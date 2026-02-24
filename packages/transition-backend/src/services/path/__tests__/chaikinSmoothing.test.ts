/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { chaikinSmoothSegment, chaikinSmoothPath, hasCoarseVertices } from '../chaikinSmoothing';

// Realistic coordinates in the Montreal area (lon, lat).
// Large spacing (~1.5 km) with a sharp 90° turn at stationB.
const stationA: [number, number] = [-73.620, 45.500];
const stationB: [number, number] = [-73.610, 45.510];
const stationC: [number, number] = [-73.600, 45.500];

// Dense coordinates (~30 m apart) approximating a smooth curve.
// The angles are moderate but the spacing is well below the 50 m threshold.
function buildDenseCurve(start: [number, number], end: [number, number], n: number): [number, number][] {
    const coords: [number, number][] = [start];
    for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const lng = start[0] + t * (end[0] - start[0]);
        const lat = start[1] + t * (end[1] - start[1]) + 0.0002 * Math.sin(Math.PI * t);
        coords.push([lng, lat]);
    }
    coords.push(end);
    return coords;
}

describe('hasCoarseVertices', () => {
    test('should return false for fewer than 3 points', () => {
        expect(hasCoarseVertices([[0, 0], [1, 1]])).toBe(false);
        expect(hasCoarseVertices([])).toBe(false);
    });

    test('should return true for widely-spaced sharp turn', () => {
        expect(hasCoarseVertices([stationA, stationB, stationC])).toBe(true);
    });

    test('should return false for dense smooth curve', () => {
        const denseCurve = buildDenseCurve(stationA, stationC, 60);
        expect(hasCoarseVertices(denseCurve)).toBe(false);
    });

    test('should return false for nearly straight widely-spaced path', () => {
        const straight: [number, number][] = [
            [-73.620, 45.500],
            [-73.610, 45.5002],
            [-73.600, 45.500]
        ];
        // Very small deflection angle, large spacing -> not coarse
        expect(hasCoarseVertices(straight)).toBe(false);
    });
});

describe('chaikinSmoothSegment', () => {
    test('should return copy for fewer than 3 points', () => {
        const twoPoints = [stationA, stationC];
        expect(chaikinSmoothSegment(twoPoints, 2)).toEqual(twoPoints);
    });

    test('should preserve first and last points', () => {
        const coords = [stationA, stationB, stationC];
        const result = chaikinSmoothSegment(coords, 1);
        expect(result[0]).toEqual(stationA);
        expect(result[result.length - 1]).toEqual(stationC);
    });

    test('should produce more points for coarse geometry', () => {
        const coords = [stationA, stationB, stationC];
        const result = chaikinSmoothSegment(coords, 1);
        expect(result.length).toBeGreaterThan(coords.length);
    });

    test('should apply correct Chaikin ratios for 1 iteration on 3 coarse points', () => {
        const coords = [stationA, stationB, stationC];
        const result = chaikinSmoothSegment(coords, 1);

        expect(result[0]).toEqual(stationA);
        // R_0 = 1/4 * A + 3/4 * B
        expect(result[1][0]).toBeCloseTo(0.25 * stationA[0] + 0.75 * stationB[0], 10);
        expect(result[1][1]).toBeCloseTo(0.25 * stationA[1] + 0.75 * stationB[1], 10);
        // Q_1 = 3/4 * B + 1/4 * C
        expect(result[2][0]).toBeCloseTo(0.75 * stationB[0] + 0.25 * stationC[0], 10);
        expect(result[2][1]).toBeCloseTo(0.75 * stationB[1] + 0.25 * stationC[1], 10);
        expect(result[3]).toEqual(stationC);
    });

    test('should stop early when segment is already smooth (convergence)', () => {
        const denseCurve = buildDenseCurve(stationA, stationC, 60);
        const result = chaikinSmoothSegment(denseCurve, 5);
        // Should return the original unchanged since no coarse vertices
        expect(result).toEqual(denseCurve);
    });

    test('should not grow unboundedly when called repeatedly', () => {
        const coords = [stationA, stationB, stationC];
        const firstResult = chaikinSmoothSegment(coords, 2);

        // Second call on the smoothed result should produce the same
        // output since the result of 2 iterations on 3 wide-spaced
        // points still has some coarse areas. But running it multiple
        // times should eventually stabilize.
        let current = firstResult;
        for (let run = 0; run < 5; run++) {
            const next = chaikinSmoothSegment(current, 2);
            if (next.length === current.length) {
                // Converged: no more points added
                expect(next).toEqual(current);
                break;
            }
            current = next;
        }
    });

    test('should return empty copy for empty input', () => {
        expect(chaikinSmoothSegment([], 2)).toEqual([]);
    });

    test('should return copy for single point', () => {
        const single = [stationA];
        expect(chaikinSmoothSegment(single, 2)).toEqual(single);
    });

    test('should handle 0 iterations', () => {
        const coords = [stationA, stationB, stationC];
        const result = chaikinSmoothSegment(coords, 0);
        expect(result).toEqual(coords);
    });
});

