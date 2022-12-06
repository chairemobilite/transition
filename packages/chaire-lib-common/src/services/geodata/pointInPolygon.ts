/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import pointInPolygon from 'point-in-polygon-hao';
// see this commit to turfjs: https://github.com/Turfjs/turf/pull/1893/commits/36a9e91326dbf6b3f196aee2ade5c06f06175ac4

/**
 * Return true if the point is inside the polygon
 * @param point The point
 * @param polygon The polygon or multipolygon
 * @param ignoreBoundary If true: a point on the boundary will NOT be considered
 *    inside the polygon, default: false (points on boundary are considered
 *    inside the polygon by default)
 */
export default function (
    point: GeoJSON.Point,
    polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon,
    ignoreBoundary = false
) {
    const pointCoordinates = point.coordinates;
    // normalize to multipolygon:
    const polygonCoordinates = polygon.type === 'Polygon' ? [polygon.coordinates] : polygon.coordinates;

    let result = false;
    for (let i = 0, size = polygonCoordinates.length; i < size; i++) {
        const polyResult: boolean | number /* true: inside, false: outside, 0: on boundary */ = pointInPolygon(
            pointCoordinates,
            polygonCoordinates[i]
        );
        if (polyResult === 0) {
            return !ignoreBoundary;
        } else if (polyResult) {
            result = true;
        }
    }

    return result;
}
