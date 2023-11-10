/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { point as turfPoint } from '@turf/turf';

import serviceLocator from '../../utils/ServiceLocator';
import TrError from '../../utils/TrError';
import * as TrRoutingApi from '../../api/TrRouting';
import * as Status from '../../utils/Status';

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

const errorCodeByReason = (
    reason: TrRoutingApi.TrRoutingNoRoutingReason | TrRoutingApi.TrRoutingV2.NoRoutingAccessibilityReason
): ErrorCodes => {
    switch (reason) {
    case 'NO_ACCESS_AT_ORIGIN':
        return ErrorCodes.NoAccessAtOrigin;
    case 'NO_ACCESS_AT_DESTINATION':
        return ErrorCodes.NoAccessAtDestination;
    case 'NO_SERVICE_FROM_ORIGIN':
        return ErrorCodes.NoServiceAtOrigin;
    case 'NO_SERVICE_TO_DESTINATION':
        return ErrorCodes.NoServiceAtDestination;
    case 'NO_ACCESS_AT_ORIGIN_AND_DESTINATION':
        return ErrorCodes.NoAccessAtOriginAndDestination;
    case 'NO_ACCESS_AT_PLACE':
        return ErrorCodes.NoAccessAtPlace;
    case 'NO_SERVICE_AT_PLACE':
        return ErrorCodes.NoServiceAtPlace;
    default:
        return ErrorCodes.NoRoutingFound;
    }
};

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

// TODO This is exported because the batch routing needs to call this for result. It shouldn't be, the API should be modified so the caller uses the main TrRoutingService method instead.
const apiResultToResult = (apiResult: TrRoutingApi.TrRoutingApiResult): TrRoutingResult => {
    if ('alternatives' in apiResult) {
        const resultWithAlternatives = apiResult as TrRoutingApi.TrRoutingWithAlternativeResult;
        return {
            type: 'withAlternatives',
            alternatives: resultWithAlternatives.alternatives
        };
    }
    const resultPath = apiResult as TrRoutingApi.TrRoutingPath;
    return {
        type: 'path',
        path: resultPath
    };
};

const apiResultToAccessibleMap = (apiResult: TrRoutingApi.TrRoutingApiResult): TrRoutingResultAccessibilityMap => {
    if ('nodes' in apiResult) {
        const nodeResults = apiResult as TrRoutingApi.TrRoutingAccessibleMap;
        return {
            type: 'nodes',
            nodes: nodeResults.nodes
        };
    }
    return {
        type: 'nodes',
        nodes: []
    };
};

const apiV2ToRouteResult = (apiResult: TrRoutingApi.TrRoutingV2.RouteSuccessResult): TrRoutingRouteResult => {
    // For each route to be self contained, concatenate the query with each result
    const allRoutes = apiResult.result.routes.map((route) => ({
        ...route,
        originDestination: [turfPoint(apiResult.query.origin), turfPoint(apiResult.query.destination)] as [
            GeoJSON.Feature<GeoJSON.Point>,
            GeoJSON.Feature<GeoJSON.Point>
        ],
        timeOfTrip: apiResult.query.timeOfTrip,
        timeOfTripType: apiResult.query.timeType === 0 ? ('departure' as const) : ('arrival' as const)
    }));
    return {
        routes: allRoutes,
        totalRoutesCalculated: apiResult.result.totalRoutesCalculated
    };
};

const apiV2ToAccessMapResult = (
    apiResult: TrRoutingApi.TrRoutingV2.AccessibilityMapSuccessResult
): TrRoutingResultAccessibilityMap => {
    // For each route to be self contained, concatenate the query with each result
    const allNodes = apiResult.result.nodes.map((node) => ({
        departureTime: undefined,
        departureTimeSeconds: apiResult.query.timeType === 1 ? node.nodeTime : undefined,
        arrivalTime: undefined,
        arrivalTimeSeconds: apiResult.query.timeType === 0 ? node.nodeTime : undefined,
        id: node.nodeUuid,
        numberOfTransfers: node.numberOfTransfers,
        totalTravelTimeSeconds: node.totalTravelTime
    }));
    return {
        type: 'nodes',
        nodes: allNodes
    };
};

