/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Preferences from '../../config/Preferences';
import { Route } from './RoutingService';
import { RoutingOrTransitMode, RoutingMode } from '../../config/routingModes';
import TrError, { ErrorMessage } from '../../utils/TrError';
import { TrRoutingRoute } from '../transitRouting/types';

export const pathIsRoute = (path: Route | TrRoutingRoute | undefined): path is Route => {
    return typeof (path as any).distance === 'number';
};

// TODO Add a common type to getPath(index)
// TODO Have a common type for all results, not requiring the TResultData generic type
/**
 * Represents a routing result, for either uni or multimodal routing.
 */
export interface RoutingResult {
    hasAlternatives: () => boolean;
    getAlternativesCount: () => number;
    originDestinationToGeojson: () => GeoJSON.FeatureCollection<GeoJSON.Point>;
    /**
     * Get the geojson geometry of the path at the given index
     *
     * TODO Type the options so they are common for all routing results
     *
     * TODO Type the FeatureCollection properties
     *
     * @param index The index of the alternative path to fetch
     * @param options Additional options to pass to generate geometries
     * @returns A feature collection with the steps of the path
     */
    getPathGeojson: (index: number, options: { [key: string]: any }) => Promise<GeoJSON.FeatureCollection>;
    getPath: (index: number) => TrRoutingRoute | Route | undefined;
    getRoutingMode(): RoutingOrTransitMode;
    hasError: () => boolean;
    getError: () => TrError | undefined;
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
export class UnimodalRoutingResult implements RoutingResult {
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
}
