/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// eslint-disable-next-line n/no-unpublished-import
import type * as GtfsTypes from 'gtfs-types';
import { Path, TimeAndDistance } from 'transition-common/lib/services/path/Path';
import { StopTime } from '../gtfsImport/GtfsImportTypes';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import {
    length as turfLength,
    cleanCoords as turfCleanCoords,
    nearestPointOnLine as turfNearestPointOnLine,
    lineSliceAlong as turfLineSliceAlong,
    helpers as turfHelpers
} from '@turf/turf';

interface StopTimeDistances {
    distanceTraveled: number;
    distanceFromShape: number;
}

export const calculateDistancesFromLineShape = (params: {
    stopTimes: StopTime[];
    shapeCoordinatesWithDistances: GtfsTypes.Shapes[];
    stopCoordinatesByStopId: { [key: string]: [number, number] };
    completeShape: GeoJSON.Feature<GeoJSON.LineString>;
    totalDistanceInMeters: number;
}) => {
    const stopTimeDistances: StopTimeDistances[] = [];

    // as specified here: https://support.google.com/transitpartners/answer/6387809, we use a max distance between trip stops and shape of 150m.
    // we assume the first coordinate of the shape matches the first stop and that the last coordinate matches the last stop
    stopTimeDistances.push({
        distanceTraveled: 0,
        distanceFromShape: 0
    });
    for (let i = 1, countI = params.stopTimes.length; i < countI - 1; i++) {
        // For each stopTime, find the nearest point on shape corresponding to
        // the stop and store the distance traveled and distance from the shape
        // obtained with turf
        const stopId = params.stopTimes[i].stop_id;
        const stopCoordinates = params.stopCoordinatesByStopId[stopId];
        const stopGeojson = {
            type: 'Feature' as const,
            properties: {},
            geometry: {
                type: 'Point' as const,
                coordinates: stopCoordinates
            }
        };
        const nearestPointOnShape = turfNearestPointOnLine(params.completeShape, stopGeojson, { units: 'kilometers' });
        const distanceBetweenNodeAndShape = (nearestPointOnShape.properties.dist || 0) * 1000;
        const nearestPointDistanceFromStart = (nearestPointOnShape.properties.location || 0) * 1000;
        // stop time distance must be greater than previous and less than or equal to a maximum of 150m:
        // otherwise the stops order are incorrect or we need another method to generate distances
        stopTimeDistances.push({
            distanceTraveled: nearestPointDistanceFromStart,
            distanceFromShape: distanceBetweenNodeAndShape
        });
    }

    // set distance for last node/stop (last coordinate):
    stopTimeDistances.push({
        distanceTraveled: params.totalDistanceInMeters,
        distanceFromShape: 0
    });
    // verify stops order and distances coherence:
    let previousDistance = -Infinity;
    for (let i = 0, countI = stopTimeDistances.length; i < countI; i++) {
        const stopTimeDistance = stopTimeDistances[i];
        if (stopTimeDistance.distanceFromShape > 150 || stopTimeDistance.distanceTraveled <= previousDistance) {
            return { status: 'failed' };
        }
        previousDistance = stopTimeDistance.distanceTraveled;
    }
    return { status: 'success', stopTimeDistances };
};