type ApiCall = { socketRoute?: string; url: string };
const apiCalls = {
    route: {
        socketRoute: TrRoutingApi.TrRoutingConstants.ROUTE,
        url: TrRoutingApi.TrRoutingConstants.FETCH_ROUTE_URL
    },
    summary: { url: TrRoutingApi.TrRoutingConstants.FETCH_SUMMARY_URL },
    accessibilityMap: {
        socketRoute: TrRoutingApi.TrRoutingConstants.ACCESSIBILITY_MAP,
        url: TrRoutingApi.TrRoutingConstants.FETCH_ACCESSIBILITY_MAP_URL
    },
    legacyCall: {
        socketRoute: TrRoutingApi.TrRoutingConstants.ROUTE_V1,
        url: TrRoutingApi.TrRoutingConstants.FETCH_ROUTE_V1_URL
    }
};

export class TrRoutingService {
    private async callTrRoutingWithSocket<T, U>(socketRoute: string, params: T): Promise<Status.Status<U>> {
        return new Promise((resolve, _reject) => {
            serviceLocator.socketEventManager.emit(socketRoute, params, (routingResult: any) => {
                resolve(routingResult);
            });
        });
    }

    private async callTrRoutingWithFetch<T, U>(url: string, params: T): Promise<Status.Status<U>> {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(params),
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.status !== 200) {
            throw new TrError('Error querying trRouting from server', ErrorCodes.OtherError);
        }
        return await response.json();
    }

    private async callTrRouting<T, U>(apiCall: ApiCall, params: T): Promise<Status.Status<U>> {
        if (serviceLocator.socketEventManager && apiCall.socketRoute !== undefined) {
            return this.callTrRoutingWithSocket(apiCall.socketRoute, params);
        } else {
            return this.callTrRoutingWithFetch(apiCall.url, params);
        }
    }

    // TODO Parameters should be converted to a query in the backend, not here
    private paramsToQuery(params: RoutingQueryOptions): string {
        const trRoutingQueryArray: string[] = [
            `min_waiting_time_seconds=${params.minWaitingTime}`,
            `max_access_travel_time_seconds=${params.maxAccessTravelTime}`,
            `max_egress_travel_time_seconds=${params.maxEgressTravelTime}`,
            `max_transfer_travel_time_seconds=${params.maxTransferTravelTime}`,
            `max_travel_time_seconds=${params.maxTravelTime}`,
            `scenario_uuid=${params.scenarioId}`
        ];
        if (params.originDestination) {
            trRoutingQueryArray.push(
                `origin=${params.originDestination[0].geometry.coordinates[1]},${params.originDestination[0].geometry.coordinates[0]}`
            );

            trRoutingQueryArray.push(
                `destination=${params.originDestination[1].geometry.coordinates[1]},${params.originDestination[1].geometry.coordinates[0]}`
            );
        } else if (params.odTripUuid) {
            trRoutingQueryArray.push(`od_trip_uuid=${params.odTripUuid}`);
        }
        if (params.alternatives !== undefined) {
            trRoutingQueryArray.push(`alternatives=${params.alternatives ? '1' : '0'}`);
        }
        trRoutingQueryArray.push(
            params.timeOfTripType === 'departure'
                ? `departure_time_seconds=${params.timeOfTrip}`
                : `arrival_time_seconds=${params.timeOfTrip}`
        );
        if (params.maxFirstWaitingTime) {
            trRoutingQueryArray.push(`max_first_waiting_time_seconds=${params.maxFirstWaitingTime}`);
        }
        return trRoutingQueryArray.join('&');
    }

    // FIXME tahini: Type the options
    private async internalRouteV1(
        queryString: string,
        options: { [key: string]: unknown } = {}
    ): Promise<TrRoutingApi.TrRoutingApiResult> {
        const responseStatus = await this.callTrRouting<
            { query: string; [key: string]: any },
            TrRoutingApi.TrRoutingApiResult
        >(apiCalls.legacyCall, {
            query: queryString,
            ...options
        });
        if (Status.isStatusError(responseStatus)) {
            this.handleErrorStatus(responseStatus);
        }
        const routingResult = Status.unwrap(responseStatus);
        if (TrRoutingApi.isNoRouting(routingResult)) {
            const reason = routingResult.reason;
            throw new TrError(
                'cannot calculate transit route with trRouting: no_routing_found',
                reason !== undefined ? errorCodeByReason(reason) : ErrorCodes.NoRoutingFound,
                `transit:transitRouting:errors:${reason !== undefined ? reason : 'NoResultFound'}`
            );
        } else if (routingResult.status === 'data_error') {
            throw new TrError(
                `cannot calculate transit route with trRouting: ${
                    (routingResult as TrRoutingApi.TrRoutingErrorWithCode).status
                }`,
                ErrorCodes.DataError,
                'transit:transitRouting:errors:DataError'
            );
        } else if (routingResult.status === 'error' && routingResult.error && (routingResult.error as any).code) {
            // Any error status from the application in the v1 route
            const errorCode = (routingResult.error as any).code;
            if (errorCode.startsWith('MISSING_DATA_')) {
                throw new TrError(
                    `cannot calculate transit route with trRouting: ${errorCode}`,
                    ErrorCodes.MissingData,
                    `transit:transitRouting:errors:${errorCode}`
                );
            }
            throw new TrError(`cannot handle call to trRouting: ${errorCode}`, ErrorCodes.OtherError, {
                text: 'transit:transitRouting:errors:TrRoutingServerError',
                params: { error: String(errorCode || '-') }
            });
        } else if (routingResult.status !== 'success' && routingResult.status !== undefined) {
            // FIXME: the accessible map query response does not return a status, so if undefined, then it's ok. but it needs to be fixed in trRouting
            const routingError = routingResult as TrRoutingApi.TrRoutingError;
            // FIXME: There is a status, but it is not one that is known. Display it for now.
            console.log(`Unknown error status returned from trRouting: ${JSON.stringify(routingResult)}`);
            throw new TrError(
                `cannot calculate transit route with trRouting: ${routingError.status}`,
                ErrorCodes.OtherError,
                {
                    text: 'transit:transitRouting:errors:TrRoutingServerError',
                    params: { error: routingError.error ? routingError.error.toString() : '-' }
                }
            );
        }

        return routingResult;
    }

    // Throw the appropriate error if the status is erroneous
    private handleErrorStatus = (status: Status.StatusError) => {
        // Handle application errors
        const error = status.error;
        const errorCode = (error as any).code;
        if (errorCode === 'ECONNREFUSED') {
            throw new TrError(
                `cannot handle call to trRouting: ${error}`,
                ErrorCodes.ServerNotRunning,
                'transit:transitRouting:errors:TrRoutingServerNotRunning'
            );
        }
        throw new TrError(`cannot handle call to trRouting: ${errorCode || error}`, ErrorCodes.OtherError, {
            text: 'transit:transitRouting:errors:TrRoutingServerError',
            params: { error: String(error || '-') }
        });
    };

    private async internalSummary(
        params: TrRoutingApi.TransitRouteQueryOptions
    ): Promise<TrRoutingApi.TrRoutingV2.SummaryResponse> {
        const responseStatus = await this.callTrRouting<
            TrRoutingApi.TransitRouteQueryOptions,
            TrRoutingApi.TrRoutingV2.SummaryResponse
        >(apiCalls.summary, params);
        if (Status.isStatusError(responseStatus)) {
            this.handleErrorStatus(responseStatus);
        }
        const routingResult = Status.unwrap(responseStatus);
        if (routingResult.status === 'data_error') {
            throw new TrError(
                `cannot calculate transit route with trRouting: ${
                    (routingResult as TrRoutingApi.TrRoutingErrorWithCode).status
                }`,
                ErrorCodes.DataError,
                'transit:transitRouting:errors:DataError'
            );
        } else if (routingResult.status === 'query_error') {
            const errorCode = routingResult.errorCode;
            if (errorCode.startsWith('MISSING_DATA_')) {
                throw new TrError(
                    `cannot calculate transit route with trRouting: ${errorCode}`,
                    ErrorCodes.MissingData,
                    `transit:transitRouting:errors:${errorCode}`
                );
            }
        }

        return routingResult;
    }

    private handleRouteResponse(routingResult: TrRoutingApi.TrRoutingV2.RouteResponse): TrRoutingRouteResult {
        if (routingResult.status === 'success') {
            return apiV2ToRouteResult(routingResult);
        }
        if (TrRoutingApi.TrRoutingV2.isNoRouting(routingResult)) {
            // No routing, throw error with reason
            const reason = routingResult.reason;
            throw new TrError(
                'cannot calculate transit route with trRouting: no_routing_found',
                reason !== undefined ? errorCodeByReason(reason) : ErrorCodes.NoRoutingFound,
                `transit:transitRouting:errors:${reason !== undefined ? reason : 'NoResultFound'}`
            );
        } else if (routingResult.status === 'data_error') {
            const isMissingData = routingResult.errorCode.startsWith('MISSING_DATA_');
            // Data error on the server, data may be missing
            throw new TrError(
                `cannot calculate transit route with trRouting because of an error on server: ${routingResult.errorCode}`,
                isMissingData ? ErrorCodes.MissingData : ErrorCodes.DataError,
                `transit:transitRouting:errors:${isMissingData ? routingResult.errorCode : 'DataError'}`
            );
        } else if (routingResult.status === 'query_error') {
            throw new TrError(
                `cannot calculate transit route with trRouting because of a query error: ${routingResult.errorCode}`,
                ErrorCodes.QueryError,
                `transit:transitRouting:errors:${routingResult.errorCode}`
            );
        }
        console.log('Cannot calculate transit route with trRouting: unknown response status', routingResult);
        // throw unknown error
        throw new TrError('cannot calculate transit route with trRouting: unknown error', ErrorCodes.OtherError, {
            text: 'transit:transitRouting:errors:TrRoutingServerError',
            params: { error: '-' }
        });
    }

    private handleAccessMapResponse(
        routingResult: TrRoutingApi.TrRoutingV2.AccessibilityMapResponse
    ): TrRoutingResultAccessibilityMap {
        if (routingResult.status === 'success') {
            return apiV2ToAccessMapResult(routingResult);
        }
        if (TrRoutingApi.TrRoutingV2.isAccessMapNoRouting(routingResult)) {
            // No routing, throw error with reason
            const reason = routingResult.reason;
            throw new TrError(
                'cannot calculate accessible nodes with trRouting: no_routing_found',
                reason !== undefined ? errorCodeByReason(reason) : ErrorCodes.NoRoutingFound,
                `transit:transitRouting:errors:${reason !== undefined ? reason : 'NoResultFound'}`
            );
        } else if (routingResult.status === 'data_error') {
            const isMissingData = routingResult.errorCode.startsWith('MISSING_DATA_');
            // Data error on the server, data may be missing
            throw new TrError(
                `cannot calculate accessible nodes with trRouting because of an error on server: ${routingResult.errorCode}`,
                isMissingData ? ErrorCodes.MissingData : ErrorCodes.DataError,
                `transit:transitRouting:errors:${isMissingData ? routingResult.errorCode : 'DataError'}`
            );
        } else if (routingResult.status === 'query_error') {
            throw new TrError(
                `cannot calculate accessible nodes with trRouting because of a query error: ${routingResult.errorCode}`,
                ErrorCodes.QueryError,
                `transit:transitRouting:errors:${routingResult.errorCode}`
            );
        }
        console.log('Cannot calculate accessible nodes with trRouting: unknown response status', routingResult);
        // throw unknown error
        throw new TrError('cannot calculate accessible nodes with trRouting: unknown error', ErrorCodes.OtherError, {
            text: 'transit:transitRouting:errors:TrRoutingServerError',
            params: { error: '-' }
        });
    }

    // FIXME tahini: Type the options
    public async routeV1(
        params: RoutingQueryOptions,
        options: { [key: string]: unknown } = {}
    ): Promise<TrRoutingResult> {
        const routingResult = await this.internalRouteV1(this.paramsToQuery(params), options);
        return apiResultToResult(routingResult);
    }

    public async route(
        params: TrRoutingApi.TransitRouteQueryOptions,
        hostPort?: TrRoutingApi.HostPort
    ): Promise<TrRoutingRouteResult> {
        const responseStatus = await this.callTrRouting<
            { parameters: TrRoutingApi.TransitRouteQueryOptions; hostPort?: TrRoutingApi.HostPort },
            TrRoutingApi.TrRoutingV2.RouteResponse
        >(apiCalls.route, { parameters: params, hostPort });
        if (Status.isStatusError(responseStatus)) {
            this.handleErrorStatus(responseStatus);
        }
        const routingResult = Status.unwrap(responseStatus);
        return this.handleRouteResponse(routingResult);
    }

    public async accessibleMap(
        params: TrRoutingApi.AccessibilityMapQueryOptions,
        options: { hostPort?: TrRoutingApi.HostPort; [key: string]: unknown } = {}
    ): Promise<TrRoutingResultAccessibilityMap> {
        const responseStatus = await this.callTrRouting<
            { parameters: TrRoutingApi.AccessibilityMapQueryOptions; hostPort?: TrRoutingApi.HostPort },
            TrRoutingApi.TrRoutingV2.AccessibilityMapResponse
        >(apiCalls.accessibilityMap, { parameters: params, hostPort: options?.hostPort });
        if (Status.isStatusError(responseStatus)) {
            this.handleErrorStatus(responseStatus);
        }
        const accessMapResponse = Status.unwrap(responseStatus);
        return this.handleAccessMapResponse(accessMapResponse);
    }

    public async summary(
        params: TrRoutingApi.TransitRouteQueryOptions
    ): Promise<TrRoutingApi.TrRoutingV2.SummaryResponse> {
        return await this.internalSummary(params);
    }
}
