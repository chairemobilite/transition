/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import GeoJSON from 'geojson';
import * as turf from '@turf/turf';

const findNearestFromPoint = <P extends GeoJSON.GeoJsonProperties>(
    feature: GeoJSON.Feature<GeoJSON.Point>,
    features: GeoJSON.Feature<GeoJSON.Point, P>[],
    options: { maxDistance?: number } = {}
): { feature: GeoJSON.Feature<GeoJSON.Point, P>; dist: number } | undefined => {
    if (features.length === 0) {
        return undefined;
    }
    let nearest: GeoJSON.Feature<GeoJSON.Point, P> | undefined = undefined;
    let shortestDistance = Number.MAX_VALUE;
    for (let i = 0; i < features.length; i++) {
        const distance = turf.distance(feature, features[i], { units: 'meters' });
        if (distance < shortestDistance && !(options.maxDistance && distance > options.maxDistance)) {
            shortestDistance = distance;
            nearest = features[i];
        }
    }
    return nearest ? { feature: nearest, dist: shortestDistance } : undefined;
};

const findNearestFromLine = <P extends GeoJSON.GeoJsonProperties>(
    feature: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>,
    features: GeoJSON.Feature<GeoJSON.Point, P>[],
    options: { maxDistance?: number } = {}
): { feature: GeoJSON.Feature<GeoJSON.Point, P>; dist: number } | undefined => {
    if (features.length === 0) {
        return undefined;
    }
    let nearest: GeoJSON.Feature<GeoJSON.Point, P> | undefined = undefined;
    let shortestDistance = Number.MAX_VALUE;
    for (let i = 0; i < features.length; i++) {
        const nearestPoint = turf.nearestPointOnLine(feature.geometry, features[i], { units: 'meters' });
        const distance = nearestPoint.properties.dist !== undefined ? nearestPoint.properties.dist : Number.MAX_VALUE;
        if (distance < shortestDistance && !(options.maxDistance && distance > options.maxDistance)) {
            shortestDistance = distance;
            nearest = features[i];
        }
    }
    return nearest ? { feature: nearest, dist: shortestDistance } : undefined;
};

const findNearestFromPolygon = <P extends GeoJSON.GeoJsonProperties>(
    feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
    features: GeoJSON.Feature<GeoJSON.Point, P>[],
    options: { maxDistance?: number } = {}
): { feature: GeoJSON.Feature<GeoJSON.Point, P>; dist: number } | undefined => {
    if (features.length === 0) {
        return undefined;
    }
    let nearest: GeoJSON.Feature<GeoJSON.Point, P> | undefined = undefined;
    let shortestDistance = Number.MAX_VALUE;
    const polygonLines = turf.polygonToLineString(feature);
    const lines = polygonLines.type === 'FeatureCollection' ? polygonLines.features : [polygonLines];
    for (let i = 0; i < features.length; i++) {
        for (let lineI = 0; lineI < lines.length; lineI++) {
            const nearestPoint = turf.nearestPointOnLine(lines[lineI], features[i], { units: 'meters' });
            const distance =
                nearestPoint.properties.dist !== undefined ? nearestPoint.properties.dist : Number.MAX_VALUE;
            if (distance < shortestDistance && !(options.maxDistance && distance > options.maxDistance)) {
                shortestDistance = distance;
                nearest = features[i];
            }
        }
    }
    return nearest ? { feature: nearest, dist: shortestDistance } : undefined;
};

/**
 * Find the feature that is the nearest to the first feature to compare. This
 * uses the distance between the features. If the features are polygons or
 * lines, the distance will be calculated from the nearest point
 *
 * @export
 * @template G The geometry of the features from which to get the nearest
 * @template P The property of the features from which to get the nearest
 * @param {GeoJSON.Feature} feature The reference feature, for which to get the
 * nearest
 * @param {GeoJSON.Feature<G, P>[]} features The features from which to pick the
 * nearest
 * @param {{ maxDistance: number }} [options={ maxDistance: 20 }] Additional
 * options for this function. maxDistance is the maximal distance from which to
 * get the nearest feature, in meters. If not specified, the nearest feature will be
 * returned no matter how far it is.
 * @return {*}  {(GeoJSON.Feature<G, P> | undefined)}
 */
export const findNearest = <P extends GeoJSON.GeoJsonProperties>(
    feature: GeoJSON.Feature,
    features: GeoJSON.Feature<GeoJSON.Point, P>[],
    options: { maxDistance?: number } = {}
): { feature: GeoJSON.Feature<GeoJSON.Point, P>; dist: number } | undefined => {
    if (feature.geometry.type === 'Point') {
        return findNearestFromPoint(feature as GeoJSON.Feature<GeoJSON.Point>, features, options);
    }
    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        return findNearestFromLine(
            feature as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>,
            features,
            options
        );
    }
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        return findNearestFromPolygon(
            feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
            features,
            options
        );
    }
    console.log(`findNearest only supports features of type Point for now. Got ${feature.geometry.type}`);
    return undefined;
};
