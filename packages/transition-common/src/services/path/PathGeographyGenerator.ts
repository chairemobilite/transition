/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as Geojson from 'geojson';
import { MapMatchingResults, MapLeg } from 'chaire-lib-common/lib/services/routing/RoutingService';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import {
    durationFromAccelerationDecelerationDistanceAndRunningSpeed,
    kphToMps
} from 'chaire-lib-common/lib/utils/PhysicsUtils';
import Path, { type PeriodSegmentData } from './Path';
import type { TimeAndDistance, TypeNodeChange, SegmentChangeInfo } from './PathTypes';

const MIN_TRAVEL_TIME_FOR_DWELL_SECONDS = 15;

type PathTimeTotals = {
    totalDistance: number;
    totalDwellTimeSeconds: number;
    totalTravelTimeWithoutDwellTimesSeconds: number;
    totalTravelTimeWithDwellTimesSeconds: number;
    totalTravelTimeWithReturnBackSeconds: number;
};

type SegmentData = {
    segmentsData: TimeAndDistance[];
    dwellTimeDurationsSeconds: number[];
};

type ComputedSegmentData = SegmentData & {
    noDwellTimeDurationsSeconds: number[];
    ratioDifferenceTime: number;
};

type SegmentDuration = {
    /** Travel time including acceleration and deceleration phases at each stop */
    calculatedSegmentDurationSeconds: number;
    /** Travel time at constant speed without acceleration/deceleration, as if the vehicle did not stop */
    noDwellTimeDurationSeconds: number;
};

type RoutingResult = {
    points: Geojson.Feature<Geojson.Point>[];
    legs: (MapLeg | null)[];
};

/** Input parameters for computing a single segment's duration, dwell time, and time ratio. */
type ComputeSegmentDataParams = {
    path: Path;
    segmentIndex: number;
    segmentTimeAndDistance: TimeAndDistance;
    /** ID of the departure node for this segment */
    nodeId: string | undefined;
    initial: SegmentData;
    changesInfo: SegmentChangeInfo;
};

/** Output of computing a single segment's data: durations, dwell time, and ratio to previous data. */
type ComputeSegmentDataResult = {
    duration: SegmentDuration;
    /** Dwell time at the departure node of this segment (0 for the first segment) */
    dwellTimeSeconds: number;
    /** Ratio of previous travel time to calculated duration, used to scale new segments. 0 if not applicable. */
    initialToCalculatedTimeRatio: number;
    /** Whether this segment contributed a ratio (unchanged segment with previous data) */
    hasRatio: boolean;
};

/**
 * Get the coordinates from a geometry
 * @param geometry The geojson geometry
 */
const getCoordinates = (geometry: Geojson.Geometry): Geojson.Position[] => {
    if (geometry.type === 'Point') {
        return [(geometry as Geojson.Point).coordinates];
    } else if (geometry.type === 'MultiPoint') {
        return (geometry as Geojson.MultiPoint).coordinates;
    } else if (geometry.type === 'LineString') {
        return (geometry as Geojson.LineString).coordinates;
    } else if (geometry.type === 'MultiLineString') {
        const positions: Geojson.Position[] = [];
        (geometry as Geojson.MultiLineString).coordinates.forEach((coord) => positions.concat(coord));
        return positions;
    }
    return [];
};

/**
 * Adds a leg's coordinates to the path's coordinate list, skipping duplicates
 * so the same point isn't added twice in a row.
 *
 * @param leg - A routing leg containing steps with geometry
 * @param globalCoordinates - The path's coordinates so far (modified directly by this function)
 */
const appendLegCoordinates = (leg: MapLeg, globalCoordinates: Geojson.Position[]) => {
    leg.steps.forEach((step) => {
        const coordinates = getCoordinates(step.geometry);
        coordinates.forEach((coordinate) => {
            const lastCoordinate = globalCoordinates[globalCoordinates.length - 1];
            if (!lastCoordinate || lastCoordinate[0] !== coordinate[0] || lastCoordinate[1] !== coordinate[1]) {
                globalCoordinates.push(coordinate);
            }
        });
    });
};

/**
 * Calculates the travel duration for a single segment, accounting for acceleration and deceleration.
 *
 * The running speed is determined by the routing engine setting:
 * - `'engine'` or no custom speed: uses the raw routing speed (distance / duration from the router).
 * - Custom `defaultRunningSpeedKmH`: uses that fixed speed instead.
 *
 * The final `calculatedDuration` applies a physics-based model
 * (`durationFromAccelerationDecelerationDistanceAndRunningSpeed`) that factors in the vehicle's
 * acceleration and deceleration phases for the segment distance at the running speed.
 *
 * `noDwellTimeDuration` is the simpler distance/speed duration without acceleration modeling,
 * used for comparison metrics (e.g. `travelTimeWithoutDwellTimesSeconds`).
 *
 * @param path - The path object (provides acceleration, deceleration, routing engine, and speed config)
 * @param segmentDistanceMeters - Segment distance in meters (from routing engine)
 * @param routedDurationSeconds - Segment duration in seconds (from routing engine)
 * @returns `calculatedSegmentDurationSeconds` (with accel/decel) and `noDwellTimeDurationSeconds` (without)
 * @throws TrError if the calculated duration is zero or negative
 */
