/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJSON from 'geojson';

export interface GeojsonServiceOptions {
    interactive?: boolean;
}

export interface PromptGeojsonPolygonService {
    /**
     * Get a geojson polygon object.
     *
     * @param {string} defaultFileName A hint for the file name to get the
     * polygon from
     * @param @param {GeojsonServiceOptions} [options] Additional parameters to the
     * function
     * @return {*}  {Promise<GeoJSON.Polygon | GeoJSON.FeatureCollection |
     * GeoJSON.Feature>}
     */
    getPolygon(
        defaultFileName: string,
        options?: GeojsonServiceOptions
    ): Promise<GeoJSON.Polygon | GeoJSON.FeatureCollection | GeoJSON.Feature>;

    /**
     * Get a geojson feature collection.
     *
     * @param {string} defaultFileName A hint for the file name to get the
     * collection from
     * @param {GeojsonServiceOptions} [options]
     * @return {*}  {Promise<GeoJSON.FeatureCollection>}
     */
    getFeatureCollection(defaultFileName: string, options?: GeojsonServiceOptions): Promise<GeoJSON.FeatureCollection>;
}
