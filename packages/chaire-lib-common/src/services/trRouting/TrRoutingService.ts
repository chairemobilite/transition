/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
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
    OtherError = 'TRROUTING_ERROR_UNKNOWN',
    MissingData = 'TRROUTING_MISSING_DATA',
    DataError = 'TRROUTING_INVALID_DATA'
}

const errorCodeByReason = (reason: TrRoutingApi.TrRoutingNoRoutingReason): ErrorCodes => {
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
export type TrRoutingResultAccessibilityMap = { type: 'nodes'; nodes: TrRoutingApi.TrRoutingApiNode[] };

export type TrRoutingResult = TrRoutingResultPath | TrRoutingResultAlternatives;

// TODO This is exported because the batch routing needs to call this for result. It shouldn't be, the API should be modified so the caller uses the main TrRoutingService method instead.
export const apiResultToResult = (apiResult: TrRoutingApi.TrRoutingApiResult): TrRoutingResult => {
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

type ApiCall = { socketRoute?: string; url: string };
const apiCalls = {
    route: { socketRoute: TrRoutingApi.TrRoutingConstants.ROUTE, url: TrRoutingApi.TrRoutingConstants.FETCH_ROUTE_URL },
    summary: { url: TrRoutingApi.TrRoutingConstants.FETCH_SUMMARY_URL }
};

export class TrRoutingService {
    private async callTrRoutingWithSocket<T, U>(socketRoute: string, params: T): Promise<U> {
        return new Promise((resolve, _reject) => {
            serviceLocator.socketEventManager.emit(socketRoute, params, (routingResult: any) => {
                resolve(routingResult);
            });
        });
    }

    private async callTrRoutingWithFetch<T, U>(url: string, params: T): Promise<U> {
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
        const status: Status.Status<U> = await response.json();
        return Status.unwrap(status);
    }

    private async callTrRouting<T, U>(apiCall: ApiCall, params: T): Promise<U> {
        return new Promise((resolve, _reject) => {
            if (serviceLocator.socketEventManager && apiCall.socketRoute !== undefined) {
                this.callTrRoutingWithSocket(apiCall.socketRoute, params).then((response) => resolve(response as U));
            } else {
                this.callTrRoutingWithFetch(apiCall.url, params).then((response) => resolve(response as U));
            }
        });
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

    // TODO Parameters should be converted to a query in the backend, not here
    private accessMapParamsToQuery(params: AccessibilityMapQueryOptions): string {
        const trRoutingQueryArray: string[] = [
            `min_waiting_time_seconds=${params.minWaitingTime}`,
            `max_access_travel_time_seconds=${params.maxAccessTravelTime}`,
            `max_egress_travel_time_seconds=${params.maxEgressTravelTime}`,
            `max_transfer_travel_time_seconds=${params.maxTransferTravelTime}`,
            `max_travel_time_seconds=${params.maxTravelTime}`,
            `scenario_uuid=${params.scenarioId}`,
            'all_nodes=1'
        ];
        const accessibleNodes =
            params.accessibleNodes && params.accessibleNodes.ids.length === params.accessibleNodes.durations.length
                ? params.accessibleNodes
                : undefined;
        if (params.timeOfTripType === 'departure') {
            trRoutingQueryArray.push(
                `origin=${params.location.geometry.coordinates[1]},${params.location.geometry.coordinates[0]}`
            );
            trRoutingQueryArray.push(`departure_time_seconds=${params.timeOfTrip}`);
            if (accessibleNodes) {
                trRoutingQueryArray.push(`access_node_uuids=${accessibleNodes.ids.join(',')}`);
                trRoutingQueryArray.push(
                    `access_node_travel_times=${accessibleNodes.durations.map(Math.floor).join(',')}`
                );
            }
        } else {
            trRoutingQueryArray.push(
                `destination=${params.location.geometry.coordinates[1]},${params.location.geometry.coordinates[0]}`
            );
            trRoutingQueryArray.push(`arrival_time_seconds=${params.timeOfTrip}`);
            if (accessibleNodes) {
                trRoutingQueryArray.push(`egress_node_uuids=${accessibleNodes.ids.join(',')}`);
                trRoutingQueryArray.push(
                    `egress_node_travel_times=${accessibleNodes.durations.map(Math.floor).join(',')}`
                );
            }
        }
        if (params.maxFirstWaitingTime) {
            trRoutingQueryArray.push(`max_first_waiting_time_seconds=${params.maxFirstWaitingTime}`);
        }
        return trRoutingQueryArray.join('&');
    }

    // FIXME tahini: Type the options
    private async internalRoute(
        queryString: string,
        options: { [key: string]: unknown } = {}
    ): Promise<TrRoutingApi.TrRoutingApiResult> {
        const routingResult = await this.callTrRouting<
            { query: string; [key: string]: any },
            TrRoutingApi.TrRoutingApiResult
        >(apiCalls.route, {
            query: queryString,
            ...options
        });
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
            const error = (routingResult as TrRoutingApi.TrRoutingError).error;
            const errorCode = (routingResult.error as any).code;
            if (errorCode === 'ECONNREFUSED') {
                throw new TrError(
                    `cannot calculate transit route with trRouting: ${error}`,
                    ErrorCodes.ServerNotRunning,
                    'transit:transitRouting:errors:TrRoutingServerNotRunning'
                );
            } else if (errorCode.startsWith('MISSING_DATA_')) {
                throw new TrError(
                    `cannot calculate transit route with trRouting: ${errorCode}`,
                    ErrorCodes.MissingData,
                    `transit:transitRouting:errors:${errorCode}`
                );
            }
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

    private async internalSummary(
        params: TrRoutingApi.TransitRouteQueryOptions
    ): Promise<TrRoutingApi.TrRoutingV2.SummaryResponse> {
        const routingResult = await this.callTrRouting<
            TrRoutingApi.TransitRouteQueryOptions,
            TrRoutingApi.TrRoutingV2.SummaryResponse
        >(apiCalls.summary, params);
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

        return routingResult as TrRoutingApi.TrRoutingV2.SummaryResponse;
    }

    // FIXME tahini: Type the options
    public async route(
        params: RoutingQueryOptions,
        options: { [key: string]: unknown } = {}
    ): Promise<TrRoutingResult> {
        const routingResult = await this.internalRoute(this.paramsToQuery(params), options);
        return apiResultToResult(routingResult);
    }

    // TODO Document the API of trRouting and make sure this method should really be a separate one
    public async accessibleMap(
        params: AccessibilityMapQueryOptions,
        options: { [key: string]: unknown } = {}
    ): Promise<TrRoutingResultAccessibilityMap> {
        const routingResult = await this.internalRoute(this.accessMapParamsToQuery(params), options);
        return apiResultToAccessibleMap(routingResult);
    }

    public async summary(
        params: TrRoutingApi.TransitRouteQueryOptions
    ): Promise<TrRoutingApi.TrRoutingV2.SummaryResponse> {
        return await this.internalSummary(params);
    }
}
