/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import PQueue from 'p-queue';

import Node, { TransferableNodes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PlaceCollection from 'transition-common/lib/services/places/PlaceCollection';
import { updateAccessiblePlaces } from 'transition-common/lib/services/nodes/NodeGeographyUtils';
import { getTransferableNodes } from './TransferableNodeUtils';
import { EventEmitter } from 'events';
import { objectToCache } from '../../models/capnpCache/transitNodes.cache.queries';
import nodesDbQueries from '../../models/db/transitNodes.db.queries';
import transferableNodesDbQueries from '../../models/db/transitNodeTransferable.db.queries';

/**
 * Update the transferables nodes for each node in the collection and save the
 * nodes to cache
 *
 * @param nodeCollection The collection containing the nodes to update and save
 * @param socket The event emitter on which the object-related events, like the
 * save events, are sent
 * @param progressEmitter The event emitter to track progress of the operation
 * (optional)
 * @param collectionManager The collection manager, used to create the nodes
 */
export const saveAndUpdateAllNodes = async (
    nodeCollection: NodeCollection,
    placeCollection: PlaceCollection | undefined,
    progressEmitter?: EventEmitter,
    collectionManager?,
    cachePathDirectory?: string
): Promise<void> => {
    // Make sure the spatial index is up to date
    nodeCollection.updateSpatialIndex();
    if (placeCollection) {
        placeCollection.updateSpatialIndex();
    }

    progressEmitter?.emit('progress', { name: 'UpdatingTransferableNodes', progress: 0.0 });
    const features = nodeCollection.getFeatures();
    const countNodes = features.length;

    const promiseQueue = new PQueue({ concurrency: 20 });

    const promiseProducer = async (nodeGeojson, index) => {
        const node = new Node(nodeGeojson.properties, false, collectionManager);
        if (index % 50 === 0) {
            progressEmitter?.emit('progress', {
                name: 'UpdatingTransferableNodes',
                progress: index / countNodes
            });
        }

        const reachableNodes = await getTransferableNodes(node, nodeCollection);
        node.setData('transferableNodes', reachableNodes);

        if (placeCollection) {
            await updateAccessiblePlaces(node, placeCollection);
            await nodesDbQueries.update(node.getId(), node.attributes);
        }
        // Save both to database and cache
        const promises = [
            transferableNodesDbQueries.saveForNode(node.getId(), reachableNodes),
            objectToCache(node, cachePathDirectory)
        ];
        return await Promise.all(promises);
    };

    const addPromises = features.map(async (feature, index) =>
        promiseQueue.add(async () => promiseProducer(feature, index))
    );

    // Run all the promises, no matter their result.
    // TODO: What about failures? Should we track them, reject upon first failure (using Promise.all), just console.error them?
    await Promise.allSettled(addPromises);
    progressEmitter?.emit('progress', { name: 'UpdatingTransferableNodes', progress: 1.0 });
};