export const calculateDistancesBySegments = (params: {
    stopTimes: StopTime[];
    shapeCoordinatesWithDistances: GtfsTypes.Shapes[];
    stopCoordinatesByStopId: { [key: string]: [number, number] };
    completeShape: GeoJSON.Feature<GeoJSON.LineString>;
    totalDistanceInMeters: number;
}) => {
    const stopTimeDistances: StopTimeDistances[] = [];
    stopTimeDistances.push({
        distanceTraveled: 0,
        distanceFromShape: 0
    });

    for (let i = 1, countI = params.stopTimes.length; i < countI - 1; i++) {
        const stopTime = params.stopTimes[i];
        const stopId = stopTime.stop_id;
        const stopCoordinates = params.stopCoordinatesByStopId[stopId];
        const stopGeojson = turfHelpers.point(stopCoordinates);
        let minDistance = Infinity;
        let minStopTimeDistance = 0;

        // remove consecutive duplicates from coordinates:
        params.shapeCoordinatesWithDistances = params.shapeCoordinatesWithDistances.filter(
            (coordinate, pos, coordinates) => {
                // Always keep the 0th element as there is nothing before it
                // Then check if each element is different than the one before it
                return (
                    pos === 0 ||
                    !(
                        coordinate.shape_pt_lon === coordinates[pos - 1].shape_pt_lon &&
                        coordinate.shape_pt_lat === coordinates[pos - 1].shape_pt_lat
                    )
                );
            }
        );

        // shapeCoordinatesWithDistances must be sorted by sequence! This should be done in ShapeImporter.
        // iterate over shape segments:
        for (let j = 0, countJ = params.shapeCoordinatesWithDistances.length - 1; j < countJ; j++) {
            const coordinateIndexStart = j;
            const coordinateIndexEnd = j + 1;
            const coordinateStart = params.shapeCoordinatesWithDistances[coordinateIndexStart];
            const coordinateEnd = params.shapeCoordinatesWithDistances[coordinateIndexEnd];
            const shapeSegmentSoFar = turfHelpers.lineString([
                [coordinateStart.shape_pt_lon, coordinateStart.shape_pt_lat],
                [coordinateEnd.shape_pt_lon, coordinateEnd.shape_pt_lat]
            ]);
            // calculate shape segment length:
            const shapeSegmentLength = turfLength(shapeSegmentSoFar, { units: 'kilometers' }) * 1000;
            // update shape distance so far:
            coordinateEnd.shape_dist_traveled = (coordinateStart.shape_dist_traveled || 0) + shapeSegmentLength;
            const nearestPointOnShapeSegment = turfNearestPointOnLine(shapeSegmentSoFar, stopGeojson, {
                units: 'kilometers'
            });
            const distanceBetweenNodeAndShapeSegment = (nearestPointOnShapeSegment.properties.dist || 0) * 1000;
            const nearestPointDistanceFromSegmentStart = (nearestPointOnShapeSegment.properties.location || 0) * 1000;
            // we iterate: As soon as we reach a distance between node and shpae of less than or equal to 150o meters, we try to find the next minimum.
            // When the minimum is found, we assign the distance so far on shape to the stop time distance, as long as the new distance is further away from the previous stop time distance.
            // if it fails, we ave a weird shape and should alert the user.
            if (distanceBetweenNodeAndShapeSegment <= 150 && minDistance > distanceBetweenNodeAndShapeSegment) {
                minDistance = distanceBetweenNodeAndShapeSegment;
                minStopTimeDistance =
                    (params.shapeCoordinatesWithDistances[coordinateIndexStart].shape_dist_traveled || 0) +
                    nearestPointDistanceFromSegmentStart;
                if (j === params.shapeCoordinatesWithDistances.length - 2) {
                    // This is the last segment
                    stopTimeDistances.push({
                        distanceTraveled: minStopTimeDistance,
                        distanceFromShape: minDistance
                    });
                }
            } else {
                if (
                    distanceBetweenNodeAndShapeSegment <= 150 &&
                    minStopTimeDistance > stopTimeDistances[i - 1].distanceTraveled
                ) {
                    stopTimeDistances.push({
                        distanceTraveled: minStopTimeDistance,
                        distanceFromShape: minDistance
                    });
                    break;
                }
                minDistance = Infinity;
            }
        }

        // The distances object was not added for this stop time, we couldn't find it
        if (stopTimeDistances.length < i + 1) {
            return { status: 'failed' };
        }
    }
    stopTimeDistances.push({
        distanceTraveled: params.totalDistanceInMeters,
        distanceFromShape: 0
    });
    return { status: 'success', stopTimeDistances };
};

