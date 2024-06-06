/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { RoutingOrTransitMode, RoutingMode } from '../../config/routingModes';
import { TransitRoutingResultData } from './TransitRoutingResult';
import { UnimodalRoutingResultData } from './RoutingResult';

// This file contains the types for routing functions, used by both frontend and backend

/**
 * Attributes to parameterize any routing calculation, no matter the mode. It is
 * not specific to a trip, but specific to a calculation query
 */
export type RoutingQueryAttributes = {
    routingModes: RoutingOrTransitMode[];
    /**
     * Engine to use for the routing calculation. If not provided, the default
     * will be used.
     */
    engine?: string;
    withAlternatives: boolean;
};

/**
 * Attributes to parameterize a transit routing calculation, that can be used in
 * many contexts of transit routing, not necessarily a calculation.
 */
export type TransitRoutingBaseAttributes = {
    minWaitingTimeSeconds?: number;
    maxTransferTravelTimeSeconds?: number;
    maxAccessEgressTravelTimeSeconds?: number;
    maxWalkingOnlyTravelTimeSeconds?: number;
    maxFirstWaitingTimeSeconds?: number;
    maxTotalTravelTimeSeconds?: number;
    // TODO Consider using access/egress speeds/mode instead of forcing walking
    walkingSpeedMps?: number;
    walkingSpeedFactor?: number;
};

/**
 * Attributes to parameterize a transit query, that are not specific to any
 * transit query type, whether routing or accessibility map or other.
 */
export type TransitQueryAttributes = TransitRoutingBaseAttributes & {
    scenarioId?: string;
};

/**
 * Attributes to parameterize a transit routing calculation, that are not
 * specific to a trip, but specific to a calculation query
 */
export type TransitRoutingQueryAttributes = RoutingQueryAttributes & TransitQueryAttributes;

/**
 * Attributes to parameterize a single routing calculation, ie for a single trip
 */
export type TripRoutingQueryAttributes = TransitRoutingQueryAttributes & {
    routingName?: string;
    timeSecondsSinceMidnight: number;
    timeType: 'arrival' | 'departure';
    originGeojson: GeoJSON.Feature<GeoJSON.Point>;
    destinationGeojson: GeoJSON.Feature<GeoJSON.Point>;
    waypoints?: GeoJSON.Feature<GeoJSON.Point>[];
};

/**
 * Routing result type, where the key is the routing mode and value the actual
 * result.
 */
export type RoutingResultsByMode = {
    [key in RoutingMode]?: UnimodalRoutingResultData;
} & {
    transit?: TransitRoutingResultData;
};
