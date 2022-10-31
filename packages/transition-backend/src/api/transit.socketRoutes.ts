/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import NodeCollectionUtils from '../services/nodes/NodeCollectionUtils';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { ScheduleAttributes } from 'transition-common/lib/services/schedules/Schedule';
import PlaceCollection from 'transition-common/lib/services/places/PlaceCollection';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import nodesDbQueries from '../models/db/transitNodes.db.queries';
import schedulesDbQueries from '../models/db/transitSchedules.db.queries';

/**
 * Add routes specific to the transit objects
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 */
export default function(socket: EventEmitter) {
    // TODO: In the long term, this socket route should not exist at all.
    // Complete updates should not have to be run and should be done
    // automatically when updating and/or at a smaller scale.
    socket.on('transitNodes.updateTransferableNodes', async (callback?: (status: Status.Status<number>) => void) => {
        try {
            // TODO Make this operation a singleton, so no other can run at the same time.
            socket.emit('progress', { name: 'UpdatingTransferableNodes', progress: null });
            const nodeCollection = new NodeCollection([], {}, undefined);
            await nodeCollection.loadFromServer(serviceLocator.socketEventManager);
            const placeCollection = new PlaceCollection([], {}, undefined);
            await placeCollection.loadFromServer(serviceLocator.socketEventManager);
            await NodeCollectionUtils.saveAndUpdateAllNodes(nodeCollection, placeCollection, socket);
            if (typeof callback === 'function') {
                callback(Status.createOk(1));
            }
        } catch (error) {
            console.error(`An error occurred while update transferable nodes: ${error}`);
            if (typeof callback === 'function') {
                callback(Status.createError('Error updating transferrable nodes'));
            }
        }
    });

    // get paths associated with nodes (will return an object with node id as key and array of path ids as values)
    socket.on('transitNodes.getAssociatedPathIdsByNodeId', async (
        nodeIds: string[] /* uuids */,
        callback?: (status: Status.Status<{ [key: string]: string[] }>) => void
    ) => {
        try {
            const pathIdsByNodeId = await nodesDbQueries.getAssociatedPathIds(nodeIds);
            if (typeof callback === 'function') {
                callback(Status.createOk(pathIdsByNodeId));
            }
        } catch (error) {
            console.error(`An error occurred while getting nodes associated path ids: ${error}`);
            if (typeof callback === 'function') {
                callback(Status.createError('Error getting nodes associated path ids'));
            }
        }
    });

    socket.on(
        'transitSchedules.getForLine',
        async (lineId: string, callback: (status: Status.Status<ScheduleAttributes[]>) => void) => {
            try {
                const schedules = await schedulesDbQueries.readForLine(lineId);
                callback(Status.createOk(schedules));
            } catch (error) {
                console.error(`An error occurred while getting schedules for line ${lineId}: ${error}`);
                if (typeof callback === 'function') {
                    callback(Status.createError('Error getting schedules for line'));
                }
            }
        }
    );
}
