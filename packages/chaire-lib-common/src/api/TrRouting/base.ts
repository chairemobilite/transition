/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ErrorMessage } from '../../utils/TrError';

// TODO These batch demand attributes are not trRouting specific. They should go elsewhere
export type TransitBatchDemandFromCsvAttributes = {
    calculationName: string;
    projection: string;
    idAttribute: string;
    timeAttributeDepartureOrArrival: 'arrival' | 'departure';
    timeFormat: string;
    timeAttribute: string;
    withGeometries: boolean;
    detailed: boolean;
    cpuCount: number;
    csvFile: { location: 'upload' } | { location: 'server'; fromJob: number };
};

export type TransitBatchRoutingDemandFromCsvAttributes = TransitBatchDemandFromCsvAttributes & {
    originXAttribute: string;
    originYAttribute: string;
    destinationXAttribute: string;
    destinationYAttribute: string;
    saveToDb: false | { type: 'new'; dataSourceName: string } | { type: 'overwrite'; dataSourceId: string };
};

export type TransitBatchRoutingDemandAttributes = {
    type: 'csv';
    configuration: TransitBatchRoutingDemandFromCsvAttributes;
};

export type TransitBatchAccessibilityMapAttributes = TransitBatchDemandFromCsvAttributes & {
    xAttribute: string;
    yAttribute: string;
};

export interface TransitBatchCalculationResult {
    calculationName: string;
    detailed: boolean;
    completed: boolean;
    warnings: ErrorMessage[];
    errors: ErrorMessage[];
}

export interface TransitRouteQueryOptions {
    /**
     * An array containing the origin and destination points.
     */
    originDestination: [GeoJSON.Feature<GeoJSON.Point>, GeoJSON.Feature<GeoJSON.Point>];
    /**
     * The UUID of the scenario to use for the calculation
     */
    scenarioId: string;
    /**
     * Whether to calculate alternatives
     */
    alternatives?: boolean;
    /**
     * Arrival or departure time of the trip, in seconds since midnight
     */
    timeOfTrip: number;
    /**
     * Whether the time is arrival or departure time
     */
    timeOfTripType: 'arrival' | 'departure';
    /**
     * Minimum waiting time, in seconds
     */
    minWaitingTime?: number;
    /**
     * Maximum walking time from origin, in seconds
     */
    maxAccessTravelTime?: number;
    /**
     * Maximum walking time to reach destination, in seconds
     */
    maxEgressTravelTime?: number;
    /**
     * Maximum transfer time, in seconds
     */
    maxTransferTravelTime?: number;
    /**
     * Maximum total travel time, in seconds
     */
    maxTravelTime?: number;
    /**
     * Maximum wait time at first transit stop
     */
    maxFirstWaitingTime?: number;
}

export interface TrRoutingWalkingStep {
    action: 'walking';
    arrivalTime: string;
    arrivalTimeSeconds: number;
    departureTime: string;
    departureTimeSeconds: number;
    distanceMeters: number;
    readyToBoardAt?: string;
    readyToBoardAtSeconds?: number;
    travelTimeMinutes: number;
    travelTimeSeconds: number;
    nearestNetworkNodeDistanceMeters?: number;
    type: 'access' | 'egress' | 'transfer';
}

export interface TrRoutingBoardingStep {
    action: 'board';
    agencyAcronym: string;
    agencyName: string;
    agencyUuid: string;
    departureTime: string;
    departureTimeSeconds: number;
    legSequenceInTrip: number;
    lineLongname: string;
    lineShortname: string;
    lineUuid: string;
    mode: string;
    modeName: string;
    nodeCode: string;
    nodeCoordinates: [number, number];
    nodeName: string;
    nodeUuid: string;
    pathUuid: string;
    stopSequenceInTrip: number;
    tripUuid: string;
    waitingTimeMinutes: number;
    waitingTimeSeconds: number;
}

export interface TrRoutingUnboardingStep {
    action: 'unboard';
    agencyAcronym: string;
    agencyName: string;
    agencyUuid: string;
    arrivalTime: string;
    arrivalTimeSeconds: number;
    inVehicleDistanceMeters: number;
    inVehicleTimeMinutes: number;
    inVehicleTimeSeconds: number;
    legSequenceInTrip: number;
    lineLongname: string;
    lineShortname: string;
    lineUuid: string;
    mode: string;
    modeName: string;
    nodeCode: string;
    nodeCoordinates: [number, number];
    nodeName: string;
    nodeUuid: string;
    pathUuid: string;
    stopSequenceInTrip: number;
    tripUuid: string;
}

