/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import GeoJSON from 'geojson';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

import transitNodesDbQueries from '../../models/db/transitNodes.db.queries';
import { DecayFunctionCalculator } from './DecayFunctionCalculator';
import {
    DecayFunctionParameters,
    DecayInputValueType,
    DecayInputValue,
    WeightingRoutingMode,
    AccessibilityWeights,
    WeightDecayInputType
} from './types';
import {
    getPOIsWithinBirdDistanceFromPlaces,
    getPOIsWithinBirdDistanceFromNodes
} from '../../models/db/geometryUtils.db.queries';

export type AccessibilityWeightCalculationParameters = {
    decayFunctionParameters: DecayFunctionParameters;
    decayInputType: WeightDecayInputType; // Type of input value for decay function: birdDistance, networkDistance, or travelTime
    poisFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>; // GeoJSON FeatureCollection of POIs with intrinsic weight in properties
    placesFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point>; // GeoJSON FeatureCollection of places to calculate accessibility weights for
    maxBirdDistanceMeters?: number; // Optional: maximum bird distance in meters (from preferences if not provided)
    maxNetworkDistanceMeters?: number; // Optional: maximum network distance in meters (from preferences if not provided)
    maxTravelTimeSeconds?: number; // Optional: maximum travel time in seconds (from preferences if not provided)
    routingMode?: WeightingRoutingMode;
};

// FIXME: Use a class to encapsulate the calculation data and methods and reduce the need to pass that many parameters around.

type PreparedCalculationData = {
    validPOIsFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>;
    decayInputValueType: DecayInputValueType;
    maxBirdDistance: number;
    maxNetworkDistance: number;
    maxTravelTime: number;
    routingService: ReturnType<typeof routingServiceManager.getRoutingServiceForEngine>;
};

type CalculateWeightForEntityParameters = {
    entityFeature: GeoJSON.Feature<GeoJSON.Point>;
    poisInBirdDistance: Array<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }>;
    decayInputType: WeightDecayInputType;
    preparedData: PreparedCalculationData;
    decayFunctionParameters: DecayFunctionParameters;
    routingMode: WeightingRoutingMode;
};

/**
 * Service to calculate accessibility weights for places based on intrinsic weighted POIs and decay functions.
 *
 * This calculator can be used with any type of place (transit nodes, points of interest, home, etc.)
 * as attractors for POIs. The accessibility weight of each place is calculated based on the proximity and
 * intrinsic weights of surrounding POIs, using configurable decay functions to model how POI influence
 * decreases with distance or travel time.
 */
export class AccessibilityWeightCalculator {
    /**
     * Validate and prepare POIs for accessibility weight calculation.
     * Filters POIs with valid geometry and ensures they have numeric IDs.
     * Auto-generates numeric IDs for POIs that are missing or have invalid IDs.
     *
     * @param poisFeatureCollection Input POIs FeatureCollection
     * @returns Status with valid POIs FeatureCollection with numeric IDs
     */
    private static validateAndPreparePOIs(
        poisFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>
    ): Status.Status<GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>> {
        // Validate POIs FeatureCollection
        if (!poisFeatureCollection || !poisFeatureCollection.features || poisFeatureCollection.features.length === 0) {
            return Status.createError(
                new TrError(
                    'poisFeatureCollection is required and must contain at least one feature',
                    'AWC0001',
                    'AccessibilityWeightCalculationError'
                )
            );
        }

        // Filter POIs with valid geometry
        const validPOIs = poisFeatureCollection.features.filter(
            (feature) => feature.geometry && feature.geometry.coordinates
        );

        if (validPOIs.length === 0) {
            // No valid POIs, return empty FeatureCollection
            return Status.createOk({
                type: 'FeatureCollection',
                features: []
            });
        }

        // Generate new integer IDs from scratch, ignoring original POI IDs
        let nextId = 1;
        const validPOIsWithNumericIds = validPOIs.map((poi) => {
            return {
                ...poi,
                id: nextId++
            } as GeoJSON.Feature<GeoJSON.Point, { weight?: number }> & { id: number };
        });

        // Create FeatureCollection with valid POIs that have numeric ids
        return Status.createOk({
            type: 'FeatureCollection',
            features: validPOIsWithNumericIds
        });
    }

