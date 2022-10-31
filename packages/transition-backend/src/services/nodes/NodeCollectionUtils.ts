/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import PQueue from 'p-queue';

import Node from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PlaceCollection from 'transition-common/lib/services/places/PlaceCollection';
import NodeGeographyUtils from 'transition-common/lib/services/nodes/NodeGeographyUtils';
import { EventEmitter } from 'events';
import { objectToCache } from '../../models/capnpCache/transitNodes.cache.queries';
import nodesDbQueries from '../../models/db/transitNodes.db.queries';

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
        await NodeGeographyUtils.updateTransferableNodes(node, nodeCollection);
        if (placeCollection) {
            await NodeGeographyUtils.updateAccessiblePlaces(node, placeCollection);
            await nodesDbQueries.update(node.getId(), node.attributes);
        }
        return await objectToCache(node, cachePathDirectory);
    };

    const addPromises = features.map(async (feature, index) =>
        promiseQueue.add(async () => promiseProducer(feature, index))
    );

    // Run all the promises, no matter their result.
    // TODO: What about failures? Should we track them, reject upon first failure (using Promise.all), just console.error them?
    await Promise.allSettled(addPromises);
    progressEmitter?.emit('progress', { name: 'UpdatingTransferableNodes', progress: 1.0 });
};

export default {
    saveAndUpdateAllNodes
};