export const calculateDistances = (
    path: Path,
    params: {
        stopTimes: StopTime[];
        shapeCoordinatesWithDistances: GtfsTypes.Shapes[];
        stopCoordinatesByStopId: { [key: string]: [number, number] };
        completeShape: GeoJSON.Feature<GeoJSON.LineString>;
        totalDistanceInMeters: number;
    }
) => {
    console.log(`generating shape distances for path ${path.getId()} of line ${path.getAttributes().line_id}`);

    const result = calculateDistancesFromLineShape(params);
    return result.status === 'success' ? result : calculateDistancesBySegments(params);
};

// TODO Split into smaller functions, add unit tests
export const generateGeographyAndSegmentsFromGtfs = (
    path: Path,
    shapeCoordinatesWithDistances: GtfsTypes.Shapes[],
    nodeIds: string[],
    stopTimes: StopTime[],
    shapeGtfsId: string,
    stopCoordinatesByStopId: { [key: string]: [number, number] },
    defaultLayoverRatioOverTotalTravelTime = 0.1,
    defaultMinLayoverTimeSeconds = 180
): ErrorMessage[] => {
    path.getAttributes().nodes = nodeIds; // reset nodes, they will be regenerated from stop times

    // Return errors when generating the path
    const errors: ErrorMessage[] = [];
    if (!shapeCoordinatesWithDistances || !shapeCoordinatesWithDistances[0]) {
        path.setData('gtfs', { shape_id: shapeGtfsId });
        path.set('geography', null);
        return errors;
    }

    const hasDistances =
        shapeCoordinatesWithDistances[0].shape_dist_traveled !== undefined &&
        stopTimes &&
        stopTimes[0] &&
        stopTimes[0].shape_dist_traveled !== undefined; // did gtfs provided distances to generate segments?
    let shapeDistancesFailed = false;
    let shapeDistancesAreInMeters = false;
    const uncleanedCompleteShape = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: shapeCoordinatesWithDistances.map((coordinate) => {
                return [coordinate.shape_pt_lon, coordinate.shape_pt_lat];
            })
        }
    };
    const completeShape = turfCleanCoords(uncleanedCompleteShape);
    const totalDistanceInMeters = turfLength(completeShape, { units: 'kilometers' }) * 1000;

    // An array of distances traveled. We take them from the stopTimes if
    // available, otherwise attempd to get them from the shape
    let stopTimeDistances: StopTimeDistances[] = stopTimes.map((stopTime) => ({
        distanceTraveled: stopTime.shape_dist_traveled || -Infinity,
        distanceFromShape: 0
    }));

    if (!hasDistances) {
        const result = calculateDistances(path, {
            stopTimes,
            completeShape,
            shapeCoordinatesWithDistances,
            stopCoordinatesByStopId,
            totalDistanceInMeters
        });

        if (result.status === 'success') {
            stopTimeDistances = result.stopTimeDistances as StopTimeDistances[];
        } else {
            console.log(
                `shapeGtfsId ${shapeGtfsId}: something is wrong with the stops order, or there are ambiguous loops.`
            );
            const line: any = path.getLine();
            // TODO This is the react-i18n error format, we shouldn't use it in backend. Find a common format for the whole code.
            errors.push({
                text: GtfsMessages.CannotGenerateFromGtfsShape,
                params: {
                    shapeGtfsId,
                    lineShortName: line.get('shortname'),
                    lineName: line.get('longname')
                }
            });
            shapeDistancesFailed = true;
        }

        shapeDistancesAreInMeters = true; // this allows us to use known units distances along the shape when generate shape segments later on.
        // it saves us the calculation of the distance along the shape for each individual coordinate.
    }
    if (shapeDistancesFailed) {
        console.log(`could not generate distances from shape for line id ${path.getAttributes().line_id}`);

        // we create an incomplete path to allow schedule generation but without segments shapes and distances:
        const segments = [];
        const segmentsData: TimeAndDistance[] = [];
        const dwellTimeSecondsData: number[] = [];
        let totalDwellTimeSeconds = 0;
        let totalTravelTimeWithoutDwellTimesSeconds = 0;
        let totalTravelTimeWithDwellTimesSeconds = 0;

        for (let i = 0, countI = stopTimes.length; i < countI - 1; i++) {
            const stopTime = stopTimes[i];
            const nextStopTime = stopTimes[i + 1];
            const dwellTimeSeconds = stopTime.departureTimeSeconds - stopTime.arrivalTimeSeconds;
            const travelTimeSeconds = Math.ceil(nextStopTime.arrivalTimeSeconds - stopTime.departureTimeSeconds);
            segmentsData.push({
                travelTimeSeconds: travelTimeSeconds, // we should make an average over each period here instead of using the first trip travel times
                distanceMeters: null
            });
            dwellTimeSecondsData.push(dwellTimeSeconds);
            totalDwellTimeSeconds += dwellTimeSeconds;
            totalTravelTimeWithoutDwellTimesSeconds += travelTimeSeconds;
            totalTravelTimeWithDwellTimesSeconds += dwellTimeSeconds + travelTimeSeconds;
        }
        const customLayoverMinutes = path.getAttributes().data.customLayoverMinutes;
        const layoverTimeSeconds =
            customLayoverMinutes !== undefined
                ? customLayoverMinutes * 60
                : Math.ceil(
                    Math.max(
                        defaultLayoverRatioOverTotalTravelTime * totalTravelTimeWithDwellTimesSeconds,
                        defaultMinLayoverTimeSeconds
                    )
                );

        const pathData = {
            segments: segmentsData,
            dwellTimeSeconds: dwellTimeSecondsData,
            layoverTimeSeconds: layoverTimeSeconds,
            travelTimeWithoutDwellTimesSeconds: totalTravelTimeWithoutDwellTimesSeconds,
            totalDistanceMeters: Math.ceil(totalDistanceInMeters),
            totalDwellTimeSeconds: totalDwellTimeSeconds,
            operatingTimeWithoutLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds,
            operatingTimeWithLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds,
            totalTravelTimeWithReturnBackSeconds: null,
            averageSpeedWithoutDwellTimesMetersPerSecond:
                Math.round((totalDistanceInMeters / totalTravelTimeWithoutDwellTimesSeconds) * 100) / 100,
            operatingSpeedMetersPerSecond:
                Math.round((totalDistanceInMeters / totalTravelTimeWithDwellTimesSeconds) * 100) / 100,
            operatingSpeedWithLayoverMetersPerSecond:
                Math.round(
                    (totalDistanceInMeters / (totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds)) * 100
                ) / 100,
            returnBackGeography: null,
            nodeTypes: [],
            waypoints: [],
            waypointTypes: []
        };

        path.getAttributes().segments = segments;
        path.getAttributes().data = Object.assign(path.getAttributes().data, pathData);
    } else {
        if (!shapeDistancesAreInMeters) {
            stopTimeDistances[0].distanceTraveled = 0;
            // units can be any distance units, so we need to interpolate along the interval to convert to meters:
            const minDistance = stopTimeDistances[0].distanceTraveled || 0;
            const maxDistance = stopTimeDistances[stopTimeDistances.length - 1].distanceTraveled || 0;
            const distanceInterval = maxDistance - minDistance;
            for (let i = 1, countI = stopTimeDistances.length; i < countI - 1; i++) {
                stopTimeDistances[i].distanceTraveled =
                    (stopTimeDistances[i].distanceTraveled / distanceInterval) * totalDistanceInMeters;
            }
            stopTimeDistances[stopTimes.length - 1].distanceTraveled = totalDistanceInMeters;
        }

        //console.log(stopTimes);

        let globalCoordinates = [];
        const segments: number[] = [];
        const segmentsData: TimeAndDistance[] = [];
        const dwellTimeSecondsData: number[] = [];
        let totalDwellTimeSeconds = 0;
        let totalTravelTimeWithoutDwellTimesSeconds = 0;
        let totalTravelTimeWithDwellTimesSeconds = 0;

        for (let i = 0, countI = stopTimes.length; i < countI - 1; i++) {
            const stopTime = stopTimes[i];
            const nextStopTime = stopTimes[i + 1];
            const distanceSoFarMeters = stopTimeDistances[i].distanceTraveled;
            const nextDistanceSoFarMeters = stopTimeDistances[i + 1].distanceTraveled;
            const segmentGeojson = turfLineSliceAlong(
                completeShape,
                distanceSoFarMeters / 1000,
                nextDistanceSoFarMeters / 1000,
                { units: 'kilometers' }
            );
            const segmentLengthMeters = turfLength(segmentGeojson, { units: 'kilometers' }) * 1000;
            let segmentCoordinates;
            // hack for cleanCoords: see https://github.com/Turfjs/turf/issues/1758
            if (segmentGeojson.geometry.coordinates.length === 3) {
                if (
                    segmentGeojson.geometry.coordinates[0][0] === segmentGeojson.geometry.coordinates[1][0] &&
                    segmentGeojson.geometry.coordinates[0][1] === segmentGeojson.geometry.coordinates[1][1]
                ) {
                    segmentCoordinates = [
                        segmentGeojson.geometry.coordinates[1],
                        segmentGeojson.geometry.coordinates[2]
                    ];
                } else if (
                    segmentGeojson.geometry.coordinates[1][0] === segmentGeojson.geometry.coordinates[2][0] &&
                    segmentGeojson.geometry.coordinates[1][1] === segmentGeojson.geometry.coordinates[2][1]
                ) {
                    segmentCoordinates = [
                        segmentGeojson.geometry.coordinates[0],
                        segmentGeojson.geometry.coordinates[2]
                    ];
                } else {
                    segmentCoordinates = turfCleanCoords(segmentGeojson).geometry.coordinates;
                }
            } else {
                segmentCoordinates = turfCleanCoords(segmentGeojson).geometry.coordinates;
            }
            // hack ends here.
            // remove the last coordinate if duplicated:
            if (
                globalCoordinates[globalCoordinates.length - 1] &&
                globalCoordinates[globalCoordinates.length - 1][0] === segmentCoordinates[0][0] &&
                globalCoordinates[globalCoordinates.length - 1][1] === segmentCoordinates[0][1]
            ) {
                segmentCoordinates.shift();
            }
            const dwellTimeSeconds = stopTime.departureTimeSeconds - stopTime.arrivalTimeSeconds;
            const travelTimeSeconds = Math.ceil(nextStopTime.arrivalTimeSeconds - stopTime.departureTimeSeconds);
            const distanceMeters = Math.ceil(segmentLengthMeters);
            if (i === 0) {
                segments.push(0);
            } else {
                segments.push(globalCoordinates.length - 1);
            }
            globalCoordinates = globalCoordinates.concat(segmentCoordinates);
            /*if (globalCoordinates.length === 0) // first segment
            {
              globalCoordinates = globalCoordinates.concat(segmentCoordinates);
            }
            else // don't repeat same coordinate after segment
            {
              globalCoordinates = globalCoordinates.concat(segmentCoordinates);
            }*/
            segmentsData.push({
                travelTimeSeconds: travelTimeSeconds, // we should make an average over each period here instead of using the first trip travel times
                distanceMeters: distanceMeters
            });
            dwellTimeSecondsData.push(dwellTimeSeconds);
            totalDwellTimeSeconds += dwellTimeSeconds;
            totalTravelTimeWithoutDwellTimesSeconds += travelTimeSeconds;
            totalTravelTimeWithDwellTimesSeconds += dwellTimeSeconds + travelTimeSeconds;
        }
        const customLayoverMinutes = path.getAttributes().data.customLayoverMinutes;
        const layoverTimeSeconds =
            customLayoverMinutes !== undefined
                ? customLayoverMinutes * 60
                : Math.ceil(
                    Math.max(
                        defaultLayoverRatioOverTotalTravelTime * totalTravelTimeWithDwellTimesSeconds,
                        defaultMinLayoverTimeSeconds
                    )
                );
        // add last dwellTime
        dwellTimeSecondsData.push(0);

        const pathData = {
            segments: segmentsData,
            dwellTimeSeconds: dwellTimeSecondsData,
            layoverTimeSeconds: layoverTimeSeconds,
            travelTimeWithoutDwellTimesSeconds: totalTravelTimeWithoutDwellTimesSeconds,
            totalDistanceMeters: Math.ceil(totalDistanceInMeters),
            totalDwellTimeSeconds: totalDwellTimeSeconds,
            operatingTimeWithoutLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds,
            operatingTimeWithLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds,
            totalTravelTimeWithReturnBackSeconds: null,
            averageSpeedWithoutDwellTimesMetersPerSecond:
                Math.round((totalDistanceInMeters / totalTravelTimeWithoutDwellTimesSeconds) * 100) / 100,
            operatingSpeedMetersPerSecond:
                Math.round((totalDistanceInMeters / totalTravelTimeWithDwellTimesSeconds) * 100) / 100,
            operatingSpeedWithLayoverMetersPerSecond:
                Math.round(
                    (totalDistanceInMeters / (totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds)) * 100
                ) / 100,
            returnBackGeography: null,
            nodeTypes: [],
            waypoints: [],
            waypointTypes: []
        };

        completeShape.geometry.coordinates = globalCoordinates;

        path.getAttributes().segments = segments;
        path.getAttributes().data = Object.assign(path.getAttributes().data, pathData);

        const terminalsGeojsons = [
            path.collectionManager.get('nodes').getById(nodeIds[0]),
            path.collectionManager.get('nodes').getById(nodeIds[nodeIds.length - 1])
        ];
        path.getAttributes().data.birdDistanceBetweenTerminals = turfLength(
            turfHelpers.lineString([
                terminalsGeojsons[0].geometry.coordinates,
                terminalsGeojsons[1].geometry.coordinates
            ]),
            { units: 'meters' }
        );
    }

    path.setData('gtfs', { shape_id: shapeGtfsId });
    path.setData('from_gtfs', true);
    path.set('geography', completeShape.geometry);

    return errors;
};

