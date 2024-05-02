/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import TransitNode, { TransferableNodes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { getNodesInBirdDistance } from './NodeCollectionUtils';

const getTransferableNodesFromBirdRadius = (
    nodesInBirdRadius: { id: string; distance: number }[],
    walkingSpeedMetersPerSeconds: number
): TransferableNodes => {
    const transferableNodes: TransferableNodes = {
        nodesIds: [],
        walkingTravelTimesSeconds: [],
        walkingDistancesMeters: []
    };
    for (let i = 0, count = nodesInBirdRadius.length; i < count; i++) {
        const nodeInBirdRadius = nodesInBirdRadius[i];

        transferableNodes.nodesIds.push(nodeInBirdRadius.id);
        transferableNodes.walkingTravelTimesSeconds.push(
            Math.ceil(nodeInBirdRadius.distance / walkingSpeedMetersPerSeconds)
        );
        transferableNodes.walkingDistancesMeters.push(Math.ceil(nodeInBirdRadius.distance));
    }
    return transferableNodes;
};

const getTransferableNodeOsrm = async (
    direction: 'from' | 'to',
    refGeometry: GeoJSON.Feature<GeoJSON.Point>,
    nodeArr: GeoJSON.Feature<GeoJSON.Point>[],
    nodesInBirdRadius: { id: string; distance: number }[],
    maxWalkingTravelTimeRadiusSeconds: number
) => {
    const transferableNodes: TransferableNodes = {
        nodesIds: [],
        walkingTravelTimesSeconds: [],
        walkingDistancesMeters: []
    };

    const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
    const routingResultJson =
        direction === 'from'
            ? await routingService.tableFrom({
                mode: 'walking',
                origin: refGeometry,
                destinations: nodeArr
            })
            : await routingService.tableTo({
                mode: 'walking',
                origins: nodeArr,
                destination: refGeometry
            });

    const durations = routingResultJson.durations;
    const distances = routingResultJson.distances;
    for (let i = 0, count = nodesInBirdRadius.length; i < count; i++) {
        const nodeInBirdRadius = nodesInBirdRadius[i];
        const travelTimeSeconds = durations[i];
        if (!_isBlank(travelTimeSeconds) && travelTimeSeconds <= maxWalkingTravelTimeRadiusSeconds) {
            const distanceMeters = distances[i];
            if (nodeInBirdRadius.distance <= distanceMeters + 100) {
                // osrm will calculate and give very short durations and distances when the nearest network osm node is very far (out of routing network), so we make sure not to keep these.
                transferableNodes.nodesIds.push(nodeInBirdRadius.id);
                transferableNodes.walkingTravelTimesSeconds.push(Math.ceil(travelTimeSeconds));
                transferableNodes.walkingDistancesMeters.push(Math.ceil(distanceMeters));
            }
        }
    }
    return transferableNodes;
};

const getTransferableNodesToOsrm = async (
    node: TransitNode,
    nodeCollection: NodeCollection,
    nodesInBirdRadius: { id: string; distance: number }[],
    maxWalkingTravelTimeRadiusSeconds: number
) => {
    return await getTransferableNodeOsrm(
        'to',
        node.toGeojson(),
        nodesInBirdRadius
            .map((n) => nodeCollection.getById(n.id))
            .filter((n) => n !== undefined) as GeoJSON.Feature<GeoJSON.Point>[],
        nodesInBirdRadius,
        maxWalkingTravelTimeRadiusSeconds
    );
};

const getTransferableNodesFromOsrm = async (
    node: TransitNode,
    nodeCollection: NodeCollection,
    nodesInBirdRadius: { id: string; distance: number }[],
    maxWalkingTravelTimeRadiusSeconds: number
) => {
    return await getTransferableNodeOsrm(
        'from',
        node.toGeojson(),
        nodesInBirdRadius
            .map((n) => nodeCollection.getById(n.id))
            .filter((n) => n !== undefined) as GeoJSON.Feature<GeoJSON.Point>[],
        nodesInBirdRadius,
        maxWalkingTravelTimeRadiusSeconds
    );
};

export const getDefaultTransferableNodeDistance = (
    maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
) => {
    const walkingSpeedMetersPerSeconds = Preferences.get('defaultWalkingSpeedMetersPerSeconds');
    return maxWalkingTravelTimeRadiusSeconds * walkingSpeedMetersPerSeconds;
};

/**
 * Get the nodes in the collection that are within a certain distance of the
 * node.  This function does not change the node.
 *
 * // TODO This gets the walking speed from the preferences and forces walking
 * mode. Other modes and speeds could be used.
 */
const nodesWithinTravelTimeRadiusSeconds = async (
    node: TransitNode,
    nodeCollection: NodeCollection,
    travelTimeRadiusSeconds: number
): Promise<TransferableNodes> => {
    const walkingSpeedMetersPerSeconds = Preferences.get('defaultWalkingSpeedMetersPerSeconds');
    const radiusBirdDistanceMeters = travelTimeRadiusSeconds * walkingSpeedMetersPerSeconds;
    const nodesInBirdRadius = await getNodesInBirdDistance(node.getId(), radiusBirdDistanceMeters);
    const transferableNodes =
        nodesInBirdRadius.length === 0
            ? {
                nodesIds: [],
                walkingTravelTimesSeconds: [],
                walkingDistancesMeters: []
            }
            : Preferences.get('transit.nodes.useBirdDistanceForTransferableNodes')
                ? // do not calculate network distance, but only bird distance (use for testing only!)
                getTransferableNodesFromBirdRadius(nodesInBirdRadius, walkingSpeedMetersPerSeconds)
                : await getTransferableNodesFromOsrm(node, nodeCollection, nodesInBirdRadius, travelTimeRadiusSeconds);
    transferableNodes.nodesIds.unshift(node.getId());
    transferableNodes.walkingTravelTimesSeconds.unshift(0);
    transferableNodes.walkingDistancesMeters.unshift(0);

    return transferableNodes;
};

/**
 * Get the transferable nodes from this node, but also get the transferable
 * nodes to this node. It does not modify the node, nor
 * does it affect the other nodes. It is the responsibility of the caller to
 * update the node appropriately if necessary.
 */
export const getTransferableNodesWithAffected = async (
    node: TransitNode,
    nodeCollection: NodeCollection,
    affectedNodes: { id: string; distance: number }[]
): Promise<{ from: TransferableNodes; to: TransferableNodes } | undefined> => {
    try {
        const walkingSpeedMetersPerSeconds = Preferences.get('defaultWalkingSpeedMetersPerSeconds');
        const reachableNodes = await nodesWithinTravelTimeRadiusSeconds(
            node,
            nodeCollection,
            Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
        );
        const transferableNodesTo =
            affectedNodes.length === 0
                ? {
                    nodesIds: [],
                    walkingTravelTimesSeconds: [],
                    walkingDistancesMeters: []
                }
                : Preferences.get('transit.nodes.useBirdDistanceForTransferableNodes')
                    ? // do not calculate network distance, but only bird distance (use for testing only!)
                    getTransferableNodesFromBirdRadius(affectedNodes, walkingSpeedMetersPerSeconds)
                    : await getTransferableNodesToOsrm(
                        node,
                        nodeCollection,
                        affectedNodes,
                        Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
                    );
        return { from: reachableNodes, to: transferableNodesTo };
    } catch (error) {
        console.error(`cannot fetch nodes in radius with affected because of an error: ${error}`);
        return undefined;
    }
};

/**
 * Get the nodes transferable from this node. It does not modify the node, nor
 * does it affect the other nodes. It is the responsibility of the caller to
 * update the node appropriately if necessary.
 */
export const getTransferableNodes = async (
    node: TransitNode,
    nodeCollection: NodeCollection
): Promise<TransferableNodes> => {
    try {
        const reachableNodes = await nodesWithinTravelTimeRadiusSeconds(
            node,
            nodeCollection,
            Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
        );
        return reachableNodes;
    } catch (error) {
        // TODO From the user point of view, this quietly fails, we should better handle the error or throw an error and let the caller do what needs to be done
        console.error(error);
        return {
            nodesIds: [node.getId()],
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        };
    }
};
