/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import cacheRoutes from '../cache.socketRoutes';
import { recreateCache } from '../../services/capnpCache/dbToCache';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const socketStub = new EventEmitter();
cacheRoutes(socketStub);

jest.mock('../../services/capnpCache/dbToCache', () => ({
    recreateCache: jest.fn()
}));
const mockedRecreateCache = recreateCache as jest.MockedFunction<typeof recreateCache>;

beforeEach(() => {
    mockedRecreateCache.mockClear();
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
