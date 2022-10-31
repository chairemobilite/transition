/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as GtfsTypes from 'gtfs-types';
import * as PathGtfsGenerator from '../PathGtfsGeographyGenerator';
import { length as turfLength } from '@turf/turf';
import Path from 'transition-common/lib/services/path/Path';

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
}

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