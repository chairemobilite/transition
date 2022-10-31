/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import transitRoutes from '../transitPaths.socketRoutes';
import transitPathQueries from '../../models/db/transitPaths.db.queries';

const socketStub = new EventEmitter();
transitRoutes(socketStub);

const mockedDbQuery = jest.fn();

jest.mock('../../models/db/transitPaths.db.queries', () => {
    return {
        geojsonCollection: jest.fn(),
        geojsonCollectionForServices: jest.fn()
    }
});

const mockedGeojsonCollection = transitPathQueries.geojsonCollection as jest.MockedFunction<typeof transitPathQueries.geojsonCollection>;
const mockedCollectionForService = transitPathQueries.geojsonCollectionForServices as jest.MockedFunction<typeof transitPathQueries.geojsonCollectionForServices>;

describe('Schedules: get paths for scenario', () => {

    const scenarioId = uuidV4();

    test('Get paths for scenario correctly', (done) => {
        const pathsGeojsonAttributes = {
            type: 'FeatureCollection' as const,
            features: [
                {
                    type: 'Feature'  as const,
                    properties: {},
                    id: 1,
                    geometry: { type: 'LineString' as const, coordinates: [[-73, 45], [-73.1, 45.1]]}    
                }
            ]
        }
        ;
        mockedGeojsonCollection.mockResolvedValueOnce(pathsGeojsonAttributes);
        socketStub.emit('transitPaths.getForScenario', scenarioId, function (status) {
            expect(Status.isStatusOk(status));
            expect(Status.unwrap(status)).toEqual(pathsGeojsonAttributes);
            expect(mockedGeojsonCollection).toHaveBeenLastCalledWith({ scenarioId });
            done();
        });
    });

    test('Get paths for scenario with error', (done) => {
        mockedGeojsonCollection.mockRejectedValueOnce('DB error');
        socketStub.emit('transitPaths.getForScenario', scenarioId, function (status) {
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toBe('Error getting paths for scenario');
            expect(mockedGeojsonCollection).toHaveBeenLastCalledWith({ scenarioId });
            done();
        });
    });
});

describe('Schedules: get paths for services', () => {

    const serviceIds = [uuidV4(), uuidV4()];

    test('Get paths for services correctly', (done) => {
        const pathsGeojsonAttributes = {
            type: 'FeatureCollection' as const,
            features: [
                {
                    type: 'Feature'  as const,
                    properties: {},
                    id: 1,
                    geometry: { type: 'LineString' as const, coordinates: [[-73.2, 45.2], [-73.1, 45.1]]}    
                }
            ]
        }
        ;
        mockedCollectionForService.mockResolvedValueOnce(pathsGeojsonAttributes);
        socketStub.emit('transitPaths.getForServices', serviceIds, function (status) {
            expect(Status.isStatusOk(status));
            expect(Status.unwrap(status)).toEqual(pathsGeojsonAttributes);
            expect(mockedCollectionForService).toHaveBeenLastCalledWith(serviceIds);
            done();
        });
    });

    test('Get paths for services with error', (done) => {
        mockedGeojsonCollection.mockRejectedValueOnce('DB error');
        socketStub.emit('transitPaths.getForServices', serviceIds, function (status) {
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect(mockedCollectionForService).toHaveBeenLastCalledWith(serviceIds);
            expect((status as any).error).toBe('Error getting paths for services');
            done();
        });
    });
});