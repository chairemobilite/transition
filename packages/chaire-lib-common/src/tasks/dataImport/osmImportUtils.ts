/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { centroid as turfCentroid } from '@turf/turf';
import { SingleGeoFeature } from '../../services/geodata/GeoJSONUtils';

export class GeojsonOutputter {
    private _idUrl: string | undefined;

    constructor(idUrl?: string) {
        this._idUrl = idUrl;
    }

    toString(geojson: SingleGeoFeature) {
        const geojsonName = geojson.properties?.name ? ` ${geojson.properties.name}` : '';
        if (!this._idUrl) {
            return `${geojson.id}${geojsonName}`;
        }
        const geojsonPoint = turfCentroid(geojson);
        const [type, id] = (String(geojson.id) || '').split('/');
        const osmFeatureId = !id
            ? undefined
            : type === 'way'
                ? `w${id}`
                : type === 'node'
                    ? `n${id}`
                    : type === 'relation'
                        ? `r${id}`
                        : undefined;
        const osmIdQuery = osmFeatureId ? `id=${osmFeatureId}&` : '';
        return `${geojson.id}${geojsonName} (${this._idUrl}#${osmIdQuery}map=19.00/${geojsonPoint.geometry.coordinates[1]}/${geojsonPoint.geometry.coordinates[0]})`;
    }
}
