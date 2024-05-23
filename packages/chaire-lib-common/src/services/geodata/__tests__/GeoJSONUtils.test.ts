/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import * as GeoJSONUtils from '../GeoJSONUtils';
import each from 'jest-each';

describe('isPolygon', () => {
    each([
        [
            'A Point feature, should return false',
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } },
            false
        ], [
            'A LineString feature, should return false',
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } },
            false
        ], [
            'A Polygon feature, should return true',
            { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[1, 2], [3, 4]] } },
            true
        ], [
            'A MultiPolygon feature, should return true',
            { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[[1, 2], [3, 4]], [[5, 6], [7, 1]]] } },
            true
        ]
    ]).test('%s', (_, geojson: GeoJSON.Feature<GeoJSON.Geometry>, expected) => {
        const result = GeoJSONUtils.isPolygon(geojson);
        expect(result).toEqual(expected);
    });
});

describe('getPointCoordinates', () => {
    each([
        [
            'With a point geometry, should return coordinates',
            { type: 'Point', coordinates: [1, 2] },
            [1, 2]
        ], [
            'A LineString geometry, should return undefined',
            { type: 'LineString', coordinates: [[1, 2], [3, 4]] },
            undefined
        ], [
            'Invalid geojson type, should return undefined',
            { type: 'InvalidType', coordinates: [1, 2] },
            undefined
        ], [
            'A feature with a Point geometry, should return coordinates',
            { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } },
            [1, 2]
        ], [
            'A feature with a LineString geometry, should return undefined',
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } },
            undefined
        ], [
            'A feature collection with a single point geometry, should return coordinates',
            { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } }] },
            [1, 2]
        ], [
            'A feature collection with many point geometries, should return undefined',
            { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] } }, { type: 'Feature', geometry: { type: 'Point', coordinates: [3, 4] } }] },
            undefined
        ], [
            'A feature collection with a single non-point geometry, should return undefined',
            { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } }] },
            undefined
        ],
    ]).test('%s', (_, geojson: GeoJSON.GeoJSON, expected) => {
        const result = GeoJSONUtils.getPointCoordinates(geojson);
        expect(result).toEqual(expected);
    });
});