export const calculateSegmentDuration = (
    path: Path,
    segmentDistanceMeters: number,
    routedDurationSeconds: number
): SegmentDuration => {
    const acceleration = path.getData('defaultAcceleration') as number;
    const deceleration = path.getData('defaultDeceleration') as number;
    const routingEngine = path.getData('routingEngine') as string;
    const defaultRunningSpeedKmH = path.getData('defaultRunningSpeedKmH') as number;

    const runningSpeedMps =
        routingEngine === 'engine' || _isBlank(defaultRunningSpeedKmH)
            ? segmentDistanceMeters / routedDurationSeconds
            : kphToMps(defaultRunningSpeedKmH);

    const noDwellTimeDurationSeconds =
        routingEngine === 'engine' || _isBlank(defaultRunningSpeedKmH)
            ? routedDurationSeconds
            : segmentDistanceMeters / runningSpeedMps;

    const calculatedSegmentDurationSeconds = durationFromAccelerationDecelerationDistanceAndRunningSpeed(
        acceleration,
        deceleration,
        segmentDistanceMeters,
        runningSpeedMps
    );

    if (calculatedSegmentDurationSeconds <= 0) {
        throw new TrError(
            'Error trying to generate a path geography. There was an error while calculating segment duration.',
            'PUPDGEO0001',
            'TransitPathCannotUpdateGeographyBecauseErrorCalculatingSegmentDuration'
        );
    }

    const segmentDuration: SegmentDuration = { calculatedSegmentDurationSeconds, noDwellTimeDurationSeconds };
    return segmentDuration;
};

/**
 * Maps a current segment index to the previous segment index after a node insertion.
 *
 * When a node is inserted, one previous segment is split into two new segments. The mapping:
 * - Before `insertIndex - 1`: index is unchanged (before the split point).
 * - At `insertIndex - 1` or `insertIndex`: these are the two new segments created by the
 *   split (no previous equivalent) → returns -1.
 * - After `insertIndex`: shifted by -1 because the previous data had one fewer segment.
 *
 * @param currentSegmentIndex - The segment index in the current (post-insertion) path
 * @param insertIndex - The node index where the new node was inserted
 * @returns The corresponding previous segment index, or -1 for the newly created segments
 */
const getInitialSegmentIndexAfterInsert = (currentSegmentIndex: number, insertIndex: number): number => {
    if (currentSegmentIndex < insertIndex - 1) {
        return currentSegmentIndex;
    }
    if (currentSegmentIndex === insertIndex - 1 || currentSegmentIndex === insertIndex) {
        return -1;
    }
    return currentSegmentIndex - 1;
};

/**
 * Maps a current segment index to the previous segment index after a node removal.
 *
 * When a node is removed, its two adjacent segments merge into one new segment. The mapping:
 * - Removed node at index 0: the first previous segment disappears, so all current indices map to previous + 1.
 * - New segment at `removedNodeIndex - 1`: this is the merged segment (no previous equivalent) → returns -1.
 * - New segment at or after `removedNodeIndex`: shifted by +1 because the previous data had one extra segment.
 * - Otherwise: index is unchanged (before the removal point).
 *
 * @param currentSegmentIndex - The segment index in the current (post-removal) path
 * @param removedNodeIndex - The index of the node that was removed
 * @returns The corresponding previous segment index, or -1 for the merged segment
 */
const getInitialSegmentIndexAfterRemove = (currentSegmentIndex: number, removedNodeIndex: number): number => {
    if (removedNodeIndex === 0) {
        return currentSegmentIndex + 1;
    }
    if (currentSegmentIndex === removedNodeIndex - 1) {
        return -1;
    }

    if (currentSegmentIndex >= removedNodeIndex) {
        return currentSegmentIndex + 1;
    }
    return currentSegmentIndex;
};

/**
 * Maps a current segment index to its corresponding index in the previous segment data,
 * accounting for node insertions or removals that shift segment indices.
 *
 * - No change: returns the same index (1:1 mapping).
 * - Node insert: delegates to `getInitialSegmentIndexAfterInsert` (the new node splits a segment,
 *   so indices after the insertion point are shifted).
 * - Node remove: delegates to `getInitialSegmentIndexAfterRemove` (two segments merge into one,
 *   so indices after the removal point are shifted).
 *
 * Returns -1 when the segment has no corresponding previous segment (e.g. a newly created segment
 * from a node insertion).
 *
 * @param currentSegmentIndex - The segment index in the current path
 * @param lastNodeChange - The node change that occurred (insert/remove with index), if any
 * @returns The corresponding previous segment index, or -1 if the segment is new
 */
const getInitialSegmentIndex = (currentSegmentIndex: number, lastNodeChange?: TypeNodeChange): number => {
    if (!lastNodeChange) {
        return currentSegmentIndex;
    }
    if (lastNodeChange.type === 'insert') {
        return getInitialSegmentIndexAfterInsert(currentSegmentIndex, lastNodeChange.index);
    }
    if (lastNodeChange.type === 'remove') {
        return getInitialSegmentIndexAfterRemove(currentSegmentIndex, lastNodeChange.index);
    }
    return currentSegmentIndex;
};

