/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import { defaultInternalImportData, offsetStopTimes } from './GtfsImportData.test';
import Line from 'transition-common/lib/services/line/Line';
import Path from 'transition-common/lib/services/path/Path';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import PathImporter from '../PathImporter';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import { generateGeographyAndSegmentsFromGtfs, generateGeographyAndSegmentsFromStopTimes } from '../../path/PathGtfsGeographyGenerator';
import pathsDbQueries from '../../../models/db/transitPaths.db.queries';

jest.mock('../../../models/db/transitPaths.db.queries');

jest.mock('../../path/PathGtfsGeographyGenerator', () => ({
    generateGeographyAndSegmentsFromStopTimes: jest.fn(),
    generateGeographyAndSegmentsFromGtfs: jest.fn()
}));
const mockedPathGenerationFromGTFS = generateGeographyAndSegmentsFromGtfs as jest.MockedFunction<typeof generateGeographyAndSegmentsFromGtfs>;
const mockedPathGenerationFromStopTimes = generateGeographyAndSegmentsFromStopTimes as jest.MockedFunction<typeof generateGeographyAndSegmentsFromStopTimes>;
const setPathGeography = (path: Path, nodeIds: string[], gtfsShapeId: string | undefined) => {
    path.getAttributes().nodes = nodeIds;
    path.getAttributes().geography = {
        type: 'LineString' as const,
        coordinates: []
    };
    path.setData('gtfs', { shape_id: gtfsShapeId })
}
mockedPathGenerationFromGTFS.mockImplementation((path, _coords, nodeIds, _stopTimes, gtfsShapeId) => {
    setPathGeography(path, nodeIds, gtfsShapeId);
    return [];
});
mockedPathGenerationFromStopTimes.mockImplementation((path, nodeIds, _stopTimes, _stopCoords) => {
    setPathGeography(path, nodeIds, undefined);
    return [];
});

const importData = Object.assign({}, defaultInternalImportData);
const routeId = uuidV4();
importData.lineIdsByRouteGtfsId[routeId] = uuidV4();
const collectionManager = new CollectionManager(null, { });
const line = new Line({id: importData.lineIdsByRouteGtfsId[routeId], mode: 'metro', category: 'A' }, false, collectionManager);
const lineCollection = new LineCollection([line], {});
collectionManager.add('lines', lineCollection);

beforeEach(() => {
    (pathsDbQueries.createMultiple as any).mockClear();
});

