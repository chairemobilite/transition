/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Position } from 'geojson';
import type { CurveSegment } from 'transition-common/lib/services/path/railCurves/types';
import { curveSegmentsToGeojson } from '../railCurveAnalysis';

const coordinates: Position[] = [
    [-73.6, 45.5],
    [-73.599, 45.5],
    [-73.598, 45.501],
    [-73.597, 45.503],
    [-73.596, 45.504]
];

const segment = (startIndex: number, endIndex: number, type: CurveSegment['type']): CurveSegment => ({
    startIndex,
    endIndex,
    medianRadiusMeters: 300.4,
    minRadiusMeters: 250.6,
    lengthMeters: 120.5,
    type
});

describe('curveSegmentsToGeojson', () => {
    test.each([
        { label: 'no segment', segments: [] },
        { label: 'only straight segments', segments: [segment(0, 4, 'straight')] },
        { label: 'a single-point curve', segments: [segment(2, 2, 'curve')] }
    ])('returns no feature for $label', ({ segments }) => {
        expect(curveSegmentsToGeojson(coordinates, segments).features).toEqual([]);
    });

    test('returns a line for each curve segment, with rounded values', () => {
        const result = curveSegmentsToGeojson(coordinates, [
            segment(0, 1, 'straight'),
            segment(1, 3, 'curve'),
            segment(3, 4, 'straight')
        ]);
        expect(result.features).toEqual([
            {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: coordinates.slice(1, 4) },
                properties: { medianRadiusMeters: 300, minRadiusMeters: 251, lengthMeters: 121 }
            }
        ]);
    });
});
