/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import cacheRoutes from '../cache.socketRoutes';
import { recreateCache } from '../../services/capnpCache/dbToCache';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { TestUtils } from 'chaire-lib-common/lib/test';

const socketStub = new EventEmitter();
cacheRoutes(socketStub);

jest.mock('../../services/capnpCache/dbToCache', () => ({
    recreateCache: jest.fn()
}));
const mockedRecreateCache = recreateCache as jest.MockedFunction<typeof recreateCache>;

jest.mock('chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager', () => ({
    restart: jest.fn()
}));
const mockedRestart = trRoutingProcessManager.restart as jest.MockedFunction<typeof trRoutingProcessManager.restart>;

const trRoutingStartedListener = jest.fn();
socketStub.on('service.trRouting.started', trRoutingStartedListener);

beforeEach(() => {
    jest.clearAllMocks();
    mockedRestart.mockResolvedValue({ status: 'started' });
});

describe('Recreate cache', () => {

    test('Recreate cache correctly', (done) => {
        mockedRecreateCache.mockResolvedValueOnce();
        socketStub.emit('cache.saveAll', (status) => {
            expect(mockedRecreateCache).toHaveBeenCalledWith({ refreshTransferrableNodes: false, saveLines: false, cachePathDirectory: undefined });
            expect(Status.isStatusOk(status)).toBe(true);
            expect(Status.unwrap(status)).toEqual(true);
            done();
        });
    });

    test('Recreate cache with error', (done) => {
        const message = 'Error recreating cache';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedRecreateCache.mockRejectedValueOnce(error);
        socketStub.emit('cache.saveAll', function (status) {
            expect(mockedRecreateCache).toHaveBeenCalledWith({ refreshTransferrableNodes: false, saveLines: false });
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toEqual(message);
            done();
        });
    });

});

describe('Restart trRouting after saving the cache', () => {
    const saveAll = () => new Promise((resolve) => socketStub.emit('cache.saveAll', resolve));

    test('trRouting is restarted, if it is running', async () => {
        mockedRecreateCache.mockResolvedValueOnce();
        const status = await saveAll();
        expect(Status.isStatusOk(status as Status.Status<boolean>)).toBe(true);
        // The restart is done after the response, wait for it to complete
        await TestUtils.flushPromises();
        expect(mockedRestart).toHaveBeenCalledTimes(1);
        expect(mockedRestart).toHaveBeenCalledWith({ doNotStartIfStopped: true });
        expect(trRoutingStartedListener).toHaveBeenCalledTimes(1);
    });

    test('trRouting is not running, it is not restarted', async () => {
        mockedRecreateCache.mockResolvedValueOnce();
        mockedRestart.mockResolvedValueOnce({ status: 'no_restart_required', service: 'trRouting', name: 'trRouting' });
        await saveAll();        
        await TestUtils.flushPromises();  // The restart is done after the response, wait for it to complete
        expect(mockedRestart).toHaveBeenCalledWith({ doNotStartIfStopped: true });
        expect(trRoutingStartedListener).not.toHaveBeenCalled();
    });

    test('Error restarting trRouting, after a successful save', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockedRecreateCache.mockResolvedValueOnce();
        mockedRestart.mockRejectedValueOnce(new Error('Cannot start trRouting'));
        const status = await saveAll();
        expect(Status.isStatusOk(status as Status.Status<boolean>)).toBe(true);
        await TestUtils.flushPromises(); // The restart is done after the response, wait for it to complete
        expect(mockedRestart).toHaveBeenCalledTimes(1);
        expect(trRoutingStartedListener).not.toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error restarting trRouting after saving the cache: ', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });

    test('Cache not saved, trRouting is not restarted', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        mockedRecreateCache.mockRejectedValueOnce(new TrError('Error recreating cache', 'CODE', 'transit:Message'));
        const status = await saveAll();
        expect(Status.isStatusError(status as Status.Status<boolean>)).toBe(true);
        await TestUtils.flushPromises(); // The restart is normally done after the response, wait for it to have been completed
        expect(mockedRestart).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});
