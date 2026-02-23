/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { KnexPostgis } from 'knex-postgis';
import { isGeometryObject } from 'geojson-validation';

/**
 * Convert a GeoJSON geometry to PostGIS geography format,
 * allowing undefined input values
 *
 * Since our columns are in geography types, we should use geogFromGeoJSON.
 * However, geogFromGeoJSON is not available in the KnexPostgis.
 * PostGIS 3.0+ will then auto cast the geometry to geography when inserting.
 * See section 4.3.2 at https://postgis.net/docs/using_postgis_dbmanagement.html
 */
export const geometryToPostgis = (
    geometry: GeoJSON.Geometry | undefined | null,
    st: KnexPostgis
): ReturnType<KnexPostgis['geomFromGeoJSON']> | undefined => {
    if (geometry === undefined || geometry === null || !isGeometryObject(geometry)) {
        return undefined;
    }
    return st.geomFromGeoJSON(geometry);
};
