/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import transitPathSmoothingRoutes from '../transitPathSmoothing.socketRoutes';

type SmoothPathResponse = {
    waypoints: [number, number][][];
};

const socketStub = new EventEmitter();
transitPathSmoothingRoutes(socketStub);

function emitSmoothPath(params: Record<string, unknown>): Promise<SmoothPathResponse> {
    return new Promise((resolve, reject) => {
        socketStub.emit(
            'transitPaths.smoothPath',
            params,
            (status: Status.Status<SmoothPathResponse>) => {
                try {
                    if (Status.isStatusError(status)) {
                        reject(new Error(`API returned error: ${status.error}`));
                        return;
                    }
                    resolve(Status.unwrap(status) as SmoothPathResponse);
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}

// Realistic Montreal-area stations (~1 km apart)
const stationA: [number, number] = [-73.620, 45.500];
const stationB: [number, number] = [-73.610, 45.510];
const stationC: [number, number] = [-73.600, 45.500];

// Dense waypoints approximating a smooth curve (~30 m apart)
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

describe('transitPaths.smoothPath', () => {
    test('should return empty waypoints for empty coordinates', async () => {
        const result = await emitSmoothPath({
            coordinates: [],
            nodeIndices: []
        });
        expect(result.waypoints).toEqual([]);
    });

    test('should return empty waypoints for only 2 coordinates', async () => {
        const result = await emitSmoothPath({
            coordinates: [stationA, stationC],
            nodeIndices: [0]
        });
        expect(result.waypoints).toEqual([[]]);
    });

    test('should return empty waypoints for null coordinates', async () => {
        const result = await emitSmoothPath({
            coordinates: null,
            nodeIndices: [0]
        });
        expect(result.waypoints).toEqual([]);
    });

    test('should smooth a single coarse segment with 3 points', async () => {
        const result = await emitSmoothPath({
            coordinates: [stationA, stationB, stationC],
            nodeIndices: [0],
            iterations: 1
        });

        expect(result.waypoints).toHaveLength(1);
        const wps = result.waypoints[0];
        expect(wps.length).toBe(2);
        // R_0 and Q_1 from Chaikin's
        expect(wps[0][0]).toBeCloseTo(0.25 * stationA[0] + 0.75 * stationB[0]);
        expect(wps[0][1]).toBeCloseTo(0.25 * stationA[1] + 0.75 * stationB[1]);
        expect(wps[1][0]).toBeCloseTo(0.75 * stationB[0] + 0.25 * stationC[0]);
        expect(wps[1][1]).toBeCloseTo(0.75 * stationB[1] + 0.25 * stationC[1]);
    });

    test('should smooth a path with two coarse segments', async () => {
        const mid1: [number, number] = [-73.615, 45.508];
        const mid2: [number, number] = [-73.605, 45.508];
        const coords: [number, number][] = [stationA, mid1, stationB, mid2, stationC];
        const result = await emitSmoothPath({
            coordinates: coords,
            nodeIndices: [0, 2],
            iterations: 1
        });

        expect(result.waypoints).toHaveLength(2);
        expect(result.waypoints[0].length).toBeGreaterThan(0);
        expect(result.waypoints[1].length).toBeGreaterThan(0);
    });

    test('should not include node endpoints in waypoints', async () => {
        const mid: [number, number] = [-73.615, 45.508];
        const result = await emitSmoothPath({
            coordinates: [stationA, mid, stationC],
            nodeIndices: [0],
            iterations: 1
        });

        const wps = result.waypoints[0];
        for (const wp of wps) {
            expect(wp).not.toEqual(stationA);
            expect(wp).not.toEqual(stationC);
        }
    });

    test('should skip already-smooth segments (convergence)', async () => {
        const denseCurve = buildDenseCurve(stationA, stationC, 60);
        const result = await emitSmoothPath({
            coordinates: denseCurve,
            nodeIndices: [0],
            iterations: 3
        });

        expect(result.waypoints).toHaveLength(1);
        // Dense curve is already smooth, so waypoints are the original intermediates unchanged
        const originalIntermediates = denseCurve.slice(1, -1);
        expect(result.waypoints[0]).toEqual(originalIntermediates);
    });

    test('should not modify an already-smooth path', async () => {
        // Build a path that is already smooth (dense, gentle curve)
        const denseCurve = buildDenseCurve(stationA, stationC, 40);
        const originalIntermediates = denseCurve.slice(1, -1);

        const result = await emitSmoothPath({
            coordinates: denseCurve,
            nodeIndices: [0],
            iterations: 2
        });

        // Already smooth -> returned unchanged
        expect(result.waypoints[0]).toEqual(originalIntermediates);
    });

    test('should eventually stabilize on repeated calls', async () => {
        const mid: [number, number] = [-73.615, 45.508];
        let coords: [number, number][] = [stationA, mid, stationC];

        let prevLength = 0;
        for (let run = 0; run < 10; run++) {
            const result = await emitSmoothPath({
                coordinates: coords,
                nodeIndices: [0],
                iterations: 2
            });
            const wpCount = result.waypoints[0].length;
            if (wpCount === prevLength) {
                // Converged: no more points added
                break;
            }
            expect(run).toBeLessThan(9); // Must stabilize within 10 runs
            prevLength = wpCount;
            coords = [stationA, ...result.waypoints[0], stationC];
        }
    });

    test('should default to 2 iterations when not specified', async () => {
        const mid: [number, number] = [-73.615, 45.508];
        const resultDefault = await emitSmoothPath({
            coordinates: [stationA, mid, stationC],
            nodeIndices: [0]
        });
        const resultExplicit = await emitSmoothPath({
            coordinates: [stationA, mid, stationC],
            nodeIndices: [0],
            iterations: 2
        });

        expect(resultDefault.waypoints[0].length).toBe(resultExplicit.waypoints[0].length);
        expect(resultDefault.waypoints[0]).toEqual(resultExplicit.waypoints[0]);
    });

    test('should handle segment with no intermediate waypoints (2-point segment)', async () => {
        const mid: [number, number] = [-73.615, 45.508];
        const result = await emitSmoothPath({
            coordinates: [stationA, stationB, mid, stationC],
            nodeIndices: [0, 1],
            iterations: 2
        });

        expect(result.waypoints).toHaveLength(2);
        // First segment: 2 points (no intermediate) -> empty
        expect(result.waypoints[0]).toEqual([]);
        // Second segment: 3 points (coarse) -> has waypoints
        expect(result.waypoints[1].length).toBeGreaterThan(0);
    });
});
