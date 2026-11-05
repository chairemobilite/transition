/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Position } from 'geojson';
import { calculateTurnDirections, calculateRadiiAtVertices } from '../geometry';
import { arcCoordinates, straightCoordinates } from './railCurvesTestUtils';

const center: Position = [-73.6, 45.5];

describe('calculateRadiiAtVertices circumradius', () => {
    /** Radius at the middle vertex of 3 points, for a tram so that radii down to 18 m are kept */
    const radiusAtMiddle = (points: Position[]) => calculateRadiiAtVertices(points, 'tram')[1];

    test.each([
        { radiusMeters: 18, spacingMeters: 5 },
        { radiusMeters: 150, spacingMeters: 30 },
        { radiusMeters: 500, spacingMeters: 100 },
        { radiusMeters: 3000, spacingMeters: 200 }
    ])('returns $radiusMeters m for points on a $radiusMeters m circle', ({ radiusMeters, spacingMeters }) => {
        const radius = radiusAtMiddle(arcCoordinates(center, radiusMeters, spacingMeters, 3)) as number;
        expect(Math.abs(radius - radiusMeters) / radiusMeters).toBeLessThan(0.001);
    });

    test('returns the maximum radius for exactly collinear points', () => {
        // On the equator. Points on another great circle give a huge radius instead, from rounding
        expect(
            radiusAtMiddle([
                [0, 0],
                [0.001, 0],
                [0.002, 0]
            ])
        ).toBe(10000);
    });

    test('returns the maximum radius for nearly collinear points', () => {
        // 1 cm offset over 2 km: the stable formula must not return a negative area or NaN
        const [p1, , p3] = straightCoordinates(center, 1000, 3);
        const p2: Position = [(p1[0] + p3[0]) / 2, (p1[1] + p3[1]) / 2 + 0.0000001];
        expect(radiusAtMiddle([p1, p2, p3])).toBe(10000);
    });
});

describe('calculateTurnDirections turn direction', () => {
    /** Turn direction at the middle vertex of 3 points */
    const directionAtMiddle = (p1: Position, p2: Position, p3: Position) => calculateTurnDirections([p1, p2, p3])[1];

    test.each([
        { label: 'north', p3: [-73.598, 45.501], expected: 'left' },
        { label: 'south', p3: [-73.598, 45.499], expected: 'right' },
        { label: 'straight east', p3: [-73.598, 45.5], expected: 'straight' }
    ])('returns $expected when heading east then $label', ({ p3, expected }) => {
        expect(directionAtMiddle(center, [-73.599, 45.5], p3)).toBe(expected);
    });

    test('detects a gentle turn on densely sampled points', () => {
        // 286 m radius every 5 m: 1° per vertex, with a cross product of about 3.5e-11 square degrees
        const [p1, p2, p3] = arcCoordinates(center, 286, 5, 3);
        expect(directionAtMiddle(p1, p2, p3)).toBe('left');
        expect(directionAtMiddle(p3, p2, p1)).toBe('right');
    });
});

describe('calculateTurnDirections', () => {
    test.each([
        { label: 'no point', coordinates: [], expected: [] },
        { label: '2 points', coordinates: straightCoordinates(center, 100, 2), expected: [null, null] },
        {
            // On a meridian: a great circle that is also a straight line in longitude and latitude
            label: 'a straight line',
            coordinates: [
                [-73.6, 45.5],
                [-73.6, 45.501],
                [-73.6, 45.502],
                [-73.6, 45.503]
            ],
            expected: [null, 'straight', 'straight', null]
        }
    ])('returns the directions for $label', ({ coordinates, expected }) => {
        expect(calculateTurnDirections(coordinates)).toEqual(expected);
    });
});

describe('calculateRadiiAtVertices', () => {
    test.each([
        { label: 'no point', coordinates: [] },
        { label: '2 points', coordinates: straightCoordinates(center, 100, 2) }
    ])('returns only nulls for $label', ({ coordinates }) => {
        expect(calculateRadiiAtVertices(coordinates, 'rail')).toEqual(coordinates.map(() => null));
    });

    test('returns the circle radius at each middle vertex and null at both ends', () => {
        const radii = calculateRadiiAtVertices(arcCoordinates(center, 400, 50, 5), 'rail');
        expect(radii[0]).toBeNull();
        expect(radii[4]).toBeNull();
        radii.slice(1, 4).forEach((radius) => expect(radius).toBeCloseTo(400, -1));
    });

    test('returns the maximum radius for vertices on a straight line', () => {
        expect(calculateRadiiAtVertices(straightCoordinates(center, 100, 4), 'rail')).toEqual([
            null,
            10000,
            10000,
            null
        ]);
    });

    test.each([
        { mode: 'tram' as const, radiusMeters: 10, expected: 18 },
        { mode: 'tram' as const, radiusMeters: 25, expected: 25 },
        { mode: 'rail' as const, radiusMeters: 25, expected: 50 },
        { mode: 'rail' as const, radiusMeters: 20000, expected: 10000 }
    ])('raises or lowers a $radiusMeters m radius to $expected m for $mode', ({ mode, radiusMeters, expected }) => {
        // Spacing at or below MIN_SPACING_FOR_RELIABILITY_CHECK_METERS: the reliability check does not apply
        const spacingMeters = Math.min(radiusMeters, 200);
        const radii = calculateRadiiAtVertices(arcCoordinates(center, radiusMeters, spacingMeters, 3), mode);
        expect(radii[1]).toBeCloseTo(expected, -1);
    });

    test.each([
        { label: 'kept below the spacing limit', spacingMeters: 150, radiusMeters: 160, expected: 160 },
        {
            label: 'replaced by the maximum radius when too tight for its spacing',
            spacingMeters: 300,
            radiusMeters: 400,
            expected: 10000
        },
        { label: 'kept when wide enough for its spacing', spacingMeters: 300, radiusMeters: 500, expected: 500 }
    ])('a radius is $label', ({ spacingMeters, radiusMeters, expected }) => {
        const radii = calculateRadiiAtVertices(arcCoordinates(center, radiusMeters, spacingMeters, 3), 'rail');
        expect(radii[1]).toBeCloseTo(expected, -1);
    });

    test('returns the maximum radius for coincident points', () => {
        const [p1, p3] = straightCoordinates(center, 100, 2);
        expect(calculateRadiiAtVertices([p1, p1, p3], 'rail')).toEqual([null, 10000, null]);
    });
});