    /**
     * Validate calculation parameters.
     *
     * @param maxBirdDistanceMeters Optional maximum bird distance
     * @param maxNetworkDistanceMeters Optional maximum network distance
     * @param maxTravelTimeSeconds Optional maximum travel time
     * @returns Status indicating validation success or failure
     */
    private static validateParameters(
        maxBirdDistanceMeters?: number,
        maxNetworkDistanceMeters?: number,
        maxTravelTimeSeconds?: number
    ): Status.Status<void> {
        if (maxBirdDistanceMeters !== undefined && maxBirdDistanceMeters <= 0) {
            return Status.createError(
                new TrError(
                    'maxBirdDistanceMeters must be a positive number',
                    'AWC0002',
                    'AccessibilityWeightCalculationError'
                )
            );
        }
        if (maxNetworkDistanceMeters !== undefined && maxNetworkDistanceMeters <= 0) {
            return Status.createError(
                new TrError(
                    'maxNetworkDistanceMeters must be a positive number',
                    'AWC0003',
                    'AccessibilityWeightCalculationError'
                )
            );
        }
        if (maxTravelTimeSeconds !== undefined && maxTravelTimeSeconds <= 0) {
            return Status.createError(
                new TrError(
                    'maxTravelTimeSeconds must be a positive number',
                    'AWC0004',
                    'AccessibilityWeightCalculationError'
                )
            );
        }
        return Status.createOk(undefined);
    }

    /**
     * Get max distances and travel time from preferences if not provided.
     *
     * @param routingMode Routing mode
     * @param maxBirdDistanceMeters Optional maximum bird distance
     * @param maxNetworkDistanceMeters Optional maximum network distance
     * @param maxTravelTimeSeconds Optional maximum travel time
     * @returns Object with max distances and travel time
     */
    private static getMaxDistancesAndTime(
        routingMode: WeightingRoutingMode,
        maxBirdDistanceMeters?: number,
        maxNetworkDistanceMeters?: number,
        maxTravelTimeSeconds?: number
    ): { maxBirdDistance: number; maxNetworkDistance: number; maxTravelTime: number } {
        // Compute values with order of precedence: explicit arg, preference, default
        const computedMaxBirdDistance =
            maxBirdDistanceMeters ??
            Preferences.get(`maxAccessibilityWeightsBirdDistancesMeters.${routingMode}`) ??
            2500;
        const computedMaxNetworkDistance =
            maxNetworkDistanceMeters ??
            Preferences.get(`maxAccessibilityWeightsNetworkDistancesMeters.${routingMode}`) ??
            2500;
        const computedMaxTravelTime =
            maxTravelTimeSeconds ?? Preferences.get(`maxAccessibilityWeightsTravelTimeSeconds.${routingMode}`) ?? 1800;

        // Validate each computed value: must be finite and strictly positive
        // Replace invalid values with safe defaults
        const maxBirdDistance =
            Number.isFinite(computedMaxBirdDistance) && computedMaxBirdDistance > 0 ? computedMaxBirdDistance : 2500;
        const maxNetworkDistance =
            Number.isFinite(computedMaxNetworkDistance) && computedMaxNetworkDistance > 0
                ? computedMaxNetworkDistance
                : 2500;
        const maxTravelTime =
            Number.isFinite(computedMaxTravelTime) && computedMaxTravelTime > 0 ? computedMaxTravelTime : 1800;

        return {
            maxBirdDistance,
            maxNetworkDistance,
            maxTravelTime
        };
    }

