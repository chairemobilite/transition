/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Position } from 'geojson';
import { destination as turfDestination } from '@turf/turf';
import { findCoarseVertices, vertexProducts } from '../PathVertexGeometry';

const center: Position = [-73.6, 45.5];

/** Points on a circle arc turning left, with the given chord length between consecutive points */
const arc = (radiusMeters: number, spacingMeters: number, count: number): Position[] => {
    const stepDegrees = (2 * Math.asin(spacingMeters / (2 * radiusMeters)) * 180) / Math.PI;
    return Array.from(
        { length: count },
        (_, i) =>
            turfDestination(center, radiusMeters / 1000, 180 - i * stepDegrees, { units: 'kilometers' }).geometry
                .coordinates
    );
};

describe('vertexProducts', () => {
    test.each([
        { label: 'left turn', p3: [-73.598, 45.501], sign: 1 },
        { label: 'right turn', p3: [-73.598, 45.499], sign: -1 },
        { label: 'straight line', p3: [-73.598, 45.5], sign: 0 }
    ])('returns a cross product with the sign of a $label', ({ p3, sign }) => {
        expect(Math.sign(vertexProducts(center, [-73.599, 45.5], p3).cross)).toBe(sign);
    });
});

describe('findCoarseVertices turning angle', () => {
    /** Turning angle at the middle vertex, or undefined if it is not a coarse vertex */
    const angleAtMiddle = (coordinates: Position[]) => findCoarseVertices(coordinates)[0]?.angleRad;

    test.each([
        { label: 'right angle', p3: [-73.599, 45.501], expected: Math.PI / 2 },
        { label: 'U-turn', p3: [-73.6, 45.5], expected: Math.PI }
    ])('returns the angle for a $label', ({ p3, expected }) => {
        expect(angleAtMiddle([center, [-73.599, 45.5], p3])).toBeCloseTo(expected, 5);
    });

    test('ignores a straight line', () => {
        expect(angleAtMiddle([center, [-73.599, 45.5], [-73.598, 45.5]])).toBeUndefined();
    });

    test('corrects the longitude with the latitude', () => {
        // At 60° of latitude, one degree of longitude is half a degree of latitude, so this is a 45° turn
        expect(
            angleAtMiddle([
                [0, 60],
                [0.002, 60],
                [0.004, 60.001]
            ])
        ).toBeCloseTo(Math.PI / 4, 2);
    });
});

describe('findCoarseVertices', () => {
    test.each([
        { label: 'fewer than 3 points', coordinates: arc(300, 100, 2), expected: [] },
        // 50 m radius every 5 m: about 5.7° per vertex
        { label: 'a dense curve', coordinates: arc(50, 5, 6), expected: [] },
        // 50 m radius every 20 m: about 23° per vertex, but points are close together
        { label: 'a tight curve with close points', coordinates: arc(50, 20, 4), expected: [] },
        // 300 m radius every 100 m: about 19° per vertex with distant points
        { label: 'a coarse curve', coordinates: arc(300, 100, 4), expected: [1, 2] }
    ])('returns the vertices of $label', ({ coordinates, expected }) => {
        expect(findCoarseVertices(coordinates).map((vertex) => vertex.index)).toEqual(expected);
    });

    test('returns the angle and spacing of each vertex', () => {
        const [vertex] = findCoarseVertices(arc(300, 100, 3));
        expect(vertex.index).toBe(1);
        expect(vertex.angleRad).toBeCloseTo(2 * Math.asin(100 / 600), 2);
        expect(vertex.spacingMeters).toBeCloseTo(100, 0);
    });
});
