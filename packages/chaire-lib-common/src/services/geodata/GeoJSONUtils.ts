/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export type SingleGeometry =
    | GeoJSON.Point
    | GeoJSON.MultiPoint
    | GeoJSON.LineString
    | GeoJSON.MultiLineString
    | GeoJSON.Polygon
    | GeoJSON.MultiPolygon;
export type SingleGeoFeature = GeoJSON.Feature<SingleGeometry>;

/** Return whether a feature is a polygon or multipolygon */
export const isPolygon = <P extends GeoJSON.GeoJsonProperties>(
    feature: GeoJSON.Feature<GeoJSON.Geometry, P>
): feature is GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, P> => {
    return feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon';
};