/**
 * Returns the dwell time adjustment to subtract from a preserved segment's travel time.
 *
 * When previous data had no separate dwell time (GTFS baked-in), the dwell was included in the
 * segment's travel time. In that case, we subtract the current dwell time to isolate the
 * travel portion. Otherwise, no adjustment is needed.
 *
 * Exceptions where no subtraction is applied:
 * - The previous segment was the first one (initialIndex === 0): the first node always has dwell = 0,
 *   so we can't distinguish baked-in from normal.
 * - A node was inserted at the beginning: the previous first segment's departure node went from
 *   dwell = 0 (path start) to having a real dwell time — this is not baked-in.
 *
 * @param segmentIndex - The current segment index
 * @param initialIndex - The corresponding previous segment index
 * @param currentDwellTime - The current dwell time at the departure node
 * @param previous - Previous segment data (previous dwell times)
 * @param changesInfo - Info about recent node/waypoint changes
 * @returns The number of seconds to subtract from the preserved travel time
 */
const getDwellTimeAdjustment = (
    segmentIndex: number,
    initialIndex: number,
    currentDwellTime: number,
    initial: SegmentData,
    changesInfo: SegmentChangeInfo
): number => {
    // If the previous segment already had a separate dwell time, no adjustment needed
    const initialDwellTime = initialIndex > 0 ? initial.dwellTimeDurationsSeconds[initialIndex] || 0 : 0;
    if (initialDwellTime !== 0) {
        return 0;
    }
    // If a node was inserted at the beginning, the previous first segment's departure node
    // went from dwell=0 (path start) to having a real dwell time — not baked-in
    const wasOldFirstAfterInsertAtBeginning =
        changesInfo.lastNodeChange?.type === 'insert' && changesInfo.lastNodeChange?.index === 0 && segmentIndex === 1;
    if (wasOldFirstAfterInsertAtBeginning) {
        return 0;
    }
    // Dwell was baked into the previous travel time — subtract it
    return currentDwellTime;
};

/**
 * Returns the dwell time in seconds for a given node on the path.
 *
 * Looks up the node from the collection manager to get its default dwell time, then delegates
 * to `path.getDwellTimeSecondsAtNode()` which resolves the final value based on the path's
 * own dwell time configuration and the node-level default as fallback.
 *
 * @param path - The path object (provides dwell time config and access to the node collection)
 * @param nodeId - The ID of the node to get the dwell time for
 * @returns Dwell time in seconds at this node
 */
const getDwellTimeSecondsForNode = (path: Path, nodeId: unknown): number => {
    if (!nodeId) {
        return 0;
    }
    const node = path.collectionManager.get('nodes').getById(nodeId);
    const nodeDefaultDwellTimeSeconds = node?.properties?.default_dwell_time_seconds;
    return path.getDwellTimeSecondsAtNode(nodeDefaultDwellTimeSeconds);
};

/**
 * Returns the effective dwell time for a preserved segment, handling baked-in dwell detection.
 *
 * When previous data had dwell baked into travel time (dwell = 0 for a non-first node),
 * we want to unbake it — but only if the travel time is long enough to absorb the subtraction.
 * If unbaking would drop travel time below MIN_TRAVEL_TIME_FOR_DWELL_SECONDS, returns 0 to
 * keep the dwell baked in.
 *
 * @param nodeDwellTime - The current node's dwell time in seconds
 * @param initialIndex - The corresponding previous segment index
 * @param initialDwellTimes - The previous dwell time array
 * @param initialTravelTime - The previous segment's travel time in seconds
 * @returns The effective dwell time (0 if dwell should stay baked in)
 */
const getEffectiveDwellTime = (
    nodeDwellTime: number,
    initialIndex: number,
    initialDwellTimes: number[],
    initialTravelTime: number
): number => {
    const initialDwellTime = initialIndex > 0 ? initialDwellTimes[initialIndex] || 0 : 0;
    const hasBakedInDwell = initialDwellTime === 0 && initialIndex > 0;
    if (hasBakedInDwell && initialTravelTime - nodeDwellTime < MIN_TRAVEL_TIME_FOR_DWELL_SECONDS) {
        return 0;
    }
    return nodeDwellTime;
};

/**
 * Calculates the layover time at the terminus in seconds.
 *
 * If the path has a custom layover set (`customLayoverMinutes`), uses that value directly.
 * Otherwise, computes the layover as a ratio of total travel time (including dwell times),
 * with a minimum floor, both configured via user preferences.
 *
 * @param path - The path object (checked for `customLayoverMinutes` in its data)
 * @param totalTravelTimeWithDwellTimesSeconds - Total operating time used to compute the default ratio-based layover
 * @returns Layover time in seconds
 */
const calculateLayoverSeconds = (path: Path, totalTravelTimeWithDwellTimesSeconds: number): number => {
    const customLayoverMinutes: any = path.getData('customLayoverMinutes', null);
    if (!_isBlank(customLayoverMinutes)) {
        return customLayoverMinutes * 60;
    }
    return Math.max(
        Preferences.current.transit.paths.data.defaultLayoverRatioOverTotalTravelTime *
            totalTravelTimeWithDwellTimesSeconds,
        Preferences.current.transit.paths.data.defaultMinLayoverTimeSeconds
    );
};

/**
 * Assembles the final path data object from computed totals and segment data.
 *
 * Combines per-segment results with path-level totals to produce the data structure stored on the
 * path. Derives several aggregate metrics:
 * - `operatingTimeWithoutLayoverTimeSeconds`: total travel time including dwell times at stops
 * - `operatingTimeWithLayoverTimeSeconds`: adds layover time to operating time
 * - `totalTravelTimeWithReturnBackSeconds`: operating time with layover (for round-trip consideration)
 * - Average speeds: without dwell times, with dwell times (operating), and with layover
 *
 * @param segmentsData - Per-segment travel time and distance
 * @param dwellTimeDurationsSeconds - Dwell times at each node
 * @param layoverTimeSeconds - Layover (battement) time at the terminus
 * @param totals - Aggregated time and distance totals for the path
 */
