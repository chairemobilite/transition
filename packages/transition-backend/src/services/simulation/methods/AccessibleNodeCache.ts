/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random from 'random';
import geokdbush from 'geokdbush';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import { PlaceAttributes } from 'transition-common/lib/services/places/Place';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { NodeAttributes } from 'transition-common/lib/services/nodes/Node';

/**
 * A cache for accessible nodes from each place. They can be sent as parameters
 * to the trRouting query instead of trRouting fetching the nodes from osrm.
 *
 * TODO: This cache (and the query parameters) is a local optimization that
 * could be handled by some other caching mechanism.
 */
export default class AccessibleNodeCache {
    private accessibleNodesCache: { [placeId: string]: { ids: string[]; durations: number[] } } = {};
    private currentCacheSize = 0;
    public cacheHits = 0;
    public cacheMiss = 0;

    constructor(private maxCacheSize: number = 10000) {
        // Nothing to do
    }

    private cacheResult(key: string, value: { ids: string[]; durations: number[] }) {
        this.cacheMiss++;
        // Evict cache object if required
        if (this.currentCacheSize === this.maxCacheSize) {
            const removeAt = random.integer(0, this.maxCacheSize);
            const toRemove = Object.keys(this.accessibleNodesCache)[removeAt];
            delete this.accessibleNodesCache[toRemove];
        }
        this.accessibleNodesCache[key] = value;
    }

    private nodesInBirdRadiusMeters = (
        place: PlaceAttributes,
        nodeCollection: NodeCollection,
        birdRadiusMeters = 1000
    ) => {
        const nodesInBirdRadius = geokdbush.around(
            nodeCollection.getSpatialIndex(),
            place.geography.coordinates[0], // lon
            place.geography.coordinates[1], // lat
            undefined,
            birdRadiusMeters / 1000
        );
        return nodesInBirdRadius;
    };

    private getAccessibleNodesInRadius = async (
        place: PlaceAttributes,
        nodeCollection: NodeCollection,
        maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxAccessEgressWalkingTravelTimeSeconds')
    ): Promise<{ ids: string[]; durations: number[] }> => {
        const ids: string[] = [];
        const durations: number[] = [];

        const walkingSpeedMetersPerSeconds = Preferences.get('defaultWalkingSpeedMetersPerSeconds');
        const radiusBirdDistanceMeters = maxWalkingTravelTimeRadiusSeconds * walkingSpeedMetersPerSeconds;

        const nodesInBirdRadius: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>[] = this.nodesInBirdRadiusMeters(
            place,
            nodeCollection,
            radiusBirdDistanceMeters
        );
        const useBirdDistances = Preferences.get('transit.nodes.useBirdDistanceForTransferableNodes');

        let netDurations: number[] = [];

        if (!useBirdDistances) {
            const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
            const routingResultJson = await routingService.tableFrom({
                mode: 'walking',
                origin: { type: 'Feature', geometry: place.geography, properties: {} },
                destinations: nodesInBirdRadius
            });
            netDurations = routingResultJson.durations;
        } else {
            for (let i = 0, count = nodesInBirdRadius.length; i < count; i++) {
                const nodeInBirdRadius = nodesInBirdRadius[i];

                const birdDistanceMeters =
                    geokdbush.distance(
                        place.geography.coordinates[0], // lon
                        place.geography.coordinates[1],
                        nodeInBirdRadius.geometry.coordinates[0],
                        nodeInBirdRadius.geometry.coordinates[1]
                    ) * 1000;
                netDurations.push(Math.ceil(birdDistanceMeters / walkingSpeedMetersPerSeconds));
            }
        }

        for (let i = 0, count = nodesInBirdRadius.length; i < count; i++) {
            const netDuration = netDurations[i];
            if (netDuration < maxWalkingTravelTimeRadiusSeconds) {
                ids.push(nodesInBirdRadius[i].properties.id);
                durations.push(netDuration);
            }
        }
        return { ids, durations };
    };

    /**
     * Get the nodes that are in walking distance of the place, along with their
     * travel time.
     */
    getAccessibleNodes = async (
        place: PlaceAttributes,
        nodeCollection: NodeCollection,
        maxWalkingTravelTimeRadiusSeconds = Preferences.get('transit.nodes.maxTransferWalkingTravelTimeSeconds')
    ): Promise<{ ids: string[]; durations: number[] }> => {
        const accessibleNodes = this.accessibleNodesCache[place.id];
        if (accessibleNodes !== undefined) {
            this.cacheHits++;
            return accessibleNodes;
        }
        const calculatedAccessiblePlaces = await this.getAccessibleNodesInRadius(
            place,
            nodeCollection,
            maxWalkingTravelTimeRadiusSeconds
        );
        this.cacheResult(place.id, calculatedAccessiblePlaces);

        return calculatedAccessiblePlaces;
    };
}