export type TrRoutingStep = TrRoutingWalkingStep | TrRoutingBoardingStep | TrRoutingUnboardingStep;

export interface TrRoutingPath {
    accessDistanceMeters: number;
    accessTravelTimeMinutes: number;
    accessTravelTimeSeconds: number;
    arrivalTime: string;
    arrivalTimeSeconds: number;
    departureTime: string;
    departureTimeSeconds: number;
    destination: [number, number];
    egressDistanceMeters: number;
    egressTravelTimeMinutes: number;
    egressTravelTimeSeconds: number;
    firstWaitingTimeMinutes: number;
    firstWaitingTimeSeconds: number;
    initialDepartureTime: string;
    initialDepartureTimeSeconds: number;
    initialLostTimeAtDepartureMinutes: number;
    initialLostTimeAtDepartureSeconds: number;
    numberOfBoardings: number;
    numberOfTransfers: number;
    optimizeCases: string;
    origin: [number, number];
    status: 'success';
    steps: TrRoutingStep[];
    totalDistanceMeters: number;
    totalInVehicleDistanceMeters: number;
    totalInVehicleTimeMinutes: number;
    totalInVehicleTimeSeconds: number;
    totalNonTransitDistanceMeters: number;
    totalNonTransitTravelTimeMinutes: number;
    totalNonTransitTravelTimeSeconds: number;
    totalTravelTimeMinutes: number;
    totalTravelTimeSeconds: number;
    totalWaitingTimeMinutes: number;
    totalWaitingTimeSeconds: number;
    transferWaitingTimeMinutes: number;
    transferWaitingTimeSeconds: number;
    transferWalkingDistanceMeters: number;
    transferWalkingTimeMinutes: number;
    transferWalkingTimeSeconds: number;
    nearestNetworkNodeOriginDistanceMeters?: number;
    nearestNetworkNodeDestinationDistanceMeters?: number;
}

export interface TrRoutingApiNode {
    departureTime?: string;
    departureTimeSeconds?: number;
    arrivalTime?: string;
    arrivalTimeSeconds?: number;
    id: string;
    numberOfTransfers: number;
    totalTravelTimeSeconds: number;
}

export interface TrRoutingAccessibleMap {
    status: 'success';
    nodes: TrRoutingApiNode[];
    numberOfReachableNodes: number;
    optimizeCases: string;
    percentOfReachableNodes: number;
}

export interface TrRoutingAlternative extends TrRoutingPath {
    alternativeSequence: number;
    alternativeTotalSequence: number;
}

export interface TrRoutingWithAlternativeResult {
    status: 'success';
    alternatives: TrRoutingAlternative[];
}

export type TrRoutingNoRoutingReason =
    | 'NO_ROUTING_FOUND'
    | 'NO_ACCESS_AT_ORIGIN'
    | 'NO_ACCESS_AT_DESTINATION'
    | 'NO_ACCESS_AT_ORIGIN_AND_DESTINATION'
    | 'NO_SERVICE_FROM_ORIGIN'
    | 'NO_SERVICE_TO_DESTINATION';

export interface TrRoutingNoResult {
    status: 'no_routing_found';
    reason?: TrRoutingNoRoutingReason;
    origin: [number, number];
    destination: [number, number];
}

export interface TrRoutingError {
    status: 'error';
    error?: string | { code: string };
}

export interface TrRoutingErrorWithCode {
    status: 'data_error' | 'query_error';
    errorCode: string;
}

export const isErrorWithCode = (result: TrRoutingApiResult): result is TrRoutingErrorWithCode => {
    return result.status === 'data_error' || result.status === 'query_error';
};

export const isNoRouting = (result: TrRoutingApiResult): result is TrRoutingNoResult => {
    return result.status === 'no_routing_found';
};

export type TrRoutingApiResult =
    | TrRoutingWithAlternativeResult
    | TrRoutingPath
    | TrRoutingAccessibleMap
    | TrRoutingNoResult
    | TrRoutingError
    | TrRoutingErrorWithCode;