    /**
     * Prepare common calculation data (POIs, decay type, max distances, routing service).
     *
     * @param parameters Calculation parameters
     * @returns Status with prepared calculation data
     */
    private static prepareCalculationData(parameters: {
        poisFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }>;
        decayInputType: WeightDecayInputType;
        maxBirdDistanceMeters?: number;
        maxNetworkDistanceMeters?: number;
        maxTravelTimeSeconds?: number;
        routingMode?: WeightingRoutingMode;
    }): Status.Status<PreparedCalculationData> {
        const {
            poisFeatureCollection,
            decayInputType,
            maxBirdDistanceMeters,
            maxNetworkDistanceMeters,
            maxTravelTimeSeconds,
            routingMode = 'walking'
        } = parameters;

        // Validate and prepare POIs
        const poisStatus = AccessibilityWeightCalculator.validateAndPreparePOIs(poisFeatureCollection);
        if (Status.isStatusError(poisStatus)) {
            return poisStatus;
        }
        const validPOIsFeatureCollection = poisStatus.result;

        if (validPOIsFeatureCollection.features.length === 0) {
            // Return empty data structure - caller should handle empty results
            return Status.createOk({
                validPOIsFeatureCollection,
                decayInputValueType: decayInputType === 'travelTime' ? 'time' : 'distance',
                maxBirdDistance: 0,
                maxNetworkDistance: 0,
                maxTravelTime: 0,
                routingService: routingServiceManager.getRoutingServiceForEngine('engine')
            });
        }

        // Validate parameters
        const validationStatus = AccessibilityWeightCalculator.validateParameters(
            maxBirdDistanceMeters,
            maxNetworkDistanceMeters,
            maxTravelTimeSeconds
        );
        if (Status.isStatusError(validationStatus)) {
            return validationStatus;
        }

        // Get max distances and travel time
        const { maxBirdDistance, maxNetworkDistance, maxTravelTime } =
            AccessibilityWeightCalculator.getMaxDistancesAndTime(
                routingMode,
                maxBirdDistanceMeters,
                maxNetworkDistanceMeters,
                maxTravelTimeSeconds
            );

        // Map decayInputType to DecayInputValueType for the decay function
        // The decay function only cares about 'distance' or 'time', not the source
        const decayInputValueType: DecayInputValueType = decayInputType === 'travelTime' ? 'time' : 'distance';

        return Status.createOk({
            validPOIsFeatureCollection,
            decayInputValueType,
            maxBirdDistance,
            maxNetworkDistance,
            maxTravelTime,
            routingService: routingServiceManager.getRoutingServiceForEngine('engine')
        });
    }

    /**
     * Calculate accessibility weight for a single entity (place or node).
     *
     * @param parameters Calculation parameters
     * @returns Status with calculated accessibility weight
     */
    private static async calculateWeightForEntity(
        parameters: CalculateWeightForEntityParameters
    ): Promise<Status.Status<number>> {
        const {
            entityFeature,
            poisInBirdDistance,
            decayInputType,
            preparedData,
            decayFunctionParameters,
            routingMode
        } = parameters;

        if (poisInBirdDistance.length === 0) {
            return Status.createOk(0);
        }

        if (decayInputType === 'birdDistance') {
            return Status.createOk(
                AccessibilityWeightCalculator.calculateAccessibilityWeightUsingBirdDistance(
                    poisInBirdDistance,
                    preparedData.maxBirdDistance,
                    preparedData.decayInputValueType,
                    decayFunctionParameters
                )
            );
        } else {
            return await AccessibilityWeightCalculator.calculateAccessibilityWeightUsingRouting(
                entityFeature,
                poisInBirdDistance,
                decayInputType,
                preparedData.maxNetworkDistance,
                preparedData.maxTravelTime,
                preparedData.decayInputValueType,
                decayFunctionParameters,
                preparedData.routingService,
                routingMode
            );
        }
    }

    /**
     * Calculate place accessibility weights based on POI proximity and decay functions.
     * Any place can be used as an attractor for POIs - the places are provided as a
     * GeoJSON FeatureCollection of Point features.
     *
     * @param parameters Calculation parameters
     * @param progressCallback Optional callback for progress updates (0.0 to 1.0)
     * @returns Status with dictionary mapping place IDs to their calculated accessibility weights: { id1: weight1, id2: weight2, ... }
     */
    static async calculateWeights(
        parameters: AccessibilityWeightCalculationParameters,
        progressCallback?: (progress: number) => void
    ): Promise<Status.Status<AccessibilityWeights>> {
        const { placesFeatureCollection, decayFunctionParameters, decayInputType, ...restParams } = parameters;

        // Validate places FeatureCollection
        if (
            !placesFeatureCollection ||
            !placesFeatureCollection.features ||
            placesFeatureCollection.features.length === 0
        ) {
            return Status.createError(
                new TrError(
                    'placesFeatureCollection is required and must contain at least one feature',
                    'AWC0005',
                    'AccessibilityWeightCalculationError'
                )
            );
        }

        // Prepare common calculation data
        const preparedDataStatus = AccessibilityWeightCalculator.prepareCalculationData({
            ...restParams,
            decayInputType
        });

        if (Status.isStatusError(preparedDataStatus)) {
            return preparedDataStatus;
        }

        const preparedData = preparedDataStatus.result;

        if (preparedData.validPOIsFeatureCollection.features.length === 0) {
            return Status.createOk({});
        }

        // Filter places with valid geometry
        const validPlaces = placesFeatureCollection.features.filter(
            (feature) => feature.geometry && feature.geometry.coordinates && feature.id !== undefined
        );

        if (validPlaces.length === 0) {
            return Status.createOk({});
        }

        const results: AccessibilityWeights = {};

        // Create a FeatureCollection with only valid places
        const validPlacesFeatureCollection: GeoJSON.FeatureCollection<GeoJSON.Point> = {
            type: 'FeatureCollection',
            features: validPlaces
        };

        // Get POIs within bird distance for all places in a single batch query
        // This creates a single temporary table for all places and POIs
        const poisByPlaceId = await getPOIsWithinBirdDistanceFromPlaces(
            validPlacesFeatureCollection,
            preparedData.maxBirdDistance,
            preparedData.validPOIsFeatureCollection
        );

        // Process each place
        for (let placeIndex = 0; placeIndex < validPlaces.length; placeIndex++) {
            const place = validPlaces[placeIndex];

            // Update progress
            if (progressCallback) {
                progressCallback(placeIndex / validPlaces.length);
            }

            // Skip places without valid geometry (shouldn't happen after filtering, but double-check)
            if (!place.geometry || !place.geometry.coordinates || place.id === undefined) {
                continue;
            }

            const placeId = typeof place.id === 'string' ? place.id : String(place.id);

            // Get POIs within bird distance from the batch results
            const poisInBirdDistance = poisByPlaceId[placeId] || [];

            // Calculate accessibility weight for this place
            const weightStatus = await AccessibilityWeightCalculator.calculateWeightForEntity({
                entityFeature: place,
                poisInBirdDistance,
                decayInputType,
                preparedData,
                decayFunctionParameters,
                routingMode: parameters.routingMode || 'walking'
            });

            if (Status.isStatusError(weightStatus)) {
                return weightStatus;
            }

            results[placeId] = weightStatus.result;
        }

        // Final progress update
        if (progressCallback) {
            progressCallback(1.0);
        }

        return Status.createOk(results);
    }

    /**
     * Calculate node accessibility weights based on POI proximity and decay functions.
     * This method uses the existing tr_transit_nodes table and only creates a temporary POIs table,
     * making it more efficient for transit node calculations.
     *
     * @param parameters Calculation parameters (with nodeIds instead of placesFeatureCollection)
     * @param progressCallback Optional callback for progress updates (0.0 to 1.0)
     * @returns Status with dictionary mapping node IDs to their calculated accessibility weights: { id1: weight1, id2: weight2, ... }
     */
    static async calculateNodeAccessibilityWeights(
        parameters: Omit<AccessibilityWeightCalculationParameters, 'placesFeatureCollection'> & { nodeIds?: string[] },
        progressCallback?: (progress: number) => void
    ): Promise<Status.Status<AccessibilityWeights>> {
        const { nodeIds, decayFunctionParameters, decayInputType, ...restParams } = parameters;

        // Early return if nodeIds is an empty array (means "no nodes")
        // This avoids calling getPOIsWithinBirdDistanceFromNodes and transitNodesDbQueries.collection unnecessarily
        if (nodeIds !== undefined && nodeIds.length === 0) {
            return Status.createOk({});
        }

        // Prepare common calculation data
        const preparedDataStatus = AccessibilityWeightCalculator.prepareCalculationData({
            ...restParams,
            decayInputType
        });

        if (Status.isStatusError(preparedDataStatus)) {
            return preparedDataStatus;
        }

        const preparedData = preparedDataStatus.result;

        if (preparedData.validPOIsFeatureCollection.features.length === 0) {
            return Status.createOk({});
        }

        const results: AccessibilityWeights = {};

        // Get POIs within bird distance for all nodes in a single batch query
        // This uses the existing tr_transit_nodes table and only creates a temporary POIs table
        // If nodeIds is undefined, calculates for all enabled nodes. If empty array, returns {} immediately.
        const poisByNodeId = await getPOIsWithinBirdDistanceFromNodes(
            preparedData.maxBirdDistance,
            preparedData.validPOIsFeatureCollection,
            nodeIds
        );

        // Get node data from database for routing
        // If nodeIds is not provided, fetches all enabled nodes
        const nodesCollection = await transitNodesDbQueries.collection({ nodeIds });

        // Create a map of node IDs to node features for easier lookup
        const nodeMap = new Map<string, GeoJSON.Feature<GeoJSON.Point>>();
        for (const node of nodesCollection) {
            if (node.geography && node.id) {
                nodeMap.set(node.id, {
                    type: 'Feature',
                    id: node.id,
                    geometry: node.geography,
                    properties: {}
                });
            }
        }

        // Get list of node IDs to process (from provided nodeIds or from database results)
        const nodeIdsToProcess =
            nodeIds && nodeIds.length > 0
                ? nodeIds
                : nodesCollection.map((node) => node.id).filter((id): id is string => id !== undefined);

        // Process each node
        for (let nodeIndex = 0; nodeIndex < nodeIdsToProcess.length; nodeIndex++) {
            const nodeId = nodeIdsToProcess[nodeIndex];

            // Update progress
            if (progressCallback) {
                progressCallback(nodeIndex / nodeIdsToProcess.length);
            }

            // Get node feature from map
            const nodeFeature = nodeMap.get(nodeId);
            if (!nodeFeature || !nodeFeature.geometry || !nodeFeature.geometry.coordinates) {
                // Node not found or invalid geometry, accessibility weight is 0
                results[nodeId] = 0;
                continue;
            }

            // Get POIs within bird distance from the batch results
            const poisInBirdDistance = poisByNodeId[nodeId] || [];

            // Calculate accessibility weight for this node
            const weightStatus = await AccessibilityWeightCalculator.calculateWeightForEntity({
                entityFeature: nodeFeature,
                poisInBirdDistance,
                decayInputType,
                preparedData,
                decayFunctionParameters,
                routingMode: parameters.routingMode || 'walking'
            });

            if (Status.isStatusError(weightStatus)) {
                return weightStatus;
            }

            results[nodeId] = weightStatus.result;
        }

        // Final progress update
        if (progressCallback) {
            progressCallback(1.0);
        }

        return Status.createOk(results);
    }

    /**
     * Calculate place accessibility weight using bird distance (straight-line distance).
     * This method skips routing and uses the bird distance directly from the POI query results.
     *
     * @param poisInBirdDistance Array of POIs within bird distance
     * @param maxBirdDistance Maximum bird distance threshold
     * @param decayInputValueType Type of input value for decay function ('distance' or 'time')
     * @param decayFunctionParameters Decay function parameters
     * @returns Calculated accessibility weight for the place
     */
    private static calculateAccessibilityWeightUsingBirdDistance(
        poisInBirdDistance: Array<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }>,
        maxBirdDistance: number,
        decayInputValueType: DecayInputValueType,
        decayFunctionParameters: DecayFunctionParameters
    ): number {
        let placeAccessibilityWeight = 0;

        for (const poi of poisInBirdDistance) {
            const birdDistance = poi.distance;

            // Filter by max bird distance threshold
            if (birdDistance > maxBirdDistance) {
                continue;
            }

            // Calculate decay value using bird distance
            const inputValue: DecayInputValue = {
                distanceMeters: birdDistance
            };

            try {
                const decayValue = DecayFunctionCalculator.calculateDecay(
                    inputValue,
                    decayInputValueType,
                    decayFunctionParameters
                );

                // Add weighted contribution: placeWeight += poiWeight * decayValue
                placeAccessibilityWeight += poi.weight * decayValue;
            } catch (error) {
                console.warn(`Error calculating decay for POI ${poi.id}: ${error}`);
            }
        }

        return placeAccessibilityWeight;
    }

    /**
     * Calculate place accessibility weight using routing (network distance or travel time).
     * This method uses OSRM routing to calculate network distances and travel times.
     *
     * @param place Place feature to calculate accessibility weight for
     * @param poisInBirdDistance Array of POIs within bird distance
     * @param decayInputType Type of decay input ('networkDistance' or 'travelTime')
     * @param maxNetworkDistance Maximum network distance threshold
     * @param maxTravelTime Maximum travel time threshold
     * @param decayInputValueType Type of input value for decay function ('distance' or 'time')
     * @param decayFunctionParameters Decay function parameters
     * @param routingService Routing service instance
     * @param routingMode Routing mode
     * @returns Status with calculated accessibility weight for the place
     */
    private static async calculateAccessibilityWeightUsingRouting(
        place: GeoJSON.Feature<GeoJSON.Point>,
        poisInBirdDistance: Array<{ id: number; weight: number; distance: number; geography: GeoJSON.Point }>,
        decayInputType: WeightDecayInputType,
        maxNetworkDistance: number,
        maxTravelTime: number,
        decayInputValueType: DecayInputValueType,
        decayFunctionParameters: DecayFunctionParameters,
        routingService: ReturnType<typeof routingServiceManager.getRoutingServiceForEngine>,
        routingMode: WeightingRoutingMode
    ): Promise<Status.Status<number>> {
        // Convert POIs to GeoJSON features for routing
        const poiGeographies: GeoJSON.Feature<GeoJSON.Point>[] = poisInBirdDistance.map((poi) => ({
            type: 'Feature',
            geometry: poi.geography,
            properties: {
                poiId: poi.id,
                weight: poi.weight ?? 0,
                birdDistance: poi.distance
            }
        }));

        // Calculate network distances and travel times using OSRM
        const placeFeature: GeoJSON.Feature<GeoJSON.Point> = {
            type: 'Feature',
            geometry: place.geometry,
            properties: {}
        };

        const routingResult = await routingService.tableFrom({
            mode: routingMode,
            origin: placeFeature,
            destinations: poiGeographies
        });

        // Extract durations and distances from routing result
        const durations = routingResult.durations || [];
        const distances = routingResult.distances || [];

        let placeAccessibilityWeight = 0;

        for (let i = 0; i < poiGeographies.length; i++) {
            const poiFeature = poiGeographies[i];
            if (!poiFeature.properties) {
                continue;
            }

            const poiWeight = (poiFeature.properties.weight as number) ?? 0;
            const travelTimeSeconds = durations[i];
            const distanceMeters = distances[i];

            // Validate and filter based on decay input type
            // Skip POIs that are not accessible (null/undefined is acceptable, but NaN indicates an error)
            if (decayInputType === 'travelTime') {
                // For travel time: skip if null/undefined (POI not accessible), but throw if NaN (error)
                if (travelTimeSeconds === null || travelTimeSeconds === undefined) {
                    continue; // POI not accessible, skip it
                }
                if (isNaN(travelTimeSeconds)) {
                    const poiId = poiFeature.properties.poiId as number;
                    return Status.createError(
                        new TrError(
                            `Travel time is NaN for decay input type 'travelTime' for POI ${poiId}`,
                            'AWC0007',
                            'AccessibilityWeightCalculationError'
                        )
                    );
                }
                // Filter based on travel time threshold
                if (travelTimeSeconds > maxTravelTime) {
                    continue;
                }
            } else if (decayInputType === 'networkDistance') {
                // For network distance: skip if null/undefined (POI not accessible), but throw if NaN (error)
                if (distanceMeters === null || distanceMeters === undefined) {
                    continue; // POI not accessible, skip it
                }
                if (isNaN(distanceMeters)) {
                    const poiId = poiFeature.properties.poiId as number;
                    return Status.createError(
                        new TrError(
                            `Network distance is NaN for decay input type 'networkDistance' for POI ${poiId}`,
                            'AWC0008',
                            'AccessibilityWeightCalculationError'
                        )
                    );
                }
                // Filter based on network distance threshold
                if (distanceMeters > maxNetworkDistance) {
                    continue;
                }
            } else {
                // For birdDistance, we shouldn't reach here (handled in the if branch above)
                return Status.createError(
                    new TrError(
                        `Unexpected decay input type: ${decayInputType}`,
                        'AWC0009',
                        'AccessibilityWeightCalculationError'
                    )
                );
            }

            // Calculate decay value
            const inputValue: DecayInputValue = {
                distanceMeters,
                travelTimeSeconds
            };

            try {
                const decayValue = DecayFunctionCalculator.calculateDecay(
                    inputValue,
                    decayInputValueType,
                    decayFunctionParameters
                );

                // Add weighted contribution: placeWeight += poiWeight * decayValue
                placeAccessibilityWeight += poiWeight * decayValue;
            } catch (error) {
                const poiId = poiFeature.properties.poiId as number;
                console.warn(`Error calculating decay for POI ${poiId}: ${error}`);
            }
        }

        return Status.createOk(placeAccessibilityWeight);
    }
}
