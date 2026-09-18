/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import transitObjectDataHandlers from '../TransitObjectsDataHandler';
import scenariosDbQueries from '../../../models/db/transitScenarios.db.queries';
import { isSocketIo } from '../../../api/socketUtils';

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

const mockedScenariosDeleteMultiple =
    scenariosDbQueries.deleteMultiple as jest.MockedFunction<Exclude<typeof scenariosDbQueries.deleteMultiple, undefined>>;
const mockedIsSocketIo = isSocketIo as jest.MockedFunction<typeof isSocketIo>;

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
    test('check exposed scenarios handler', () => {
        expect(transitObjectDataHandlers.scenarios).toEqual({
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
            mockedScenariosDeleteMultiple.mockResolvedValueOnce(idsToDelete.length);
            mockedIsSocketIo.mockReturnValue(true);

            const status = await transitObjectDataHandlers.scenarios.deleteMultiple!(socketStub, idsToDelete);

            expect(mockedScenariosDeleteMultiple).toHaveBeenCalledWith(idsToDelete);
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ deletedCount: idsToDelete.length });
            expect((socketStub as any).broadcast.emit).toHaveBeenCalledWith('data.updated');
            expect((socketStub as any).emit).toHaveBeenCalledWith('cache.dirty');
        });

        test('returns ok and does not emit when socket is not Socket.IO', async () => {
            const idsToDelete = ['scenario-1', 'scenario-2'];
            mockedScenariosDeleteMultiple.mockResolvedValueOnce(idsToDelete.length);
            mockedIsSocketIo.mockReturnValue(false);

            const status = await transitObjectDataHandlers.scenarios.deleteMultiple!(socketStub, idsToDelete);

            expect(mockedScenariosDeleteMultiple).toHaveBeenCalledWith(idsToDelete);
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ deletedCount: idsToDelete.length });
            expect((socketStub as any).broadcast.emit).not.toHaveBeenCalled();
            expect((socketStub as any).emit).not.toHaveBeenCalled();
        });

        test('does not emit notifications when no object was deleted', async () => {
            mockedScenariosDeleteMultiple.mockResolvedValueOnce(0);
            mockedIsSocketIo.mockReturnValue(true);

            const status = await transitObjectDataHandlers.scenarios.deleteMultiple!(socketStub, ['scenario-1']);

            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ deletedCount: 0 });
            expect((socketStub as any).broadcast.emit).not.toHaveBeenCalled();
            expect((socketStub as any).emit).not.toHaveBeenCalled();
        });

        test('returns an error status when database deletion throws', async () => {
            mockedScenariosDeleteMultiple.mockRejectedValueOnce(new Error('db error'));

            const status = await transitObjectDataHandlers.scenarios.deleteMultiple!(socketStub, ['scenario-1']);

            expect(Status.isStatusError(status)).toEqual(true);
            expect((status as any).error).toEqual('Error deleting multiple objects');
            expect((socketStub as any).broadcast.emit).not.toHaveBeenCalled();
            expect((socketStub as any).emit).not.toHaveBeenCalled();
        });
    });
});