const buildPathData = (
    segmentsData: TimeAndDistance[],
    dwellTimeDurationsSeconds: number[],
    layoverTimeSeconds: number,
    totals: PathTimeTotals
) => {
    return {
        segments: segmentsData,
        dwellTimeSeconds: dwellTimeDurationsSeconds,
        layoverTimeSeconds,
        travelTimeWithoutDwellTimesSeconds: totals.totalTravelTimeWithoutDwellTimesSeconds,
        totalDistanceMeters: totals.totalDistance,
        totalDwellTimeSeconds: totals.totalDwellTimeSeconds,
        operatingTimeWithoutLayoverTimeSeconds: totals.totalTravelTimeWithDwellTimesSeconds,
        operatingTimeWithLayoverTimeSeconds: totals.totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds,
        totalTravelTimeWithReturnBackSeconds: totals.totalTravelTimeWithReturnBackSeconds + layoverTimeSeconds,
        averageSpeedWithoutDwellTimesMetersPerSecond: roundToDecimals(
            totals.totalDistance / totals.totalTravelTimeWithoutDwellTimesSeconds,
            2
        ),
        operatingSpeedMetersPerSecond: roundToDecimals(
            totals.totalDistance / totals.totalTravelTimeWithDwellTimesSeconds,
            2
        ),
        operatingSpeedWithLayoverMetersPerSecond: roundToDecimals(
            totals.totalDistance / (totals.totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds),
            2
        ),
        from_gtfs: false
    };
};

/**
 * Determines whether a segment needs its travel time recalculated (scaled by the ratio)
 * rather than preserved from previous data.
 *
 * A segment is "new" when:
 * - forceRecalculate is true (full recalculation from OSRM)
 * - It has no previous travel time (created by a node insert/remove)
 * - Its waypoint was changed (route changed even though the segment existed before)
 */
const isNewSegment = (
    initialTime: number | undefined,
    segmentIndex: number,
    changesInfo: SegmentChangeInfo
): boolean => {
    if (changesInfo.forceRecalculate || initialTime === undefined) {
        return true;
    }
    return (
        changesInfo.lastWaypointChangedSegmentIndex !== undefined &&
        segmentIndex === changesInfo.lastWaypointChangedSegmentIndex
    );
};

/**
 * Computes the duration, dwell time, and `initialToCalculatedTimeRatio` for a single
 * completed segment. The first segment always has dwell time 0 (layover is separate).
 * For unchanged segments with previous data, computes the ratio of previous travel time to
 * new calculated duration, used to scale new/modified segments.
 *
 * @param params - The segment parameters (path, index, distance, duration, nodeId, previous data, changes info)
 * @returns The segment duration, dwell time, and optional time ratio for unchanged segments
 */
const computeSegmentData = (params: ComputeSegmentDataParams): ComputeSegmentDataResult => {
    const { path, segmentIndex, segmentTimeAndDistance, nodeId, initial, changesInfo } = params;

    const duration = calculateSegmentDuration(
        path,
        segmentTimeAndDistance.distanceMeters || 0,
        segmentTimeAndDistance.travelTimeSeconds
    );
    // First segment's departure is the path start — no dwell time (layover is separate)
    const nodeDwellTimeSeconds = segmentIndex === 0 ? 0 : getDwellTimeSecondsForNode(path, nodeId);

    const initialIndex = getInitialSegmentIndex(segmentIndex, changesInfo.lastNodeChange);
    const initialTime = initialIndex >= 0 ? initial.segmentsData[initialIndex]?.travelTimeSeconds : undefined;
    const isNew = isNewSegment(initialTime, segmentIndex, changesInfo);

    const dwellTimeSeconds = isNew
        ? nodeDwellTimeSeconds
        : getEffectiveDwellTime(nodeDwellTimeSeconds, initialIndex, initial.dwellTimeDurationsSeconds, initialTime!);

    let initialToCalculatedTimeRatio = 0;
    const hasRatio = !isNew;
    if (hasRatio) {
        const adjustmentDwellTime = getDwellTimeAdjustment(
            segmentIndex,
            initialIndex,
            dwellTimeSeconds,
            initial,
            changesInfo
        );
        initialToCalculatedTimeRatio = (initialTime! - adjustmentDwellTime) / duration.calculatedSegmentDurationSeconds;
    }

    return { duration, dwellTimeSeconds, initialToCalculatedTimeRatio, hasRatio };
};

/**
 * Builds the path's coordinate geometry and per-segment data from routing legs, and computes the
 * `ratioDifferenceTime` scaling factor used to adjust new/modified segment travel times.
 *
 * Iterates over routing legs (one per waypoint-to-waypoint sub-route) and aggregates them into
 * node-to-node segments. For each completed segment:
 * - Calculates duration and distance from the routing engine results.
 * - Determines dwell time at the arrival node (set to 0 if the segment is too short to justify it).
 * - For unchanged segments with previous data, accumulates the ratio of previous travel time to new
 *   calculated duration into `ratioCumulated`, which is averaged at the end to produce
 *   `ratioDifferenceTime`. This ratio captures how the user's scheduled times relate to raw
 *   routing times, so it can be applied to new/modified segments.
 *
 * A trailing segment that ends at a waypoint (not a node) is included in the geometry but excluded
 * from duration totals and ratio calculation.
 *
 * @param path - The path object (provides node IDs, speed config, dwell time settings)
 * @param routing - Routing results (points and legs between them)
 * @param previous - Previous segment data for preserving travel time ratios
 * @param changesInfo - Info about recent node/waypoint changes that affect segment mapping
 * @returns Segment geometry, per-segment time/distance data, dwell times, and the computed ratioDifferenceTime
 */
