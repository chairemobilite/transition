/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type * as GtfsTypes from 'gtfs-types';
import * as PathGtfsGenerator from '../PathGtfsGeographyGenerator';
import { length as turfLength, cleanCoords as turfCleanCoords } from '@turf/turf';
import Path from 'transition-common/lib/services/path/Path';
import { StopTime } from '../../gtfsImport/GtfsImportTypes';

const simpleShapeWithCorrectStops = {
    shapes: [
        { shape_id : 'simpleShape', shape_pt_lat : 45.53817373794911, shape_pt_lon : -73.61449241638184, shape_pt_sequence : 0 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53901539378457, shape_pt_lon : -73.6138916015625, shape_pt_sequence : 2 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53936107021012, shape_pt_lon : -73.6136770248413, shape_pt_sequence : 5 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539586510212274, shape_pt_lon : -73.61359119415283, shape_pt_sequence : 7 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539766861563216, shape_pt_lon : -73.61352682113647, shape_pt_sequence : 8 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54039808673583, shape_pt_lon : -73.61320495605469, shape_pt_sequence : 9 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54056340644332, shape_pt_lon : -73.61316204071045, shape_pt_sequence : 10 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54164548707048, shape_pt_lon : -73.61264705657959, shape_pt_sequence : 20 },
    ],
    stopTimes: [
        { trip_id: 'simpleTrip', stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
        { trip_id: 'simpleTrip', stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
        { trip_id: 'simpleTrip', stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
        { trip_id: 'simpleTrip', stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
    ],
    coordinatesByStopId: {
        stop1: [ -73.61436367034912, 45.538143678579104 ] as [number, number],
        stop2: [ -73.61350536346436, 45.53933101147487 ] as [number, number],
        stop3: [ -73.61326932907104, 45.540623522580056 ] as [number, number],
        stop4: [ -73.61247539520264, 45.5415252569181 ] as [number, number]
    }
};

const simpleShapeWithOffsettedStops = {
    shapes: simpleShapeWithCorrectStops.shapes,
    stopTimes: simpleShapeWithCorrectStops.stopTimes,
    coordinatesByStopId: {
        stop1: simpleShapeWithCorrectStops.coordinatesByStopId.stop1,
        stop2: simpleShapeWithCorrectStops.coordinatesByStopId.stop2,
        stop3: [ -73.61523807048798, 45.54157785764142 ] as [number, number],
        stop4: simpleShapeWithCorrectStops.coordinatesByStopId.stop4
    }
};

const loopShape = {
    shapes: [
        { shape_id : 'loopShape', shape_pt_lat : 45.54080387060464, shape_pt_lon : -73.62292528152466, shape_pt_sequence : 0 },
        { shape_id : 'loopShape', shape_pt_lat : 45.54002987291301, shape_pt_lon : -73.620285987854, shape_pt_sequence : 2 },
        { shape_id : 'loopShape', shape_pt_lat : 45.539188232262994, shape_pt_lon : -73.61741065979004, shape_pt_sequence : 5 },
        { shape_id : 'loopShape', shape_pt_lat : 45.53909805573183, shape_pt_lon : -73.61730337142943, shape_pt_sequence : 7 },
        { shape_id : 'loopShape', shape_pt_lat : 45.53900036432657, shape_pt_lon : -73.61741065979004, shape_pt_sequence : 8 },
        { shape_id : 'loopShape', shape_pt_lat : 45.53845178635968, shape_pt_lon : -73.61775398254395, shape_pt_sequence : 10 },
        { shape_id : 'loopShape', shape_pt_lat : 45.539308467412866, shape_pt_lon : -73.62066149711609, shape_pt_sequence : 20 },
        { shape_id : 'loopShape', shape_pt_lat : 45.53994721233565, shape_pt_lon : -73.620285987854, shape_pt_sequence : 30 },
        { shape_id : 'loopShape', shape_pt_lat : 45.53999981453531, shape_pt_lon : -73.62014651298523, shape_pt_sequence : 40 },
        { shape_id : 'loopShape', shape_pt_lat : 45.53897030539848, shape_pt_lon : -73.61670255661011, shape_pt_sequence : 50 },
    ],
    stopTimes: [
        { trip_id: 'loopTrip', stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
        { trip_id: 'loopTrip', stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
        { trip_id: 'loopTrip', stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
        { trip_id: 'loopTrip', stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36320 },
        { trip_id: 'loopTrip', stop_id: 'stop5', stop_sequence: 6, arrivalTimeSeconds: 36400, departureTimeSeconds: 36420 },
        { trip_id: 'loopTrip', stop_id: 'stop6', stop_sequence: 7, arrivalTimeSeconds: 36520, departureTimeSeconds: 36520 }
    ],
    coordinatesByStopId: {
        stop1: [ -73.6229145526886, 45.54075126915725 ] as [number, number],
        stop2: [ -73.6203932762146, 45.5399847853404 ] as [number, number],
        stop3: [ -73.61746430397032, 45.53909805573183 ] as [number, number],
        stop4: [ -73.61920237541199, 45.53891770223567 ] as [number, number],
        stop5: [ -73.62035036087036, 45.540086232327894 ] as [number, number],
        stop6: [ -73.61679911613463, 45.53890267275154 ] as [number, number]
    }
};

const shapeToLine = (shape: GtfsTypes.Shapes[]) => {
    return {
        type: 'Feature' as const,
        properties: {},
        geometry: {
            type: 'LineString' as const,
            coordinates: shape.map((coordinate) => {
                return [coordinate.shape_pt_lon, coordinate.shape_pt_lat];
            })
        }
    };
};

describe('Calculate distances on shape, fast approach', () => {

    test('Test simple shape', () => {
        const completeShape = shapeToLine(simpleShapeWithCorrectStops.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistancesFromLineShape({
            stopTimes: simpleShapeWithCorrectStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithCorrectStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithCorrectStops.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('success');
        const stopTimeDistances = result.stopTimeDistances as { distanceTraveled: number; distanceFromShape: number; }[];
        expect(stopTimeDistances).toBeDefined();
        expect(stopTimeDistances.length).toEqual(simpleShapeWithCorrectStops.stopTimes.length);
        let previousDistance = -1;
        for (let i = 0; i < simpleShapeWithCorrectStops.stopTimes.length - 1; i++) {
            expect(stopTimeDistances[i].distanceTraveled).toBeLessThan(totalDistanceInMeters);
            expect(stopTimeDistances[i].distanceTraveled).toBeGreaterThan(previousDistance);
            previousDistance = stopTimeDistances[i].distanceTraveled;
        }
        // Check last stop
        expect(stopTimeDistances[simpleShapeWithCorrectStops.stopTimes.length - 1].distanceTraveled).toEqual(totalDistanceInMeters);
    });

    test('Test simple shape, but with stops too far from shape', () => {
        const completeShape = shapeToLine(simpleShapeWithOffsettedStops.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistancesFromLineShape({
            stopTimes: simpleShapeWithOffsettedStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithOffsettedStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithOffsettedStops.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('failed');
    });

    test('Test loop shape', () => {
        const completeShape = shapeToLine(loopShape.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistancesFromLineShape({
            stopTimes: loopShape.stopTimes,
            stopCoordinatesByStopId: loopShape.coordinatesByStopId,
            shapeCoordinatesWithDistances: loopShape.shapes,
            completeShape,
            totalDistanceInMeters
        });
        // In such a loop, this approach should fail
        expect(result.status).toEqual('failed');
    });

});

describe('Calculate distances on shape, slow approach', () => {

    test('Test simple shape', () => {
        const completeShape = shapeToLine(simpleShapeWithCorrectStops.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistancesBySegments({
            stopTimes: simpleShapeWithCorrectStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithCorrectStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithCorrectStops.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('success');
        const stopTimeDistances = result.stopTimeDistances as { distanceTraveled: number; distanceFromShape: number; }[];
        expect(stopTimeDistances).toBeDefined();
        expect(stopTimeDistances.length).toEqual(simpleShapeWithCorrectStops.stopTimes.length);
        let previousDistance = -1;
        for (let i = 0; i < simpleShapeWithCorrectStops.stopTimes.length - 1; i++) {
            expect(stopTimeDistances[i].distanceTraveled).toBeLessThan(totalDistanceInMeters);
            expect(stopTimeDistances[i].distanceTraveled).toBeGreaterThan(previousDistance);
            previousDistance = stopTimeDistances[i].distanceTraveled;
        }
        // Check last stop
        expect(stopTimeDistances[simpleShapeWithCorrectStops.stopTimes.length - 1].distanceTraveled).toEqual(totalDistanceInMeters);
    });

    test('Test simple shape, but with stops too far from shape', () => {
        const completeShape = shapeToLine(simpleShapeWithOffsettedStops.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistancesBySegments({
            stopTimes: simpleShapeWithOffsettedStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithOffsettedStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithOffsettedStops.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('failed');
    });

    test('Test loop shape', () => {
        const completeShape = shapeToLine(loopShape.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistancesBySegments({
            stopTimes: loopShape.stopTimes,
            stopCoordinatesByStopId: loopShape.coordinatesByStopId,
            shapeCoordinatesWithDistances: loopShape.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('success');
        const stopTimeDistances = result.stopTimeDistances as { distanceTraveled: number; distanceFromShape: number; }[];
        expect(stopTimeDistances).toBeDefined();
        expect(stopTimeDistances.length).toEqual(loopShape.stopTimes.length);
        let previousDistance = -1;
        for (let i = 0; i < loopShape.stopTimes.length - 1; i++) {
            expect(stopTimeDistances[i].distanceTraveled).toBeLessThan(totalDistanceInMeters);
            expect(stopTimeDistances[i].distanceTraveled).toBeGreaterThan(previousDistance);
            previousDistance = stopTimeDistances[i].distanceTraveled;
        }
        // Check last stop
        expect(stopTimeDistances[loopShape.stopTimes.length - 1].distanceTraveled).toEqual(totalDistanceInMeters);
    });

});

describe('Calculate distances, call both approaches', () => {

    const path = new Path({}, true);

    test('Test simple shape', () => {
        const completeShape = shapeToLine(simpleShapeWithCorrectStops.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistances(path, {
            stopTimes: simpleShapeWithCorrectStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithCorrectStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithCorrectStops.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('success');
        const stopTimeDistances = result.stopTimeDistances as { distanceTraveled: number; distanceFromShape: number; }[];
        expect(stopTimeDistances).toBeDefined();
        expect(stopTimeDistances.length).toEqual(simpleShapeWithCorrectStops.stopTimes.length);
        let previousDistance = -1;
        for (let i = 0; i < simpleShapeWithCorrectStops.stopTimes.length - 1; i++) {
            expect(stopTimeDistances[i].distanceTraveled).toBeLessThan(totalDistanceInMeters);
            expect(stopTimeDistances[i].distanceTraveled).toBeGreaterThan(previousDistance);
            previousDistance = stopTimeDistances[i].distanceTraveled;
        }
        // Check last stop
        expect(stopTimeDistances[simpleShapeWithCorrectStops.stopTimes.length - 1].distanceTraveled).toEqual(totalDistanceInMeters);
    });

    test('Test simple shape, but with stops too far from shape', () => {
        const completeShape = shapeToLine(simpleShapeWithOffsettedStops.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistances(path, {
            stopTimes: simpleShapeWithOffsettedStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithOffsettedStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithOffsettedStops.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('failed');
    });

    test('Test loop shape', () => {
        const completeShape = shapeToLine(loopShape.shapes);
        const totalDistanceInMeters = turfLength(completeShape, { units: 'meters' });
        const result = PathGtfsGenerator.calculateDistancesBySegments({
            stopTimes: loopShape.stopTimes,
            stopCoordinatesByStopId: loopShape.coordinatesByStopId,
            shapeCoordinatesWithDistances: loopShape.shapes,
            completeShape,
            totalDistanceInMeters
        });
        expect(result.status).toEqual('success');
        const stopTimeDistances = result.stopTimeDistances as { distanceTraveled: number; distanceFromShape: number; }[];
        expect(stopTimeDistances).toBeDefined();
        expect(stopTimeDistances.length).toEqual(loopShape.stopTimes.length);
        let previousDistance = -1;
        for (let i = 0; i < loopShape.stopTimes.length - 1; i++) {
            expect(stopTimeDistances[i].distanceTraveled).toBeLessThan(totalDistanceInMeters);
            expect(stopTimeDistances[i].distanceTraveled).toBeGreaterThan(previousDistance);
            previousDistance = stopTimeDistances[i].distanceTraveled;
        }
        // Check last stop
        expect(stopTimeDistances[loopShape.stopTimes.length - 1].distanceTraveled).toEqual(totalDistanceInMeters);
    });

});

describe('calculateLayoverTimeSeconds', () => {

    test('should use custom layover when provided', () => {
        expect(PathGtfsGenerator.calculateLayoverTimeSeconds(5, 1000, 0.1, 180)).toEqual(300);
    });

    test('should use ratio when it exceeds default minimum', () => {
        // ratio: 0.1 * 5000 = 500 > 180
        expect(PathGtfsGenerator.calculateLayoverTimeSeconds(undefined, 5000, 0.1, 180)).toEqual(500);
    });

    test('should use default minimum when ratio is below it', () => {
        // ratio: 0.1 * 1000 = 100 < 180
        expect(PathGtfsGenerator.calculateLayoverTimeSeconds(undefined, 1000, 0.1, 180)).toEqual(180);
    });

    test('should ceil the result', () => {
        // ratio: 0.1 * 1801 = 180.1 -> ceil = 181
        expect(PathGtfsGenerator.calculateLayoverTimeSeconds(undefined, 1801, 0.1, 180)).toEqual(181);
    });

});

describe('computeSegmentTimesFromStopTimes', () => {

    const makeStopTimes = (times: [number, number][]): StopTime[] =>
        times.map(([arrival, departure], i) => ({
            trip_id: 'trip1',
            stop_id: `stop${i}`,
            stop_sequence: i,
            arrivalTimeSeconds: arrival,
            departureTimeSeconds: departure
        }));

    test('should compute times with null distances', () => {
        const stopTimes = makeStopTimes([
            [36000, 36000],
            [36090, 36100],
            [36200, 36200]
        ]);
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes([stopTimes], [null, null]);
        expect(result.segmentsData).toEqual([
            { travelTimeSeconds: 90, distanceMeters: null },
            { travelTimeSeconds: 100, distanceMeters: null }
        ]);
        expect(result.dwellTimeSecondsData).toEqual([0, 10]);
        expect(result.totalDwellTimeSeconds).toEqual(10);
        expect(result.totalTravelTimeWithoutDwellTimesSeconds).toEqual(190);
        expect(result.totalTravelTimeWithDwellTimesSeconds).toEqual(200);
    });

    test('should compute times with actual distances', () => {
        const stopTimes = makeStopTimes([
            [36000, 36000],
            [36090, 36100],
            [36200, 36200]
        ]);
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes([stopTimes], [500, 300]);
        expect(result.segmentsData).toEqual([
            { travelTimeSeconds: 90, distanceMeters: 500 },
            { travelTimeSeconds: 100, distanceMeters: 300 }
        ]);
    });

    test('should handle 2-stop path (single segment)', () => {
        const stopTimes = makeStopTimes([
            [36000, 36000],
            [36120, 36120]
        ]);
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes([stopTimes], [null]);
        expect(result.segmentsData).toHaveLength(1);
        expect(result.segmentsData[0].travelTimeSeconds).toEqual(120);
        expect(result.dwellTimeSecondsData).toEqual([0]);
        expect(result.totalDwellTimeSeconds).toEqual(0);
    });

    test('should accumulate dwell times correctly', () => {
        const stopTimes = makeStopTimes([
            [36000, 36010],
            [36100, 36120],
            [36200, 36230],
            [36300, 36300]
        ]);
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes([stopTimes], [null, null, null]);
        expect(result.dwellTimeSecondsData).toEqual([10, 20, 30]);
        expect(result.totalDwellTimeSeconds).toEqual(60);
    });

    test('should ceil travel times', () => {
        const stopTimes = makeStopTimes([
            [36000, 36000],
            [36001.5, 36001.5] // 1.5 second travel
        ]);
        // arrival - departure = 1.5, Math.ceil(1.5) = 2
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes([stopTimes], [null]);
        expect(result.segmentsData[0].travelTimeSeconds).toEqual(2);
    });

    test('should average times across multiple trips', () => {
        // Trip 1: 90s travel (segment 1), 100s travel (segment 2), 10s dwell at stop 1
        const trip1StopTimes = makeStopTimes([
            [36000, 36000],
            [36090, 36100],  // 90s travel, 10s dwell
            [36200, 36200]   // 100s travel
        ]);
        // Trip 2: 110s travel (segment 1), 100s travel (segment 2), 10s dwell at stop 1
        const trip2StopTimes = makeStopTimes([
            [37000, 37000],
            [37110, 37120],  // 110s travel, 10s dwell
            [37220, 37220]   // 100s travel
        ]);
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes(
            [trip1StopTimes, trip2StopTimes],
            [null, null]
        );
        // Average travel times: (90+110)/2=100, (100+100)/2=100
        expect(result.segmentsData[0].travelTimeSeconds).toEqual(100);
        expect(result.segmentsData[1].travelTimeSeconds).toEqual(100);
        // Average dwell times: (0+0)/2=0, (10+10)/2=10
        expect(result.dwellTimeSecondsData).toEqual([0, 10]);
        expect(result.totalDwellTimeSeconds).toEqual(10);
        expect(result.totalTravelTimeWithoutDwellTimesSeconds).toEqual(200);
        expect(result.totalTravelTimeWithDwellTimesSeconds).toEqual(210);
    });

    test('should ceil average travel times', () => {
        // Trip 1: 89s travel, Trip 2: 90s travel -> average 89.5, ceil to 90
        const trip1StopTimes = makeStopTimes([
            [36000, 36000],
            [36089, 36089]
        ]);
        const trip2StopTimes = makeStopTimes([
            [37000, 37000],
            [37090, 37090]
        ]);
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes(
            [trip1StopTimes, trip2StopTimes],
            [null]
        );
        expect(result.segmentsData[0].travelTimeSeconds).toEqual(90); // ceil(89.5)
    });

    test('should round average dwell times', () => {
        // Trip 1: 9s dwell, Trip 2: 10s dwell -> average 9.5, round to 10
        const trip1StopTimes = makeStopTimes([
            [36000, 36009],  // 9s dwell
            [36100, 36100]
        ]);
        const trip2StopTimes = makeStopTimes([
            [37000, 37010],  // 10s dwell
            [37100, 37100]
        ]);
        const result = PathGtfsGenerator.computeSegmentTimesFromStopTimes(
            [trip1StopTimes, trip2StopTimes],
            [null]
        );
        expect(result.dwellTimeSecondsData[0]).toEqual(10); // round(9.5)
    });

});

describe('cleanSegmentCoordinates', () => {

    const makeLineFeature = (coords: number[][]): GeoJSON.Feature<GeoJSON.LineString> => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords }
    });

    test('should remove duplicate first coordinates in 3-coord linestring', () => {
        const feature = makeLineFeature([[1, 2], [1, 2], [3, 4]]);
        const result = PathGtfsGenerator.cleanSegmentCoordinates(feature);
        expect(result).toEqual([[1, 2], [3, 4]]);
    });

    test('should remove duplicate last coordinates in 3-coord linestring', () => {
        const feature = makeLineFeature([[1, 2], [3, 4], [3, 4]]);
        const result = PathGtfsGenerator.cleanSegmentCoordinates(feature);
        expect(result).toEqual([[1, 2], [3, 4]]);
    });

    test('should use turfCleanCoords for 3-coord linestring with no duplicates', () => {
        // Non-collinear points so turfCleanCoords keeps all 3
        const feature = makeLineFeature([[0, 0], [1, 2], [3, 1]]);
        const result = PathGtfsGenerator.cleanSegmentCoordinates(feature);
        expect(result).toEqual([[0, 0], [1, 2], [3, 1]]);
    });

    test('should use turfCleanCoords for >3 coordinates', () => {
        const feature = makeLineFeature([[0, 0], [1, 1], [2, 2], [3, 3]]);
        const result = PathGtfsGenerator.cleanSegmentCoordinates(feature);
        // turfCleanCoords removes collinear middle points
        expect(result).toEqual([[0, 0], [3, 3]]);
    });

    test('should pass through 2-coordinate linestrings via turfCleanCoords', () => {
        const feature = makeLineFeature([[1, 2], [3, 4]]);
        const result = PathGtfsGenerator.cleanSegmentCoordinates(feature);
        expect(result).toEqual([[1, 2], [3, 4]]);
    });

});

describe('normalizeDistancesToMeters', () => {

    test('should proportionally convert arbitrary units to meters', () => {
        const distances: PathGtfsGenerator.StopTimeDistances[] = [
            { distanceTraveled: 0, distanceFromShape: 0 },
            { distanceTraveled: 50, distanceFromShape: 0 },
            { distanceTraveled: 100, distanceFromShape: 0 }
        ];
        PathGtfsGenerator.normalizeDistancesToMeters(distances, 1000);
        expect(distances[0].distanceTraveled).toEqual(0);
        expect(distances[1].distanceTraveled).toEqual(500);
        expect(distances[2].distanceTraveled).toEqual(1000);
    });

    test('should handle single interior stop', () => {
        const distances: PathGtfsGenerator.StopTimeDistances[] = [
            { distanceTraveled: 0, distanceFromShape: 0 },
            { distanceTraveled: 25, distanceFromShape: 0 },
            { distanceTraveled: 200, distanceFromShape: 0 }
        ];
        PathGtfsGenerator.normalizeDistancesToMeters(distances, 500);
        expect(distances[0].distanceTraveled).toEqual(0);
        expect(distances[1].distanceTraveled).toBeCloseTo(62.5);
        expect(distances[2].distanceTraveled).toEqual(500);
    });

    test('should set first distance to 0 even if it had a different value', () => {
        const distances: PathGtfsGenerator.StopTimeDistances[] = [
            { distanceTraveled: 10, distanceFromShape: 0 },
            { distanceTraveled: 50, distanceFromShape: 0 },
            { distanceTraveled: 100, distanceFromShape: 0 }
        ];
        PathGtfsGenerator.normalizeDistancesToMeters(distances, 1000);
        expect(distances[0].distanceTraveled).toEqual(0);
    });

});

describe('sliceShapeIntoSegments', () => {

    test('should produce correct segment count', () => {
        const completeShape = shapeToLine(simpleShapeWithCorrectStops.shapes);
        const cleanedShape = turfCleanCoords(completeShape);
        const totalDistance = turfLength(cleanedShape, { units: 'meters' });
        const distResult = PathGtfsGenerator.calculateDistancesFromLineShape({
            stopTimes: simpleShapeWithCorrectStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithCorrectStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithCorrectStops.shapes,
            completeShape: cleanedShape,
            totalDistanceInMeters: totalDistance
        });
        expect(distResult.status).toEqual('success');
        const stopTimeDistances = distResult.stopTimeDistances as PathGtfsGenerator.StopTimeDistances[];

        const result = PathGtfsGenerator.sliceShapeIntoSegments(cleanedShape, stopTimeDistances, 4);
        // 4 stops => 3 segments
        expect(result.segments).toHaveLength(3);
        expect(result.segmentDistancesMeters).toHaveLength(3);
        expect(result.globalCoordinates.length).toBeGreaterThanOrEqual(3);
    });

    test('should have first segment index at 0', () => {
        const completeShape = shapeToLine(simpleShapeWithCorrectStops.shapes);
        const cleanedShape = turfCleanCoords(completeShape);
        const totalDistance = turfLength(cleanedShape, { units: 'meters' });
        const distResult = PathGtfsGenerator.calculateDistancesFromLineShape({
            stopTimes: simpleShapeWithCorrectStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithCorrectStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithCorrectStops.shapes,
            completeShape: cleanedShape,
            totalDistanceInMeters: totalDistance
        });
        const stopTimeDistances = distResult.stopTimeDistances as PathGtfsGenerator.StopTimeDistances[];

        const result = PathGtfsGenerator.sliceShapeIntoSegments(cleanedShape, stopTimeDistances, 4);
        expect(result.segments[0]).toEqual(0);
    });

    test('should have consistent total distance across segments', () => {
        const completeShape = shapeToLine(simpleShapeWithCorrectStops.shapes);
        const cleanedShape = turfCleanCoords(completeShape);
        const totalDistance = turfLength(cleanedShape, { units: 'meters' });
        const distResult = PathGtfsGenerator.calculateDistancesFromLineShape({
            stopTimes: simpleShapeWithCorrectStops.stopTimes,
            stopCoordinatesByStopId: simpleShapeWithCorrectStops.coordinatesByStopId,
            shapeCoordinatesWithDistances: simpleShapeWithCorrectStops.shapes,
            completeShape: cleanedShape,
            totalDistanceInMeters: totalDistance
        });
        const stopTimeDistances = distResult.stopTimeDistances as PathGtfsGenerator.StopTimeDistances[];

        const result = PathGtfsGenerator.sliceShapeIntoSegments(cleanedShape, stopTimeDistances, 4);
        const sumOfSegments = result.segmentDistancesMeters.reduce((a, b) => a + b, 0);
        // Sum of ceiled segment distances should be close to total distance (within rounding)
        expect(sumOfSegments).toBeGreaterThan(0);
        expect(sumOfSegments).toBeLessThanOrEqual(Math.ceil(totalDistance) + result.segmentDistancesMeters.length);
    });

});

describe('buildPathData', () => {

    test('should compute speed metrics correctly', () => {
        const segmentTimes: PathGtfsGenerator.SegmentTimeResults = {
            segmentsData: [
                { travelTimeSeconds: 100, distanceMeters: 500 },
                { travelTimeSeconds: 200, distanceMeters: 500 }
            ],
            dwellTimeSecondsData: [0, 10],
            totalDwellTimeSeconds: 10,
            totalTravelTimeWithoutDwellTimesSeconds: 300,
            totalTravelTimeWithDwellTimesSeconds: 310
        };
        const result = PathGtfsGenerator.buildPathData({
            segmentTimes,
            layoverTimeSeconds: 180,
            totalDistanceMeters: 1000
        });
        expect(result.totalDistanceMeters).toEqual(1000);
        expect(result.travelTimeWithoutDwellTimesSeconds).toEqual(300);
        expect(result.operatingTimeWithoutLayoverTimeSeconds).toEqual(310);
        expect(result.operatingTimeWithLayoverTimeSeconds).toEqual(490);
        // averageSpeedWithoutDwellTimes: 1000 / 300 = 3.33
        expect(result.averageSpeedWithoutDwellTimesMetersPerSecond).toBeCloseTo(3.33, 2);
        // operatingSpeed: 1000 / 310 = 3.23
        expect(result.operatingSpeedMetersPerSecond).toBeCloseTo(3.23, 2);
        // operatingSpeedWithLayover: 1000 / 490 = 2.04
        expect(result.operatingSpeedWithLayoverMetersPerSecond).toBeCloseTo(2.04, 2);
    });

    test('should pass through null and empty fields', () => {
        const segmentTimes: PathGtfsGenerator.SegmentTimeResults = {
            segmentsData: [{ travelTimeSeconds: 100, distanceMeters: null }],
            dwellTimeSecondsData: [0],
            totalDwellTimeSeconds: 0,
            totalTravelTimeWithoutDwellTimesSeconds: 100,
            totalTravelTimeWithDwellTimesSeconds: 100
        };
        const result = PathGtfsGenerator.buildPathData({
            segmentTimes,
            layoverTimeSeconds: 180,
            totalDistanceMeters: 500
        });
        expect(result.totalTravelTimeWithReturnBackSeconds).toBeNull();
        expect(result.returnBackGeography).toBeNull();
        expect(result.nodeTypes).toEqual([]);
        expect(result.waypoints).toEqual([]);
        expect(result.waypointTypes).toEqual([]);
    });

    test('should pass through dwell time array', () => {
        const segmentTimes: PathGtfsGenerator.SegmentTimeResults = {
            segmentsData: [
                { travelTimeSeconds: 90, distanceMeters: null },
                { travelTimeSeconds: 100, distanceMeters: null }
            ],
            dwellTimeSecondsData: [0, 10, 0],
            totalDwellTimeSeconds: 10,
            totalTravelTimeWithoutDwellTimesSeconds: 190,
            totalTravelTimeWithDwellTimesSeconds: 200
        };
        const result = PathGtfsGenerator.buildPathData({
            segmentTimes,
            layoverTimeSeconds: 180,
            totalDistanceMeters: 1000
        });
        expect(result.dwellTimeSeconds).toEqual([0, 10, 0]);
        expect(result.totalDwellTimeSeconds).toEqual(10);
    });

    test('should ceil total distance', () => {
        const segmentTimes: PathGtfsGenerator.SegmentTimeResults = {
            segmentsData: [{ travelTimeSeconds: 100, distanceMeters: null }],
            dwellTimeSecondsData: [0],
            totalDwellTimeSeconds: 0,
            totalTravelTimeWithoutDwellTimesSeconds: 100,
            totalTravelTimeWithDwellTimesSeconds: 100
        };
        const result = PathGtfsGenerator.buildPathData({
            segmentTimes,
            layoverTimeSeconds: 180,
            totalDistanceMeters: 999.3
        });
        expect(result.totalDistanceMeters).toEqual(1000);
    });

});
