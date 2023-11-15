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

/**
 * Get the coordinates of a point from the geojson object. The geojson object
 * can be a point, a feature with a point geometry, or a feature collection with
 * a single feature with a point geometry.
 *
 * @param geojson Any geojson object
 * @returns The coordinates of the point, or undefined if the object is not a
 * point
 */
export const getPointCoordinates = (geojson: GeoJSON.GeoJSON): number[] | undefined => {
    if (geojson.type === 'Point') {
        return geojson.coordinates;
    }
    if (geojson.type === 'Feature' && geojson.geometry.type === 'Point') {
        return geojson.geometry.coordinates;
    }
    if (
        geojson.type === 'FeatureCollection' &&
        geojson.features.length === 1 &&
        geojson.features[0].geometry.type === 'Point'
    ) {
        return geojson.features[0].geometry.coordinates;
    }
    return undefined;
};

export const emptyFeatureCollection = { type: 'FeatureCollection', features: [] } as GeoJSON.FeatureCollection;
