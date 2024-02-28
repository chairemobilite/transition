/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _uniq from 'lodash/uniq';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import nodesDbQueries from '../../models/db/transitNodes.db.queries';
import transitNodeTransferableDbQueries from '../../models/db/transitNodeTransferable.db.queries';
import {
    getDefaultTransferableNodeDistance,
    getNodesInBirdDistance,
    getTransferableNodesWithAffected
} from './TransferableNodeUtils';
import { objectToCache } from '../../models/capnpCache/transitNodes.cache.queries';

/**
 * Saves a node to the database and to cache. If the geography has changed, it
 * also updates the transferrable nodes from and to this node.
 *
 * @param attributes The updated node's attributes
 * @param geographyChanged Whether the geography has changed
 * @returns The number of nodes updated after by saving this node
 */
export const saveNode = async (attributes: NodeAttributes, geographyChanged: boolean): Promise<number> => {
    // Is the node new or updated? In either case, save
    const nodeExists = await nodesDbQueries.exists(attributes.id);
    const returning = nodeExists
        ? await nodesDbQueries.update(attributes.id, attributes)
        : await nodesDbQueries.create(attributes);
    const id = typeof returning === 'string' ? returning : attributes.id;
    const affectedNodeIds = [id];

    // If the geography changed, update the transferable nodes
    if (geographyChanged) {
        // Get nodes that previously transferred to this one
        const originalTransferableTo = await transitNodeTransferableDbQueries.getToNode(id);
        affectedNodeIds.push(...originalTransferableTo);

        // Get the node collection consisting of the nodes within bird radius of node
        const nodesInBirdRadius = await getNodesInBirdDistance(id, getDefaultTransferableNodeDistance());
        const nodesToFetch = nodesInBirdRadius.map((n) => n.id);
        nodesToFetch.push(id);
        const nodesAttributes = await nodesDbQueries.geojsonCollection({ nodeIds: nodesToFetch });
        const nodeCollection = new NodeCollection(nodesAttributes.features, {});
        const nodeAttributes = nodeCollection.getById(id);
        if (nodeAttributes === undefined) {
            throw 'Node to save does not exist in the node collection';
        }
        const node = nodeCollection.newObject(nodeAttributes);

        // Update transferable nodes from and to the current node
        const transferableNodesWithUndefined = await getTransferableNodesWithAffected(
            node,
            nodeCollection,
            nodesInBirdRadius
        );
        // FIXME: Errors should be properly handled, otherwise we may have invalid data
        if (transferableNodesWithUndefined !== undefined) {
            affectedNodeIds.push(...transferableNodesWithUndefined.from.nodesIds.slice(1));
            // Save the transferable nodes
            await transitNodeTransferableDbQueries.saveForNode(
                id,
                transferableNodesWithUndefined.from,
                transferableNodesWithUndefined.to
            );
        }
    }

    const uniqueAffecteNodeIds = _uniq(affectedNodeIds);
    // Save to cache the current node and all nodes affected by this change
    const nodesAttributes = await nodesDbQueries.geojsonCollection({ nodeIds: uniqueAffecteNodeIds });
    const nodeCollection = new NodeCollection(nodesAttributes.features, {});
    const objectToCachePromises = uniqueAffecteNodeIds.map(async (nid) => {
        const node = nodeCollection.newObject(
            nodeCollection.getById(nid) as GeoJSON.Feature<GeoJSON.Point, NodeAttributes>
        );
        const transferableNodes = await transitNodeTransferableDbQueries.getFromNode(nid);
        node.setData('transferableNodes', transferableNodes);
        return await objectToCache(node, node.getData('customCachePath') as string);
    });
    await Promise.all(objectToCachePromises);

    // Return the number of affected nodes
    return uniqueAffecteNodeIds.length;
};
