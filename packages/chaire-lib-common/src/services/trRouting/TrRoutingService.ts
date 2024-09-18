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
import { ErrorCodes, TrRoutingResultAccessibilityMap, TrRoutingRouteResult } from './types';

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

    public async route(
        params: TrRoutingApi.TransitRouteQueryOptions,
        hostPort?: TrRoutingApi.HostPort
    ): Promise<TrRoutingRouteResult> {
        const origDestStr = `${params.originDestination[0].geometry.coordinates.join(',')} to ${params.originDestination[1].geometry.coordinates.join(',')}`;
        console.log(`tripRouting: Getting route from trRouting service for ${origDestStr}`);
        const responseStatus = await this.callTrRouting<
            { parameters: TrRoutingApi.TransitRouteQueryOptions; hostPort?: TrRoutingApi.HostPort },
            TrRoutingApi.TrRoutingV2.RouteResponse
        >(apiCalls.route, { parameters: params, hostPort });
        console.log(`tripRouting: Received route response from trRouting service for ${origDestStr}`);
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
