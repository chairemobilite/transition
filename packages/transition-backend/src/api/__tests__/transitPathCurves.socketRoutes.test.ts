/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { LineString } from 'geojson';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import type {
    CurveRadiusAnalysis,
    PathTravelTimeAnalysis,
    TimeSpeedProfile
} from 'transition-common/lib/services/path/railCurves/types';
import type { Feature, Point } from 'geojson';
import transitPathCurvesRoutes from '../transitPathCurves.socketRoutes';

type CurveAnalysisResponse = {
    travelTimeAnalysis: PathTravelTimeAnalysis | null;
    speedProfile: TimeSpeedProfile | null;
    curveRadius: CurveRadiusAnalysis | null;
    largeAngleVertices: Feature<Point>[] | null;
};

const socketStub = new EventEmitter();
transitPathCurvesRoutes(socketStub);

/**
 * Wraps the socket emit in a promise so assertion failures
 * propagate correctly instead of being caught by the route handler.
 */
function emitCurveAnalysis(params: Record<string, unknown>): Promise<CurveAnalysisResponse> {
    return new Promise((resolve, reject) => {
        socketStub.emit(
            'transitPaths.curveAnalysis',
            params,
            (status: Status.Status<CurveAnalysisResponse>) => {
                try {
                    if (Status.isStatusError(status)) {
                        reject(new Error(`API returned error: ${status.error}`));
                        return;
                    }
                    resolve(Status.unwrap(status) as CurveAnalysisResponse);
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}

/**
 * Build a smooth arc between two points with n intermediate waypoints.
 * Small deflection angles so geometry is classified as 'high' resolution.
 */
function buildSmoothArc(
    start: [number, number],
    end: [number, number],
    n: number
): [number, number][] {
    const coords: [number, number][] = [start];
    for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const lng = start[0] + t * (end[0] - start[0]);
        const lat = start[1] + t * (end[1] - start[1]) + 0.0005 * Math.sin(Math.PI * t);
        coords.push([lng, lat]);
    }
    coords.push(end);
    return coords;
}

const stationA: [number, number] = [-73.745618, 45.368994];
const stationB: [number, number] = [-73.731251, 45.368103];
const stationC: [number, number] = [-73.725000, 45.372000];

const smoothArcAB = buildSmoothArc(stationA, stationB, 20);
const smoothArcBC = buildSmoothArc(stationB, stationC, 15);
const fullCoords = [...smoothArcAB, ...smoothArcBC.slice(1)];

const stationBIndex = smoothArcAB.length - 1;

const twoSegmentGeography: LineString = {
    type: 'LineString',
    coordinates: fullCoords
};

const singleSegmentGeography: LineString = {
    type: 'LineString',
    coordinates: smoothArcAB
};

const defaultParams = {
    mode: 'rail' as const,
    runningSpeedKmH: 80,
    accelerationMps2: 0.5,
    decelerationMps2: 0.8
};

describe('transitPaths.curveAnalysis', () => {

    test('should return all null fields for empty geography', async () => {
        const result = await emitCurveAnalysis({
            ...defaultParams,
            geography: { type: 'LineString', coordinates: [] },
            segments: [0, 0],
            dwellTimeSeconds: [0, 0]
        });
        expect(result.travelTimeAnalysis).toBeNull();
        expect(result.speedProfile).toBeNull();
        expect(result.curveRadius).toBeNull();
        expect(result.largeAngleVertices).toBeNull();
    });

    test('should return all null fields for single-point geography', async () => {
        const result = await emitCurveAnalysis({
            ...defaultParams,
            geography: { type: 'LineString', coordinates: [stationA] },
            segments: [0, 0],
            dwellTimeSeconds: [0, 0]
        });
        expect(result.travelTimeAnalysis).toBeNull();
        expect(result.speedProfile).toBeNull();
        expect(result.curveRadius).toBeNull();
        expect(result.largeAngleVertices).toBeNull();
    });

    test('should return valid analysis for a two-segment path (3 stations)', async () => {
        const result = await emitCurveAnalysis({
            ...defaultParams,
            geography: twoSegmentGeography,
            segments: [0, stationBIndex],
            dwellTimeSeconds: [0, 30, 0]
        });

        expect(result.travelTimeAnalysis).not.toBeNull();
        expect(result.travelTimeAnalysis!.segments.length).toBe(2);
        expect(result.travelTimeAnalysis!.segments[0].segmentIndex).toBe(0);
        expect(result.travelTimeAnalysis!.segments[1].segmentIndex).toBe(1);
        expect(result.travelTimeAnalysis!.segments[0].distanceMeters).toBeGreaterThan(0);
        expect(result.travelTimeAnalysis!.segments[1].distanceMeters).toBeGreaterThan(0);
        expect(result.travelTimeAnalysis!.totalDistanceMeters).toBeGreaterThan(0);
        expect(result.travelTimeAnalysis!.totalTimeWithCurvesSeconds).toBeGreaterThan(0);
        expect(result.travelTimeAnalysis!.totalTimeWithoutCurvesSeconds).toBeGreaterThan(0);
        expect(result.travelTimeAnalysis!.geometryResolution).toBeDefined();

        expect(result.speedProfile).not.toBeNull();
        expect(result.speedProfile!.segmentCount).toBe(2);
        expect(result.speedProfile!.totalDwellTimeSeconds).toBe(30);
        expect(result.speedProfile!.points.length).toBeGreaterThan(0);
        expect(result.speedProfile!.totalTimeSeconds).toBeGreaterThan(0);
        expect(result.speedProfile!.totalDistanceMeters).toBeGreaterThan(0);

        expect(result.curveRadius).not.toBeNull();
        expect(result.curveRadius!.radiiAtVertices.length).toBe(fullCoords.length);

        expect(result.largeAngleVertices).not.toBeNull();
        expect(Array.isArray(result.largeAngleVertices)).toBe(true);
    });

    test('should return valid analysis for a three-segment path (4 stations)', async () => {
        const stationD: [number, number] = [-73.720000, 45.375000];
        const arcCD = buildSmoothArc(stationC, stationD, 12);
        const threeSegCoords = [...fullCoords, ...arcCD.slice(1)];
        const stationCIndex = fullCoords.length - 1;

        const result = await emitCurveAnalysis({
            ...defaultParams,
            geography: { type: 'LineString', coordinates: threeSegCoords },
            segments: [0, stationBIndex, stationCIndex],
            dwellTimeSeconds: [0, 20, 15, 0]
        });

        expect(result.travelTimeAnalysis).not.toBeNull();
        expect(result.travelTimeAnalysis!.segments.length).toBe(3);
        expect(result.travelTimeAnalysis!.segments[2].segmentIndex).toBe(2);

        expect(result.speedProfile).not.toBeNull();
        expect(result.speedProfile!.segmentCount).toBe(3);
        expect(result.speedProfile!.totalDwellTimeSeconds).toBe(35);
    });

    test('should return null curveRadius for 2-point geometry', async () => {
        const result = await emitCurveAnalysis({
            ...defaultParams,
            geography: {
                type: 'LineString',
                coordinates: [stationA, stationB]
            },
            segments: [0, 1],
            dwellTimeSeconds: [0, 0, 0]
        });

        expect(result.travelTimeAnalysis).toBeNull();
        expect(result.curveRadius).toBeNull();
        expect(result.largeAngleVertices).toEqual([]);
    });

    test('should return speed profile even when travelTimeAnalysis is null (single segment)', async () => {
        const result = await emitCurveAnalysis({
            ...defaultParams,
            geography: singleSegmentGeography,
            segments: [0],
            dwellTimeSeconds: [0, 0]
        });

        expect(result.travelTimeAnalysis).toBeNull();
        expect(result.speedProfile).not.toBeNull();
        expect(result.speedProfile!.points.length).toBeGreaterThan(0);
        expect(result.speedProfile!.totalTimeSeconds).toBeGreaterThan(0);

        expect(result.curveRadius).not.toBeNull();
        expect(result.curveRadius!.radiiAtVertices.length).toBe(smoothArcAB.length);
    });

    test.each([
        { mode: 'rail' as const, label: 'rail' },
        { mode: 'tram' as const, label: 'tram' },
        { mode: 'metro' as const, label: 'metro' },
        { mode: 'highSpeedRail' as const, label: 'highSpeedRail' },
        { mode: 'tramTrain' as const, label: 'tramTrain' }
    ])('should accept $label mode', async ({ mode }) => {
        const result = await emitCurveAnalysis({
            ...defaultParams,
            mode,
            geography: twoSegmentGeography,
            segments: [0, stationBIndex],
            dwellTimeSeconds: [0, 10, 0]
        });
        expect(result.travelTimeAnalysis).not.toBeNull();
        expect(result.curveRadius).not.toBeNull();
    });

    test('should detect large angle vertices for coarse geometry', async () => {
        const coarseCoords: [number, number][] = [
            [-73.75, 45.37],
            [-73.74, 45.37],
            [-73.74, 45.36],
            [-73.73, 45.36]
        ];
        const result = await emitCurveAnalysis({
            ...defaultParams,
            geography: {
                type: 'LineString',
                coordinates: coarseCoords
            },
            segments: [0, 2],
            dwellTimeSeconds: [0, 0, 0]
        });

        expect(result.largeAngleVertices).not.toBeNull();
        expect(result.largeAngleVertices!.length).toBeGreaterThan(0);
        const vertex = result.largeAngleVertices![0];
        expect(vertex.geometry.type).toBe('Point');
        expect(vertex.properties).toHaveProperty('angle');
        expect(vertex.properties).toHaveProperty('spacingMeters');
        expect(vertex.properties).toHaveProperty('index');
    });

    test('speed profile should respect dwell times', async () => {
        const noDwell = await emitCurveAnalysis({
            ...defaultParams,
            geography: twoSegmentGeography,
            segments: [0, stationBIndex],
            dwellTimeSeconds: [0, 0, 0]
        });

        const withDwell = await emitCurveAnalysis({
            ...defaultParams,
            geography: twoSegmentGeography,
            segments: [0, stationBIndex],
            dwellTimeSeconds: [0, 60, 0]
        });

        expect(noDwell.speedProfile).not.toBeNull();
        expect(withDwell.speedProfile).not.toBeNull();
        expect(withDwell.speedProfile!.totalDwellTimeSeconds).toBe(60);
        expect(noDwell.speedProfile!.totalDwellTimeSeconds).toBe(0);
        expect(withDwell.speedProfile!.totalTimeSeconds)
            .toBeGreaterThan(noDwell.speedProfile!.totalTimeSeconds);
    });

    test('higher running speed should not increase travel time', async () => {
        const slowResult = await emitCurveAnalysis({
            ...defaultParams,
            runningSpeedKmH: 40,
            geography: twoSegmentGeography,
            segments: [0, stationBIndex],
            dwellTimeSeconds: [0, 0, 0]
        });

        const fastResult = await emitCurveAnalysis({
            ...defaultParams,
            runningSpeedKmH: 120,
            geography: twoSegmentGeography,
            segments: [0, stationBIndex],
            dwellTimeSeconds: [0, 0, 0]
        });

        expect(slowResult.travelTimeAnalysis).not.toBeNull();
        expect(fastResult.travelTimeAnalysis).not.toBeNull();
        expect(slowResult.travelTimeAnalysis!.totalTimeWithCurvesSeconds)
            .toBeGreaterThanOrEqual(fastResult.travelTimeAnalysis!.totalTimeWithCurvesSeconds);
    });
});
