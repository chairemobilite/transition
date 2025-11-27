/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import ServerConfig from '../../config/ServerConfig';
import * as TrRoutingApi from 'chaire-lib-common/lib/api/TrRouting';

/**
 * A class that wraps the calls to the trRouting service API
 *
 * TODO: Make an instance of this class per host/port, with url prefix defined
 * at construction. Port management should be done by the
 * TrRoutingProcessManager
 *
 * @class TrRoutingServiceBackend
 */
class TrRoutingServiceBackend {
    private async request<T>(
        query: string,
        host: string | undefined,
        port: string | number | undefined,
        customRequestPath: string
    ): Promise<T> {
        const trRoutingRequest = `${this.getUrlPrefix(host, port, customRequestPath)}?${query}`;

        const maxAttempts = 2;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await fetch(trRoutingRequest, { method: 'GET' });
                // 200 and 400 are both valid response from TrRouting and are handled by the parsers
                if (![200, 400].includes(response.status)) {
                    throw new Error(`TrRouting request failed with status ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error(`TrRouting Fetch error (try ${i}): ${error}`);
                // Wait 1s until next attempt
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
        console.error('TrRouting Request exhausted all retries');
        throw new Error('TrRouting request failed, exhausted all retries');
    }

    // FIXME This call is still necessary for od trips and all_nodes, until all calls have been updated to API v2
    v1TransitCall(
        query: string,
        host: string,
        port: string
    ): Promise<
        | TrRoutingApi.TrRoutingWithAlternativeResult
        | TrRoutingApi.TrRoutingPath
        | TrRoutingApi.TrRoutingNoResult
        | TrRoutingApi.TrRoutingErrorWithCode
        | TrRoutingApi.TrRoutingError
        | TrRoutingApi.TrRoutingAccessibleMap
    > {
        return this.request<
            | TrRoutingApi.TrRoutingWithAlternativeResult
            | TrRoutingApi.TrRoutingPath
            | TrRoutingApi.TrRoutingNoResult
            | TrRoutingApi.TrRoutingErrorWithCode
            | TrRoutingApi.TrRoutingError
            | TrRoutingApi.TrRoutingAccessibleMap
        >(query, host, port, 'route/v1/transit');
    }

    private routeOptionsToQueryString = (parameters: TrRoutingApi.TransitRouteQueryOptions): string => {
        const trRoutingQueryArray = [
            `origin=${parameters.originDestination[0].geometry.coordinates[0]},${parameters.originDestination[0].geometry.coordinates[1]}`,
            `destination=${parameters.originDestination[1].geometry.coordinates[0]},${parameters.originDestination[1].geometry.coordinates[1]}`,
            `scenario_id=${parameters.scenarioId}`,
            `time_of_trip=${parameters.timeOfTrip}`,
            `time_type=${parameters.timeOfTripType === 'departure' ? 0 : 1}`,
            `alternatives=${parameters.alternatives !== true ? 'false' : 'true'}`
        ];

        if (parameters.minWaitingTime) {
            trRoutingQueryArray.push(`min_waiting_time=${parameters.minWaitingTime}`);
        }
        if (parameters.maxAccessTravelTime) {
            trRoutingQueryArray.push(`max_access_travel_time=${parameters.maxAccessTravelTime}`);
        }
        if (parameters.maxEgressTravelTime) {
            trRoutingQueryArray.push(`max_egress_travel_time=${parameters.maxEgressTravelTime}`);
        }
        if (parameters.maxTransferTravelTime) {
            trRoutingQueryArray.push(`max_transfer_travel_time=${parameters.maxTransferTravelTime}`);
        }
        if (parameters.maxTravelTime) {
            trRoutingQueryArray.push(`max_travel_time=${parameters.maxTravelTime}`);
        }
        if (parameters.maxFirstWaitingTime) {
            trRoutingQueryArray.push(`max_first_waiting_time=${parameters.maxFirstWaitingTime}`);
        }

        return trRoutingQueryArray.join('&');
    };

    private accessMapOptionsToQueryString = (parameters: TrRoutingApi.AccessibilityMapQueryOptions): string => {
        const trRoutingQueryArray = [
            `place=${parameters.location.geometry.coordinates[0]},${parameters.location.geometry.coordinates[1]}`,
            `scenario_id=${parameters.scenarioId}`,
            `time_of_trip=${parameters.timeOfTrip}`,
            `time_type=${parameters.timeOfTripType === 'departure' ? 0 : 1}`
        ];

        if (parameters.minWaitingTime) {
            trRoutingQueryArray.push(`min_waiting_time=${parameters.minWaitingTime}`);
        }
        if (parameters.maxAccessTravelTime) {
            trRoutingQueryArray.push(`max_access_travel_time=${parameters.maxAccessTravelTime}`);
        }
        if (parameters.maxEgressTravelTime) {
            trRoutingQueryArray.push(`max_egress_travel_time=${parameters.maxEgressTravelTime}`);
        }
        if (parameters.maxTransferTravelTime) {
            trRoutingQueryArray.push(`max_transfer_travel_time=${parameters.maxTransferTravelTime}`);
        }
        if (parameters.maxTravelTime) {
            trRoutingQueryArray.push(`max_travel_time=${parameters.maxTravelTime}`);
        }
        if (parameters.maxFirstWaitingTime) {
            trRoutingQueryArray.push(`max_first_waiting_time=${parameters.maxFirstWaitingTime}`);
        }

        return trRoutingQueryArray.join('&');
    };

    route(
        parameters: TrRoutingApi.TransitRouteQueryOptions,
        hostPort: TrRoutingApi.HostPort = {}
    ): Promise<TrRoutingApi.TrRoutingV2.RouteResponse> {
        const trRoutingQuery = this.routeOptionsToQueryString(parameters);

        return this.request<TrRoutingApi.TrRoutingV2.RouteResponse>(
            trRoutingQuery,
            hostPort.host,
            hostPort.port,
            'v2/route'
        );
    }

    summary(parameters: TrRoutingApi.TransitRouteQueryOptions): Promise<TrRoutingApi.TrRoutingV2.SummaryResponse> {
        const trRoutingQuery = this.routeOptionsToQueryString(parameters);

        return this.request<TrRoutingApi.TrRoutingV2.SummaryResponse>(
            trRoutingQuery,
            undefined,
            undefined,
            'v2/summary'
        );
    }

    accessibilityMap(
        parameters: TrRoutingApi.AccessibilityMapQueryOptions,
        hostPort: TrRoutingApi.HostPort = {}
    ): Promise<TrRoutingApi.TrRoutingV2.AccessibilityMapResponse> {
        const trRoutingQuery = this.accessMapOptionsToQueryString(parameters);

        return this.request<TrRoutingApi.TrRoutingV2.AccessibilityMapResponse>(
            trRoutingQuery,
            hostPort.host,
            hostPort.port,
            'v2/accessibility'
        );
    }

    updateCache(parameters: { cacheNames: string[]; customPath?: string }, host?: string, port?: string) {
        const cacheNames = parameters.cacheNames || ['all'];
        const customPath = parameters.customPath || null;

        const trRoutingQuery = `cache_names=${cacheNames.join(',')}${
            customPath ? `&custom_cache_path=${customPath}` : ''
        }`;

        return this.request(trRoutingQuery, host, port, 'updateCache');
    }

    private getUrlPrefix(
        host: string | undefined,
        port: string | number | undefined,
        customRequestPath: string
    ): string {
        // FIXME We should not get the port from here, as we assume here it is for the single instance and not the batch.
        const trRoutingConfig = ServerConfig.getTrRoutingConfig('single');
        if (host === undefined) {
            // There used to be a host in the config, but we do not support it, it either comes from the environment or is localhost
            host = process.env.TR_ROUTING_HOST_URL || 'http://localhost';
        }
        if (port === undefined) {
            port = process.env.TR_ROUTING_HOST_PORT || trRoutingConfig.port;
        }
        return `${host}${port ? ':' + port : ''}/${customRequestPath}`;
    }
}

// singleton:
const instance = new TrRoutingServiceBackend();
Object.freeze(instance);

export default instance;
