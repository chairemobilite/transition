/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import transitNodesDbQueries from '../../models/db/transitNodes.db.queries';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import TransitNode, { TransferableNodes } from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';

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
    const radiusBirdDistanceMeters = Math.ceil(travelTimeRadiusSeconds * walkingSpeedMetersPerSeconds);
    const nodesInBirdRadius = await transitNodesDbQueries.getNodesInBirdDistance(
        node.getId(),
        radiusBirdDistanceMeters
    );
    const nodesInRoutedRadius = {
        nodesIds: [node.getId()],
        walkingTravelTimesSeconds: [0],
        walkingDistancesMeters: [0]
    };

    if (nodesInBirdRadius.length === 0) {
        node.getAttributes().data.transferableNodes = nodesInRoutedRadius;
        return nodesInRoutedRadius;
    }
    if (Preferences.get('transit.nodes.useBirdDistanceForTransferableNodes')) {
        // do not calculate network distance, but only bird distance (use for testing only!)
        for (let i = 0, count = nodesInBirdRadius.length; i < count; i++) {
            const nodeInBirdRadius = nodesInBirdRadius[i];

            nodesInRoutedRadius.nodesIds.push(nodeInBirdRadius.id);
            nodesInRoutedRadius.walkingTravelTimesSeconds.push(
                Math.ceil(nodeInBirdRadius.distance / walkingSpeedMetersPerSeconds)
            );
            nodesInRoutedRadius.walkingDistancesMeters.push(Math.ceil(nodeInBirdRadius.distance));
        }
        return nodesInRoutedRadius;
    } else {
        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
        const routingResultJson = await routingService.tableFrom({
            mode: 'walking',
            origin: node.toGeojson(),
            destinations: nodesInBirdRadius
                .map((n) => nodeCollection.getById(n.id))
                .filter((n) => n !== undefined) as GeoJSON.Feature<GeoJSON.Point>[]
        });

        const durations = routingResultJson.durations;
        const distances = routingResultJson.distances;
        for (let i = 0, count = nodesInBirdRadius.length; i < count; i++) {
            const nodeInBirdRadius = nodesInBirdRadius[i];

            const travelTimeSeconds = durations[i];
            if (!_isBlank(travelTimeSeconds) && travelTimeSeconds <= travelTimeRadiusSeconds) {
                const distanceMeters = distances[i];
                if (nodeInBirdRadius.distance <= distanceMeters + 100) {
                    // osrm will calculate and give very short durations and distances when the nearest network osm node is very far (out of routing network), so we make sure not to keep these.
                    nodesInRoutedRadius.nodesIds.push(nodeInBirdRadius.id);
                    nodesInRoutedRadius.walkingTravelTimesSeconds.push(Math.ceil(travelTimeSeconds));
                    nodesInRoutedRadius.walkingDistancesMeters.push(Math.ceil(distanceMeters));
                }
            }
        }
        return nodesInRoutedRadius;
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
        console.error(error);
        return {
            nodesIds: [node.getId()],
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        };
    }
};
