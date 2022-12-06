/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash.get';
//TODO replace this fetch-retry library with one compatible with TS
const fetch = require('@zeit/fetch-retry')(require('node-fetch'));

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import * as TrRoutingApi from 'chaire-lib-common/lib/api/TrRouting';
import TrRoutingProcessManager from '../processManagers/TrRoutingProcessManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

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
    hasAvailablePortsStatus(startingPort: number = Preferences.get('trRouting.batchPortStart', 14000)): boolean {
        const availablePorts = this.getAvailablePorts(startingPort);
        return Object.keys(availablePorts).find((port) => availablePorts[port] === true) !== undefined;
    }

    getAvailablePorts(startingPort: number = Preferences.get('trRouting.batchPortStart', 14000)): {
        [port: number]: boolean;
    } {
        return TrRoutingProcessManager.getAvailablePortsByStartingPort(startingPort);
    }

    getAvailablePort(startingPort: number = Preferences.get('trRouting.batchPortStart', 14000)) {
        return TrRoutingProcessManager.getAvailablePort(startingPort);
    }

    request(
        query: string,
        host: string | undefined,
        port: string | undefined,
        customRequestPath: string
    ): Promise<
        | TrRoutingApi.TrRoutingWithAlternativeResult
        | TrRoutingApi.TrRoutingPath
        | TrRoutingApi.TrRoutingNoResult
        | TrRoutingApi.TrRoutingErrorWithCode
        | TrRoutingApi.TrRoutingError
        | TrRoutingApi.TrRoutingAccessibleMap
    > {
        const trRoutingRequest = `${this.getUrlPrefix(host, port, customRequestPath)}?${query}`;

        //console.log('trRoutingRequest', trRoutingRequest);

        return new Promise((resolve, reject) => {
            fetch(trRoutingRequest, {
                retry: { retries: 2, retryDelay: 1000 },
                method: 'GET'
            })
                .then((response) => {
                    return response.json();
                })
                .then((routingResultJson) => {
                    resolve(routingResultJson);
                })
                .catch((error) => {
                    console.error(error);
                    reject(error);
                });
        });
    }

    // TODO Receive an object instead, that can be converted to a call to v1 or v2
    route(
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
        return this.request(query, host, port, 'route/v1/transit');
    }

    routeTo(
        origin: GeoJSON.Feature<GeoJSON.Point>,
        destination: GeoJSON.Feature<GeoJSON.Point>,
        departureTimeSeconds: number,
        scenarioId: string,
        parameters = Preferences.get('transit.routing.transit'),
        host?: string,
        port?: string
    ) {
        // origin and destination must be geojson features

        const trRoutingQueryArray = [
            `origin=${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]}`,
            `destination=${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]}`,
            `min_waiting_time_seconds=${_get(parameters, 'minWaitingTimeSeconds', 180)}`,
            `max_access_travel_time_seconds=${_get(
                parameters,
                'maxAccessTravelTimeSeconds',
                _get(parameters, 'maxAccessEgressTravelTimeSeconds', 900)
            )}`,
            `max_egress_travel_time_seconds=${_get(
                parameters,
                'maxEgressTravelTimeSeconds',
                _get(parameters, 'maxAccessEgressTravelTimeSeconds', 900)
            )}`,
            `max_transfer_travel_time_seconds=${_get(parameters, 'maxTransferTravelTimeSeconds', 900)}`,
            `max_travel_time_seconds=${_get(parameters, 'maxTotalTravelTimeSeconds', 10800)}`,
            `departure_time_seconds=${departureTimeSeconds || _get(parameters, 'departureTimeSeconds', 28800)}`,
            `scenario_uuid=${scenarioId || _get(parameters, 'scenarioId', null)}`,
            `alternatives=${_get(parameters, 'alternatives', false) === true ? '1' : '0'}`,
            `max_alternatives=${_get(parameters, 'maxAlternatives', 200)}`
        ];

        if (parameters.maxFirstWaitingTimeSeconds) {
            trRoutingQueryArray.push(`max_first_waiting_time_seconds=${parameters.maxFirstWaitingTimeSeconds}`);
        }

        if (parameters.od_trip_uuid || parameters.odTripId) {
            trRoutingQueryArray.push(`od_trip_uuid=${parameters.od_trip_uuid || parameters.odTripId}`);
        }

        if (!_isBlank(parameters.port) && _isBlank(port)) {
            port = parameters.port;
        }

        if (!_isBlank(parameters.host) && _isBlank(host)) {
            host = parameters.host;
        }

        const trRoutingQuery = trRoutingQueryArray.join('&');

        return this.request(trRoutingQuery, host, port, 'route/v1/transit');
    }

    routeFrom(
        origin: GeoJSON.Feature<GeoJSON.Point>,
        destination: GeoJSON.Feature<GeoJSON.Point>,
        arrivalTimeSeconds: number,
        scenarioId: string,
        parameters = Preferences.get('transit.routing.transit'),
        host?: string,
        port?: string
    ) {
        // origin and destination must be geojson features

        const trRoutingQueryArray = [
            `origin=${origin.geometry.coordinates[1]},${origin.geometry.coordinates[0]}`,
            `destination=${destination.geometry.coordinates[1]},${destination.geometry.coordinates[0]}`,
            `min_waiting_time_seconds=${_get(parameters, 'minWaitingTimeSeconds', 180)}`,
            `max_access_travel_time_seconds=${_get(parameters, 'maxAccessEgressTravelTimeSeconds', 900)}`,
            `max_egress_travel_time_seconds=${_get(parameters, 'maxAccessEgressTravelTimeSeconds', 900)}`,
            `max_transfer_travel_time_seconds=${_get(parameters, 'maxTransferTravelTimeSeconds', 900)}`,
            `max_travel_time_seconds=${_get(parameters, 'maxTotalTravelTimeSeconds', 10800)}`,
            `arrival_time_seconds=${arrivalTimeSeconds || _get(parameters, 'arrivalTimeSeconds', 28800)}`,
            `scenario_uuid=${scenarioId || _get(parameters, 'scenarioId', null)}`,
            `alternatives=${_get(parameters, 'alternatives', false) === true ? '1' : '0'}`,
            `max_alternatives=${_get(parameters, 'maxAlternatives', 200)}`
        ];

        if (parameters.maxFirstWaitingTimeSeconds) {
            trRoutingQueryArray.push(`max_first_waiting_time_seconds=${parameters.maxFirstWaitingTimeSeconds}`);
        }

        if (parameters.od_trip_uuid || parameters.odTripId) {
            trRoutingQueryArray.push(`od_trip_uuid=${parameters.od_trip_uuid || parameters.odTripId}`);
        }

        if (!_isBlank(parameters.port) && _isBlank(port)) {
            port = parameters.port;
        }

        if (!_isBlank(parameters.host) && _isBlank(host)) {
            host = parameters.host;
        }

        const trRoutingQuery = trRoutingQueryArray.join('&');

        return this.request(trRoutingQuery, host, port, 'route/v1/transit');
    }

    summary(parameters: TrRoutingApi.TransitRouteQueryOptions) {
        // origin and destination must be geojson features

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

        const trRoutingQuery = trRoutingQueryArray.join('&');

        return this.request(trRoutingQuery, undefined, undefined, 'v2/summary');
    }

    updateCache(parameters: { cacheNames: string[]; customPath?: string }, host?: string, port?: string) {
        const cacheNames = parameters.cacheNames || ['all'];
        const customPath = parameters.customPath || null;

        const trRoutingQuery = `cache_names=${cacheNames.join(',')}${
            customPath ? `&custom_cache_path=${customPath}` : ''
        }`;

        return this.request(trRoutingQuery, host, port, 'updateCache');
    }

    private getUrlPrefix(host: string | undefined, port: string | undefined, customRequestPath: string): string {
        const trRoutingConfig = Preferences.get('trRouting');
        if (host === undefined) {
            host = process.env.TR_ROUTING_HOST_URL || trRoutingConfig.host || 'http://localhost';
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
