/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import geokdbush from 'geokdbush';
import { lineIntersect as turfLineIntersect, distance as turfDistance, point as turfPoint } from '@turf/turf';
import { EventEmitter } from 'events';

import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import * as Status from 'chaire-lib-common/lib/utils/Status';

import Node, { AccessiblePlacesPerTravelTime } from './Node';
import PlaceCollection from '../places/PlaceCollection';

import {
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

// TODO: test
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
 * Find the touching point between two lines.
 * It will return point only if the first line as a common point
 * with second line and both are extremities.
 * @param line1: a GeoJSON.Feature<GeoJSON.LineString>
 * @param line2: a GeoJSON.Feature<GeoJSON.LineString>
 * @returns a GeoJSON.Feature<GeoJSON.Point> or undefined
 */
const findTouchingPoint = (
    line1: GeoJSON.Feature<GeoJSON.LineString>,
    line2: GeoJSON.Feature<GeoJSON.LineString>
): GeoJSON.Feature<GeoJSON.Point> | undefined => {
    // Extract start and end points of both lines
    const line1StartCoordinates = line1.geometry.coordinates[0] as GeoJSON.Position;
    const line1EndCoordinates = line1.geometry.coordinates[line1.geometry.coordinates.length - 1] as GeoJSON.Position;
    const line2StartCoordinates = line2.geometry.coordinates[0] as GeoJSON.Position;
    const line2EndCoordinates = line2.geometry.coordinates[line2.geometry.coordinates.length - 1] as GeoJSON.Position;

    // Helper function to check if two points are equal (within a small epsilon)
    const arePointsEqual = (p1: GeoJSON.Position, p2: GeoJSON.Position): boolean => {
        return p1[0] === p2[0] && p1[1] === p2[1];
    };

    // Check all possible endpoint combinations
    if (arePointsEqual(line1StartCoordinates, line2StartCoordinates)) {
        return turfPoint(line1StartCoordinates) as GeoJSON.Feature<GeoJSON.Point>;
    }

    if (arePointsEqual(line1StartCoordinates, line2EndCoordinates)) {
        return turfPoint(line1StartCoordinates) as GeoJSON.Feature<GeoJSON.Point>;
    }

    if (arePointsEqual(line1EndCoordinates, line2StartCoordinates)) {
        return turfPoint(line1EndCoordinates) as GeoJSON.Feature<GeoJSON.Point>;
    }

    if (arePointsEqual(line1EndCoordinates, line2EndCoordinates)) {
        return turfPoint(line1EndCoordinates) as GeoJSON.Feature<GeoJSON.Point>;
    }

    return undefined;
};

/**
 * Get the places that are in walking distance of the node.
 * This function does not change the node.
 *
 * TODO: This may not be just for walking
 * TODO: test
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
 * Propose names for a node name based on the nearest street intersections.
 * it fetches the nearest streets from osm, and then find intersections of
 * these streets and generate names from these intersections, ordered by distance with node.
 */
export const proposeNames = async (
    socket: EventEmitter,
    node: Node,
    maxRadiusMeters = 200
): Promise<string[] | undefined> => {
    // get nearest street intersections from osm:
    let intersectionNames: string[] | undefined = [];
    let radiusAroundMeters = 100;
    const nodeGeojson = node.toGeojson();
    while (intersectionNames !== undefined && intersectionNames.length < 2 && radiusAroundMeters <= maxRadiusMeters) {
        intersectionNames = await new Promise((resolve, reject) => {
            socket.emit(
                'osm.streetsAroundPoint',
                nodeGeojson,
                radiusAroundMeters,
                (status: Status.Status<GeoJSON.Feature<GeoJSON.LineString>[]>) => {
                    if (Status.isStatusOk(status)) {
                        const streetsGeojsonFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = status.result;
                        const streetsWithNames = streetsGeojsonFeatures.filter((f) => f.properties?.name !== undefined);
                        const distanceFromNodeByStreetIntersectionName: { [key: string]: number } = {};
                        // find intersections for each pair of street names:
                        for (let i = 0, countI = streetsWithNames.length; i < countI; i++) {
                            const street1 = streetsWithNames[i] as GeoJSON.Feature<GeoJSON.LineString>;
                            const street1Name = street1.properties?.name;
                            for (let j = 0, countJ = streetsWithNames.length; j < countJ; j++) {
                                const street2 = streetsWithNames[j] as GeoJSON.Feature<GeoJSON.LineString>;
                                const street2Name = street2.properties?.name;
                                const intersectionName = `${street1Name} / ${street2Name}`;
                                const reversedIntersectionName = `${street2Name} / ${street1Name}`;
                                if (
                                    street1Name !== street2Name &&
                                    !distanceFromNodeByStreetIntersectionName[reversedIntersectionName]
                                ) {
                                    /*
                                        new version of turf.lineIntersect (since v7) does not return the touching point for
                                        lines that are touching at extremities, so we need to find the touching point manually:
                                        See https://github.com/Turfjs/turf/issues/2667
                                    */
                                    const intersectionPoints = turfLineIntersect(street1, street2);
                                    const touchingPoint = findTouchingPoint(street1, street2);
                                    if (touchingPoint) {
                                        intersectionPoints.features.push(touchingPoint);
                                    }
                                    if (intersectionPoints.features.length > 0) {
                                        for (let k = 0, countK = intersectionPoints.features.length; k < countK; k++) {
                                            const intersectionPoint = intersectionPoints.features[k];
                                            const distanceFromNode = turfDistance(intersectionPoint, nodeGeojson, {
                                                units: 'meters'
                                            });
                                            if (
                                                distanceFromNodeByStreetIntersectionName[intersectionName] === undefined
                                            ) {
                                                distanceFromNodeByStreetIntersectionName[intersectionName] =
                                                    distanceFromNode;
                                                distanceFromNodeByStreetIntersectionName[reversedIntersectionName] =
                                                    distanceFromNode;
                                            } else if (
                                                distanceFromNodeByStreetIntersectionName[intersectionName] >
                                                distanceFromNode
                                            ) {
                                                // only update distance if we found a closer insterseciton for the same streets:
                                                distanceFromNodeByStreetIntersectionName[intersectionName] =
                                                    distanceFromNode;
                                                distanceFromNodeByStreetIntersectionName[reversedIntersectionName] =
                                                    distanceFromNode;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        // sort by distance ASC:
                        const intersectionNames = Object.keys(distanceFromNodeByStreetIntersectionName).sort(
                            (intersectionName1, intersectionName2) => {
                                return (
                                    distanceFromNodeByStreetIntersectionName[intersectionName1] -
                                    distanceFromNodeByStreetIntersectionName[intersectionName2]
                                );
                            }
                        );

                        if (intersectionNames.length > 0) {
                            resolve(intersectionNames);
                        } else {
                            // if no intersection found, return every street names found in radius:
                            resolve(streetsWithNames.map((f) => f.properties?.name as string));
                        }
                    } else if (Status.isStatusError(status)) {
                        console.error('Error while getting street names around node: ', status.error);
                        resolve(undefined);
                    }
                }
            );
        });
        radiusAroundMeters += Math.min(100, maxRadiusMeters - radiusAroundMeters);
    }
    return intersectionNames;
};

/**
 * Update the accessible places from this node, but does not affect the other
 * nodes. The node's data is updated, but it is the responsibility of the caller
 * to save the node appropriately.
 * TODO: test
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
