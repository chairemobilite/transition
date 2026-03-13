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
import Path, { TimeAndDistance, TypeNodeChange } from './Path';

const MIN_TRAVEL_TIME_FOR_DWELL_SECONDS = 15;

type PathTimeTotals = {
    totalDistance: number;
    totalDwellTimeSeconds: number;
    totalTravelTimeWithoutDwellTimesSeconds: number;
    totalTravelTimeWithDwellTimesSeconds: number;
    totalTravelTimeWithReturnBackSeconds: number;
};

type CurrentSegmentData = {
    segmentsData: TimeAndDistance[];
    noDwellTimeDurationsSeconds: number[];
    dwellTimeDurationsSeconds: number[];
    ratioDifferenceTime: number;
};

type PreviousSegmentData = {
    oldSegmentsData: TimeAndDistance[];
    oldDwellTimesData: number[];
};

type SegmentChangeInfo = {
    lastNodeChange?: TypeNodeChange;
    changedSegmentIndex?: number;
};

type StopTimes = {
    dwellTimeDurationsSeconds: number[];
    layoverTimeSeconds: number;
};

type SegmentDuration = {
    calculatedDurationSeconds: number;
    noDwellTimeDurationSeconds: number;
};

type RoutingResult = {
    points: Geojson.Feature<Geojson.Point>[];
    legs: (MapLeg | null)[];
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
 * @returns `calculatedDuration` (with accel/decel) and `noDwellTimeDuration` (without)
 * @throws TrError if the calculated duration is zero or negative
 */
const calculateSegmentDuration = (
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

    const calculatedSegmentDurationSeconds = Math.ceil(
        durationFromAccelerationDecelerationDistanceAndRunningSpeed(
            acceleration,
            deceleration,
            segmentDistanceMeters,
            runningSpeedMps
        )
    );
    const calculatedDurationSeconds = calculatedSegmentDurationSeconds !== null ? calculatedSegmentDurationSeconds : -1;

    if (calculatedDurationSeconds <= 0) {
        throw new TrError(
            'Error trying to generate a path geography. There was an error while calculating segment duration.',
            'PUPDGEO0001',
            'TransitPathCannotUpdateGeographyBecauseErrorCalculatingSegmentDuration'
        );
    }

    const segmentDuration: SegmentDuration = { calculatedDurationSeconds, noDwellTimeDurationSeconds };
    return segmentDuration;
};

/**
 * Maps a current segment index to the old segment index after a node insertion.
 *
 * When a node is inserted, one old segment is split into two new segments. The mapping:
 * - Before `insertIndex - 1`: index is unchanged (before the split point).
 * - At `insertIndex - 1` or `insertIndex`: these are the two new segments created by the
 *   split (no old equivalent) → returns -1.
 * - After `insertIndex`: shifted by -1 because the old data had one fewer segment.
 *
 * @param newSegmentIndex - The segment index in the current (post-insertion) path
 * @param insertIndex - The node index where the new node was inserted
 * @returns The corresponding old segment index, or -1 for the newly created segments
 */
const getOldSegmentIndexForInsert = (newSegmentIndex: number, insertIndex: number): number => {
    if (newSegmentIndex < insertIndex - 1) {
        return newSegmentIndex;
    }
    if (newSegmentIndex === insertIndex - 1 || newSegmentIndex === insertIndex) {
        return -1;
    }
    return newSegmentIndex - 1;
};

/**
 * Maps a current segment index to the old segment index after a node removal.
 *
 * When a node is removed, its two adjacent segments merge into one new segment. The mapping:
 * - Removed node at index 0: the first old segment disappears, so all new indices map to old + 1.
 * - New segment at `removedNodeIndex - 1`: this is the merged segment (no old equivalent) → returns -1.
 * - New segment at or after `removedNodeIndex`: shifted by +1 because the old data had one extra segment.
 * - Otherwise: index is unchanged (before the removal point).
 *
 * @param newSegmentIndex - The segment index in the current (post-removal) path
 * @param removedNodeIndex - The index of the node that was removed
 * @returns The corresponding old segment index, or -1 for the merged segment
 */
const getOldSegmentIndexForRemove = (newSegmentIndex: number, removedNodeIndex: number): number => {
    if (removedNodeIndex === 0) {
        return newSegmentIndex + 1;
    }
    if (newSegmentIndex === removedNodeIndex - 1) {
        return -1;
    }

    if (newSegmentIndex >= removedNodeIndex) {
        return newSegmentIndex + 1;
    }
    return newSegmentIndex;
};

/**
 * Maps a current segment index to its corresponding index in the previous segment data,
 * accounting for node insertions or removals that shift segment indices.
 *
 * - No change: returns the same index (1:1 mapping).
 * - Node insert: delegates to `getOldSegmentIndexForInsert` (the new node splits a segment,
 *   so indices after the insertion point are shifted).
 * - Node remove: delegates to `getOldSegmentIndexForRemove` (two segments merge into one,
 *   so indices after the removal point are shifted).
 *
 * Returns -1 when the segment has no corresponding old segment (e.g. a newly created segment
 * from a node insertion).
 *
 * @param newSegmentIndex - The segment index in the current path
 * @param lastNodeChange - The node change that occurred (insert/remove with index), if any
 * @returns The corresponding old segment index, or -1 if the segment is new
 */
const getOldSegmentIndex = (newSegmentIndex: number, lastNodeChange?: TypeNodeChange): number => {
    if (!lastNodeChange) {
        return newSegmentIndex;
    }
    if (lastNodeChange.type === 'insert') {
        return getOldSegmentIndexForInsert(newSegmentIndex, lastNodeChange.index);
    }
    if (lastNodeChange.type === 'remove') {
        return getOldSegmentIndexForRemove(newSegmentIndex, lastNodeChange.index);
    }
    return newSegmentIndex;
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
    const node = path.collectionManager.get('nodes').getById(nodeId);
    const nodeDefaultDwellTimeSeconds = node?.properties?.default_dwell_time_seconds;
    return path.getDwellTimeSecondsAtNode(nodeDefaultDwellTimeSeconds);
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
 * @param stopTimes - Dwell times at each node and layover time at the terminus
 * @param totals - Aggregated time and distance totals for the path
 */
const buildPathData = (segmentsData: TimeAndDistance[], stopTimes: StopTimes, totals: PathTimeTotals) => {
    return {
        segments: segmentsData,
        dwellTimeSeconds: stopTimes.dwellTimeDurationsSeconds,
        layoverTimeSeconds: stopTimes.layoverTimeSeconds,
        travelTimeWithoutDwellTimesSeconds: totals.totalTravelTimeWithoutDwellTimesSeconds,
        totalDistanceMeters: totals.totalDistance,
        totalDwellTimeSeconds: totals.totalDwellTimeSeconds,
        operatingTimeWithoutLayoverTimeSeconds: totals.totalTravelTimeWithDwellTimesSeconds,
        operatingTimeWithLayoverTimeSeconds: totals.totalTravelTimeWithDwellTimesSeconds + stopTimes.layoverTimeSeconds,
        totalTravelTimeWithReturnBackSeconds:
            totals.totalTravelTimeWithReturnBackSeconds + stopTimes.layoverTimeSeconds,
        averageSpeedWithoutDwellTimesMetersPerSecond: roundToDecimals(
            totals.totalDistance / totals.totalTravelTimeWithoutDwellTimesSeconds,
            2
        ),
        operatingSpeedMetersPerSecond: roundToDecimals(
            totals.totalDistance / totals.totalTravelTimeWithDwellTimesSeconds,
            2
        ),
        operatingSpeedWithLayoverMetersPerSecond: roundToDecimals(
            totals.totalDistance / (totals.totalTravelTimeWithDwellTimesSeconds + stopTimes.layoverTimeSeconds),
            2
        ),
        from_gtfs: false
    };
};

/**
 * Builds the path's coordinate geometry and per-segment data from routing legs, and computes the
 * `ratioDifferenceTime` scaling factor used to adjust new/modified segment travel times.
 *
 * Iterates over routing legs (one per waypoint-to-waypoint sub-route) and aggregates them into
 * node-to-node segments. For each completed segment:
 * - Calculates duration and distance from the routing engine results.
 * - Determines dwell time at the arrival node (set to 0 if the segment is too short to justify it).
 * - For unchanged segments with previous data, accumulates the ratio of old travel time to new
 *   calculated duration into `ratioCulminate`, which is averaged at the end to produce
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
    previous: PreviousSegmentData,
    changesInfo: SegmentChangeInfo
) => {
    const globalCoordinates: Geojson.Position[] = [];
    let segmentCoordinatesStartIndex = 0;
    const segments: number[] = [];
    const segmentsData: TimeAndDistance[] = [];
    const noDwellTimeDurationsSeconds: number[] = [];
    const nodeIds = path.get('nodes', []);
    const dwellTimeDurationsSeconds = [0]; // 0 for the first node, we calculate layover separately
    let nextNodeIndex = 1;
    let segmentDurationSeconds = 0;
    let segmentDistanceMeters = 0;
    let ratioCulminate = 0;
    let numberOfSegmentsCulminated = 0;

    for (let i = 0; i < routing.legs.length; i++) {
        const leg = routing.legs[i];
        const nextIsNode = routing.points[i + 1].properties?.isNode;
        if (!leg) {
            continue;
        }

        if (routing.points[i].properties?.isNode) {
            segmentCoordinatesStartIndex = globalCoordinates.length > 0 ? globalCoordinates.length - 1 : 0;
        }

        appendLegCoordinates(leg, globalCoordinates);

        segmentDurationSeconds += Math.ceil(leg.duration);
        segmentDistanceMeters += Math.ceil(leg.distance);

        // Path cannot finish at a waypoint, so this last segment is not part of the total calculations.
        if (i === routing.legs.length - 1 && !(nodeIds as any[])[nextNodeIndex]) {
            segments.push(segmentCoordinatesStartIndex);
            segmentsData.push({ travelTimeSeconds: segmentDurationSeconds, distanceMeters: segmentDistanceMeters });
        } else if (nextIsNode && (nodeIds as any[])[nextNodeIndex]) {
            const duration: SegmentDuration = calculateSegmentDuration(
                path,
                segmentDistanceMeters,
                segmentDurationSeconds
            );
            const nodeDwellTimeSeconds = getDwellTimeSecondsForNode(path, (nodeIds as any[])[nextNodeIndex]);

            const segmentIndex = segments.length;
            const oldIndex = getOldSegmentIndex(segmentIndex, changesInfo.lastNodeChange);
            const previousTime = oldIndex >= 0 ? previous.oldSegmentsData[oldIndex]?.travelTimeSeconds : undefined;
            const oldDwellTime = oldIndex > 0 ? previous.oldDwellTimesData[oldIndex] || 0 : 0;
            // When an old segment had no separate dwell time (e.g. GTFS where dwell was baked into travel time),
            // only set a dwell if the segment is long enough — otherwise we'd shorten the travel time.
            // For new segments or segments that already had a dwell time, always use the node's dwell time.
            const hasBakedInDwell = previousTime !== undefined && oldDwellTime === 0 && oldIndex > 0;
            const dwellTimeSeconds =
                hasBakedInDwell && previousTime - nodeDwellTimeSeconds < MIN_TRAVEL_TIME_FOR_DWELL_SECONDS
                    ? 0
                    : nodeDwellTimeSeconds;
            const isChangedSegment =
                changesInfo.changedSegmentIndex !== undefined && segmentIndex === changesInfo.changedSegmentIndex;
            if (previousTime && !isChangedSegment) {
                // When a node was inserted at the beginning, the old first segment's departure node
                // went from dwell=0 (path start) to having a real dwell time. Don't subtract in that case.
                const wasOldFirstAfterInsertAtBeginning =
                    changesInfo.lastNodeChange?.type === 'insert' &&
                    changesInfo.lastNodeChange?.index === 0 &&
                    segmentIndex === 1;
                const dwellTimeAdjustment =
                    oldDwellTime === 0 && !wasOldFirstAfterInsertAtBeginning ? dwellTimeSeconds : 0;
                numberOfSegmentsCulminated++;
                ratioCulminate += (previousTime - dwellTimeAdjustment) / duration.calculatedDurationSeconds;
            }

            segments.push(segmentCoordinatesStartIndex);
            segmentsData.push({
                travelTimeSeconds: duration.calculatedDurationSeconds,
                distanceMeters: segmentDistanceMeters
            });
            noDwellTimeDurationsSeconds.push(duration.noDwellTimeDurationSeconds);
            dwellTimeDurationsSeconds.push(dwellTimeSeconds);
            // reset for next segment:
            segmentDurationSeconds = 0;
            segmentDistanceMeters = 0;
            nextNodeIndex++;
        }
    }

    const ratioDifferenceTime = numberOfSegmentsCulminated > 0 ? ratioCulminate / numberOfSegmentsCulminated : 1;

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
 * Adjusts segment travel times and computes path-level totals (distance, travel time, dwell time, layover).
 *
 * For each segment, the travel time is either preserved from the previous data or recalculated:
 * - **Preserved**: If the segment existed before and was not modified (unchanged geometry), the old
 *   travel time is reused. When the old data had no separate dwell time (oldDwellTime === 0), the
 *   dwell time was baked into travelTimeSeconds, so the current dwell time is subtracted to isolate
 *   the travel portion.
 * - **Recalculated**: If the segment is new (node insert), modified (waypoint change), or has no
 *   previous data, its travel time is scaled by `ratioDifferenceTime` (ratio of scheduled time to
 *   routed time from the path's existing data).
 *
 * After adjusting all segment times, computes and returns the full path data including totals and
 * layover time.
 *
 * @param path - The path object (used for layover calculation and speed config)
 * @param current - Current routing results (segments, durations, dwell times, scaling ratio)
 * @param previous - Previous segment data used to preserve unchanged travel times
 * @param changesInfo - Info about recent node/waypoint changes that affect segment mapping
 */
const adjustTimesAndComputeTotals = (
    path: Path,
    current: CurrentSegmentData,
    previous: PreviousSegmentData,
    changesInfo: SegmentChangeInfo
) => {
    let totalDistance = 0;
    let totalDwellTimeSeconds = 0;
    let totalTravelTimeWithoutDwellTimesSeconds = 0;
    let totalTravelTimeWithDwellTimesSeconds = 0;
    let totalTravelTimeWithReturnBackSeconds = 0;

    for (let s = 0; s < current.segmentsData.length; s++) {
        // Skip the last segment if it ends at a waypoint (not a node) — it's not part of the totals
        if (s >= current.noDwellTimeDurationsSeconds.length) {
            break;
        }
        const oldIndex = getOldSegmentIndex(s, changesInfo.lastNodeChange);
        const previousTime = oldIndex >= 0 ? previous.oldSegmentsData[oldIndex]?.travelTimeSeconds : undefined;
        const isChangedSegment = changesInfo.changedSegmentIndex !== undefined && s === changesInfo.changedSegmentIndex;
        if (previousTime !== undefined && !isChangedSegment) {
            const oldDwellTime = oldIndex > 0 ? previous.oldDwellTimesData[oldIndex] || 0 : 0;
            // When a node was inserted at the beginning, the old first segment's departure node
            // went from dwell=0 (path start) to having a real dwell time. Don't subtract in that case.
            const wasOldFirstAfterInsertAtBeginning =
                changesInfo.lastNodeChange?.type === 'insert' && changesInfo.lastNodeChange?.index === 0 && s === 1;
            const shouldSubtractDwell = oldDwellTime === 0 && !wasOldFirstAfterInsertAtBeginning;
            current.segmentsData[s].travelTimeSeconds = Math.ceil(
                shouldSubtractDwell ? previousTime - current.dwellTimeDurationsSeconds[s] : previousTime
            );
        } else {
            current.segmentsData[s].travelTimeSeconds = Math.ceil(
                current.segmentsData[s].travelTimeSeconds * current.ratioDifferenceTime
            );
        }
        const dwellTime = current.dwellTimeDurationsSeconds[s + 1] || 0;
        totalDistance += current.segmentsData[s].distanceMeters || 0;
        totalTravelTimeWithDwellTimesSeconds += current.segmentsData[s].travelTimeSeconds + dwellTime;
        totalTravelTimeWithoutDwellTimesSeconds += current.noDwellTimeDurationsSeconds[s];
        totalDwellTimeSeconds += dwellTime;
        totalTravelTimeWithReturnBackSeconds += current.segmentsData[s].travelTimeSeconds + dwellTime;
    }

    const layoverTimeSeconds = calculateLayoverSeconds(path, totalTravelTimeWithDwellTimesSeconds);

    const totals: PathTimeTotals = {
        totalDistance,
        totalDwellTimeSeconds,
        totalTravelTimeWithoutDwellTimesSeconds,
        totalTravelTimeWithDwellTimesSeconds,
        totalTravelTimeWithReturnBackSeconds
    };

    const stopTimes: StopTimes = { dwellTimeDurationsSeconds: current.dwellTimeDurationsSeconds, layoverTimeSeconds };

    return buildPathData(current.segmentsData, stopTimes, totals);
};

const handleLegs = (path: Path, routing: RoutingResult) => {
    const lastNodeChange = path.attributes.data._lastNodeChange;
    delete path.attributes.data._lastNodeChange;
    const changedSegmentIndex = path.attributes.data._lastWaypointChangedSegmentIndex;
    delete path.attributes.data._lastWaypointChangedSegmentIndex;
    const previous: PreviousSegmentData = {
        oldSegmentsData: path.attributes.data.segments || [],
        oldDwellTimesData: path.attributes.data.dwellTimeSeconds || []
    };
    const changesInfo: SegmentChangeInfo = { lastNodeChange, changedSegmentIndex };

    const {
        globalCoordinates,
        segments,
        segmentsData,
        noDwellTimeDurationsSeconds,
        dwellTimeDurationsSeconds,
        ratioDifferenceTime
    } = buildSegmentsAndGeometry(path, routing, previous, changesInfo);

    const newData = adjustTimesAndComputeTotals(
        path,
        { segmentsData, noDwellTimeDurationsSeconds, dwellTimeDurationsSeconds, ratioDifferenceTime },
        previous,
        changesInfo
    );

    path.set('geography', { type: 'LineString', coordinates: globalCoordinates });
    path.attributes.segments = segments;
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
 */
export const generatePathGeographyFromRouting = (
    path: any,
    points: Geojson.FeatureCollection<Geojson.Point>,
    segmentResults: MapMatchingResults[]
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
        handleLegs(path, routing);
    } catch (error) {
        throw new TrError(
            'Error trying to generate a path geography:' + error,
            'PUPDGEO0003',
            'TransitPathCannotUpdateGeographyBecauseAtLeastOneLegWithNoResult'
        );
    }
};

export default generatePathGeographyFromRouting;