const buildSegmentsAndGeometry = (
    path: Path,
    routing: RoutingResult,
    initial: SegmentData,
    changesInfo: SegmentChangeInfo
) => {
    const globalCoordinates: Geojson.Position[] = [];
    let segmentCoordinatesStartIndex = 0;
    const segments: number[] = [];
    const segmentsData: TimeAndDistance[] = [];
    const noDwellTimeDurationsSeconds: number[] = [];
    const nodeIds = path.attributes.nodes;
    const dwellTimeDurationsSeconds: number[] = [];
    let nextNodeIndex = 1;
    let segmentTimeAndDistance: TimeAndDistance = { travelTimeSeconds: 0, distanceMeters: 0 };
    let ratioCumulated = 0;
    let numberOfSegmentsCumulated = 0;

    for (let i = 0; i < routing.legs.length; i++) {
        const leg = routing.legs[i];
        const nextIsNode = routing.points[i + 1].properties?.isNode;
        if (!leg) {
            continue;
        }

        // A segment can have many coordinates; when we reach a node, mark the
        // start of the next segment at the current end of globalCoordinates.
        if (routing.points[i].properties?.isNode && globalCoordinates.length > 0) {
            segmentCoordinatesStartIndex = globalCoordinates.length - 1;
        }

        appendLegCoordinates(leg, globalCoordinates);

        segmentTimeAndDistance.travelTimeSeconds += leg.duration;
        segmentTimeAndDistance.distanceMeters = (segmentTimeAndDistance.distanceMeters || 0) + Math.ceil(leg.distance);

        // Path cannot finish at a waypoint, so this last segment is not part of the total calculations.
        if (i === routing.legs.length - 1 && !nodeIds[nextNodeIndex]) {
            segments.push(segmentCoordinatesStartIndex);
            segmentsData.push(segmentTimeAndDistance);
            break;
        }
        // Next point is a waypoint, not a node — still accumulating the same segment.
        if (!nextIsNode || !nodeIds[nextNodeIndex]) {
            continue;
        }

        const segmentIndex = segments.length;
        const segmentParams: ComputeSegmentDataParams = {
            path,
            segmentIndex,
            segmentTimeAndDistance,
            nodeId: nodeIds[nextNodeIndex - 1],
            initial,
            changesInfo
        };
        const result = computeSegmentData(segmentParams);

        if (result.hasRatio) {
            numberOfSegmentsCumulated++;
            ratioCumulated += result.initialToCalculatedTimeRatio;
        }

        segments.push(segmentCoordinatesStartIndex);
        segmentsData.push({
            travelTimeSeconds: result.duration.calculatedSegmentDurationSeconds,
            distanceMeters: segmentTimeAndDistance.distanceMeters
        });
        noDwellTimeDurationsSeconds.push(result.duration.noDwellTimeDurationSeconds);
        dwellTimeDurationsSeconds.push(result.dwellTimeSeconds);
        // reset for next segment:
        segmentTimeAndDistance = { travelTimeSeconds: 0, distanceMeters: 0 };
        nextNodeIndex++;
    }

    // Add dwell time for the last (arrival) node
    const lastNodeId = nodeIds[nextNodeIndex - 1];
    dwellTimeDurationsSeconds.push(getDwellTimeSecondsForNode(path, lastNodeId));

    const ratioDifferenceTime = numberOfSegmentsCumulated > 0 ? ratioCumulated / numberOfSegmentsCumulated : 1;

    return {
        globalCoordinates,
        segments,
        segmentsData,
        noDwellTimeDurationsSeconds,
        dwellTimeDurationsSeconds,
        ratioDifferenceTime
    };
};

/**
 * Adjusts a single segment's travel time, either preserving the previous value or recalculating it.
 *
 * - **Preserved**: If the segment existed before and was not modified, the previous travel time is reused.
 *   When the previous data had no separate dwell time (GTFS baked-in) and the segment was not the first one,
 *   the departure node's dwell time is subtracted to isolate the travel portion. Exception: when a node
 *   was inserted at the beginning, the previous first segment's departure node gained a dwell time it didn't
 *   have before (was path start), so no subtraction is applied.
 * - **Recalculated**: If the segment is new, modified, or has no previous data, its travel time is
 *   scaled by `ratioDifferenceTime`.
 *
 * @param segmentIndex - The current segment index
 * @param current - Current routing results (segments, durations, dwell times, scaling ratio)
 * @param previous - Previous segment data used to preserve unchanged travel times
 * @param changesInfo - Info about recent node/waypoint changes that affect segment mapping
 */
