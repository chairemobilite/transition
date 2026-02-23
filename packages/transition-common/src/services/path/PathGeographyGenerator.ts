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

const appendLegCoordinates = (leg: MapLeg, globalCoordinates: Geojson.Position[]) => {
    leg.steps
        .map((step) => getCoordinates(step.geometry))
        .forEach((coordinates) =>
            coordinates.forEach((coordinate) => {
                const lastCoordinate = globalCoordinates[globalCoordinates.length - 1];
                if (!lastCoordinate || lastCoordinate[0] !== coordinate[0] || lastCoordinate[1] !== coordinate[1]) {
                    globalCoordinates.push(coordinate);
                }
            })
        );
};

const calculateSegmentDuration = (
    path: Path,
    segmentDistance: number,
    segmentDuration: number
): { calculatedDuration: number; noDwellTimeDuration: number } => {
    const acceleration = path.getData('defaultAcceleration') as number;
    const deceleration = path.getData('defaultDeceleration') as number;
    const routingEngine = path.getData('routingEngine') as string;
    const defaultRunningSpeed = path.getData('defaultRunningSpeedKmH') as number;

    const runningSpeed =
        routingEngine === 'engine' || _isBlank(defaultRunningSpeed)
            ? segmentDistance / segmentDuration
            : kphToMps(defaultRunningSpeed);

    // noDwellTimeDuration is the time if the vehicle does not stop at all
    const noDwellTimeDuration =
        routingEngine === 'engine' || _isBlank(defaultRunningSpeed)
            ? segmentDuration
            : segmentDistance / runningSpeed; // no acceleration/deceleration

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

    return { calculatedDuration, noDwellTimeDuration };
};

const getDwellTimeSecondsForNode = (path: Path, nodeId: unknown): number => {
    const node = (path as any)._collectionManager.get('nodes').getById(nodeId);
    const nodeDefaultDwellTimeSeconds =
        node && node.properties && node.properties.default_dwell_time_seconds
            ? node.properties.default_dwell_time_seconds
            : undefined;
    return path.getDwellTimeSecondsAtNode(nodeDefaultDwellTimeSeconds);
};

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
    ); // ceil to nearest minute
};

const buildPathData = (
    segmentsData: TimeAndDistance[],
    dwellTimeSecondsData: number[],
    layoverTimeSeconds: number,
    totalDistance: number,
    totalTravelTimeWithoutDwellTimesSeconds: number,
    totalTravelTimeWithDwellTimesSeconds: number,
    totalDwellTimeSeconds: number,
    totalTravelTimeWithReturnBackSeconds: number
) => {
    return {
        segments: segmentsData,
        dwellTimeSeconds: dwellTimeSecondsData,
        layoverTimeSeconds: layoverTimeSeconds,
        travelTimeWithoutDwellTimesSeconds: totalTravelTimeWithoutDwellTimesSeconds,
        totalDistanceMeters: totalDistance,
        totalDwellTimeSeconds: totalDwellTimeSeconds,
        operatingTimeWithoutLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds,
        operatingTimeWithLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds,
        totalTravelTimeWithReturnBackSeconds: totalTravelTimeWithReturnBackSeconds + layoverTimeSeconds,
        averageSpeedWithoutDwellTimesMetersPerSecond: roundToDecimals(
            totalDistance / totalTravelTimeWithoutDwellTimesSeconds,
            2
        ),
        operatingSpeedMetersPerSecond: roundToDecimals(totalDistance / totalTravelTimeWithDwellTimesSeconds, 2),
        operatingSpeedWithLayoverMetersPerSecond: roundToDecimals(
            totalDistance / (totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds),
            2
        ),
        from_gtfs: false
    };
};

const buildSegmentsAndGeometry = (
    path: Path,
    points: Geojson.Feature<Geojson.Point>[],
    legs: (MapLeg | null)[]
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

    for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        const nextIsNode = points[i + 1].properties?.isNode;
        if (!leg) {
            continue;
        }

        if (points[i].properties?.isNode) {
            segmentCoordinatesStartIndex = globalCoordinates.length > 0 ? globalCoordinates.length - 1 : 0;
        }

        appendLegCoordinates(leg, globalCoordinates);

        segmentDuration += Math.ceil(leg.duration);
        segmentDistance += Math.ceil(leg.distance);

        // Path cannot finish at a waypoint, so this last segment si not part of the total calculations.
        if (i === legs.length - 1 && !(nodeIds as any[])[nextNodeIndex]) {
            // last leg is to a waypoint (missing node at the end)
            segments.push(segmentCoordinatesStartIndex);
            segmentsData.push({ travelTimeSeconds: segmentDuration, distanceMeters: segmentDistance });
        } else if (nextIsNode && (nodeIds as any[])[nextNodeIndex]) {
            // we can create the segment
            const { calculatedDuration, noDwellTimeDuration } = calculateSegmentDuration(path, segmentDistance, segmentDuration);
            const dwellTimeSeconds = getDwellTimeSecondsForNode(path, (nodeIds as any[])[nextNodeIndex]);

            segments.push(segmentCoordinatesStartIndex);
            segmentsData.push({ travelTimeSeconds: calculatedDuration, distanceMeters: segmentDistance });
            noDwellTimeDurations.push(noDwellTimeDuration);
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
    ); // ceil to nearest minute
    totalTravelTimeWithDwellTimesSeconds = roundSecondsToNearestMinute(totalTravelTimeWithDwellTimesSeconds, Math.ceil); // ceil to nearest minute
    totalTravelTimeWithReturnBackSeconds = roundSecondsToNearestMinute(totalTravelTimeWithReturnBackSeconds, Math.ceil); // ceil to nearest minute

    const layoverTimeSeconds = calculateLayoverSeconds(path, totalTravelTimeWithDwellTimesSeconds);

    return buildPathData(
        segmentsData,
        dwellTimeSecondsData,
        layoverTimeSeconds,
        totalDistance,
        totalTravelTimeWithoutDwellTimesSeconds,
        totalTravelTimeWithDwellTimesSeconds,
        totalDwellTimeSeconds,
        totalTravelTimeWithReturnBackSeconds
    );
};

const handleLegs = (path: Path, points: Geojson.Feature<Geojson.Point>[], legs: (MapLeg | null)[]) => {
    const { globalCoordinates, segments, segmentsData, noDwellTimeDurations, dwellTimeSecondsData } =
        buildSegmentsAndGeometry(path, points, legs);

    const newData = adjustTimesAndComputeTotals(path, segmentsData, noDwellTimeDurations, dwellTimeSecondsData);

    path.set('geography', { type: 'LineString', coordinates: globalCoordinates }); // to trigger history save. We should create transactions to set one history step for the whole update here
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
        handleLegs(path, points.features, legResults);
    } catch (error) {
        throw new TrError(
            'Error trying to generate a path geography:' + error,
            'PUPDGEO0003',
            'TransitPathCannotUpdateGeographyBecauseAtLeastOneLegWithNoResult'
        );
    }
};

export default generatePathGeographyFromRouting;
