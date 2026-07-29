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
import Path, { type PeriodSegmentData, type PathAttributesData } from './Path';
import { buildPeriodSegmentData } from './PathSegmentTimeUtils';
import type { TimeAndDistance, TypeNodeChange, SegmentChangeInfo } from './PathTypes';

const MIN_TRAVEL_TIME_FOR_DWELL_SECONDS = 15;

/** Running totals accumulated while iterating over segments to build final path data. */
type PathTimeTotals = {
    totalDistance: number;
    totalDwellTimeSeconds: number;
    totalTravelTimeWithoutDwellTimesSeconds: number;
    totalTravelTimeWithDwellTimesSeconds: number;
    totalTravelTimeWithReturnBackSeconds: number;
};

/** Previous segment times and dwell durations, carried forward from the path's prior state. */
type SegmentData = {
    segmentsData: TimeAndDistance[];
    dwellTimeDurationsSeconds: number[];
};

/** Extends SegmentData with per-segment durations computed without dwell time. */
type ComputedSegmentData = SegmentData & {
    noDwellTimeDurationsSeconds: number[];
};

/** A current segment whose previous (initial) state is preserved across the edit. */
type PreservedSegmentInfo = {
    isNew: false;
    /** The corresponding previous segment index */
    initialIndex: number;
    /** The previous travel time for this segment in seconds */
    initialTravelTimeSeconds: number;
};

/** A current segment with no preserved previous equivalent (needs recalculation). */
type NewSegmentInfo = {
    isNew: true;
};

/** Each current segment's previous (initial) state before the edit, discriminated by `isNew`. */
type InitialSegmentInfo = PreservedSegmentInfo | NewSegmentInfo;

type SegmentDuration = {
    /** Travel time including acceleration and deceleration phases at each stop */
    calculatedSegmentDurationSeconds: number;
    /** Travel time at constant speed without acceleration/deceleration, as if the vehicle did not stop */
    noDwellTimeDurationSeconds: number;
};

/** Snapped node points and legs returned by the routing engine for a path. */
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