const adjustSegmentTime = (
    segmentIndex: number,
    current: ComputedSegmentData,
    initial: SegmentData,
    changesInfo: SegmentChangeInfo
) => {
    const initialIndex = getInitialSegmentIndex(segmentIndex, changesInfo.lastNodeChange);
    const initialTime = initialIndex >= 0 ? initial.segmentsData[initialIndex]?.travelTimeSeconds : undefined;
    if (!isNewSegment(initialTime, segmentIndex, changesInfo)) {
        // Unchanged segment: preserve the previous travel time, subtracting any baked-in dwell time
        const adjustment = getDwellTimeAdjustment(
            segmentIndex,
            initialIndex,
            current.dwellTimeDurationsSeconds[segmentIndex],
            initial,
            changesInfo
        );
        current.segmentsData[segmentIndex].travelTimeSeconds = initialTime! - adjustment;
    } else {
        // New or modified segment: scale the routing-calculated time by the ratio from existing data
        current.segmentsData[segmentIndex].travelTimeSeconds =
            current.segmentsData[segmentIndex].travelTimeSeconds * current.ratioDifferenceTime;
    }
};

/**
 * Adds a single segment's distance, travel time, and dwell time to the running totals.
 *
 * @param segmentIndex - The current segment index
 * @param current - Current routing results (segments, durations, dwell times)
 * @param totals - The running totals to accumulate into (modified in place)
 */
const accumulateSegmentTotals = (segmentIndex: number, current: ComputedSegmentData, totals: PathTimeTotals) => {
    const dwellTime = current.dwellTimeDurationsSeconds[segmentIndex + 1] || 0;
    const travelTime = current.segmentsData[segmentIndex].travelTimeSeconds;
    totals.totalDistance += current.segmentsData[segmentIndex].distanceMeters || 0;
    totals.totalTravelTimeWithDwellTimesSeconds += travelTime + dwellTime;
    totals.totalTravelTimeWithoutDwellTimesSeconds += current.noDwellTimeDurationsSeconds[segmentIndex];
    totals.totalDwellTimeSeconds += dwellTime;
    totals.totalTravelTimeWithReturnBackSeconds += travelTime + dwellTime;
};

/**
 * Adjusts segment travel times via {@link adjustSegmentTime} and computes path-level totals
 * (distance, travel time, dwell time, layover). Returns the full path data object.
 *
 * @param path - The path object (used for layover calculation)
 * @param current - Current routing results (segments, durations, dwell times, scaling ratio)
 * @param previous - Previous segment data used to preserve unchanged travel times
 * @param changesInfo - Info about recent node/waypoint changes that affect segment mapping
 * @returns The assembled path data with segments, totals, and speeds
 */
const adjustTimesAndComputeTotals = (
    path: Path,
    current: ComputedSegmentData,
    initial: SegmentData,
    changesInfo: SegmentChangeInfo
) => {
    const totals: PathTimeTotals = {
        totalDistance: 0,
        totalDwellTimeSeconds: 0,
        totalTravelTimeWithoutDwellTimesSeconds: 0,
        totalTravelTimeWithDwellTimesSeconds: 0,
        totalTravelTimeWithReturnBackSeconds: 0
    };

    const segmentCount = current.noDwellTimeDurationsSeconds.length;
    for (let currentSegmentIndex = 0; currentSegmentIndex < segmentCount; currentSegmentIndex++) {
        adjustSegmentTime(currentSegmentIndex, current, initial, changesInfo);
        accumulateSegmentTotals(currentSegmentIndex, current, totals);
    }

    const layoverTimeSeconds = calculateLayoverSeconds(path, totals.totalTravelTimeWithDwellTimesSeconds);

    return buildPathData(current.segmentsData, current.dwellTimeDurationsSeconds, layoverTimeSeconds, totals);
};

/**
 * Remaps a single period/service segment data entry after a path edit.
 *
 * Mirrors the base segment logic in {@link buildSegmentsAndGeometry} / {@link adjustSegmentTime},
 * but applied to period-specific travel times independently.
 *
 * Two-pass approach:
 * 1. **Ratio pass**: For each unchanged segment, compute `periodTravelTime / physicsDuration` and
 *    average across all unchanged segments. This gives the period-specific congestion factor
 *    (e.g., AM peak might be 1.4x while off-peak is 1.0x).
 * 2. **Build pass**: For each segment in the new path:
 *    - **Preserved**: Reuse the period's original travel time, minus a dwell adjustment if dwell
 *      was baked into the travel time (see {@link getEffectiveDwellTime}).
 *    - **New**: Scale the physics duration by the period ratio computed in pass 1.
 *
 * Dwell times are resolved from node defaults via {@link getDwellTimeSecondsForNode}, with
 * baked-in dwell detection checked against the period's initial dwell data.
 * Aggregates (travel time, operating time, speeds) are recomputed from the remapped segments.
 * `tripCount` is preserved unchanged (editing the path doesn't change how many trips ran).
 *
 * If all segments are new (no unchanged segments to compute a ratio from), the ratio defaults
 * to 1.0 — new segments get pure physics durations with no congestion adjustment.
 *
 * @param path - The path object (provides node IDs, dwell time config, node collection)
 * @param initialPeriod - The period/service data from before the edit
 * @param physicsDurations - Per-segment travel times from the physics model, before ratio scaling
 * @param newSegmentsData - Per-segment distance/time from the new routing result
 * @param changesInfo - Info about the node/waypoint change that triggered the remap
 * @returns The remapped period data with updated segments, dwell times, and recomputed aggregates
 */
