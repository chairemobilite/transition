/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type GeoJSON from 'geojson';

import type * as Status from 'chaire-lib-common/lib/utils/Status';
import * as StatusUtils from 'chaire-lib-common/lib/utils/Status';
import type {
    ValhallaRouteOptions,
    ValhallaMatchOptions,
    ValhallaIsochroneOptions
} from 'chaire-lib-common/lib/api/Routing';
import type * as RoutingService from 'chaire-lib-common/lib/services/routing/RoutingService';

import fetchRetry from 'fetch-retry';
const fetch = fetchRetry(global.fetch);

import type {
    ValhallaRouteResults,
    ValhallaMatchResults,
    ValhallaIsochroneResults
} from 'chaire-lib-common/lib/api/Valhalla';

const COMMON_FETCH_OPTIONS = {
    headers: {
        'Accept-Encoding': 'identity'
    }
};

class ValhallaService {
    private _host: string;
    private _port: number;
    private _isSecure: boolean;

    constructor(host: string, port: number, isSecure = false) {
        this._host = host || 'localhost';

        if (port <= 0) {
            throw new Error('ValhallaService: port number must be valid');
        }

        this._port = port;
        this._isSecure = isSecure;
    }

    public async route(
        params: ValhallaRouteOptions
    ): Promise<Status.Status<ValhallaRouteResults>> {
        const request = this.buildRouteRequest(params);

        return this.makeRequest<ValhallaRouteResults>('/route', request);
    }

    public async match(
        params: ValhallaMatchOptions
    ): Promise<Status.Status<ValhallaMatchResults>> {
        throw new Error('Valhalla map matching is not implemented yet');
    }

    public async tableFrom(
        _params: RoutingService.TableFromParameters
    ): Promise<Status.Status<RoutingService.TableResults>> {
        throw new Error('Valhalla table routing is not implemented yet');
    }

    public async tableTo(
        _params: RoutingService.TableToParameters
    ): Promise<Status.Status<RoutingService.TableResults>> {
        throw new Error('Valhalla table routing is not implemented yet');
    }

    public async isochrone(
        params: ValhallaIsochroneOptions
    ): Promise<Status.Status<ValhallaIsochroneResults>> {
        const request = {
            costing: this.getCosting(params.mode),
            units: 'kilometers',
            ...params
        };

        return this.makeRequest<ValhallaIsochroneResults>('/isochrone', request);
    }

    private buildRouteRequest(params: ValhallaRouteOptions) {
        return {
            locations: params.points.map((point) => ({
                lon: point.geometry.coordinates[0],
                lat: point.geometry.coordinates[1]
            })),
            costing: this.getCosting(params.mode),
            units: 'kilometers',
            ...params
        };
    }

    private getCosting(mode: string): string {
        switch (mode) {
            case 'walking':
                return 'pedestrian';
            case 'cycling':
                return 'bicycle';
            case 'driving':
                return 'auto';
            default:
                throw new Error(`ValhallaService: unsupported routing mode ${mode}`);
        }
    }

    private async makeRequest<T>(
        endpoint: string,
        parameters: unknown
    ): Promise<Status.Status<T>> {
        const url = `${this.buildUrlPrefix()}${endpoint}`;

        const response = await fetch(url, {
            ...COMMON_FETCH_OPTIONS,
            method: 'POST',
            headers: {
                ...COMMON_FETCH_OPTIONS.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(parameters)
        });

        const result = await response.json();

        if (response.ok) {
            return StatusUtils.createOk(result);
        }

        return StatusUtils.createError(result);
    }

    private buildUrlPrefix(): string {
        const protocol = this._isSecure ? 'https' : 'http';
        return `${protocol}://${this._host}:${this._port}`;
    }

    public getHostPort(): { host: string; port: number } {
        return {
            host: this._host,
            port: this._port
        };
    }
}

// singleton:
const instance = new ValhallaService('localhost', 8002); // Temporary hardcoded host and port, should be configurable in the future
Object.freeze(instance);

export default instance;
