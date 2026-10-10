/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// maplibre-gl is ESM only and cannot be loaded by Jest. An identity projection keeps the
// expected values readable: Mercator x, y are the longitude and latitude.
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
import { buildPathInstances, SEGMENT_FLOATS } from '../pathGeometry';

const lineString = (coordinates: number[][], color?: string): Feature => ({
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: color === undefined ? {} : { color }
});

/**
 * Segments as [previousX, previousY, startX, startY, endX, endY, nextX, nextY, startDistance,
 * endDistance] in absolute coordinates, distances in Mercator units
 */
const absoluteSegments = (features: Feature[], simplifyTolerance?: number): number[][] => {
    const instances = buildPathInstances(features, simplifyTolerance);
    const [originX, originY] = instances.origin;
    return Array.from({ length: instances.count }, (_, i) => {
        const values = Array.from(instances.segments.slice(i * SEGMENT_FLOATS, (i + 1) * SEGMENT_FLOATS));
        const points = values.slice(0, 8).map((value, j) => value + (j % 2 === 0 ? originX : originY));
        return [...points, ...values.slice(8).map((distance) => distance / 512)];
    });
};

describe('buildPathInstances', () => {
    test.each([
        { title: 'no feature', features: [] },
        { title: 'empty line', features: [lineString([])] },
        { title: 'single point', features: [lineString([[1, 1]])] },
        { title: 'only duplicated points', features: [lineString([[1, 1], [1, 1], [1, 1]])] },
        { title: 'point feature', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 1] }, properties: {} } as Feature] }
    ])('$title: no segment', ({ features }) => {
        const instances = buildPathInstances(features);
        expect(instances.count).toEqual(0);
        expect(instances.segments).toHaveLength(0);
        expect(instances.colors).toHaveLength(0);
    });

    test.each([
        {
            title: '2 points',
            coordinates: [[0, 0], [0.003, 0.004]],
            expected: [[0, 0, 0, 0, 0.003, 0.004, 0.003, 0.004, 0, 0.005]]
        },
        {
            title: 'right angle',
            coordinates: [[0, 0], [0.001, 0], [0.001, 0.002]],
            expected: [
                [0, 0, 0, 0, 0.001, 0, 0.001, 0.002, 0, 0.001],
                [0, 0, 0.001, 0, 0.001, 0.002, 0.001, 0.002, 0.001, 0.003]
            ]
        },
        {
            title: 'U-turn',
            coordinates: [[0, 0], [0.002, 0], [0, 0]],
            expected: [
                [0, 0, 0, 0, 0.002, 0, 0, 0, 0, 0.002],
                [0, 0, 0.002, 0, 0, 0, 0, 0, 0.002, 0.004]
            ]
        },
        {
            title: 'duplicated points are merged',
            coordinates: [[0, 0], [0, 0], [0.001, 0], [0.001, 0], [0.001, 0.001]],
            expected: [
                [0, 0, 0, 0, 0.001, 0, 0.001, 0.001, 0, 0.001],
                [0, 0, 0.001, 0, 0.001, 0.001, 0.001, 0.001, 0.001, 0.002]
            ]
        }
    ])('$title', ({ coordinates, expected }) => {
        const segments = absoluteSegments([lineString(coordinates)]);
        expect(segments).toHaveLength(expected.length);
        segments.forEach((segment, i) => {
            segment.forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], 9));
        });
    });

    test.each([
        {
            title: 'no tolerance: all points kept',
            tolerance: 0,
            expected: [
                [0, 0, 0, 0, 0.001, 0.0001, 0.002, 0, 0, Math.hypot(0.001, 0.0001)],
                [0, 0, 0.001, 0.0001, 0.002, 0, 0.002, 0, Math.hypot(0.001, 0.0001), 2 * Math.hypot(0.001, 0.0001)]
            ]
        },
        {
            // 0.0002 Mercator units: larger than the 0.0001 detail
            title: 'detail smaller than the tolerance: removed, original distances kept',
            tolerance: 0.0002 * 512,
            expected: [[0, 0, 0, 0, 0.002, 0, 0.002, 0, 0, 2 * Math.hypot(0.001, 0.0001)]]
        }
    ])('simplification, $title', ({ tolerance, expected }) => {
        const segments = absoluteSegments([lineString([[0, 0], [0.001, 0.0001], [0.002, 0]])], tolerance);
        expect(segments).toHaveLength(expected.length);
        segments.forEach((segment, i) => {
            segment.forEach((value, j) => expect(value).toBeCloseTo(expected[i][j], 9));
        });
    });

    test('each path restarts its distance at 0', () => {
        const segments = absoluteSegments([
            lineString([[0, 0], [0.001, 0], [0.002, 0]]),
            lineString([[0, 0.001], [0.001, 0.001]])
        ]);
        expect(segments.map((segment) => segment[8])).toEqual([
            0,
            expect.closeTo(0.001, 9),
            0
        ]);
    });

    test('origin at the bounding box center of all paths', () => {
        const instances = buildPathInstances([
            lineString([[-73.6, 45.5], [-73.55, 45.52]]),
            lineString([[-73.5, 45.6], [-73.52, 45.58]])
        ]);
        expect(instances.origin[0]).toBeCloseTo(-73.55, 12);
        expect(instances.origin[1]).toBeCloseTo(45.55, 12);
    });

    test.each([
        { color: '#ff8000', expected: [255, 128, 0, 255] },
        { color: undefined, expected: [128, 128, 128, 255] }
    ])('color $color on every segment of the path', ({ color, expected }) => {
        const instances = buildPathInstances([lineString([[0, 0], [0.001, 0], [0.002, 0]], color)]);
        expect(Array.from(instances.colors)).toEqual([...expected, ...expected]);
    });
});
