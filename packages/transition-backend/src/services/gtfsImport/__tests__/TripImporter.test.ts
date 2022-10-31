/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import { gtfsValidSimpleData, defaultInternalImportData } from './GtfsImportData.test';
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

beforeEach(() => {
    
});

describe('GTFS Trip import preparation', () => {
    test('Test prepare trip data, nothing imported', async () => {
        currentData = gtfsValidSimpleData

        const importer = new TripImporter({ directoryPath: '' });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(0);
    });

    test('Test prepare trip data, all services and routes', async () => {
        currentData = gtfsValidSimpleData;
        const importData = Object.assign({}, defaultInternalImportData);

        const routeIdsByGtfsIds = {};
        const serviceIdsByGtfsIds = {};
        currentData['trips.txt'].forEach(trip => {
            routeIdsByGtfsIds[trip.route_id] = uuidV4();
            serviceIdsByGtfsIds[trip.service_id] = uuidV4();
        });
        importData.lineIdsByRouteGtfsId = routeIdsByGtfsIds;
        importData.serviceIdsByGtfsId = serviceIdsByGtfsIds;

        const importer = new TripImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(currentData['trips.txt'].length);
        for (let i = 0; i < data.length; i++) {
            const { direction_id, wheelchair_accessible, bikes_allowed, ...rest } = currentData['trips.txt'][i];
            const actual = data[i];
            expect(actual).toEqual({
                direction_id: direction_id === '0' ? 0 : 1,
                wheelchair_accessible: 0,
                bikes_allowed: 0,
                ...rest
            })
        }
    });

    test('Test prepare trip data, only first service and route', async () => {
        currentData = gtfsValidSimpleData;
        const importData = Object.assign({}, defaultInternalImportData);

        const firstTrip = currentData['trips.txt'][0];
        const routeIdsByGtfsIds: any = {};
        const serviceIdsByGtfsIds: any = {};
        routeIdsByGtfsIds[firstTrip.route_id] = uuidV4();
        serviceIdsByGtfsIds[firstTrip.service_id] = uuidV4();
        importData.lineIdsByRouteGtfsId = routeIdsByGtfsIds;
        importData.serviceIdsByGtfsId = serviceIdsByGtfsIds;

        const importer = new TripImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toBeLessThan(currentData['trips.txt'].length);
        expect(data.length).toBeGreaterThan(0);
    });

    test('Test prepare trip data, various import values', async () => {
        const route_id = 'routeID';
        const service_id = 'serviceID';
        const noOptional = { route_id, service_id, trip_id: uuidV4() };
        const with1BoolAndEmptyDirection = { route_id, service_id, trip_id: uuidV4(), wheelchair_accessible: '1', bikes_allowed: '1', direction_id: '' };
        const with2Bool = { route_id, service_id, trip_id: uuidV4(), wheelchair_accessible: '2', bikes_allowed: '2' };
        const with0Bool = { route_id, service_id, trip_id: uuidV4(), wheelchair_accessible: '0', bikes_allowed: '0' };
        const withInvalidBool = { route_id, service_id, trip_id: uuidV4(), wheelchair_accessible: '100', bikes_allowed: 'nan', direction_id: '40', shape_id: 'shape' };
        const emptyShapeId = { route_id, service_id, trip_id: uuidV4(), wheelchair_accessible: '100', bikes_allowed: '0', direction_id: '40', shape_id: '' };
        currentData = {
            'trips.txt': [ noOptional, with1BoolAndEmptyDirection, with2Bool, with0Bool, withInvalidBool, emptyShapeId ]
        };

        const importData = Object.assign({}, defaultInternalImportData);
        importData.lineIdsByRouteGtfsId = { routeID: uuidV4() };
        importData.serviceIdsByGtfsId = { serviceID: uuidV4() };

        const importer = new TripImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(currentData['trips.txt'].length);
        expect(data[0]).toEqual({ route_id, service_id, trip_id: expect.anything(), wheelchair_accessible: 0, bikes_allowed: 0 });
        expect(data[1]).toEqual({ route_id, service_id, trip_id: expect.anything(), direction_id: undefined, wheelchair_accessible: 1, bikes_allowed: 1 });
        expect(data[2]).toEqual({ route_id, service_id, trip_id: expect.anything(), direction_id: undefined, wheelchair_accessible: 2, bikes_allowed: 2 });
        expect(data[3]).toEqual({ route_id, service_id, trip_id: expect.anything(), direction_id: undefined, wheelchair_accessible: 0, bikes_allowed: 0 });
        expect(data[4]).toEqual({ route_id, service_id, trip_id: expect.anything(), direction_id: undefined, wheelchair_accessible: 0, bikes_allowed: 0, shape_id: 'shape' });
        expect(data[5]).toEqual({ route_id, service_id, trip_id: expect.anything(), direction_id: undefined, wheelchair_accessible: 0, bikes_allowed: 0 });
    });

});
