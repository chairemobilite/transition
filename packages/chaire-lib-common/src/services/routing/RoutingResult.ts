/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _get from 'lodash/get';

import Preferences from '../../config/Preferences';
import { Route } from './RoutingService';
import { RoutingOrTransitMode, RoutingMode } from '../../config/routingModes';
import TrError, { ErrorMessage } from '../../utils/TrError';
import { TrRoutingRoute } from '../trRouting/TrRoutingService';

// TODO Add a common type to getPath(index)
// TODO Have a common type for all results, not requiring the TResultData generic type
/**
 * Represents a routing result, for either uni or multimodal routing.
 */
export interface RoutingResult<TResultData> {
    hasAlternatives: () => boolean;
    getAlternativesCount: () => number;
    originDestinationToGeojson: () => GeoJSON.FeatureCollection<GeoJSON.Point>;
    getPathGeojson: (index: number, options: { [key: string]: any }) => Promise<GeoJSON.FeatureCollection>;
    getPath: (index: number) => TrRoutingRoute | Route | undefined;
    getRoutingMode(): RoutingOrTransitMode;
    hasError: () => boolean;
    getError: () => TrError | undefined;
    getParams: () => TResultData;
}

/**
 * Describe a unimodal routing result data
 *
 * TODO Have one single type for the routing results, whether uni or multi-modal
 */
export interface UnimodalRoutingResultData {
    routingMode: RoutingMode;
    origin: GeoJSON.Feature<GeoJSON.Point>;
    destination: GeoJSON.Feature<GeoJSON.Point>;
    paths: Route[];
    error?: { localizedMessage: ErrorMessage; error: string; errorCode: string };
}

/**
 * Represents a unimodal routing result
 */
export class UnimodalRoutingResult implements RoutingResult<UnimodalRoutingResultData> {
    constructor(private _params: UnimodalRoutingResultData) {
        /** Nothing to do */
    }

    getRoutingMode(): RoutingOrTransitMode {
        return this._params.routingMode;
    }

    hasAlternatives(): boolean {
        return this._params.paths.length > 1;
    }

    getAlternativesCount(): number {
        return this._params.paths.length;
    }

    getPath(index: number): Route | undefined {
        return this._params.paths[index];
    }

    originDestinationToGeojson(): GeoJSON.FeatureCollection<GeoJSON.Point> {
        return {
            type: 'FeatureCollection',
            features: [this._params.origin, this._params.destination]
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
                    mode: this._params.routingMode,
                    color: Preferences.get(
                        `transit.routing.transit.${this._params.routingMode}.color`, // TODO: rename or move this prefs to reduce nesting
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
        return this._params.error !== undefined;
    }

    getError(): TrError | undefined {
        const error = this._params.error;
        return error !== undefined ? new TrError(error.error, error.errorCode, error.localizedMessage) : undefined;
    }

    getParams = (): UnimodalRoutingResultData => this._params;
}
