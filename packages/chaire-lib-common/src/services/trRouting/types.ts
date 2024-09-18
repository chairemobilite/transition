/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// This file contains types for the trRouting calculations
import * as TrRoutingApi from '../../api/TrRouting';

export enum ErrorCodes {
    NoRoutingFound = 'TRROUTING_NO_ROUTING_FOUND',
    NoAccessAtOrigin = 'TRROUTING_NO_ROUTING_NO_ACCESS_AT_ORIGIN',
    NoAccessAtDestination = 'TRROUTING_NOT_ROUTING_NO_ACCESS_AT_DESTINATION',
    NoAccessAtOriginAndDestination = 'TRROUTING_NOT_ROUTING_NO_ACCESS_AT_ORIGIN_AND_DESTINATION',
    NoServiceAtOrigin = 'TRROUTING_NO_ROUTING_NO_SERVICE_FROM_ORIGIN',
    NoServiceAtDestination = 'TRROUTING_NO_ROUTING_NO_SERVICE_TO_DESTINATION',
    ServerNotRunning = 'TRROUTING_SERVER_NOT_RUNNING',
    NoAccessAtPlace = 'TRROUTING_NOT_ROUTING_NO_ACCESS_AT_PLACE',
    NoServiceAtPlace = 'TRROUTING_NO_ROUTING_NO_SERVICE_AT_PLACE',
    OtherError = 'TRROUTING_ERROR_UNKNOWN',
    MissingData = 'TRROUTING_MISSING_DATA',
    DataError = 'TRROUTING_INVALID_DATA',
    QueryError = 'TRROUTING_QUERY_ERROR'
}

interface TrRoutingBaseQueryOptions {
    /**
     * Minimum waiting time, in seconds
     */
    minWaitingTime: number;
    /**
     * Maximum walking time from origin, in seconds
     */
    maxAccessTravelTime: number;
    /**
     * Maximum walking time to reach destination, in seconds
     */
    maxEgressTravelTime: number;
    /**
     * Maximum transfer time, in seconds
     */
    maxTransferTravelTime: number;
    /**
     * Maximum total travel time, in seconds
     */
    maxTravelTime: number;
    /**
     * The UUID of the scenario to use for the calculation
     */
    scenarioId: string;
    /**
     * Arrival or departure time of the trip, in seconds since midnight
     */
    timeOfTrip: number;
    /**
     * Whether the time is arrival or departure time
     */
    timeOfTripType: 'arrival' | 'departure';
    /**
     * Maximum wait time at first transit stop
     */
    maxFirstWaitingTime?: number;
}

export interface RoutingQueryOptions extends TrRoutingBaseQueryOptions {
    /**
     * Whether to calculate alternatives
     */
    alternatives?: boolean;
    /**
     * An array containing the origin and destination points. Any of the 2 can
     * be undefined if there is no origin or destination (for example
     * accessibility maps)
     */
    originDestination?: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>];
    /**
     * UUID of od trip
     *
     * FIXME: Are originDestination and odTripUuid mutually exclusive, but one of them is mandatory?
     */
    odTripUuid?: string;
}

export interface AccessibilityMapQueryOptions extends TrRoutingBaseQueryOptions {
    /**
     * To point from/to which to get the accessibility map
     */
    location: GeoJSON.Feature<GeoJSON.Point>;
    accessibleNodes?: { ids: string[]; durations: number[] };
}

export type TrRoutingResultPath = { type: 'path'; path: TrRoutingApi.TrRoutingPath };
export type TrRoutingResultAlternatives = {
    type: 'withAlternatives';
    alternatives: TrRoutingApi.TrRoutingAlternative[];
};

// Api agnostic version of the accessibility map result
// FIXME Not changed since V1, should we revisit?
export type TrRoutingResultAccessibilityMap = { type: 'nodes'; nodes: TrRoutingApi.TrRoutingApiNode[] };

export type TrRoutingResult = TrRoutingResultPath | TrRoutingResultAlternatives;

// For each route to be self contained, the query parameters are added to each result
export type TrRoutingRoute = TrRoutingApi.TrRoutingV2.SingleRouteResult & {
    originDestination: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>];
    timeOfTrip: number;
    timeOfTripType: 'arrival' | 'departure';
};
// API agnostic version of the route result
export type TrRoutingRouteResult = { routes: TrRoutingRoute[]; totalRoutesCalculated: number };
