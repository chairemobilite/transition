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
jest.mock('../../services/transitObjects/TransitObjectsDataHandler', () => ({
    __esModule: true,
    default: {
        schedules: mockScheduleDataHandler
    },
    createDataHandlers: jest.fn(() => ({
        schedules: mockScheduleDataHandler
    })),
    TransitObjectDataHandler: jest.fn()
}));

jest.mock('../../services/transitObjects/transitServices/ServiceDuplicator', () => ({
    duplicateServices: jest.fn()
}));

import { v4 as uuidV4 } from 'uuid';
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { TransitObjectDataHandler } from '../../services/transitObjects/TransitObjectsDataHandler';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import transitObjectRoutes from '../transitObjects.socketRoutes';
import { duplicateServices } from '../../services/transitObjects/transitServices/ServiceDuplicator';

const mockedDuplicateAndSave = duplicateServices as jest.MockedFunction<typeof duplicateServices>;
const socketStub = new EventEmitter();
transitObjectRoutes(socketStub);

describe('Service duplication route', () => {
    test('Duplicate with default options', (done) => {
        const originalServices = [uuidV4(), uuidV4()];
        const savedServices = {
            [originalServices[0]]: uuidV4(), 
            [originalServices[1]]: uuidV4()
        };
        mockedDuplicateAndSave.mockResolvedValueOnce(Status.createOk(savedServices));

        socketStub.emit('transitServices.duplicate', originalServices, {}, (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(savedServices);
            expect(mockedDuplicateAndSave).toHaveBeenLastCalledWith(originalServices, {});
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
        mockedDuplicateAndSave.mockResolvedValueOnce(Status.createOk(savedServices));

        socketStub.emit('transitServices.duplicate', originalServices, options, (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(savedServices);
            expect(mockedDuplicateAndSave).toHaveBeenLastCalledWith(originalServices, options);
            done();
        });
    });

    test('Duplicate where error occurred', (done) => {
        const originalServices = [uuidV4(), uuidV4()];
        mockedDuplicateAndSave.mockResolvedValueOnce(Status.createError('An error occurred'));

        socketStub.emit('transitServices.duplicate', originalServices, {}, (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(Status.isStatusError(status)).toEqual(true);
            expect(mockedDuplicateAndSave).toHaveBeenLastCalledWith(originalServices, {});
            done();
        });
    });
});

describe('Schedules update batch route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

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