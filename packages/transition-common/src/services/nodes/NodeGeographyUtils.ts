/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import geokdbush from 'geokdbush';
import _cloneDeep from 'lodash.clonedeep';

import Node, { TransferableNodes, AccessiblePlacesPerTravelTime } from './Node';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import NodeCollection from './NodeCollection';
import PlaceCollection from '../places/PlaceCollection';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    categories,
    detailedCategories,
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

const nodesInBirdRadiusMeters = (node: Node, nodeCollection: NodeCollection, birdRadiusMeters = 1000) => {
    const nodesInBirdRadius = geokdbush.around(
        nodeCollection.getSpatialIndex(),
        node.lon(),
        node.lat(),
        undefined,
        birdRadiusMeters / 1000
    );
    return nodesInBirdRadius;
};

const placesInBirdRadiusMeters = (node: Node, placeCollection: PlaceCollection, birdRadiusMeters = 1000) => {
    const placesInBirdRadius = geokdbush.around(
        placeCollection.getSpatialIndex(),
        node.lon(),
        node.lat(),
        undefined,
        birdRadiusMeters / 1000
    );
    return placesInBirdRadius;
};

/**
 * Get the nodes in the collection that are in walking distance of the node.
 * This function does not change the node.
 *
 * TODO: This may not be just for walking
 */
export const nodesInWalkingTravelTimeRadiusSeconds = async (
    node: Node,
    nodeCollection: NodeCollection,
    maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
): Promise<TransferableNodes> => {
    const walkingSpeedMetersPerSeconds = Preferences.get('defaultWalkingSpeedMetersPerSeconds');
    const radiusBirdDistanceMeters = maxWalkingTravelTimeRadiusSeconds * walkingSpeedMetersPerSeconds;
    const nodesInBirdRadius: any[] = nodesInBirdRadiusMeters(node, nodeCollection, radiusBirdDistanceMeters);
    if (nodesInBirdRadius.length > 0 && nodesInBirdRadius[0].properties.id === node.getId()) {
        nodesInBirdRadius.shift();
    }
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

            const transferableNodeBirdDistanceMeters =
                geokdbush.distance(
                    node.lon(),
                    node.lat(),
                    nodeInBirdRadius.geometry.coordinates[0],
                    nodeInBirdRadius.geometry.coordinates[1]
                ) * 1000;
            nodesInRoutedRadius.nodesIds.push(nodeInBirdRadius.properties.id);
            nodesInRoutedRadius.walkingTravelTimesSeconds.push(
                Math.ceil(transferableNodeBirdDistanceMeters / walkingSpeedMetersPerSeconds)
            );
            nodesInRoutedRadius.walkingDistancesMeters.push(Math.ceil(transferableNodeBirdDistanceMeters));
        }
        return nodesInRoutedRadius;
    } else {
        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
        const routingResultJson = await routingService.tableFrom({
            mode: 'walking',
            origin: node.toGeojson(),
            destinations: nodesInBirdRadius
        });

        const durations = routingResultJson.durations;
        const distances = routingResultJson.distances;
        for (let i = 0, count = nodesInBirdRadius.length; i < count; i++) {
            const nodeInBirdRadius = nodesInBirdRadius[i];

            const travelTimeSeconds = durations[i];
            if (!_isBlank(travelTimeSeconds) && travelTimeSeconds <= maxWalkingTravelTimeRadiusSeconds) {
                const distanceMeters = distances[i];
                const birdDistanceMeters =
                    geokdbush.distance(
                        node.lon(),
                        node.lat(),
                        nodeInBirdRadius.geometry.coordinates[0],
                        nodeInBirdRadius.geometry.coordinates[1]
                    ) * 1000;
                if (birdDistanceMeters <= distanceMeters + 100) {
                    // osrm will calculate and give very short durations and distances when the nearest network osm node is very far (out of routing network), so we make sure not to keep these.
                    nodesInRoutedRadius.nodesIds.push(nodeInBirdRadius.properties.id);
                    nodesInRoutedRadius.walkingTravelTimesSeconds.push(Math.ceil(travelTimeSeconds));
                    nodesInRoutedRadius.walkingDistancesMeters.push(Math.ceil(distanceMeters));
                }
            }
        }
        return nodesInRoutedRadius;
    }
};

/**
 * Get the places that are in walking distance of the node.
 * This function does not change the node.
 *
 * TODO: This may not be just for walking
 */
