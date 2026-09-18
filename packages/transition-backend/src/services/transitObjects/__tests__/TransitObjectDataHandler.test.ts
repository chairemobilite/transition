/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import transitObjectDataHandlers from '../TransitObjectsDataHandler';
import scenariosDbQueries from '../../../models/db/transitScenarios.db.queries';
import { isSocketIo } from '../../../api/socketUtils';
import { duplicateServices } from '../transitServices/ServiceDuplicator';
import { duplicateSchedules, type DuplicateScheduleMappings } from '../transitSchedules/ScheduleUtils';

jest.mock('../../../models/db/transitAgencies.db.queries', () => ({}));
jest.mock('../../../models/db/transitLines.db.queries', () => ({}));
jest.mock('../../../models/db/transitNodes.db.queries', () => ({}));
jest.mock('../../../models/db/transitPaths.db.queries', () => ({}));
jest.mock('../../../models/db/transitServices.db.queries', () => ({}));
jest.mock('../../../models/db/transitSchedules.db.queries', () => ({}));
jest.mock('../../../models/db/transitScenarios.db.queries', () => ({
    deleteMultiple: jest.fn()
}));

jest.mock('../../../models/capnpCache/transitAgencies.cache.queries', () => ({}));
jest.mock('../../../models/capnpCache/transitLines.cache.queries', () => ({}));
jest.mock('../../../models/capnpCache/transitNodes.cache.queries', () => ({}));
jest.mock('../../../models/capnpCache/transitPaths.cache.queries', () => ({}));
jest.mock('../../../models/capnpCache/transitScenarios.cache.queries', () => ({}));
jest.mock('../../../models/capnpCache/transitServices.cache.queries', () => ({}));
jest.mock('../../capnpCache/dbToCache', () => ({}));

jest.mock('../../../api/socketUtils', () => ({
    isSocketIo: jest.fn()
}));

jest.mock('../transitServices/ServiceDuplicator', () => ({
    duplicateServices: jest.fn()
}));

jest.mock('../transitSchedules/ScheduleUtils', () => ({
    duplicateSchedules: jest.fn()
}));

const mockedScenariosDeleteMultiple =
    scenariosDbQueries.deleteMultiple as jest.MockedFunction<Exclude<typeof scenariosDbQueries.deleteMultiple, undefined>>;
const mockedIsSocketIo = isSocketIo as jest.MockedFunction<typeof isSocketIo>;
const mockedServiceDuplicate = duplicateServices as jest.MockedFunction<typeof duplicateServices>;
const mockedScheduleDuplicate = duplicateSchedules as jest.MockedFunction<typeof duplicateSchedules>;

// Mock the socket with an EventEmitter mock that has an emit function we can spy on
const socketStub = {
    emit: jest.fn(),
    broadcast: {
        emit: jest.fn()
    }
} as unknown as EventEmitter;

beforeEach(() => {
    jest.clearAllMocks();
    mockedIsSocketIo.mockReturnValue(false);
});

describe('TransitObjectDataHandler scenarios', () => {
    // Assign the handler once, so that we don't forget to update copy-pasted tests from other handlers
    const dataHandler = transitObjectDataHandlers.scenarios;

    test('check exposed scenarios handler', () => {
        expect(dataHandler).toEqual({
            lowerCaseName: 'scenario',
            className: 'Scenario',
            classNamePlural: 'Scenarios',
            create: expect.any(Function),
            read: expect.any(Function),
            update: expect.any(Function),
            delete: expect.any(Function),
            deleteMultiple: expect.any(Function)
        });
    });

    describe('deleteMultiple', () => {

        test('returns ok and emits socket notifications when some objects were deleted', async () => {
            const idsToDelete = ['scenario-1', 'scenario-2'];
            mockedScenariosDeleteMultiple.mockResolvedValueOnce(idsToDelete);
            mockedIsSocketIo.mockReturnValue(true);

            const status = await dataHandler.deleteMultiple!(socketStub, idsToDelete);

            expect(mockedScenariosDeleteMultiple).toHaveBeenCalledWith(idsToDelete);
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ deletedIds: idsToDelete });
            expect((socketStub as any).broadcast.emit).toHaveBeenCalledWith('data.updated');
            expect((socketStub as any).emit).toHaveBeenCalledWith('cache.dirty');
        });

        test('returns ok and does not emit when socket is not Socket.IO', async () => {
            const idsToDelete = ['scenario-1', 'scenario-2'];
            mockedScenariosDeleteMultiple.mockResolvedValueOnce(idsToDelete);
            mockedIsSocketIo.mockReturnValue(false);

            const status = await dataHandler.deleteMultiple!(socketStub, idsToDelete);

            expect(mockedScenariosDeleteMultiple).toHaveBeenCalledWith(idsToDelete);
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ deletedIds: idsToDelete });
            expect((socketStub as any).broadcast.emit).not.toHaveBeenCalled();
            expect((socketStub as any).emit).not.toHaveBeenCalled();
        });

        test('does not emit notifications when no object was deleted', async () => {
            mockedScenariosDeleteMultiple.mockResolvedValueOnce([]);
            mockedIsSocketIo.mockReturnValue(true);

            const status = await dataHandler.deleteMultiple!(socketStub, ['scenario-1']);

            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ deletedIds: [] });
            expect((socketStub as any).broadcast.emit).not.toHaveBeenCalled();
            expect((socketStub as any).emit).not.toHaveBeenCalled();
        });

        test('returns an error status when database deletion throws', async () => {
            mockedScenariosDeleteMultiple.mockRejectedValueOnce(new Error('db error'));

            const status = await dataHandler.deleteMultiple!(socketStub, ['scenario-1']);

            expect(Status.isStatusError(status)).toEqual(true);
            expect((status as any).error).toEqual('Error deleting multiple objects');
            expect((socketStub as any).broadcast.emit).not.toHaveBeenCalled();
            expect((socketStub as any).emit).not.toHaveBeenCalled();
        });
    });
});

