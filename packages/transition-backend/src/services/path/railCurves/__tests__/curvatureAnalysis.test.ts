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

/** A left turn followed by a right turn on a circle of the given radius: 4 points turning left, then 3 turning right */
const leftThenRightCoordinates = (radiusMeters: number, spacingMeters: number): Position[] => {
    // Angle between consecutive points, in degrees
    const step = (2 * Math.asin(spacingMeters / (2 * radiusMeters)) * 180) / Math.PI;
    const left = arcCoordinates(center, radiusMeters, spacingMeters, 4);
    // Center of the right turn, on the other side of the last point, so the tangent is continuous
    const bearingFromCenter = 180 - 3 * step;
    const radiusKm = radiusMeters / 1000;
    const rightCenter = turfDestination(left[3], radiusKm, bearingFromCenter, { units: 'kilometers' }).geometry
        .coordinates;
    const right = [1, 2, 3].map(
        (i) =>
            turfDestination(rightCenter, radiusKm, bearingFromCenter + 180 + i * step, { units: 'kilometers' }).geometry
                .coordinates
    );
    return [...left, ...right];
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
        expect(segments[1]).toEqual(expect.objectContaining({ medianRadiusMeters: 300, minRadiusMeters: 200 }));
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

    test('uses an explicit straight threshold instead of the one from the speed', () => {
        const coordinates = arcCoordinates(center, 1000, 50, 4);
        const segments = segmentPathByCurvature(coordinates, [null, 1000, 1000, null], {
            mode: 'rail',
            runningSpeedKmH: 90,
            straightThresholdMeters: 2000
        });
        expect(segments.map((segment) => segment.type)).toEqual(['curve']);
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
