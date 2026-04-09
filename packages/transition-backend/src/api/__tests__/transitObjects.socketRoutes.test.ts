/*
 * Copyright 2024-2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

const mockScheduleDataHandler: TransitObjectDataHandler = {
    lowerCaseName: 'schedule',
    className: 'Schedule',
    classNamePlural: 'Schedules',
    create: jest.fn().mockResolvedValue({}),
    read: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    updateBatch: jest.fn().mockImplementation((socket, attributesList) => {
        try{
            return Promise.resolve({
                ids: attributesList.map(item => ({ id: item.id }))
            });
        }
        catch (error) {
            console.error('Error batch updating schedules: ', error);
            return TrError.isTrError(error) ? error.export() : { error: 'Error updating batch' };
        }
    }),
};
const mockDataHandlerWithAllFunctions: TransitObjectDataHandler = {
    lowerCaseName: 'object',
    className: 'Object',
    classNamePlural: 'Objects',
    create: jest.fn().mockResolvedValue({}),
    read: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
    deleteMultiple: jest.fn().mockResolvedValue({}),
    geojsonCollection: jest.fn().mockResolvedValue({}),
    collection: jest.fn().mockResolvedValue({}),
    saveCache: jest.fn().mockResolvedValue({}),
    deleteCache: jest.fn().mockResolvedValue({}),
    deleteMultipleCache: jest.fn().mockResolvedValue({}),
    loadCache: jest.fn().mockResolvedValue({}),
    saveCollectionCache: jest.fn().mockResolvedValue({}),
    loadCollectionCache: jest.fn().mockResolvedValue({})
};

jest.mock('../../services/transitObjects/TransitObjectsDataHandler', () => ({
    __esModule: true,
    default: {
        schedules: mockScheduleDataHandler,
        objects: mockDataHandlerWithAllFunctions
    },
    createDataHandlers: jest.fn(() => ({
        schedules: mockScheduleDataHandler,
        objects: mockDataHandlerWithAllFunctions
    })),
    TransitObjectDataHandler: jest.fn()
}));

jest.mock('../../services/transitObjects/transitServices/ServiceDuplicator', () => ({
    duplicateServices: jest.fn()
}));

jest.mock('../../services/transitObjects/transitSchedules/ScheduleUtils', () => ({
    duplicateSchedules: jest.fn()
}));

import { v4 as uuidV4 } from 'uuid';
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { TransitObjectDataHandler } from '../../services/transitObjects/TransitObjectsDataHandler';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import transitObjectRoutes from '../transitObjects.socketRoutes';
import { duplicateServices } from '../../services/transitObjects/transitServices/ServiceDuplicator';
import { duplicateSchedules } from '../../services/transitObjects/transitSchedules/ScheduleUtils';

const mockedDuplicateAndSaveService = duplicateServices as jest.MockedFunction<typeof duplicateServices>;
const mockedDuplicateSchedules = duplicateSchedules as jest.MockedFunction<typeof duplicateSchedules>;
const socketStub = new EventEmitter();
transitObjectRoutes(socketStub);

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Object socket routes', () => {
    // FIXME Add tests for create, read, update, delete, geojsonCollection,
    // collection, saveCache, deleteCache, deleteMultipleCache, loadCache,
    // saveCollectionCache, loadCollectionCache routes

    describe('deleteMultiple route', () => {
        test('deleteMultiple when the route exists', (done) => {
            // Create ids to delete and set the mock to return those ids as deleted
            const objectIdsToDelete = [uuidV4(), uuidV4()];
            (mockDataHandlerWithAllFunctions.deleteMultiple as jest.MockedFunction<Exclude<typeof mockDataHandlerWithAllFunctions.deleteMultiple, undefined>>).mockResolvedValueOnce(Status.createOk({ deletedIds: objectIdsToDelete }));
            socketStub.emit('transitObjects.deleteMultiple', objectIdsToDelete, (status: Status.Status<{ deletedIds: string[] }>) => {
                expect(Status.isStatusOk(status)).toEqual(true);
                expect(Status.unwrap(status)).toEqual({ deletedIds: objectIdsToDelete});
                expect(mockDataHandlerWithAllFunctions.deleteMultiple).toHaveBeenLastCalledWith(socketStub, objectIdsToDelete);
                done();
            });
        });

        test('deleteMultiple route is not registered for schedules', () => {
            const eventName = 'transitSchedules.deleteMultiple';

            // Route is not registered
            expect(socketStub.listenerCount(eventName)).toBe(0);

            // Optional stronger check: emit returns false when no listeners exist
            const callback = jest.fn();
            const emitted = socketStub.emit(eventName, ['id-1'], callback);
            expect(emitted).toBe(false);
            expect(callback).not.toHaveBeenCalled();
        });
    });
});

describe('Service duplication route', () => {
    test('Duplicate with default options', (done) => {
        const originalServices = [uuidV4(), uuidV4()];
        const savedServices = {
            [originalServices[0]]: uuidV4(), 
            [originalServices[1]]: uuidV4()
        };
        mockedDuplicateAndSaveService.mockResolvedValueOnce(Status.createOk(savedServices));

        socketStub.emit('transitServices.duplicate', originalServices, {}, (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(savedServices);
            expect(mockedDuplicateAndSaveService).toHaveBeenLastCalledWith(originalServices, {});
            done();
        });
    });

    test('Duplicate with options', (done) => {
        const originalServices = [uuidV4(), uuidV4()];
        const savedServices = {
            [originalServices[0]]: uuidV4(), 
            [originalServices[1]]: uuidV4()
        };
        const options = { newServiceSuffix: ' copy'}
        mockedDuplicateAndSaveService.mockResolvedValueOnce(Status.createOk(savedServices));

        socketStub.emit('transitServices.duplicate', originalServices, options, (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(savedServices);
            expect(mockedDuplicateAndSaveService).toHaveBeenLastCalledWith(originalServices, options);
            done();
        });
    });

    test('Duplicate where error occurred', (done) => {
        const originalServices = [uuidV4(), uuidV4()];
        mockedDuplicateAndSaveService.mockResolvedValueOnce(Status.createError('An error occurred'));

        socketStub.emit('transitServices.duplicate', originalServices, {}, (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(Status.isStatusError(status)).toEqual(true);
            expect(mockedDuplicateAndSaveService).toHaveBeenLastCalledWith(originalServices, {});
            done();
        });
    });
});

describe('Schedules update batch route', () => {

    test('updateSchedulesBatch handler is initialized', () => {
        expect(socketStub.listenerCount('transitSchedules.updateBatch')).toBe(1);
    });

    test('updateSchedulesBatch with valid attributes', (done) => {
        const attributeList = [{id: 'test-id-1'}, {id: 'test-id-2'}];
        
        socketStub.emit('transitSchedules.updateBatch', attributeList, (response) => {
            try {
                // Verify the mock was called
                expect(mockScheduleDataHandler.updateBatch).toHaveBeenCalledTimes(1);
                expect(mockScheduleDataHandler.updateBatch).toHaveBeenCalledWith(
                    socketStub,
                    attributeList
                );
                
                // Verify the response
                expect(response).toEqual({
                    ids: [
                        { id: 'test-id-1' },
                        { id: 'test-id-2' }
                    ]
                });
                done();
            } catch (error) {
                done(error);
            }
        });
    });

    test('updateSchedulesBatch where error occurred', async () => {
        const invalidAttributeList = null;
        const response = await new Promise((resolve) => {
            socketStub.emit('transitSchedules.updateBatch', invalidAttributeList, resolve);
        });
        expect(mockScheduleDataHandler.updateBatch).toHaveBeenCalledWith(
            socketStub,
            invalidAttributeList
        );
        expect(response).toHaveProperty('error');
    });
});

describe('Schedule duplication', () => {

    test('Duplicate with mappings', (done) => {
        const serviceMapping = {
            [uuidV4()]: uuidV4(), 
            [uuidV4()]: uuidV4()
        };
        const newScheduleIdMapping = { 1: 2, 3: 4 }; 
        mockedDuplicateSchedules.mockResolvedValueOnce(Status.createOk(newScheduleIdMapping));

        socketStub.emit('transitSchedules.duplicate', { serviceIdMapping: serviceMapping }, (status) => {
            try {
                expect(Status.isStatusOk(status)).toEqual(true);
                expect(Status.unwrap(status)).toEqual(newScheduleIdMapping);
                expect(mockedDuplicateSchedules).toHaveBeenCalledWith({ serviceIdMapping: serviceMapping });
                done();
            } catch(error) {
                done(error);
            }
        });
    });

    test('Duplicate where error occurred', (done) => {
        const serviceMapping = {
            [uuidV4()]: uuidV4(), 
            [uuidV4()]: uuidV4()
        };
        const lineMapping = {
            [uuidV4()]: uuidV4(), 
            [uuidV4()]: uuidV4()
        };
        const pathMapping = {
            [uuidV4()]: uuidV4()
        }
        mockedDuplicateSchedules.mockResolvedValueOnce(Status.createError('An error occurred'));

        socketStub.emit('transitSchedules.duplicate', { serviceIdMapping: serviceMapping, lineIdMapping: lineMapping, pathIdMapping: pathMapping }, (status) => {
            try {
                expect(Status.isStatusOk(status)).toEqual(false);
                expect(Status.isStatusError(status)).toEqual(true);
                expect(mockedDuplicateSchedules).toHaveBeenLastCalledWith({ serviceIdMapping: serviceMapping, lineIdMapping: lineMapping, pathIdMapping: pathMapping });
                done();
            } catch(error) {
                done(error);
            }
        });
    });
});