describe('chaikinSmoothPath', () => {
    test('should return empty waypoints for 2-point segment', () => {
        expect(chaikinSmoothPath([stationA, stationC], [0], 2)).toEqual([[]]);
    });

    test('should smooth a single coarse segment and return intermediate waypoints only', () => {
        const coords = [stationA, stationB, stationC];
        const result = chaikinSmoothPath(coords, [0], 1);

        expect(result).toHaveLength(1);
        const waypoints = result[0];
        expect(waypoints.length).toBeGreaterThan(0);
        expect(waypoints[0]).not.toEqual(stationA);
        expect(waypoints[waypoints.length - 1]).not.toEqual(stationC);
    });

    test('should skip already-smooth segments while smoothing coarse ones', () => {
        // Segment 0: dense curve (already smooth)
        const denseSegment = buildDenseCurve(stationA, stationB, 40);
        // Segment 1: coarse (only 3 wide-spaced points)
        const coarseMiddle: [number, number] = [-73.605, 45.510];
        const coarseSegment = [stationB, coarseMiddle, stationC];

        const fullCoords = [...denseSegment, ...coarseSegment.slice(1)];
        const nodeIndices = [0, denseSegment.length - 1];

        const result = chaikinSmoothPath(fullCoords, nodeIndices, 2);
        expect(result).toHaveLength(2);

        // Segment 0: already smooth -> waypoints unchanged from original
        const originalSeg0Waypoints = denseSegment.slice(1, -1);
        expect(result[0]).toEqual(originalSeg0Waypoints);

        // Segment 1: coarse -> should have been smoothed (more waypoints)
        expect(result[1].length).toBeGreaterThan(1);
    });

    test('should smooth multiple coarse segments independently', () => {
        const mid1: [number, number] = [-73.615, 45.508];
        const mid2: [number, number] = [-73.605, 45.508];
        const coords = [stationA, mid1, stationB, mid2, stationC];
        const result = chaikinSmoothPath(coords, [0, 2], 1);

        expect(result).toHaveLength(2);
        expect(result[0].length).toBeGreaterThan(0);
        expect(result[1].length).toBeGreaterThan(0);
    });

    test('should preserve node positions (not included in waypoints)', () => {
        const mid: [number, number] = [-73.615, 45.508];
        const coords = [stationA, mid, stationB, mid, stationC];
        const result = chaikinSmoothPath(coords, [0, 2], 1);

        expect(result).toHaveLength(2);
        for (const wp of result[0]) {
            expect(wp).not.toEqual(stationA);
            expect(wp).not.toEqual(stationB);
        }
        for (const wp of result[1]) {
            expect(wp).not.toEqual(stationB);
            expect(wp).not.toEqual(stationC);
        }
    });

    test('should handle single node index (whole path is one segment)', () => {
        const mid1: [number, number] = [-73.616, 45.504];
        const mid2: [number, number] = [-73.612, 45.508];
        const mid3: [number, number] = [-73.608, 45.504];
        const coords = [stationA, mid1, mid2, mid3, stationC];
        const result = chaikinSmoothPath(coords, [0], 2);

        expect(result).toHaveLength(1);
        expect(result[0].length).toBeGreaterThan(0);
    });
});