// TODO Add unit tests
export const generateGeographyAndSegmentsFromStopTimes = (
    path: Path,
    nodeIds: string[],
    stopTimes: StopTime[],
    stopCoordinatesByStopId: { [key: string]: [number, number] },
    defaultLayoverRatioOverTotalTravelTime = 0.1,
    defaultMinLayoverTimeSeconds = 180
): ErrorMessage[] => {
    path.getAttributes().nodes = nodeIds; // reset nodes, they will be regenerated from stop times

    // Return errors when generating the path
    const errors: ErrorMessage[] = [];

    const coordinates = stopTimes
        .map((stopTime) => {
            if (stopCoordinatesByStopId[stopTime.stop_id] === undefined) {
                console.log('undefined stop coordinates for stop id ', stopTime.stop_id);
            }
            return stopCoordinatesByStopId[stopTime.stop_id];
        })
        .filter((coordinate) => coordinate !== undefined);

    if (coordinates.length !== stopTimes.length) {
        console.log('Path generation from stop times: some stop times do not have coordinates. Cannot generate path');
        const line: any = path.getLine();
        errors.push({
            text: GtfsMessages.CannotGenerateFromStopTimes,
            params: {
                lineShortName: line.get('shortname'),
                lineName: line.get('longname')
            }
        });
        path.setData('gtfs', { shape_id: undefined });
        path.set('geography', null);
        return errors;
    }

    const uncleanedCompleteShape = {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates
        }
    };
    const completeShape = turfCleanCoords(uncleanedCompleteShape);
    const totalDistanceInMeters = turfLength(completeShape, { units: 'kilometers' }) * 1000;

    // we create simple path segments between stops and get distances with turf
    const segments: number[] = [];
    const segmentsData: TimeAndDistance[] = [];
    const dwellTimeSecondsData: number[] = [];
    let totalDwellTimeSeconds = 0;
    let totalTravelTimeWithoutDwellTimesSeconds = 0;
    let totalTravelTimeWithDwellTimesSeconds = 0;

    // TODO Calculate the distances between stops, even if it is approximate. But some stop times may have a shape_dist_traveled field
    for (let i = 0, countI = stopTimes.length; i < countI - 1; i++) {
        const stopTime = stopTimes[i];
        const nextStopTime = stopTimes[i + 1];
        const dwellTimeSeconds = stopTime.departureTimeSeconds - stopTime.arrivalTimeSeconds;
        const travelTimeSeconds = Math.ceil(nextStopTime.arrivalTimeSeconds - stopTime.departureTimeSeconds);
        segmentsData.push({
            travelTimeSeconds: travelTimeSeconds, // we should make an average over each period here instead of using the first trip travel times
            distanceMeters: null
        });
        dwellTimeSecondsData.push(dwellTimeSeconds);
        totalDwellTimeSeconds += dwellTimeSeconds;
        totalTravelTimeWithoutDwellTimesSeconds += travelTimeSeconds;
        totalTravelTimeWithDwellTimesSeconds += dwellTimeSeconds + travelTimeSeconds;
        // Since we simply have coordinates, the index of the coordinates is the stop index
        segments.push(i);
    }
    const customLayoverMinutes = path.getAttributes().data.customLayoverMinutes;
    const layoverTimeSeconds =
        customLayoverMinutes !== undefined
            ? customLayoverMinutes * 60
            : Math.ceil(
                Math.max(
                    defaultLayoverRatioOverTotalTravelTime * totalTravelTimeWithDwellTimesSeconds,
                    defaultMinLayoverTimeSeconds
                )
            );

    const pathData = {
        segments: segmentsData,
        dwellTimeSeconds: dwellTimeSecondsData,
        layoverTimeSeconds: layoverTimeSeconds,
        travelTimeWithoutDwellTimesSeconds: totalTravelTimeWithoutDwellTimesSeconds,
        totalDistanceMeters: Math.ceil(totalDistanceInMeters),
        totalDwellTimeSeconds: totalDwellTimeSeconds,
        operatingTimeWithoutLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds,
        operatingTimeWithLayoverTimeSeconds: totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds,
        totalTravelTimeWithReturnBackSeconds: null,
        averageSpeedWithoutDwellTimesMetersPerSecond:
            Math.round((totalDistanceInMeters / totalTravelTimeWithoutDwellTimesSeconds) * 100) / 100,
        operatingSpeedMetersPerSecond:
            Math.round((totalDistanceInMeters / totalTravelTimeWithDwellTimesSeconds) * 100) / 100,
        operatingSpeedWithLayoverMetersPerSecond:
            Math.round((totalDistanceInMeters / (totalTravelTimeWithDwellTimesSeconds + layoverTimeSeconds)) * 100) /
            100,
        returnBackGeography: null,
        nodeTypes: [],
        waypoints: [],
        waypointTypes: []
    };

    path.getAttributes().segments = segments;
    path.getAttributes().data = Object.assign(path.getAttributes().data, pathData);

    path.setData('gtfs', { shape_id: undefined });
    path.setData('from_gtfs', true);
    path.set('geography', completeShape.geometry);

    return errors;
};
