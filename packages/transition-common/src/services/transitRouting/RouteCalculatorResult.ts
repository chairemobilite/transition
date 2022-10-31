/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash.get';

import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { Route } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { RoutingOrTransitMode, RoutingMode } from 'chaire-lib-common/lib/config/routingModes';
import { TrRoutingPath } from 'chaire-lib-common/lib/api/TrRouting';
import TrError from 'chaire-lib-common/lib/utils/TrError';

// TODO Add a common type to getPath(index)
export interface RouteCalculatorResult {
    hasAlternatives: () => boolean;
    getAlternativesCount: () => number;
    originDestinationToGeojson: () => GeoJSON.FeatureCollection<GeoJSON.Point>;
    getPathGeojson: (index: number, options: { [key: string]: any }) => Promise<GeoJSON.FeatureCollection>;
    getPath: (index: number) => TrRoutingPath | Route | undefined;
    getRoutingMode(): RoutingOrTransitMode;
    hasError: () => boolean;
    getError: () => TrError | undefined;
}

interface ResultParams {
    routingMode: RoutingMode;
    origin: GeoJSON.Feature<GeoJSON.Point>;
    destination: GeoJSON.Feature<GeoJSON.Point>;
    paths: Route[];
    error?: TrError;
}

export class UnimodalRouteCalculationResult implements RouteCalculatorResult {
    private _routingMode: RoutingMode;
    private _origin: GeoJSON.Feature<GeoJSON.Point>;
    private _destination: GeoJSON.Feature<GeoJSON.Point>;
    private _paths: Route[];
    private _error: TrError | undefined;

    constructor(params: ResultParams) {
        this._routingMode = params.routingMode;
        this._origin = params.origin;
        this._destination = params.destination;
        this._paths = params.paths;
        this._error = params.error;
    }

    getRoutingMode(): RoutingOrTransitMode {
        return this._routingMode;
    }

    hasAlternatives(): boolean {
        return this._paths.length > 1;
    }

    getAlternativesCount(): number {
        return this._paths.length;
    }

    getPath(index: number): Route | undefined {
        return this._paths[index];
    }

    originDestinationToGeojson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
        return {
            type: 'FeatureCollection',
            features: [this._origin, this._destination]
        };
    }

    getWalkOnlyRoute(): Route | undefined {
        return undefined;
    }

    async getPathGeojson(index: number, _options: { [key: string]: any } = {}): Promise<GeoJSON.FeatureCollection> {
        const path = this.getPath(index);
        if (path?.geometry) {
            const geojson: GeoJSON.Feature<GeoJSON.Geometry> = {
                type: 'Feature',
                geometry: path.geometry,
                properties: {
                    distanceMeters: path.distance,
                    travelTimeSeconds: path.duration,
                    mode: this._routingMode,
                    color: Preferences.get(
                        `transit.routing.transit.${this._routingMode}.color`, // TODO: rename or move this prefs to reduce nesting
                        Preferences.get('transit.routing.transit.default.color')
                    )
                }
            };
            return {
                type: 'FeatureCollection',
                features: [geojson]
            };
        }
        throw 'Geometry should be in the route, it is not';
    }

    hasError(): boolean {
        return this._error !== undefined;
    }

    getError(): TrError | undefined {
        return this._error;
    }
}
