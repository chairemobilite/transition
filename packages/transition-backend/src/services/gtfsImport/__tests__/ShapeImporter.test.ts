/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import { gtfsValidSimpleData, defaultInternalImportData } from './GtfsImportData.test';
import ShapeImporter from '../ShapeImporter';
import TripImporter from '../TripImporter';

let currentData: any = gtfsValidSimpleData;

jest.mock('chaire-lib-backend/lib/services/files/CsvFile', () => {
    return {
        parseCsvFile: jest.fn().mockImplementation(async (filePath, rowCallback, _options) => {
            const data = currentData[filePath];
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    rowCallback(data[i], i);
                }
            }
        })
    }
});

describe('GTFS Shape import preparation', () => {
    test('Test prepare shape data, nothing imported', async () => {
        currentData = gtfsValidSimpleData

        const importer = new ShapeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(0);
    });

    test('Test invalid shape data', async() => {
        const shapeIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: uuidV4(), shape_id: shapeIdToImport }];

        const badLat = { shape_id: shapeIdToImport, shape_pt_lat: 'notalat', shape_pt_lon: '-73', shape_pt_sequence: '3', shape_dist_traveled: '1' };
        const badLon = { shape_id: shapeIdToImport, shape_pt_lat: '45', shape_pt_lon: 'notalon', shape_pt_sequence: '3', shape_dist_traveled: '1' };
        const badSeq1 = { shape_id: shapeIdToImport, shape_pt_lat: '45', shape_pt_lon: '-73', shape_pt_sequence: 'notanumber', shape_dist_traveled: '1' };
        const badSeq2 = { shape_id: shapeIdToImport, shape_pt_lat: '45', shape_pt_lon: '-73', shape_pt_sequence: '-1', shape_dist_traveled: '1' };
        const badDist = { shape_id: shapeIdToImport, shape_pt_lat: '45', shape_pt_lon: '-73', shape_pt_sequence: '3', shape_dist_traveled: 'notadist' };
        const negativeDist = { shape_id: shapeIdToImport, shape_pt_lat: '45', shape_pt_lon: '-73', shape_pt_sequence: '3', shape_dist_traveled: '-1.432' };
        const absentFields = { shape_id: shapeIdToImport };
        currentData = {
            'shapes.txt': [ badLat, badLon, badSeq1, badSeq2, badDist, negativeDist, absentFields ]
        };

        const importer = new ShapeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(2);
        expect(data[0].shape_dist_traveled).toBeUndefined();
        expect(data[1].shape_dist_traveled).toBeUndefined();
    });

    test('Test data conversion', async() => {
        const shapeIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: uuidV4(), shape_id: shapeIdToImport }];

        const field = { shape_id: shapeIdToImport, shape_pt_lat: '45.6555', shape_pt_lon: '-73.001', shape_pt_sequence: '3', shape_dist_traveled: '1.4321' };
        currentData = {
            'shapes.txt': [ field ]
        };

        const importer = new ShapeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(1);
        expect(data[0]).toEqual({
            shape_id: shapeIdToImport,
            shape_pt_lat: 45.6555,
            shape_pt_lon: -73.001,
            shape_pt_sequence: 3,
            shape_dist_traveled: 1.4321
        });
    });
});

describe('GTFS Shape import preparation, using all base trips', () => {
    const routeIdsByGtfsIds = {};
    const serviceIdsByGtfsIds = {};
    gtfsValidSimpleData['trips.txt'].forEach(trip => {
        routeIdsByGtfsIds[trip.route_id] = uuidV4();
        serviceIdsByGtfsIds[trip.service_id] = uuidV4();
    });
    const importData = Object.assign({}, defaultInternalImportData, { 
        lineIdsByRouteGtfsId: routeIdsByGtfsIds, 
        serviceIdsByGtfsId: serviceIdsByGtfsIds 
    });
    const tripImporter = new TripImporter({ directoryPath: '' });

    test('Test prepare import data', async () => {
        currentData = gtfsValidSimpleData;
        const tripData = await tripImporter.prepareImportData(importData);
        importData.tripsToImport = tripData;

        const importer = new ShapeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(currentData['shapes.txt'].length);
    });

    test('Test prepare shape data', async () => {
        currentData = gtfsValidSimpleData;
        const tripData = await tripImporter.prepareImportData(importData);
        importData.tripsToImport = tripData;

        const importer = new ShapeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        const shapeData = ShapeImporter.groupShapesById(data);
        expect(Object.keys(shapeData).length).toEqual(4);
        const keys = Object.keys(shapeData);
        for (let i = 0; i < keys.length; i++) {
            const shapePoints = shapeData[keys[i]];
            for (let pointIndex = 1; pointIndex < shapePoints.length; pointIndex++) {
                expect(shapePoints[pointIndex-1].shape_pt_sequence).toBeLessThan(shapePoints[pointIndex].shape_pt_sequence);
            }
        }
    });

});

describe('GTFS Shape import preparation, one trip, one shape', () => {
    const oneTrip = gtfsValidSimpleData['trips.txt'][0];
    const importData = Object.assign({}, defaultInternalImportData);
    importData.tripsToImport = [{ route_id: oneTrip.route_id, service_id: oneTrip.service_id, trip_id: oneTrip.trip_id, shape_id: oneTrip.shape_id }];

    test('Test prepare import data', async () => {
        currentData = gtfsValidSimpleData;
        const importer = new ShapeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toBeGreaterThan(0);
        expect(data.length).toEqual(currentData['shapes.txt'].filter(shape => shape.shape_id === oneTrip.shape_id).length);
    });

    test('Test prepare shape data', async () => {
        currentData = gtfsValidSimpleData;
        const importer = new ShapeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        const shapeData = ShapeImporter.groupShapesById(data);
        expect(Object.keys(shapeData).length).toEqual(1);
    });

});