describe('One line, 2 identical simple trips', () => {
    // Prepare shape data (it doesn't matter, we won't do anything with it)
    const shapePoints = [
        { shape_id : 'simpleShape', shape_pt_lat : 45.53817373794911, shape_pt_lon : -73.61449241638184, shape_pt_sequence : 0 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53901539378457, shape_pt_lon : -73.6138916015625, shape_pt_sequence : 2 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53936107021012, shape_pt_lon : -73.6136770248413, shape_pt_sequence : 5 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539586510212274, shape_pt_lon : -73.61359119415283, shape_pt_sequence : 7 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539766861563216, shape_pt_lon : -73.61352682113647, shape_pt_sequence : 8 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54039808673583, shape_pt_lon : -73.61320495605469, shape_pt_sequence : 9 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54056340644332, shape_pt_lon : -73.61316204071045, shape_pt_sequence : 10 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54164548707048, shape_pt_lon : -73.61264705657959, shape_pt_sequence : 20 },
    ];
    importData.shapeById = {};
    importData.shapeById[shapePoints[0].shape_id] = shapePoints;
    importData.stopCoordinatesByStopId = {
        stop1: [ -73.61436367034912, 45.538143678579104 ] as [number, number],
        stop2: [ -73.61350536346436, 45.53933101147487 ] as [number, number],
        stop3: [ -73.61326932907104, 45.540623522580056 ] as [number, number],
        stop4: [ -73.61247539520264, 45.5415252569181 ] as [number, number]
    };
    const tripId = 'simpleTrip';
    const tripsByRouteId = {};
    const baseTripAndStopTimes = {
        trip: { route_id: routeId, service_id: uuidV4(), trip_id: tripId, trip_headsign: 'Test West', direction_id: 0, shape_id: shapePoints[0].shape_id },
        stopTimes: [
            { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
            { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
            { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    tripsByRouteId[routeId] = [
        baseTripAndStopTimes,
        { trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600))}
    ];

    test('Generate path without warnings', async () => {
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(1);
        expect(result.pathIdsByTripId[tripId]).toBeDefined();
        expect(result.warnings).toEqual([]);
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });

    test('Generate path with warnings', async () => {
        const warnings = ['warning1', 'warning2'];
        mockedPathGenerationFromGTFS.mockImplementationOnce((path, _coords, nodeIds, _stopTimes, gtfsShapeId) => {
            setPathGeography(path, nodeIds, gtfsShapeId);
            return warnings;
        });
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(1);
        expect(result.pathIdsByTripId[tripId]).toBeDefined();
        expect(result.warnings).toEqual(warnings);
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });

    test('Generate path, with pre-existing paths', async () => {
        // Create collection manager and line for tests
        const innerCollectionManager = new CollectionManager(null, { });
        const innerLine = new Line(line.getAttributes(), false, innerCollectionManager);
        innerCollectionManager.add('lines', new LineCollection([innerLine], {}));

        // make a first call and add paths to the line
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, innerCollectionManager) as any;
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        const pathAttributes = (pathsDbQueries.createMultiple as any).mock.calls[0][0];
        const paths = pathAttributes.map((attribs, index) => (new Path({ ...attribs, integer_id: index }, false)).toGeojson());
        innerLine.getAttributes().path_ids = pathAttributes.map(attribs => attribs.id);
        const pathCollection = new PathCollection(paths, {});
        innerCollectionManager.add('paths', pathCollection);
        innerLine.refreshPaths();
        expect(innerLine.getPaths().length).toEqual(paths.length);

        // Import the paths again, it should use the same path as previously
        const result2 = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, innerCollectionManager) as any;
        expect(result2.status).toEqual('success');
        expect(result2.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result2.pathIdsByTripId).length).toEqual(1);
        expect(result2.pathIdsByTripId[tripId]).toEqual(result.pathIdsByTripId[tripId]);
    });

});

