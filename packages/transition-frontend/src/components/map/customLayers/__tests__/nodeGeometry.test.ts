/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// maplibre-gl is ESM only and cannot be loaded by Jest. An identity projection is enough to test
// the origin and relative positions.
jest.mock(
    'maplibre-gl',
    () => ({
        MercatorCoordinate: {
            fromLngLat: ([lng, lat]: [number, number]) => ({ x: lng, y: lat })
        }
    }),
    { virtual: true }
);

import type { Feature } from 'geojson';
import { buildNodeInstances, calculateNodeRadiusForZoom } from '../nodeGeometry';

const point = (lng: number, lat: number, color?: string): Feature => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: color === undefined ? {} : { color }
});

describe('buildNodeInstances', () => {
    test.each([
        { title: 'no feature', features: [] },
        {
            title: 'only non-point features',
            features: [
                {
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
                    properties: {}
                } as Feature
            ]
        }
    ])('$title: empty buffers', ({ features }) => {
        const instances = buildNodeInstances(features);
        expect(instances).toEqual({
            origin: [0, 0],
            positions: new Float32Array(0),
            colors: new Uint8Array(0),
            count: 0
        });
    });

    test('positions relative to the bounding box center', () => {
        const instances = buildNodeInstances([
            point(-73.6, 45.5, '#ff0000'),
            point(-73.5, 45.6, '#ff0000'),
            point(-73.55, 45.52, '#ff0000')
        ]);

        expect(instances.count).toEqual(3);
        expect(instances.origin[0]).toBeCloseTo(-73.55, 12);
        expect(instances.origin[1]).toBeCloseTo(45.55, 12);
        const expectedPositions = [-0.05, -0.05, 0.05, 0.05, 0, -0.03];
        expectedPositions.forEach((expected, i) => {
            expect(instances.positions[i]).toBeCloseTo(expected, 6);
        });
    });

    test.each([
        { color: '#ff8000', expected: [255, 128, 0, 255] },
        { color: 'rgba(10, 20, 30, 0.5)', expected: [10, 20, 30, 128] },
        { color: undefined, expected: [128, 128, 128, 255] },
        { color: 'not a color', expected: [128, 128, 128, 255] }
    ])('color $color', ({ color, expected }) => {
        const instances = buildNodeInstances([point(-73.6, 45.5, color)]);
        expect(Array.from(instances.colors)).toEqual(expected);
    });

    test('skips non-point features and keeps the others in order', () => {
        const instances = buildNodeInstances([
            point(-73.6, 45.5, '#ff0000'),
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} } as Feature,
            point(-73.5, 45.6, '#00ff00')
        ]);
        expect(instances.count).toEqual(2);
        expect(Array.from(instances.colors)).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
    });
});

describe('calculateNodeRadiusForZoom', () => {
    test('should return small radius at zoom 0', () => {
        const radius = calculateNodeRadiusForZoom(0);
        expect(radius).toBe(2);
    });

    test('should return expected radius at zoom 10 (boundary)', () => {
        const radius = calculateNodeRadiusForZoom(10);
        expect(radius).toBe(4);
    });

    test('should return expected radius at zoom 15 (boundary)', () => {
        const radius = calculateNodeRadiusForZoom(15);
        expect(radius).toBe(10);
    });

    test('should return expected radius at zoom 20 (boundary)', () => {
        const radius = calculateNodeRadiusForZoom(20);
        expect(radius).toBe(18);
    });

    test('should use linear interpolation beyond zoom 20', () => {
        const radiusAt21 = calculateNodeRadiusForZoom(21);
        const radiusAt22 = calculateNodeRadiusForZoom(22);
        const radiusAt23 = calculateNodeRadiusForZoom(23);

        expect(radiusAt21).toBe(14);
        expect(radiusAt22).toBe(16);
        expect(radiusAt23).toBe(18);
        expect(radiusAt22 - radiusAt21).toBe(2);
        expect(radiusAt23 - radiusAt22).toBe(2);
    });

    test('should increase monotonically within each zoom range', () => {
        const lowZooms = [0, 3, 6, 9, 10];
        const lowRadii = lowZooms.map(calculateNodeRadiusForZoom);
        for (let i = 1; i < lowRadii.length; i++) {
            expect(lowRadii[i]).toBeGreaterThanOrEqual(lowRadii[i - 1]);
        }

        const midZooms = [10, 12, 14, 15];
        const midRadii = midZooms.map(calculateNodeRadiusForZoom);
        for (let i = 1; i < midRadii.length; i++) {
            expect(midRadii[i]).toBeGreaterThanOrEqual(midRadii[i - 1]);
        }

        const highZooms = [15, 17, 19, 20];
        const highRadii = highZooms.map(calculateNodeRadiusForZoom);
        for (let i = 1; i < highRadii.length; i++) {
            expect(highRadii[i]).toBeGreaterThanOrEqual(highRadii[i - 1]);
        }

        const extraZooms = [21, 22, 23, 24];
        const extraRadii = extraZooms.map(calculateNodeRadiusForZoom);
        for (let i = 1; i < extraRadii.length; i++) {
            expect(extraRadii[i]).toBeGreaterThan(extraRadii[i - 1]);
        }
    });

    test('should return positive values for all zoom levels', () => {
        for (let zoom = 0; zoom <= 25; zoom++) {
            expect(calculateNodeRadiusForZoom(zoom)).toBeGreaterThan(0);
        }
    });
});
