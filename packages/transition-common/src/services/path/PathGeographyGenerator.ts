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
import { roundSecondsToNearestMinute } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import {
    durationFromAccelerationDecelerationDistanceAndRunningSpeed,
    kphToMps
} from 'chaire-lib-common/lib/utils/PhysicsUtils';
import Path, { TimeAndDistance } from './Path';

type PathTimeTotals = {
    totalDistance: number;
    totalDwellTimeSeconds: number;
    totalTravelTimeWithoutDwellTimesSeconds: number;
    totalTravelTimeWithDwellTimesSeconds: number;
    totalTravelTimeWithReturnBackSeconds: number;
};

type StopTimes = {
    dwellTimeSecondsData: number[];
    layoverTimeSeconds: number;
};

type SegmentDuration = {
    calculatedDuration: number;
    noDwellTimeDuration: number;
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
 * @param segmentDistance - Segment distance in meters (from routing engine)
 * @param routedDuration - Segment duration in seconds (from routing engine)
 * @returns `calculatedDuration` (with accel/decel) and `noDwellTimeDuration` (without)
 * @throws TrError if the calculated duration is zero or negative
 */
const calculateSegmentDuration = (
    path: Path,
    segmentDistance: number,
    routedDuration: number
): SegmentDuration => {
    const acceleration = path.getData('defaultAcceleration') as number;
    const deceleration = path.getData('defaultDeceleration') as number;
    const routingEngine = path.getData('routingEngine') as string;
    const defaultRunningSpeed = path.getData('defaultRunningSpeedKmH') as number;

    const runningSpeed =
        routingEngine === 'engine' || _isBlank(defaultRunningSpeed)
            ? segmentDistance / routedDuration
            : kphToMps(defaultRunningSpeed);

    const noDwellTimeDuration =
        routingEngine === 'engine' || _isBlank(defaultRunningSpeed)
            ? routedDuration
            : segmentDistance / runningSpeed;

    const calculatedSegmentDuration = Math.ceil(
        durationFromAccelerationDecelerationDistanceAndRunningSpeed(
            acceleration,
            deceleration,
            segmentDistance,
            runningSpeed
        )
    );
    const calculatedDuration = calculatedSegmentDuration !== null ? calculatedSegmentDuration : -1;

    if (calculatedDuration <= 0) {
        throw new TrError(
            'Error trying to generate a path geography. There was an error while calculating segment duration.',
            'PUPDGEO0001',
            'TransitPathCannotUpdateGeographyBecauseErrorCalculatingSegmentDuration'
        );
    }

    const segmentDuration: SegmentDuration = { calculatedDuration, noDwellTimeDuration };
    return segmentDuration;
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
    const node = (path as any)._collectionManager.get('nodes').getById(nodeId);
    const nodeDefaultDwellTimeSeconds =
        node && node.properties && node.properties.default_dwell_time_seconds
            ? node.properties.default_dwell_time_seconds
            : undefined;
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
    return roundSecondsToNearestMinute(
        Math.max(
            Preferences.current.transit.paths.data.defaultLayoverRatioOverTotalTravelTime *
                totalTravelTimeWithDwellTimesSeconds,
            Preferences.current.transit.paths.data.defaultMinLayoverTimeSeconds
        ),
        Math.ceil
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
const buildPathData = (
    segmentsData: TimeAndDistance[],
    stopTimes: StopTimes,
    totals: PathTimeTotals
) => {
    return {
        segments: segmentsData,
        dwellTimeSeconds: stopTimes.dwellTimeSecondsData,
        layoverTimeSeconds: stopTimes.layoverTimeSeconds,
        travelTimeWithoutDwellTimesSeconds: totals.totalTravelTimeWithoutDwellTimesSeconds,
        totalDistanceMeters: totals.totalDistance,
        totalDwellTimeSeconds: totals.totalDwellTimeSeconds,
        operatingTimeWithoutLayoverTimeSeconds: totals.totalTravelTimeWithDwellTimesSeconds,
        operatingTimeWithLayoverTimeSeconds: totals.totalTravelTimeWithDwellTimesSeconds + stopTimes.layoverTimeSeconds,
        totalTravelTimeWithReturnBackSeconds: totals.totalTravelTimeWithReturnBackSeconds + stopTimes.layoverTimeSeconds,
        averageSpeedWithoutDwellTimesMetersPerSecond: roundToDecimals(
            totals.totalDistance / totals.totalTravelTimeWithoutDwellTimesSeconds,
            2
        ),
        operatingSpeedMetersPerSecond: roundToDecimals(totals.totalDistance / totals.totalTravelTimeWithDwellTimesSeconds, 2),
        operatingSpeedWithLayoverMetersPerSecond: roundToDecimals(
            totals.totalDistance / (totals.totalTravelTimeWithDwellTimesSeconds + stopTimes.layoverTimeSeconds),
            2
        ),
        from_gtfs: false
    };
};

/**
 * Builds the path's coordinate geometry and per-segment data from routing legs.
 *
 * Iterates over routing legs (one per waypoint-to-waypoint sub-route) and aggregates them into
 * node-to-node segments. For each completed segment, calculates duration and distance from the
 * routing engine results.
 *
 * A trailing segment that ends at a waypoint (not a node) is included in the geometry but excluded
 * from duration totals.
 *
 * @param path - The path object (provides node IDs, speed config, dwell time settings)
 * @param routing - Routing results (points and legs between them)
 * @returns Segment geometry, per-segment time/distance data, and dwell times
 */
const buildSegmentsAndGeometry = (
    path: Path,
    routing: RoutingResult
) => {
    const globalCoordinates: Geojson.Position[] = [];
    let segmentCoordinatesStartIndex = 0;
    const segments: number[] = [];
    const segmentsData: TimeAndDistance[] = [];
    const noDwellTimeDurations: number[] = [];
    const nodeIds = path.get('nodes', []);
    const dwellTimeSecondsData = [0]; // 0 for the first node, we calculate layover separately
    let nextNodeIndex = 1;
    let segmentDuration = 0;
    let segmentDistance = 0;

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

        segmentDuration += Math.ceil(leg.duration);
        segmentDistance += Math.ceil(leg.distance);

        // Path cannot finish at a waypoint, so this last segment is not part of the total calculations.
        if (i === routing.legs.length - 1 && !(nodeIds as any[])[nextNodeIndex]) {
            segments.push(segmentCoordinatesStartIndex);
            segmentsData.push({ travelTimeSeconds: segmentDuration, distanceMeters: segmentDistance });
        } else if (nextIsNode && (nodeIds as any[])[nextNodeIndex]) {
            const duration: SegmentDuration = calculateSegmentDuration(path, segmentDistance, segmentDuration);
            const dwellTimeSeconds = getDwellTimeSecondsForNode(path, (nodeIds as any[])[nextNodeIndex]);

            segments.push(segmentCoordinatesStartIndex);
            segmentsData.push({ travelTimeSeconds: duration.calculatedDuration, distanceMeters: segmentDistance });
            noDwellTimeDurations.push(duration.noDwellTimeDuration);
            dwellTimeSecondsData.push(dwellTimeSeconds);
            // reset for next segment:
            segmentDuration = 0;
            segmentDistance = 0;
            nextNodeIndex++;
        }
    }

    return { globalCoordinates, segments, segmentsData, noDwellTimeDurations, dwellTimeSecondsData };
};

const adjustTimesAndComputeTotals = (
    path: Path,
    segmentsData: TimeAndDistance[],
    noDwellTimeDurations: number[],
    dwellTimeSecondsData: number[]
) => {
    let totalDistance = 0;
    let totalDwellTimeSeconds = 0;
    let totalTravelTimeWithoutDwellTimesSeconds = 0;
    let totalTravelTimeWithDwellTimesSeconds = 0;
    let totalTravelTimeWithReturnBackSeconds = 0;

    for (let s = 0; s < segmentsData.length; s++) {
        // Skip the last segment if it ends at a waypoint (not a node) — it's not part of the totals
        if (s >= noDwellTimeDurations.length) {
            break;
        }
        const dwellTime = dwellTimeSecondsData[s + 1] || 0;
        totalDistance += segmentsData[s].distanceMeters || 0;
        totalTravelTimeWithDwellTimesSeconds += segmentsData[s].travelTimeSeconds + dwellTime;
        totalTravelTimeWithoutDwellTimesSeconds += noDwellTimeDurations[s];
        totalDwellTimeSeconds += dwellTime;
        totalTravelTimeWithReturnBackSeconds += segmentsData[s].travelTimeSeconds + dwellTime;
    }

    totalTravelTimeWithoutDwellTimesSeconds = roundSecondsToNearestMinute(
        totalTravelTimeWithoutDwellTimesSeconds,
        Math.ceil
    );
    totalTravelTimeWithDwellTimesSeconds = roundSecondsToNearestMinute(totalTravelTimeWithDwellTimesSeconds, Math.ceil);
    totalTravelTimeWithReturnBackSeconds = roundSecondsToNearestMinute(totalTravelTimeWithReturnBackSeconds, Math.ceil);

    const layoverTimeSeconds = calculateLayoverSeconds(path, totalTravelTimeWithDwellTimesSeconds);

    const totals: PathTimeTotals = {
        totalDistance,
        totalDwellTimeSeconds,
        totalTravelTimeWithoutDwellTimesSeconds,
        totalTravelTimeWithDwellTimesSeconds,
        totalTravelTimeWithReturnBackSeconds
    };

    const stopTimes: StopTimes = { dwellTimeSecondsData, layoverTimeSeconds };

    return buildPathData(segmentsData, stopTimes, totals);
};

const handleLegs = (path: Path, routing: RoutingResult) => {
    const { globalCoordinates, segments, segmentsData, noDwellTimeDurations, dwellTimeSecondsData } =
        buildSegmentsAndGeometry(path, routing);

    const newData = adjustTimesAndComputeTotals(path, segmentsData, noDwellTimeDurations, dwellTimeSecondsData);

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