/** Output of computing a single segment's data: durations and dwell time. */
type ComputeSegmentDataResult = {
    duration: SegmentDuration;
    /** Dwell time at the departure node of this segment (0 for the first segment) */
    dwellTimeSeconds: number;
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

    // When the routing engine is 'engine', segment duration comes from the router.
    // Otherwise ('engineCustom'/'manual'), duration is derived from defaultRunningSpeedKmH.
    const usesRoutedDuration = routingEngine === 'engine' || _isBlank(defaultRunningSpeedKmH);

    // Coincident nodes/waypoints produce a zero-duration leg; catch it before dividing by zero below
    if (usesRoutedDuration && routedDurationSeconds === 0) {
        throw new TrError(
            'Error trying to generate a path geography. OSRM returned a zero duration for segment.',
            'PUPDGEO0004',
            'TransitPathCannotUpdateGeographyBecauseErrorCalculatingSegmentDuration'
        );
    }

    const runningSpeedMps = usesRoutedDuration
        ? segmentDistanceMeters / routedDurationSeconds
        : kphToMps(defaultRunningSpeedKmH);

    const noDwellTimeDurationSeconds = usesRoutedDuration
        ? routedDurationSeconds
        : segmentDistanceMeters / runningSpeedMps;

    const calculatedSegmentDurationSeconds = durationFromAccelerationDecelerationDistanceAndRunningSpeed(
        acceleration,
        deceleration,
        segmentDistanceMeters,
        runningSpeedMps
    );

    if (calculatedSegmentDurationSeconds <= 0 || !isFinite(calculatedSegmentDurationSeconds)) {
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
 * Maps a current node index to its corresponding index in the previous node array, accounting
 * for a node insert or remove. Returns -1 for a freshly inserted node (no previous equivalent).
 *
 * Used to look up stored per-node dwell times across a path edit: a node that existed before
 * the change keeps its customized dwell time even if its adjacent segment is "new" (split by
 * an insertion).
 *
 * @param currentNodeIndex - The node's index in the current (post-change) node array
 * @param lastNodeChange - The node change that occurred (insert/remove with index), if any
 * @returns The corresponding previous node index, or -1 if the node is new
 */
const getInitialNodeIndex = (currentNodeIndex: number, lastNodeChange?: TypeNodeChange): number => {
    if (!lastNodeChange) return currentNodeIndex;
    if (lastNodeChange.type === 'insert') {
        if (currentNodeIndex < lastNodeChange.index) return currentNodeIndex;
        if (currentNodeIndex === lastNodeChange.index) return -1;
        return currentNodeIndex - 1;
    }
    if (lastNodeChange.type === 'remove') {
        if (currentNodeIndex < lastNodeChange.index) return currentNodeIndex;
        return currentNodeIndex + 1;
    }
    return currentNodeIndex;
};

/**
 * Returns the stored dwell time for a preserved node (> 0), or undefined if the node is new,
 * the stored value is 0/missing, or a full recalculation is forced. Lets customized dwell times
 * on the path survive regenerations triggered by node inserts/removes.
 *
 * @param currentNodeIndex - The node's index in the current (post-change) node array
 * @param initialDwellTimes - The previous per-node dwell time array (from `path.data.dwellTimeSeconds`)
 * @param changesInfo - Info about the node/waypoint change that triggered this regeneration
 * @returns The stored dwell time in seconds, or undefined if none applies
 */
const getPreservedNodeDwellTime = (
    currentNodeIndex: number,
    initialDwellTimes: number[],
    changesInfo: SegmentChangeInfo
): number | undefined => {
    if (changesInfo.forceRecalculate) return undefined;
    const initialNodeIndex = getInitialNodeIndex(currentNodeIndex, changesInfo.lastNodeChange);
    if (initialNodeIndex < 0) return undefined;
    const stored = initialDwellTimes[initialNodeIndex];
    return stored !== undefined && stored > 0 ? stored : undefined;
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
// TODO Refactor baked-in dwell detection. The check uses a fixed 15-second
// floor (MIN_TRAVEL_TIME_FOR_DWELL_SECONDS) on initialTravelTime - nodeDwellTime
// to decide whether dwell is baked into travel time. That threshold is
// arbitrary and gives the wrong answer for short segments with a real dwell.
// One direction worth exploring: leverage the travel-time-without-dwell value
// that already exists elsewhere in the codebase, instead of relying on a
// magic threshold.
const getEffectiveDwellTime = (
    nodeDwellTime: number,
    initialIndex: number,
    initialDwellTimes: number[],
    initialTravelTime: number
): number => {
    // We want to get the initial dwell time from the beginning of the segment.
    const initialDwellTime = initialIndex > 0 ? initialDwellTimes[initialIndex] || 0 : 0;
    // If initial segment had dwell baked into travel time (GTFS with 0 dwell time), only separate it out
    // when the segment is long enough to absorb the dwell without going below MIN_TRAVEL_TIME_FOR_DWELL_SECONDS.
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
        averageSpeedWithoutDwellTimesMetersPerSecond:
            totals.totalTravelTimeWithoutDwellTimesSeconds > 0
                ? roundToDecimals(totals.totalDistance / totals.totalTravelTimeWithoutDwellTimesSeconds, 2)
                : 0,
        operatingSpeedMetersPerSecond:
            totals.totalTravelTimeWithDwellTimesSeconds > 0
                ? roundToDecimals(totals.totalDistance / totals.totalTravelTimeWithDwellTimesSeconds, 2)
                : 0,
        operatingSpeedWithLayoverMetersPerSecond:
            totals.totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds > 0
                ? roundToDecimals(
                    totals.totalDistance / (totals.totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds),
                    2
                )
                : 0,
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
 * Resolves each current segment's previous (initial) state: previous index, previous travel time, and
 * whether it is new. Shared by the base path regeneration and the per-period remap — both need the same
 * previous state before applying their own dwell adjustment.
 *
 * @param initial - Previous segment data to resolve against
 * @param changesInfo - Info about the node/waypoint change that shifts segment indices
 * @param segmentCount - Number of current segments to resolve
 * @returns One {@link InitialSegmentInfo} per current segment
 */
const resolveInitialSegmentInfo = (
    initial: SegmentData,
    changesInfo: SegmentChangeInfo,
    segmentCount: number
): InitialSegmentInfo[] => {
    const initialSegmentInfos: InitialSegmentInfo[] = [];
    for (let i = 0; i < segmentCount; i++) {
        const initialIndex = getInitialSegmentIndex(i, changesInfo.lastNodeChange);
        const initialTravelTimeSeconds =
            initialIndex >= 0 ? initial.segmentsData[initialIndex]?.travelTimeSeconds : undefined;
        if (initialTravelTimeSeconds === undefined || isNewSegment(initialTravelTimeSeconds, i, changesInfo)) {
            initialSegmentInfos.push({ isNew: true });
            continue;
        }
        initialSegmentInfos.push({
            isNew: false,
            initialIndex,
            initialTravelTimeSeconds
        });
    }
    return initialSegmentInfos;
};

/**
 * Computes the remapped travel time of each current segment. Shared by the base path regeneration and
 * the per-period remap: the caller resolves its own per-segment dwell adjustment (the only part that
 * differs, since the baked-in unbake check depends on each side's own travel times) and passes it in
 * as `dwellAdjustmentsSeconds`.
 *
 * For each current segment:
 * - **Preserved** (not new): the previous travel time minus its dwell adjustment.
 * - **New**: the physics duration scaled by the ratio.
 *
 * The ratio (applied to new segments only) is the average of `(previousTime - adjustment) / physicsDuration`
 * over the preserved segments (defaults to 1 when there are none).
 *
 * @param initialSegmentInfos - Per-segment previous state (from {@link resolveInitialSegmentInfo})
 * @param durationsFromRouting - Per-segment routing durations before ratio scaling
 * @param dwellAdjustmentsSeconds - Per-segment dwell adjustment to subtract from preserved travel times (0 for new segments)
 * @returns The remapped travel time for each segment
 */
const computeSegmentTravelTimes = (
    initialSegmentInfos: InitialSegmentInfo[],
    durationsFromRouting: number[],
    dwellAdjustmentsSeconds: number[]
): number[] => {
    let ratioCumulated = 0;
    let ratioCount = 0;
    initialSegmentInfos.forEach((segment, i) => {
        if (segment.isNew) {
            return;
        }
        ratioCumulated += (segment.initialTravelTimeSeconds - dwellAdjustmentsSeconds[i]) / durationsFromRouting[i];
        ratioCount++;
    });
    const ratio = ratioCount > 0 ? ratioCumulated / ratioCount : 1;

    return initialSegmentInfos.map((segment, i) =>
        segment.isNew ? durationsFromRouting[i] * ratio : segment.initialTravelTimeSeconds - dwellAdjustmentsSeconds[i]
    );
};

/**
 * Resolves the dwell time for a segment, in priority order:
 *   1. A customized dwell stored on the path for a preserved node (> 0) — survives
 *      regenerations even when the adjacent segment is "new" (split by an insert/remove).
 *   2. The node's default dwell time when the segment itself is new.
 *   3. The baked-in unbake logic for preserved segments (see {@link getEffectiveDwellTime}).
 *
 * @param params.segmentIndex - The current segment index (0 means path start)
 * @param params.nodeDwellTimeSeconds - The node's default dwell time (fallback)
 * @param params.initialIndex - The corresponding previous segment index (-1 if new)
 * @param params.isNew - Whether this segment has no previous equivalent
 * @param params.initial - Previous segment data (travel times and per-node dwell times)
 * @param params.changesInfo - Info about the node/waypoint change that triggered this regeneration
 * @returns The dwell time in seconds to apply at the segment's starting node
 */
const resolveSegmentDwellTime = (params: {
    segmentIndex: number;
    nodeDwellTimeSeconds: number;
    initialIndex: number;
    isNew: boolean;
    initial: SegmentData;
    changesInfo: SegmentChangeInfo;
}): number => {
    const preservedNodeDwell =
        params.segmentIndex > 0
            ? getPreservedNodeDwellTime(
                params.segmentIndex,
                params.initial.dwellTimeDurationsSeconds,
                params.changesInfo
            )
            : undefined;
    if (preservedNodeDwell !== undefined) {
        return preservedNodeDwell;
    }
    if (params.isNew) {
        return params.nodeDwellTimeSeconds;
    }
    const initialTime = params.initial.segmentsData[params.initialIndex]?.travelTimeSeconds;
    return getEffectiveDwellTime(
        params.nodeDwellTimeSeconds,
        params.initialIndex,
        params.initial.dwellTimeDurationsSeconds,
        initialTime!
    );
};

/**
 * Computes the duration and dwell time for a single completed segment. The first segment always has
 * dwell time 0 (layover is separate). Travel-time preservation/scaling against the previous data is
 * handled later by {@link computeSegmentTravelTimes}.
 *
 * @param params - The segment parameters (path, index, distance, duration, nodeId, previous data, changes info)
 * @returns The segment duration and dwell time
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

    const dwellTimeSeconds = resolveSegmentDwellTime({
        segmentIndex,
        nodeDwellTimeSeconds,
        initialIndex,
        isNew,
        initial,
        changesInfo
    });

    return { duration, dwellTimeSeconds };
};

/**
 * Builds the path's coordinate geometry and per-segment data from routing legs.
 *
 * Iterates over routing legs (one per waypoint-to-waypoint sub-route) and aggregates them into
 * node-to-node segments. For each completed segment:
 * - Calculates duration and distance from the routing engine results.
 * - Determines dwell time at the arrival node (set to 0 if the segment is too short to justify it).
 *
 * The travel times produced here are the raw routing durations; preserving/scaling them against the
 * previous data is done afterwards by {@link computeSegmentTravelTimes} (see {@link adjustTimesAndComputeTotals}).
 *
 * A trailing segment that ends at a waypoint (not a node) is included in the geometry but excluded
 * from duration totals.
 *
 * @param path - The path object (provides node IDs, speed config, dwell time settings)
 * @param routing - Routing results (points and legs between them)
 * @param initial - Previous segment data, carried forward for later time preservation
 * @param changesInfo - Info about recent node/waypoint changes that affect segment mapping
 * @returns Segment geometry, per-segment time/distance data, and dwell times
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

    // Add dwell time for the last (arrival) node — prefer the path's stored dwell for this
    // node if it was preserved, otherwise fall back to the node default.
    const lastNodeIndex = nextNodeIndex - 1;
    const lastNodeId = nodeIds[lastNodeIndex];
    const preservedLastDwell = getPreservedNodeDwellTime(lastNodeIndex, initial.dwellTimeDurationsSeconds, changesInfo);
    dwellTimeDurationsSeconds.push(preservedLastDwell ?? getDwellTimeSecondsForNode(path, lastNodeId));

    return {
        globalCoordinates,
        segments,
        segmentsData,
        noDwellTimeDurationsSeconds,
        dwellTimeDurationsSeconds
    };
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
 * Remaps segment travel times via {@link computeSegmentTravelTimes} and computes path-level totals
 * (distance, travel time, dwell time, layover). Returns the full path data object.
 *
 * @param path - The path object (used for layover calculation)
 * @param current - Current routing results (segments, durations, dwell times)
 * @param initial - Previous segment data used to preserve unchanged travel times
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
    // Raw routing durations captured before they are overwritten with the remapped values below.
    const durationsFromRouting = current.segmentsData
        .slice(0, segmentCount)
        .map((segment) => segment.travelTimeSeconds);

    const initialSegmentInfos = resolveInitialSegmentInfo(initial, changesInfo, segmentCount);
    // Base dwell adjustment: uses the dwell already resolved for the path, against the path's own times.
    const dwellAdjustmentsSeconds = initialSegmentInfos.map((segment, i) =>
        segment.isNew
            ? 0
            : getDwellTimeAdjustment(
                i,
                segment.initialIndex,
                current.dwellTimeDurationsSeconds[i],
                initial,
                changesInfo
            )
    );
    const travelTimes = computeSegmentTravelTimes(initialSegmentInfos, durationsFromRouting, dwellAdjustmentsSeconds);

    for (let currentSegmentIndex = 0; currentSegmentIndex < segmentCount; currentSegmentIndex++) {
        current.segmentsData[currentSegmentIndex].travelTimeSeconds = travelTimes[currentSegmentIndex];
        accumulateSegmentTotals(currentSegmentIndex, current, totals);
    }

    const layoverTimeSeconds = calculateLayoverSeconds(path, totals.totalTravelTimeWithDwellTimesSeconds);

    return buildPathData(current.segmentsData, current.dwellTimeDurationsSeconds, layoverTimeSeconds, totals);
};

/**
 * Remaps a single period/service segment data entry after a path edit.
 *
 * Shares the ratio/travel-time logic with the base regeneration via {@link resolveInitialSegmentInfo} and
 * {@link computeSegmentTravelTimes}. The only per-period part is the dwell adjustment: the baked-in
 * unbake check ({@link getEffectiveDwellTime}) depends on this period's own travel times, so it is
 * computed here against `periodInitial` and passed to the shared kernel as `dwellAdjustmentsSeconds`.
 *
 * The ratio is the period-specific congestion factor (e.g. AM peak 1.4x vs off-peak 1.0x); preserved
 * segments keep their stored time (minus any baked-in dwell), new segments scale the physics duration.
 * Aggregates are recomputed from the remapped segments; `tripCount` is preserved unchanged.
 *
 * @param path - The path object (provides node IDs, dwell time config, node collection)
 * @param initialPeriod - The period/service data from before the edit
 * @param durationsFromRouting - Per-segment travel times from the physics model, before ratio scaling
 * @param newSegmentsData - Per-segment distance/time from the new routing result
 * @param changesInfo - Info about the node/waypoint change that triggered the remap
 * @returns The remapped period data with updated segments, dwell times, and recomputed aggregates
 */
const remapPeriodSegmentData = (
    path: Path,
    initialPeriod: PeriodSegmentData,
    durationsFromRouting: number[],
    newSegmentsData: TimeAndDistance[],
    changesInfo: SegmentChangeInfo
): PeriodSegmentData => {
    const segmentCount = durationsFromRouting.length;
    const nodeIds = path.attributes.nodes;

    const periodInitial: SegmentData = {
        segmentsData: initialPeriod.segments,
        dwellTimeDurationsSeconds: initialPeriod.dwellTimeSeconds
    };

    // Effective dwell for a preserved segment, checked against THIS period's travel time.
    const preservedDwellTime = (currentIndex: number, segment: PreservedSegmentInfo): number => {
        const nodeDwell = currentIndex === 0 ? 0 : getDwellTimeSecondsForNode(path, nodeIds[currentIndex]);
        return getEffectiveDwellTime(
            nodeDwell,
            segment.initialIndex,
            periodInitial.dwellTimeDurationsSeconds,
            segment.initialTravelTimeSeconds
        );
    };

    const initialSegmentInfos = resolveInitialSegmentInfo(periodInitial, changesInfo, segmentCount);
    const dwellAdjustmentsSeconds = initialSegmentInfos.map((segment, i) =>
        segment.isNew
            ? 0
            : getDwellTimeAdjustment(
                i,
                segment.initialIndex,
                preservedDwellTime(i, segment),
                periodInitial,
                changesInfo
            )
    );
    const travelTimes = computeSegmentTravelTimes(initialSegmentInfos, durationsFromRouting, dwellAdjustmentsSeconds);

    const remappedSegments: TimeAndDistance[] = travelTimes.map((travelTimeSeconds, i) => ({
        travelTimeSeconds,
        distanceMeters: newSegmentsData[i].distanceMeters
    }));

    const remappedDwellTimes = initialSegmentInfos.map((segment, i) =>
        segment.isNew ? (i === 0 ? 0 : getDwellTimeSecondsForNode(path, nodeIds[i])) : preservedDwellTime(i, segment)
    );
    remappedDwellTimes.push(getDwellTimeSecondsForNode(path, nodeIds[nodeIds.length - 1]));

    const totalDistanceMeters = remappedSegments.reduce((sum, seg) => sum + (seg.distanceMeters || 0), 0);

    return buildPeriodSegmentData(remappedSegments, remappedDwellTimes, totalDistanceMeters);
};

/**
 * Remaps all service/period segment data entries after a path edit.
 * Each service/period is remapped independently with its own ratio.
 */
const remapAllServicePeriodSegmentData = (
    path: Path,
    initialData: { [serviceId: string]: { [periodShortname: string]: PeriodSegmentData } },
    durationsFromRouting: number[],
    newSegmentsData: TimeAndDistance[],
    changesInfo: SegmentChangeInfo
): { [serviceId: string]: { [periodShortname: string]: PeriodSegmentData } } => {
    const result: { [serviceId: string]: { [periodShortname: string]: PeriodSegmentData } } = {};

    for (const serviceId of Object.keys(initialData)) {
        result[serviceId] = {};
        for (const periodShortname of Object.keys(initialData[serviceId])) {
            result[serviceId][periodShortname] = remapPeriodSegmentData(
                path,
                initialData[serviceId][periodShortname],
                durationsFromRouting,
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
    const initialPeriodData = path.attributes.data.segmentsByServiceAndPeriod;

    const geometryResult = buildSegmentsAndGeometry(path, routing, initial, changesInfo);

    const realSegmentCount = geometryResult.noDwellTimeDurationsSeconds.length;

    // Per-segment travel times from physics model (acc./dec./speed), before ratio scaling
    const durationsFromRouting = geometryResult.segmentsData.slice(0, realSegmentCount).map((s) => s.travelTimeSeconds);

    const current: ComputedSegmentData = {
        segmentsData: geometryResult.segmentsData,
        noDwellTimeDurationsSeconds: geometryResult.noDwellTimeDurationsSeconds,
        dwellTimeDurationsSeconds: geometryResult.dwellTimeDurationsSeconds
    };
    const newData: Partial<PathAttributesData> = adjustTimesAndComputeTotals(path, current, initial, changesInfo);

    // Remap period segment data or clear it on forceRecalculate
    if (initialPeriodData && !changesInfo.forceRecalculate) {
        newData.segmentsByServiceAndPeriod = remapAllServicePeriodSegmentData(
            path,
            initialPeriodData,
            durationsFromRouting,
            geometryResult.segmentsData.slice(0, realSegmentCount),
            changesInfo
        );
    } else if (initialPeriodData) {
        newData.segmentsByServiceAndPeriod = undefined;
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