export const placesInWalkingTravelTimeRadiusSeconds = async (
    node: Node,
    placeCollection: PlaceCollection,
    maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
): Promise<AccessiblePlacesPerTravelTime> => {
    const maxWalkingTravelTimeMinutes = Math.ceil(maxWalkingTravelTimeRadiusSeconds / 60.0);
    const walkingSpeedMetersPerSeconds = Preferences.get('defaultWalkingSpeedMetersPerSeconds');
    const radiusBirdDistanceMeters = maxWalkingTravelTimeRadiusSeconds * walkingSpeedMetersPerSeconds;
    const placesByTravelTimeByCategoryTemplate: { [key in PlaceCategory]: number[] }[] = [];
    const placesByTravelTimeByDetailedCategoryTemplate: { [key in PlaceDetailedCategory]: number[] }[] = [];
    for (let i = 0; i <= maxWalkingTravelTimeMinutes; i++) {
        placesByTravelTimeByCategoryTemplate[i] = {} as { [key in PlaceCategory]: number[] };
        placesByTravelTimeByDetailedCategoryTemplate[i] = {} as { [key in PlaceDetailedCategory]: number[] };
    }
    const placesWeightPerTravelTime = {
        mode: 'walking' as RoutingMode,
        placesByTravelTimeByCategory: placesByTravelTimeByCategoryTemplate,
        placesByTravelTimeByDetailedCategory: placesByTravelTimeByDetailedCategoryTemplate
    };

    const placesInBirdRadius: any[] = placesInBirdRadiusMeters(node, placeCollection, radiusBirdDistanceMeters);
    const useBirdDistances = Preferences.get('transit.nodes.useBirdDistanceForTransferableNodes');

    let durations: number[] = [];
    let distances: number[] = [];

    if (!useBirdDistances && placesInBirdRadius.length > 0) {
        const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
        const routingResultJson = await routingService.tableFrom({
            mode: 'walking',
            origin: node.toGeojson(),
            destinations: placesInBirdRadius
        });
        durations = routingResultJson.durations;
        distances = routingResultJson.distances;
    }

    for (let i = 0, count = placesInBirdRadius.length; i < count; i++) {
        const placeInBirdRadius = placesInBirdRadius[i];

        const birdDistanceMeters =
            geokdbush.distance(
                node.lon(),
                node.lat(),
                placeInBirdRadius.geometry.coordinates[0],
                placeInBirdRadius.geometry.coordinates[1]
            ) * 1000;
        const travelTimeSeconds = useBirdDistances
            ? Math.ceil(birdDistanceMeters / walkingSpeedMetersPerSeconds)
            : durations[i];

        if (!_isBlank(travelTimeSeconds) && travelTimeSeconds <= maxWalkingTravelTimeRadiusSeconds) {
            if (useBirdDistances || birdDistanceMeters <= distances[i] + 100) {
                const travelTimeMinutes = Math.ceil(travelTimeSeconds / 60.0);
                // osrm will calculate and give very short durations and distances when the nearest network osm node is very far (out of routing network), so we make sure not to keep these.
                if (travelTimeMinutes <= maxWalkingTravelTimeMinutes) {
                    const category: PlaceCategory = placeInBirdRadius.properties.data.category;
                    const detailedCategory: PlaceDetailedCategory = placeInBirdRadius.properties.data.category_detailed;
                    if (category) {
                        if (!placesWeightPerTravelTime.placesByTravelTimeByCategory[travelTimeMinutes][category]) {
                            placesWeightPerTravelTime.placesByTravelTimeByCategory[travelTimeMinutes][category] = [];
                        }
                        placesWeightPerTravelTime.placesByTravelTimeByCategory[travelTimeMinutes][category].push(
                            placeInBirdRadius.properties.integer_id
                        );
                    }
                    if (detailedCategory) {
                        if (
                            !placesWeightPerTravelTime.placesByTravelTimeByDetailedCategory[travelTimeMinutes][
                                detailedCategory
                            ]
                        ) {
                            placesWeightPerTravelTime.placesByTravelTimeByDetailedCategory[travelTimeMinutes][
                                detailedCategory
                            ] = [];
                        }
                        placesWeightPerTravelTime.placesByTravelTimeByDetailedCategory[travelTimeMinutes][
                            detailedCategory
                        ].push(placeInBirdRadius.properties.integer_id);
                    }
                }
            }
        }
    }
    return placesWeightPerTravelTime as AccessiblePlacesPerTravelTime;
};

