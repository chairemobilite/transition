/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitApi } from 'transition-common/lib/api/transit';
import { deleteUnusedNodes } from '../transitNodesUtils';

const socketMock = new EventEmitter();
let responseStatus: Status.Status<string[]> | undefined = undefined;
const deleteUnusedSocketMock = jest.fn().mockImplementation((nodeIds, callback) => callback(responseStatus));

socketMock.on(TransitApi.DELETE_UNUSED_NODES, deleteUnusedSocketMock);
serviceLocator.addService('socketEventManager', socketMock);
serviceLocator.addService('collectionManager', {
    get: () => ({
        loadFromServer: jest.fn()
    })
})

describe('deleteUnusedNodes', () => {
    const nodeId1 = 'arbitrary uuid';

    beforeEach(() => {
        deleteUnusedSocketMock.mockClear();
    })

    test('Delete some unused', async () => {
        responseStatus = Status.createOk([nodeId1]);
        const nodeIds = await deleteUnusedNodes([nodeId1]);
        expect(nodeIds).toEqual([nodeId1]);
        expect(deleteUnusedSocketMock).toHaveBeenCalledWith([nodeId1], expect.anything());
    });

    test('Delete all unused', async () => {
        responseStatus = Status.createOk([nodeId1]);
        const nodeIds = await deleteUnusedNodes([nodeId1]);
        expect(nodeIds).toEqual([nodeId1]);
        expect(deleteUnusedSocketMock).toHaveBeenCalledWith([nodeId1], expect.anything());
    });

    test('Delete some unused, with error', async () => {
        responseStatus = Status.createError('error on socket');
        let err: any = undefined;
        try {
            await deleteUnusedNodes([nodeId1])
        } catch(error) {
            err = error;
        }
        expect(err).toEqual('Error deleting unused nodes');
        expect(deleteUnusedSocketMock).toHaveBeenCalledWith([nodeId1], expect.anything());
    });
});

