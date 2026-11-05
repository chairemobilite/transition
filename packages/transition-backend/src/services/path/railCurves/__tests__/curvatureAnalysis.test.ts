/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Position } from 'geojson';
import { length as turfLength, lineString as turfLineString, destination as turfDestination } from '@turf/turf';
import { segmentPathByCurvature, analyzeCurveRadius } from '../curvatureAnalysis';
import { arcCoordinates, straightCoordinates } from './railCurvesTestUtils';

const center: Position = [-73.6, 45.5];
const lineString = (coordinates: Position[]) => ({ type: 'LineString' as const, coordinates });

/**
 * A path heading east that turns left by the same angle at its first 3 middle vertices, then right at the
 * next 3, as in an S-curve. Each of these turns is the one between 2 chords of a circle of the given radius.
 */
const leftThenRightCoordinates = (radiusMeters: number, spacingMeters: number): Position[] => {
    const turnDegrees = (2 * Math.asin(spacingMeters / (2 * radiusMeters)) * 180) / Math.PI;
    const coordinates: Position[] = [center];
    let bearing = 90;
    // A decreasing bearing is a left turn
    for (const turn of [0, -1, -1, -1, 1, 1, 1]) {
        bearing += turn * turnDegrees;
        coordinates.push(
            turfDestination(coordinates[coordinates.length - 1], spacingMeters / 1000, bearing, { units: 'kilometers' })
                .geometry.coordinates
        );
    }
    return coordinates;
};

describe('segmentPathByCurvature', () => {
    test.each([
        { label: 'no point', coordinates: [] },
        { label: 'a single point', coordinates: [center] }
    ])('returns no segment for $label', ({ coordinates }) => {
        expect(
            segmentPathByCurvature(
                coordinates,
                coordinates.map(() => null),
                { mode: 'rail', runningSpeedKmH: 90 }
            )
        ).toEqual([]);
    });

    test.each([
        { label: 'a 300 m curve below the 561 m threshold at 90 km/h', radius: 300, expectedType: 'curve' },
        { label: 'a 1000 m curve above the 561 m threshold at 90 km/h', radius: 1000, expectedType: 'straight' }
    ])('returns a single segment for $label', ({ radius, expectedType }) => {
        const coordinates = arcCoordinates(center, radius, 50, 6);
        const radii = [null, radius, radius, radius, radius, null];
        const segments = segmentPathByCurvature(coordinates, radii, { mode: 'rail', runningSpeedKmH: 90 });
        expect(segments).toEqual([
            {
                startIndex: 0,
                endIndex: 5,
                medianRadiusMeters: radius,
                minRadiusMeters: radius,
                lengthMeters: expect.closeTo(turfLength(turfLineString(coordinates), { units: 'meters' }), 3),
                type: expectedType
            }
        ]);
    });

    test('splits at each type change, with segments sharing their boundary vertex', () => {
        const coordinates = straightCoordinates(center, 100, 7);
        const radii = [null, 10000, 300, 200, 10000, 10000, null];
        const segments = segmentPathByCurvature(coordinates, radii, { mode: 'rail', runningSpeedKmH: 90 });
        expect(segments.map(({ startIndex, endIndex, type }) => ({ startIndex, endIndex, type }))).toEqual([
            { startIndex: 0, endIndex: 2, type: 'straight' },
            { startIndex: 2, endIndex: 4, type: 'curve' },
            { startIndex: 4, endIndex: 6, type: 'straight' }
        ]);
        expect(segments[1]).toEqual(expect.objectContaining({ medianRadiusMeters: 250, minRadiusMeters: 200 }));
        const totalLength = segments.reduce((sum, segment) => sum + segment.lengthMeters, 0);
        expect(totalLength).toBeCloseTo(600, 0);
    });

    test.each([
        { label: 'coarse', radiusMeters: 300, spacingMeters: 50 },
        { label: 'dense', radiusMeters: 286, spacingMeters: 5 }
    ])('splits a $label curve when the turn direction changes', ({ radiusMeters, spacingMeters }) => {
        const coordinates = leftThenRightCoordinates(radiusMeters, spacingMeters);
        const radii = coordinates.map((_, i) => (i === 0 || i === coordinates.length - 1 ? null : 300));
        const segments = segmentPathByCurvature(coordinates, radii, { mode: 'rail', runningSpeedKmH: 90 });
        expect(segments.length).toBe(2);
        expect(segments.every((segment) => segment.type === 'curve')).toBe(true);
        expect(segments[0].startIndex).toBe(0);
        expect(segments[0].endIndex).toBe(segments[1].startIndex);
        expect(segments[1].endIndex).toBe(coordinates.length - 1);
    });
});

describe('analyzeCurveRadius', () => {
    // 500 m curve, 80 km/h: the rail threshold is 443 m, the tram threshold is 761 m
    test.each([
        { mode: 'rail' as const, expectedType: 'straight' },
        { mode: 'tram' as const, expectedType: 'curve' }
    ])('classifies a 500 m curve at 80 km/h as $expectedType for $mode', ({ mode, expectedType }) => {
        const segments = analyzeCurveRadius(lineString(arcCoordinates(center, 500, 50, 6)), {
            mode,
            runningSpeedKmH: 80
        });
        expect(segments.map((segment) => segment.type)).toEqual([expectedType]);
    });

    test('classifies a straight line as straight above the speed allowed by the maximum radius', () => {
        const segments = analyzeCurveRadius(lineString(straightCoordinates(center, 100, 4)), {
            mode: 'rail',
            runningSpeedKmH: 400
        });
        expect(segments.map((segment) => segment.type)).toEqual(['straight']);
    });

    test('returns the curve radius computed from the geometry', () => {
        const [segment] = analyzeCurveRadius(lineString(arcCoordinates(center, 300, 50, 6)), {
            mode: 'rail',
            runningSpeedKmH: 90
        });
        expect(segment.type).toBe('curve');
        expect(segment.minRadiusMeters).toBeCloseTo(300, -1);
        expect(segment.medianRadiusMeters).toBeCloseTo(300, -1);
    });
});
