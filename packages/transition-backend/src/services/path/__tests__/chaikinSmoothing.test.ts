/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { chaikinSmoothPath } from '../chaikinSmoothing';

// Realistic coordinates in the Montreal area (lon, lat).
// Large spacing (~1.5 km) with a sharp 90° turn at stationB.
const stationA: [number, number] = [-73.62, 45.5];
const stationB: [number, number] = [-73.61, 45.51];
const stationC: [number, number] = [-73.6, 45.5];

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

const denseCurve = buildDenseCurve(stationA, stationC, 60);
const nearlyStraight: [number, number][] = [
    [-73.62, 45.5],
    [-73.61, 45.5002],
    [-73.6, 45.5]
];
const coarseThree = [stationA, stationB, stationC];

describe('chaikinSmoothPath', () => {
    test.each([
        ['two-point segment', [stationA, stationC], [0], 2, [[]]],
        ['empty coordinates', [], [0], 2, [[]]],
        ['single point', [stationA], [0], 2, [[]]]
    ])('should return empty waypoints for %s', (_name, coords, nodeIndices, iterations, expected) => {
        expect(chaikinSmoothPath(coords, nodeIndices, iterations)).toEqual(expected);
    });

    test.each([
        ['already-dense curve', denseCurve, 5, denseCurve.slice(1, -1)],
        ['nearly straight widely-spaced path', nearlyStraight, 5, [nearlyStraight[1]]],
        ['0 iterations on coarse geometry', coarseThree, 0, [stationB]]
    ])('should leave intermediates unchanged for %s', (_name, coords, iterations, expectedWaypoints) => {
        expect(chaikinSmoothPath(coords, [0], iterations)[0]).toEqual(expectedWaypoints);
    });

    test('should apply Chaikin ratios for 1 iteration on 3 coarse points', () => {
        const [r0, q1] = chaikinSmoothPath(coarseThree, [0], 1)[0];

        // R_0 = 1/4 * A + 3/4 * B
        expect(r0[0]).toBeCloseTo(0.25 * stationA[0] + 0.75 * stationB[0], 10);
        expect(r0[1]).toBeCloseTo(0.25 * stationA[1] + 0.75 * stationB[1], 10);
        // Q_1 = 3/4 * B + 1/4 * C
        expect(q1[0]).toBeCloseTo(0.75 * stationB[0] + 0.25 * stationC[0], 10);
        expect(q1[1]).toBeCloseTo(0.75 * stationB[1] + 0.25 * stationC[1], 10);
    });

    test('should add waypoints on coarse geometry and omit node endpoints', () => {
        const waypoints = chaikinSmoothPath(coarseThree, [0], 1)[0];

        expect(waypoints.length).toBeGreaterThan(0);
        expect(waypoints[0]).not.toEqual(stationA);
        expect(waypoints[waypoints.length - 1]).not.toEqual(stationC);
    });

    test('should stop growing after repeated calls once geometry is no longer coarse', () => {
        let coords: [number, number][] = coarseThree;

        for (let run = 0; run < 8; run++) {
            const waypoints = chaikinSmoothPath(coords, [0], 2)[0] as [number, number][];
            const next: [number, number][] = [coords[0], ...waypoints, coords[coords.length - 1]];
            if (next.length === coords.length) {
                expect(next).toEqual(coords);
                return;
            }
            coords = next;
        }

        throw new Error('smoothing did not stabilize');
    });

    test('should skip already-smooth segments while smoothing coarse ones', () => {
        const denseSegment = buildDenseCurve(stationA, stationB, 40);
        const coarseMiddle: [number, number] = [-73.605, 45.51];
        const coarseSegment = [stationB, coarseMiddle, stationC];
        const fullCoords = [...denseSegment, ...coarseSegment.slice(1)];
        const nodeIndices = [0, denseSegment.length - 1];

        const result = chaikinSmoothPath(fullCoords, nodeIndices, 2);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual(denseSegment.slice(1, -1));
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

    test('should not include node positions in waypoints', () => {
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
