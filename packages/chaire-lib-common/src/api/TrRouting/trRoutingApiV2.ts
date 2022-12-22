/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * This file contains the types for the trRouting v2 API. The API itself is
 * documented at https://chairemobilite.github.io/trRouting/APIv2/index.html
 */

export type RouteQueryResponse = {
    origin: [number, number];
    destination: [number, number];
    timeOfTrip: number;
    timeType: 0 | 1;
};

export type RouteSuccessResponseCommon = {
    status: 'success';
    query: RouteQueryResponse;
};

export type SummarySuccessResult = RouteSuccessResponseCommon & {
    result: {
        nbRoutes: number;
        lines: {
            lineUuid: string;
            lineShortname: string;
            lineLongname: string;
            agencyUuid: string;
            agencyAcronym: string;
            agencyName: string;
            alternativeCount: number;
        }[];
    };
};

export type RouteQueryError = {
    status: 'query_error';
    errorCode:
        | 'EMPTY_SCENARIO'
        | 'MISSING_PARAM_SCENARIO'
        | 'MISSING_PARAM_ORIGIN'
        | 'MISSING_PARAM_DESTINATION'
        | 'MISSING_PARAM_TIME_OF_TRIP'
        | 'INVALID_ORIGIN'
        | 'INVALID_DESTINATION'
        | 'INVALID_NUMERICAL_DATA'
        | 'PARAM_ERROR_UNKNOWN';
};

export type DataError = {
    status: 'data_error';
    errorCode:
        | 'DATA_ERROR'
        | 'MISSING_DATA_AGENCIES'
        | 'MISSING_DATA_SERVICES'
        | 'MISSING_DATA_NODES'
        | 'MISSING_DATA_LINES'
        | 'MISSING_DATA_PATHS'
        | 'MISSING_DATA_SCENARIOS'
        | 'MISSING_DATA_SCHEDULES';
};

export type SummaryResponse = SummarySuccessResult | DataError | RouteQueryError;

export type NoRoutingRouteReason =
    | 'NO_ROUTING_FOUND'
    | 'NO_ACCESS_AT_ORIGIN'
    | 'NO_ACCESS_AT_DESTINATION'
    | 'NO_ACCESS_AT_ORIGIN_AND_DESTINATION'
    | 'NO_SERVICE_FROM_ORIGIN'
    | 'NO_SERVICE_TO_DESTINATION';

export type NoRoutingRouteResult = {
    status: 'no_routing_found';
    query: RouteQueryResponse;
    reason?: NoRoutingRouteReason;
};

export type RouteSuccessResult = RouteSuccessResponseCommon & {
    result: {
        routes: SingleRouteResult[];
        totalRoutesCalculated: number;
    };
};

export type SingleRouteResult = {
    departureTime: number;
    arrivalTime: number;
    totalTravelTime: number;
    totalDistance: number;
    totalInVehicleTime: number;
    totalInVehicleDistance: number;
    totalNonTransitTravelTime: number;
    totalNonTransitDistance: number;
    numberOfBoardings: number;
    numberOfTransfers: number;
    transferWalkingTime: number;
    transferWalkingDistance: number;
    accessTravelTime: number;
    accessDistance: number;
    egressTravelTime: number;
    egressDistance: number;
    transferWaitingTime: number;
    firstWaitingTime: number;
    totalWaitingTime: number;
    steps: TripStep[];
};

export type TripStepWalking =
    | {
          action: 'walking';
          travelTime: number;
          distance: number;
          departureTime: number;
          arrivalTime: number;
      } & ({ type: 'egress' } | { type: 'access' | 'transfer'; readyToBoardAt: number });

export type TripStepEnterOrExit = {
    agencyAcronym: string;
    agencyName: string;
    agencyUuid: string;
    lineShortname: string;
    lineLongname: string;
    lineUuid: string;
    pathUuid: string;
    modeName: string;
    mode: string;
    tripUuid: string;
    legSequenceInTrip: number;
    stopSequenceInTrip: number;
    nodeName: string;
    nodeCode: string;
    nodeUuid: string;
    nodeCoordinates: [number, number];
};

export type TripStepBoarding = {
    action: 'boarding';
    departureTime: number;
    waitingTime: number;
} & TripStepEnterOrExit;

export type TripStepUnboarding = {
    action: 'unboarding';
    arrivalTime: number;
    inVehicleTime: number;
    inVehicleDistance: number;
} & TripStepEnterOrExit;

export type TripStep = TripStepWalking | TripStepBoarding | TripStepUnboarding;

export type RouteResponse = RouteSuccessResult | NoRoutingRouteResult | DataError | RouteQueryError;

export const isErrorWithCode = (result: RouteResponse | SummaryResponse): result is RouteQueryError | DataError => {
    return result.status === 'data_error' || result.status === 'query_error';
};

export const isNoRouting = (result: RouteResponse): result is NoRoutingRouteResult => {
    return result.status === 'no_routing_found';
};
