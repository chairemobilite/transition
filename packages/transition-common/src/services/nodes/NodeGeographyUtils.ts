/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import geokdbush from 'geokdbush';

import Node, { AccessiblePlacesPerTravelTime } from './Node';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import PlaceCollection from '../places/PlaceCollection';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

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
    updateAccessiblePlaces
};