const remapPeriodSegmentData = (
    path: Path,
    initialPeriod: PeriodSegmentData,
    physicsDurations: number[],
    newSegmentsData: TimeAndDistance[],
    changesInfo: SegmentChangeInfo
): PeriodSegmentData => {
    const segmentCount = physicsDurations.length;
    const nodeIds = path.attributes.nodes;

    const periodInitial: SegmentData = {
        segmentsData: initialPeriod.segments,
        dwellTimeDurationsSeconds: initialPeriod.dwellTimeSeconds
    };

    // Calculate the period's ratio
    let ratioCumulated = 0;
    let ratioCount = 0;

    for (let i = 0; i < segmentCount; i++) {
        const initialIndex = getInitialSegmentIndex(i, changesInfo.lastNodeChange);
        const initialTime = initialIndex >= 0 ? initialPeriod.segments[initialIndex]?.travelTimeSeconds : undefined;

        if (!isNewSegment(initialTime, i, changesInfo)) {
            const nodeDwell = i === 0 ? 0 : getDwellTimeSecondsForNode(path, nodeIds[i]);
            const dwellTime = getEffectiveDwellTime(
                nodeDwell,
                initialIndex,
                periodInitial.dwellTimeDurationsSeconds,
                initialTime!
            );
            const adjustment = getDwellTimeAdjustment(i, initialIndex, dwellTime, periodInitial, changesInfo);
            ratioCumulated += (initialTime! - adjustment) / physicsDurations[i];
            ratioCount++;
        }
    }

    const periodRatio = ratioCount > 0 ? ratioCumulated / ratioCount : 1;

    // Build remapped segments and dwell times
    const remappedSegments: TimeAndDistance[] = [];
    const remappedDwellTimes: number[] = [];

    for (let i = 0; i < segmentCount; i++) {
        const initialIndex = getInitialSegmentIndex(i, changesInfo.lastNodeChange);
        const initialTime = initialIndex >= 0 ? initialPeriod.segments[initialIndex]?.travelTimeSeconds : undefined;
        const isNew = isNewSegment(initialTime, i, changesInfo);

        let dwellTime: number;
        let travelTimeSeconds: number;

        if (!isNew) {
            const nodeDwell = i === 0 ? 0 : getDwellTimeSecondsForNode(path, nodeIds[i]);
            dwellTime = getEffectiveDwellTime(
                nodeDwell,
                initialIndex,
                periodInitial.dwellTimeDurationsSeconds,
                initialTime!
            );
            const adjustment = getDwellTimeAdjustment(i, initialIndex, dwellTime, periodInitial, changesInfo);
            travelTimeSeconds = initialTime! - adjustment;
        } else {
            dwellTime = i === 0 ? 0 : getDwellTimeSecondsForNode(path, nodeIds[i]);
            travelTimeSeconds = physicsDurations[i] * periodRatio;
        }

        remappedSegments.push({ travelTimeSeconds, distanceMeters: newSegmentsData[i].distanceMeters });
        remappedDwellTimes.push(dwellTime);
    }

    remappedDwellTimes.push(getDwellTimeSecondsForNode(path, nodeIds[nodeIds.length - 1]));

    const travelTimeWithoutDwellTimesSeconds = remappedSegments.reduce((sum, seg) => sum + seg.travelTimeSeconds, 0);
    const totalDwellTimeSeconds = remappedDwellTimes.reduce((sum, d) => sum + d, 0);
    const operatingTimeWithoutLayoverTimeSeconds = travelTimeWithoutDwellTimesSeconds + totalDwellTimeSeconds;
    const totalDistanceMeters = remappedSegments.reduce((sum, seg) => sum + (seg.distanceMeters || 0), 0);

    return {
        segments: remappedSegments,
        dwellTimeSeconds: remappedDwellTimes,
        travelTimeWithoutDwellTimesSeconds,
        operatingTimeWithoutLayoverTimeSeconds,
        averageSpeedWithoutDwellTimesMetersPerSecond:
            travelTimeWithoutDwellTimesSeconds > 0
                ? Math.round((totalDistanceMeters / travelTimeWithoutDwellTimesSeconds) * 100) / 100
                : 0,
        operatingSpeedMetersPerSecond:
            operatingTimeWithoutLayoverTimeSeconds > 0
                ? Math.round((totalDistanceMeters / operatingTimeWithoutLayoverTimeSeconds) * 100) / 100
                : 0,
        tripCount: initialPeriod.tripCount
    };
};

/**
 * Remaps all period/service segment data entries after a path edit.
 * Each period/service is remapped independently with its own ratio.
 */
const remapAllPeriodSegmentData = (
    path: Path,
    initialPeriodData: { [periodShortname: string]: { [serviceId: string]: PeriodSegmentData } },
    physicsDurations: number[],
    newSegmentsData: TimeAndDistance[],
    changesInfo: SegmentChangeInfo
): { [periodShortname: string]: { [serviceId: string]: PeriodSegmentData } } => {
    const result: { [periodShortname: string]: { [serviceId: string]: PeriodSegmentData } } = {};

    for (const periodShortname of Object.keys(initialPeriodData)) {
        result[periodShortname] = {};
        for (const serviceId of Object.keys(initialPeriodData[periodShortname])) {
            result[periodShortname][serviceId] = remapPeriodSegmentData(
                path,
                initialPeriodData[periodShortname][serviceId],
                physicsDurations,

                newSegmentsData,
                changesInfo
            );
        }
    }

    return result;
};

/**
 * Orchestrates the path geography update from routing results.
 *
 * Delegates to {@link buildSegmentsAndGeometry} to produce the new geometry and per-segment
 * data, and {@link adjustTimesAndComputeTotals} to finalize travel times and compute
 * path-level totals. Updates the path's geography, segments, and data attributes in place.
 *
 * @param path - The path object to update
 * @param routing - Routing results (matched points and legs between them)
 * @param changesInfo - Info about recent node/waypoint changes that affect segment mapping
 */