describe('One line, 2 different trip IDs with same shape', () => {
    // Prepare shape data (it doesn't matter, we won't do anything with it)
    const shapePoints = [
        { shape_id : 'simpleShape', shape_pt_lat : 45.53817373794911, shape_pt_lon : -73.61449241638184, shape_pt_sequence : 0 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53901539378457, shape_pt_lon : -73.6138916015625, shape_pt_sequence : 2 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53936107021012, shape_pt_lon : -73.6136770248413, shape_pt_sequence : 5 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539586510212274, shape_pt_lon : -73.61359119415283, shape_pt_sequence : 7 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539766861563216, shape_pt_lon : -73.61352682113647, shape_pt_sequence : 8 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54039808673583, shape_pt_lon : -73.61320495605469, shape_pt_sequence : 9 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54056340644332, shape_pt_lon : -73.61316204071045, shape_pt_sequence : 10 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54164548707048, shape_pt_lon : -73.61264705657959, shape_pt_sequence : 20 },
    ];
    importData.shapeById = {};
    importData.shapeById[shapePoints[0].shape_id] = shapePoints;
    importData.stopCoordinatesByStopId = {
        stop1: [ -73.61436367034912, 45.538143678579104 ] as [number, number],
        stop2: [ -73.61350536346436, 45.53933101147487 ] as [number, number],
        stop3: [ -73.61326932907104, 45.540623522580056 ] as [number, number],
        stop4: [ -73.61247539520264, 45.5415252569181 ] as [number, number]
    };
    const tripId = 'simpleTrip';
    const tripId2 = 'simpleTrip2';
    const tripsByRouteId = {};
    const baseTripAndStopTimes = {
        trip: { route_id: routeId, service_id: uuidV4(), trip_id: tripId, trip_headsign: 'Test West', direction_id: 0, shape_id: shapePoints[0].shape_id },
        stopTimes: [
            { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
            { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
            { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    tripsByRouteId[routeId] = [
        baseTripAndStopTimes,
        { 
            trip: { route_id: routeId, service_id: uuidV4(), trip_id: tripId2, trip_headsign: 'Test West', direction_id: 0, shape_id: shapePoints[0].shape_id },
            stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => Object.assign(offsetStopTimes(stopTime, 600), {trip_id: tripId2}))
        }
    ];

    test('Generate path', async () => {
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(2);
        expect(result.pathIdsByTripId[tripId]).toBeDefined();
        expect(result.pathIdsByTripId[tripId2]).toBeDefined();
        expect(result.pathIdsByTripId[tripId2]).toEqual(result.pathIdsByTripId[tripId]);
        expect(result.warnings).toEqual([]);
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });

});

describe('One line, multiple trips resulting in 2 paths', () => {
    // Prepare shape data (it doesn't matter, we won't do anything with it)
    const shapePoints1 = [
        { shape_id : 'simpleShape', shape_pt_lat : 45.53817373794911, shape_pt_lon : -73.61449241638184, shape_pt_sequence : 0 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53901539378457, shape_pt_lon : -73.6138916015625, shape_pt_sequence : 2 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.53936107021012, shape_pt_lon : -73.6136770248413, shape_pt_sequence : 5 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539586510212274, shape_pt_lon : -73.61359119415283, shape_pt_sequence : 7 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.539766861563216, shape_pt_lon : -73.61352682113647, shape_pt_sequence : 8 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54039808673583, shape_pt_lon : -73.61320495605469, shape_pt_sequence : 9 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54056340644332, shape_pt_lon : -73.61316204071045, shape_pt_sequence : 10 },
        { shape_id : 'simpleShape', shape_pt_lat : 45.54164548707048, shape_pt_lon : -73.61264705657959, shape_pt_sequence : 20 },
    ];
    const shapePoints2 = [
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.54164548707048, shape_pt_lon : -73.61264705657959, shape_pt_sequence : 0 },
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.54056340644332, shape_pt_lon : -73.61316204071045, shape_pt_sequence : 2 },
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.54039808673583, shape_pt_lon : -73.61320495605469, shape_pt_sequence : 3 },
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.539766861563216, shape_pt_lon : -73.61352682113647, shape_pt_sequence : 4 },
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.539586510212274, shape_pt_lon : -73.61359119415283, shape_pt_sequence : 5 },
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.53936107021012, shape_pt_lon : -73.6136770248413, shape_pt_sequence : 6 },
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.53901539378457, shape_pt_lon : -73.6138916015625, shape_pt_sequence : 7 },
        { shape_id : 'simpleReturnShape', shape_pt_lat : 45.53817373794911, shape_pt_lon : -73.61449241638184, shape_pt_sequence : 8 }, 
    ];
    importData.shapeById = {};
    importData.shapeById[shapePoints1[0].shape_id] = shapePoints1;
    importData.shapeById[shapePoints2[0].shape_id] = shapePoints2;

    importData.stopCoordinatesByStopId = {
        stop1: [ -73.61436367034912, 45.538143678579104 ] as [number, number],
        stop2: [ -73.61350536346436, 45.53933101147487 ] as [number, number],
        stop3: [ -73.61326932907104, 45.540623522580056 ] as [number, number],
        stop4: [ -73.61247539520264, 45.5415252569181 ] as [number, number]
    };

    const tripId = 'simpleTrip';
    const returnTripId = 'simpleReturnTrip';
    const tripsByRouteId = {};
    const baseTripAndStopTimes = {
        trip: { route_id: routeId, service_id: uuidV4(), trip_id: tripId, trip_headsign: 'Test West', direction_id: 0, shape_id: shapePoints1[0].shape_id },
        stopTimes: [
            { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
            { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
            { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    const baseReturnTripAndStopTimes = {
        trip: { route_id: routeId, service_id: uuidV4(), trip_id: returnTripId, trip_headsign: 'Test East', direction_id: 0, shape_id: shapePoints2[0].shape_id },
        stopTimes: [
            { trip_id: returnTripId, stop_id: 'stop4', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: returnTripId, stop_id: 'stop3', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
            { trip_id: returnTripId, stop_id: 'stop2', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
            { trip_id: returnTripId, stop_id: 'stop1', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    tripsByRouteId[routeId] = [
        baseTripAndStopTimes,
        baseReturnTripAndStopTimes,
        { trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600))},
        { trip: baseReturnTripAndStopTimes.trip, stopTimes: baseReturnTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600))},
        { trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 1200))},
    ];

    test('Generate path without warnings', async () => {
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(2);
        expect(result.pathIdsByTripId[tripId]).toBeDefined();
        expect(result.pathIdsByTripId[returnTripId]).toBeDefined();
        expect(result.warnings).toEqual([]);
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });

    test('Generate path with warnings', async () => {
        const warnings = ['warning1', 'warning2'];
        mockedPathGenerationFromGTFS.mockImplementationOnce((path, _coords, nodeIds, _stopTimes, gtfsShapeId) => {
            setPathGeography(path, nodeIds, gtfsShapeId);
            return warnings;
        });
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(2);
        expect(result.pathIdsByTripId[tripId]).toBeDefined();
        expect(result.pathIdsByTripId[returnTripId]).toBeDefined();
        expect(result.warnings).toEqual(warnings);
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });

    test('Add a trip with no shape, should generate a trip', async () => {
        const tripWithNoShape = 'noshape';
        tripsByRouteId[routeId].push({
            trip: { route_id: routeId, service_id: uuidV4(), trip_id: tripWithNoShape, trip_headsign: 'Test East', direction_id: 0 },
            stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => Object.assign(offsetStopTimes(stopTime, 600), { trip_id: tripWithNoShape }))
        });
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(3);
        expect(result.pathIdsByTripId[tripWithNoShape]).toBeDefined();
        expect(result.warnings.length).toEqual(1);
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });


    test('Throw an error during generation', async () => {
        const error = 'error';
        mockedPathGenerationFromGTFS.mockImplementationOnce((path) => {
            throw error;
        });
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(0);
        expect(result.warnings.length).toEqual(1);
    });

});

describe('Multiple lines, with 2 paths each', () => {
    // Prepare the second line
    const expressRouteId = uuidV4();
    importData.lineIdsByRouteGtfsId[expressRouteId] = uuidV4();
    const expressLine = new Line({id: importData.lineIdsByRouteGtfsId[expressRouteId], mode: 'metro', category: 'A' }, false);
    lineCollection.add(expressLine);

    // Prepare shape data (it doesn't matter, we won't do anything with it)
    const shapePoints1Line1 = [
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.53817373794911, shape_pt_lon : -73.61449241638184, shape_pt_sequence : 0 },
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.53901539378457, shape_pt_lon : -73.6138916015625, shape_pt_sequence : 2 },
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.53936107021012, shape_pt_lon : -73.6136770248413, shape_pt_sequence : 5 },
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.539586510212274, shape_pt_lon : -73.61359119415283, shape_pt_sequence : 7 },
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.539766861563216, shape_pt_lon : -73.61352682113647, shape_pt_sequence : 8 },
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.54039808673583, shape_pt_lon : -73.61320495605469, shape_pt_sequence : 9 },
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.54056340644332, shape_pt_lon : -73.61316204071045, shape_pt_sequence : 10 },
        { shape_id : 'Line1Shape1', shape_pt_lat : 45.54164548707048, shape_pt_lon : -73.61264705657959, shape_pt_sequence : 20 },
    ];
    const shapePoints2Line1 = [
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.54164548707048, shape_pt_lon : -73.61264705657959, shape_pt_sequence : 0 },
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.54056340644332, shape_pt_lon : -73.61316204071045, shape_pt_sequence : 2 },
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.54039808673583, shape_pt_lon : -73.61320495605469, shape_pt_sequence : 3 },
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.539766861563216, shape_pt_lon : -73.61352682113647, shape_pt_sequence : 4 },
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.539586510212274, shape_pt_lon : -73.61359119415283, shape_pt_sequence : 5 },
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.53936107021012, shape_pt_lon : -73.6136770248413, shape_pt_sequence : 6 },
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.53901539378457, shape_pt_lon : -73.6138916015625, shape_pt_sequence : 7 },
        { shape_id : 'Line1Shape2', shape_pt_lat : 45.53817373794911, shape_pt_lon : -73.61449241638184, shape_pt_sequence : 8 }, 
    ];
    const shapePoints1Line2 = shapePoints1Line1.map(shapePoint => Object.assign({}, shapePoint, {shape_id: 'Line2Shape1'}));
    const shapePoints2Line2 = shapePoints2Line1.map(shapePoint => Object.assign({}, shapePoint, {shape_id: 'Line2Shape2'}));
    importData.shapeById = {};
    importData.shapeById[shapePoints1Line1[0].shape_id] = shapePoints1Line1;
    importData.shapeById[shapePoints2Line1[0].shape_id] = shapePoints2Line1;
    importData.shapeById[shapePoints1Line2[0].shape_id] = shapePoints1Line2;
    importData.shapeById[shapePoints2Line2[0].shape_id] = shapePoints2Line2;

    importData.stopCoordinatesByStopId = {
        stop1: [ -73.61436367034912, 45.538143678579104 ] as [number, number],
        stop2: [ -73.61350536346436, 45.53933101147487 ] as [number, number],
        stop3: [ -73.61326932907104, 45.540623522580056 ] as [number, number],
        stop4: [ -73.61247539520264, 45.5415252569181 ] as [number, number]
    };

    const tripIdLine1 = 'simpleTripLine1';
    const returnTripIdLine1 = 'simpleReturnTripLine1';
    const tripIdLine2 = 'simpleTripLine2';
    const returnTripIdLine2 = 'simpleReturnTripLine2';
    const tripsByRouteId = {};
    const baseTripAndStopTimes = {
        trip: { route_id: routeId, service_id: uuidV4(), trip_id: tripIdLine1, trip_headsign: 'Test West', direction_id: 0, shape_id: shapePoints1Line1[0].shape_id },
        stopTimes: [
            { trip_id: tripIdLine1, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: tripIdLine1, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
            { trip_id: tripIdLine1, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
            { trip_id: tripIdLine1, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    const baseReturnTripAndStopTimes = {
        trip: { route_id: routeId, service_id: uuidV4(), trip_id: returnTripIdLine1, trip_headsign: 'Test East', direction_id: 0, shape_id: shapePoints2Line1[0].shape_id },
        stopTimes: [
            { trip_id: returnTripIdLine1, stop_id: 'stop4', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: returnTripIdLine1, stop_id: 'stop3', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
            { trip_id: returnTripIdLine1, stop_id: 'stop2', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
            { trip_id: returnTripIdLine1, stop_id: 'stop1', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    tripsByRouteId[routeId] = [
        baseTripAndStopTimes,
        baseReturnTripAndStopTimes,
        { trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600))},
        { trip: baseReturnTripAndStopTimes.trip, stopTimes: baseReturnTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600))},
        { trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 1200))},
    ];
    const expressTripAndStopTimes = {
        trip: { route_id: expressRouteId, service_id: uuidV4(), trip_id: tripIdLine2, trip_headsign: 'Test West Express', direction_id: 0, shape_id: shapePoints1Line2[0].shape_id },
        stopTimes: [
            { trip_id: tripIdLine2, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: tripIdLine2, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    };
    const expressReturnTripAndStopTimes = {
        trip: { route_id: expressRouteId, service_id: uuidV4(), trip_id: returnTripIdLine2, trip_headsign: 'Test East Express', direction_id: 1, shape_id: shapePoints2Line2[0].shape_id },
        stopTimes: [
            { trip_id: tripIdLine2, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: tripIdLine2, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    tripsByRouteId[expressRouteId] = [
        expressTripAndStopTimes,
        expressReturnTripAndStopTimes
    ];

    test('Generate path without warnings', async () => {
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(4);
        expect((result as any).warnings).toEqual([]);
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });

    test('Generate path with warnings', async () => {
        const warningsLine1 = ['warning1', 'warning2'];
        const warningsLine2 = ['warning3'];
        mockedPathGenerationFromGTFS.mockImplementationOnce((path, _coords, nodeIds, _stopTimes, gtfsShapeId) => {
            setPathGeography(path, nodeIds, gtfsShapeId);
            return warningsLine1;
        });
        mockedPathGenerationFromGTFS.mockImplementationOnce((path, _coords, nodeIds, _stopTimes, gtfsShapeId) => {
            setPathGeography(path, nodeIds, gtfsShapeId);
            return warningsLine2;
        });
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(4);
        expect(result.warnings).toEqual(warningsLine1.concat(warningsLine2));
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        // expect(pathsDbQueries.createMultiple).toHaveBeenCalledWith([importData.lineIdsByRouteGtfsId[routeId]]);
    });

    test('Throw an error during generation', async () => {
        const error = 'error';
        mockedPathGenerationFromGTFS.mockImplementationOnce((path) => {
            throw error;
        });
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(2);
        expect(result.warnings.length).toEqual(1);
    });

});

describe('One line, 3 trips with no shape', () => {
    // Prepare test data, without a shape
    // 2 trips have same nodes, another one is for other direction
    importData.shapeById = {};
    importData.stopCoordinatesByStopId = {
        stop1: [ -73.61436367, 45.53814367 ] as [number, number],
        stop2: [ -73.61350536, 45.53933101 ] as [number, number],
        stop3: [ -73.61326933, 45.54062352 ] as [number, number],
        stop4: [ -73.61247539, 45.54152525 ] as [number, number]
    };
    const tripId = 'simpleTrip';
    const tripsByRouteId = {};
    const baseTripAndStopTimes = {
        trip: { route_id: routeId, service_id: uuidV4(), trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
        stopTimes: [
            { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
            { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
            { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
            { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
        ]
    }
    tripsByRouteId[routeId] = [
        baseTripAndStopTimes,
        {
            trip: { ...baseTripAndStopTimes.trip, trip_id: 'simpleTrip2' },
            stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600)),
        }, {
            trip: { ...baseTripAndStopTimes.trip, trip_id: 'returnTrip', trip_headsign: 'Test east', direction_id: 1 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        }
    ];

    test('Generate path', async () => {
        const result = await PathImporter.generateAndImportPaths(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.pathIdsByTripId).toBeDefined();
        expect(Object.keys(result.pathIdsByTripId).length).toEqual(3);
        expect(result.pathIdsByTripId[tripId]).toBeDefined();
        expect(result.warnings.length).toEqual(1);
        expect(result.warnings[0].text).toEqual('transit:gtfs:errors:TripHasNoShape');
        expect(pathsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        expect(mockedPathGenerationFromStopTimes).toHaveBeenCalledTimes(2);
    });

});