describe('TransitObjectDataHandler schedules', () => {
    // Assign the handler once, so that we don't forget to update copy-pasted tests from other handlers
    const dataHandler = transitObjectDataHandlers.schedules;

    test('check exposed schedules handler', () => {
        expect(dataHandler).toEqual({
            lowerCaseName: 'schedule',
            className: 'Schedule',
            classNamePlural: 'Schedules',
            create: expect.any(Function),
            read: expect.any(Function),
            update: expect.any(Function),
            delete: expect.any(Function),
            duplicate: expect.any(Function),
            updateBatch: expect.any(Function)
        });
    });

    describe('duplicate', () => {

        const serviceMapping = {
            [uuidV4()]: uuidV4(),
            [uuidV4()]: uuidV4()
        };

        test('returns ok and mapping when the duplicate function has been called', async () => {
            const newScheduleIdMapping = { 1: 2, 3: 4 };
            mockedScheduleDuplicate.mockResolvedValueOnce(Status.createOk(newScheduleIdMapping));

            const status = await (dataHandler.duplicate as any)({ serviceIdMapping: serviceMapping });

            expect(mockedScheduleDuplicate).toHaveBeenCalledWith({ serviceIdMapping: serviceMapping });
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(newScheduleIdMapping);
        });

        test('forwards the error when the duplication function returns an error', async () => {
            mockedScheduleDuplicate.mockResolvedValueOnce(Status.createError('An error occurred while duplicating schedules'));

            const status = await (dataHandler.duplicate as any)({ serviceIdMapping: serviceMapping });

            expect(Status.isStatusError(status)).toEqual(true);
            expect((status as any).error).toEqual('An error occurred while duplicating schedules');
        });
    });
});

describe('TransitObjectDataHandler services', () => {
    // Assign the handler once, so that we don't forget to update copy-pasted tests from other handlers
    const dataHandler = transitObjectDataHandlers.services;

    test('check exposed handler', () => {
        expect(dataHandler).toEqual({
            lowerCaseName: 'service',
            className: 'Service',
            classNamePlural: 'Services',
            create: expect.any(Function),
            read: expect.any(Function),
            update: expect.any(Function),
            delete: expect.any(Function),
            duplicate: expect.any(Function)
        });
    });

    describe('duplicate', () => {

        const duplicateOptions = { serviceIds: [uuidV4(), uuidV4()] };

        test('returns ok and mapping when the duplicate function has been called', async () => {
            const newServiceIdMapping = { [duplicateOptions.serviceIds[0]]: uuidV4(), [duplicateOptions.serviceIds[1]]: uuidV4() };
            mockedServiceDuplicate.mockResolvedValueOnce(Status.createOk(newServiceIdMapping));

            const status = await (dataHandler.duplicate as any)(duplicateOptions);

            expect(mockedServiceDuplicate).toHaveBeenCalledWith(duplicateOptions);
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(newServiceIdMapping);
        });

        test('forwards the error when the duplication function returns an error', async () => {
            mockedServiceDuplicate.mockResolvedValueOnce(Status.createError('An error occurred while duplicating services'));

            const status = await (dataHandler.duplicate as any)(duplicateOptions);

            expect(Status.isStatusError(status)).toEqual(true);
            expect((status as any).error).toEqual('An error occurred while duplicating services');
        });
    });
});