/**
 * Update the transferable nodes from this node, but also recomputes the
 * transferable nodes of all the nodes around, previously or newly transferable.
 * It returns a node collection containing all the affected nodes, excluding the
 * main node, who is assumed to have been updated by the caller.
 *
 * The nodes' data is updated, but it is the responsibility of the caller to
 * save the node appropriately. Also, the features in the collection have not
 * been updated to reflect the changes in the nodes.
 *
 * TODO: Remove collectionManager from and do not require it in Node
 */
export const updateTransferableNodesWithAffected = async (
    node: Node,
    nodeCollection: NodeCollection,
    collectionManager?
): Promise<Node[]> => {
    try {
        const oldTransferableNodes = node.getAttributes().data.transferableNodes;
        const modifiedNodes: Node[] = [];
        await updateTransferableNodes(node, nodeCollection);
        if (!node.hasChanged() && !node.isNew()) {
            return [];
        }

        // Transferable nodes changed, recalculate for the others
        const updated = [node.getId()];
        const newTransferableNodes = node.getAttributes().data.transferableNodes;

        const nodeIdsToUpdate = oldTransferableNodes
            ? oldTransferableNodes.nodesIds.filter((id) => id !== node.getId())
            : [];
        newTransferableNodes?.nodesIds.forEach((id) => {
            if (id !== node.getId() && !nodeIdsToUpdate.includes(id)) nodeIdsToUpdate.push(id);
        });

        const affectedNodesUpdatePromises = nodeIdsToUpdate.map(
            async (id): Promise<void> => {
                updated.push(id);
                const featureToUpdate = nodeCollection.getById(id);
                if (!featureToUpdate) {
                    console.error(
                        'Node with id ' + id + ' was or is transferable, but it does not exist in the collection'
                    );
                    return;
                }
                const nodeToUpdate = nodeCollection.newObject(featureToUpdate, false, collectionManager);
                nodeToUpdate.startEditing();
                await updateTransferableNodes(nodeToUpdate, nodeCollection);
                if (!nodeToUpdate.hasChanged() && !nodeToUpdate.isNew()) {
                    return;
                }
                modifiedNodes.push(nodeToUpdate);
            }
        );
        await Promise.all(affectedNodesUpdatePromises);
        return modifiedNodes;
    } catch (error) {
        // TODO: Handle errors so that caller can do something about it
        const trError = TrError.isTrError(error)
            ? error
            : new TrError(
                `cannot fetch nodes in radius because of an error: ${error}`,
                'N0001',
                'NodesInRadiusCouldNotBeFetchedBecauseError'
            );
        console.error(trError.export);
        return [];
    }
};

/**
 * Update the transferable nodes from this node, but does not affect the other
 * nodes. The node's data is updated, but it is the responsibility of the caller
 * to save the node appropriately.
 */
export const updateTransferableNodes = async (node: Node, nodeCollection: NodeCollection) => {
    try {
        const reachableNodes = await nodesInWalkingTravelTimeRadiusSeconds(
            node,
            nodeCollection,
            Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
        );
        node.setData('transferableNodes', reachableNodes);
    } catch (error) {
        if (TrError.isTrError(error)) {
            return error.export();
        }
        const trError = new TrError(
            `cannot fetch nodes in radius because of an error: ${error}`,
            'N0001',
            'NodesInRadiusCouldNotBeFetchedBecauseError'
        );
        console.error(error);
        return trError.export();
    }
};

/**
 * Update the accessible places from this node, but does not affect the other
 * nodes. The node's data is updated, but it is the responsibility of the caller
 * to save the node appropriately.
 */
export const updateAccessiblePlaces = async (node: Node, placeCollection: PlaceCollection) => {
    try {
        const accessiblePlaces = {
            walking: await placesInWalkingTravelTimeRadiusSeconds(
                node,
                placeCollection,
                Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
            )
        };
        node.attributes.data.accessiblePlaces = accessiblePlaces;
    } catch (error) {
        if (TrError.isTrError(error)) {
            return error.export();
        }
        const trError = new TrError(
            `cannot fetch places in radius around node because of an error: ${error}`,
            'N0001',
            'PlacesInRadiusCouldNotBeFetchedBecauseError'
        );
        console.error(error);
        return trError.export();
    }
};

export default {
    nodesInWalkingTravelTimeRadiusSeconds,
    updateTransferableNodesWithAffected,
    updateTransferableNodes,
    updateAccessiblePlaces
};