const handleLegs = (path: Path, routing: RoutingResult, changesInfo: SegmentChangeInfo) => {
    const initial: SegmentData = {
        segmentsData: path.attributes.data.segments || [],
        dwellTimeDurationsSeconds: path.attributes.data.dwellTimeSeconds || []
    };
    const initialPeriodData = path.attributes.data.segmentsByPeriodAndService;

    const geometryResult = buildSegmentsAndGeometry(path, routing, initial, changesInfo);

    const realSegmentCount = geometryResult.noDwellTimeDurationsSeconds.length;

    // Per-segment travel times from physics model (acc./dec./speed), before ratio scaling
    const physicsDurations = geometryResult.segmentsData.slice(0, realSegmentCount).map((s) => s.travelTimeSeconds);

    const current: ComputedSegmentData = {
        segmentsData: geometryResult.segmentsData,
        noDwellTimeDurationsSeconds: geometryResult.noDwellTimeDurationsSeconds,
        dwellTimeDurationsSeconds: geometryResult.dwellTimeDurationsSeconds,
        ratioDifferenceTime: geometryResult.ratioDifferenceTime
    };
    const newData = adjustTimesAndComputeTotals(path, current, initial, changesInfo);

    // Remap period segment data or clear it on forceRecalculate
    if (initialPeriodData && !changesInfo.forceRecalculate) {
        (newData as any).segmentsByPeriodAndService = remapAllPeriodSegmentData(
            path,
            initialPeriodData,
            physicsDurations,
            geometryResult.segmentsData.slice(0, realSegmentCount),
            changesInfo
        );
    } else if (initialPeriodData) {
        (newData as any).segmentsByPeriodAndService = undefined;
    }

    path.set('geography', { type: 'LineString', coordinates: geometryResult.globalCoordinates });
    path.attributes.segments = geometryResult.segments;
    path.attributes.data = Object.assign(path.attributes.data, newData);
};

/**
 * Generate the path geography from the routing result data. The following
 * attributes and data in the path will be updated:
 *
 * * The 'geography' attribute is a LineString passing by all coordinates in the
 *   result steps
 * * The 'segments' attributes contain an array of the index in the geography's
 *   LineString where each segment of the path starts.
 * * The path's data is updated with the computed path's geography:
 * ** segments: an array containing the travelTimeSeconds and distanceMeters of each segment.
 * ** dwellTimeSeconds
 * ** layoverTimeSeconds
 * ** travelTimeWithoutDwellTimesSeconds
 * ** totalDistanceMeters
 * ** totalDwellTimeSeconds
 * ** operatingTimeWithoutLayoverTimeSeconds
 * ** operatingTimeWithLayoverTimeSeconds
 * ** totalTravelTimeWithReturnBackSeconds
 * ** averageSpeedWithoutDwellTimesMetersPerSecond
 * ** operatingSpeedMetersPerSecond
 * ** operatingSpeedWithLayoverMetersPerSecond
 *
 * @param path The path object to update
 * @param points The points by which the generated path will pass and between
 * the various segments were calculated
 * @param segmentResults The geography results
 * @param changesInfo Info about recent node/waypoint changes that affect segment mapping
 */
export const generatePathGeographyFromRouting = (
    path: any,
    points: Geojson.FeatureCollection<Geojson.Point>,
    segmentResults: MapMatchingResults[],
    changesInfo: SegmentChangeInfo = {}
) => {
    const legResults: (MapLeg | null)[] = [];
    let currentPointIndex = 0;
    const errors: { index: number; error: string }[] = [];

    segmentResults.forEach((segmentResult) => {
        let hasError = false;
        for (let i = 0; i < segmentResult.tracepoints.length - 1; i++) {
            if (segmentResult.tracepoints[i] === null) {
                errors.push({ index: currentPointIndex, error: 'RoutingDidNotMatchError' });
                hasError = true;
            }
            legResults[currentPointIndex] = hasError ? null : segmentResult.matchings[0].legs[i];
            currentPointIndex++;
        }
    });

    // Handle errors
    if (errors.length !== 0) {
        path.attributes.data.routingFailed = true;
        const nodesWithErrors: Geojson.Feature[] = [];
        const waypointsWithErrors: Geojson.Feature[] = [];
        for (let i = 0; i < errors.length; i++) {
            const problematicPoint = points.features[errors[i].index];
            if (problematicPoint.properties?.isNode) {
                nodesWithErrors.push(problematicPoint);
            } else {
                waypointsWithErrors.push(problematicPoint);
            }
        }
        path.attributes.data.geographyErrors = { nodes: nodesWithErrors, waypoints: waypointsWithErrors };
        throw new TrError(
            'Error trying to generate a path geography. Some leg did not return any result',
            'PUPDGEO0002',
            'TransitPathCannotUpdateGeographyBecauseAtLeastOneLegWithNoResult'
        );
    }

    try {
        const routing: RoutingResult = { points: points.features, legs: legResults };
        handleLegs(path, routing, changesInfo);
    } catch (error) {
        throw new TrError(
            'Error trying to generate a path geography:' + error,
            'PUPDGEO0003',
            'TransitPathCannotUpdateGeographyBecauseAtLeastOneLegWithNoResult'
        );
    }
};

export default generatePathGeographyFromRouting;
