/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import type { Position } from 'geojson';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import type { CurveAnalysisResponse } from 'transition-common/lib/services/path/railCurves/types';
import { getDefaultRunningSpeedKmH } from 'transition-common/lib/services/line/types';
import transitPathCurvesRoutes from '../transitPathCurves.socketRoutes';

const socketStub = new EventEmitter();
transitPathCurvesRoutes(socketStub);

const emitCurveAnalysis = (params: Record<string, unknown>): Promise<Status.Status<CurveAnalysisResponse>> =>
    new Promise((resolve) => socketStub.emit('transitPaths.curveAnalysis', params, resolve));

const emitAndUnwrap = async (params: Record<string, unknown>): Promise<CurveAnalysisResponse> => {
    const status = await emitCurveAnalysis(params);
    if (Status.isStatusError(status)) {
        throw new Error(`API returned error: ${status.error}`);
    }
    return Status.unwrap(status);
};

/** Smooth arc between two points, with small deflection angles at every vertex */
const buildSmoothArc = (start: Position, end: Position, n: number): Position[] => {
    const coords: Position[] = [start];
    for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        coords.push([
            start[0] + t * (end[0] - start[0]),
            start[1] + t * (end[1] - start[1]) + 0.0005 * Math.sin(Math.PI * t)
        ]);
    }
    coords.push(end);
    return coords;
};

const smoothArc = buildSmoothArc([-73.745618, 45.368994], [-73.731251, 45.368103], 20);
// Right angles every ~1 km: too coarse for a reliable radius
const coarseCoords: Position[] = [
    [-73.75, 45.37],
    [-73.74, 45.37],
    [-73.74, 45.36],
    [-73.73, 45.36]
];
const lineString = (coordinates: Position[]) => ({ type: 'LineString', coordinates });

describe('transitPaths.curveAnalysis', () => {
    test.each([
        { label: 'empty', coordinates: [] },
        { label: 'single-point', coordinates: [smoothArc[0]] },
        { label: '2-point', coordinates: smoothArc.slice(0, 2) }
    ])('returns no analysis for $label geography', async ({ coordinates }) => {
        const result = await emitAndUnwrap({ mode: 'rail', geography: lineString(coordinates) });
        expect(result).toEqual({ curveRadius: null, largeAngleVertices: [] });
    });

    test.each([
        { mode: 'rail' },
        { mode: 'tram' },
        { mode: 'metro' },
        { mode: 'highSpeedRail' },
        { mode: 'tramTrain' }
    ])('analyzes a smooth $mode path without large angle vertices', async ({ mode }) => {
        const result = await emitAndUnwrap({ mode, runningSpeedKmH: 80, geography: lineString(smoothArc) });
        expect(result.curveRadius?.radiiAtVertices.length).toBe(smoothArc.length);
        expect(result.largeAngleVertices).toEqual([]);
    });

    test('flags large angle vertices for coarse geometry', async () => {
        const result = await emitAndUnwrap({ mode: 'rail', geography: lineString(coarseCoords) });
        expect(result.largeAngleVertices.map((vertex) => vertex.properties?.index)).toEqual([1, 2]);
        expect(result.largeAngleVertices[0].properties).toEqual(
            expect.objectContaining({ angle: 90, spacingMeters: expect.any(Number) })
        );
    });

    test.each([
        { label: 'bus', mode: 'bus' },
        { label: 'unknown string', mode: 'airplane' },
        { label: 'missing', mode: undefined },
        { label: 'non-string', mode: 42 }
    ])('rejects a $label mode', async ({ mode }) => {
        const status = await emitCurveAnalysis({ mode, geography: lineString(smoothArc) });
        expect(Status.isStatusError(status)).toBe(true);
    });

    test.each([
        { label: 'zero', runningSpeedKmH: 0 },
        { label: 'negative', runningSpeedKmH: -10 },
        { label: 'NaN', runningSpeedKmH: Number.NaN },
        { label: 'infinite', runningSpeedKmH: Number.POSITIVE_INFINITY },
        { label: 'string', runningSpeedKmH: '80' }
    ])('replaces a $label running speed with the mode default', async ({ runningSpeedKmH }) => {
        const params = { mode: 'tram', geography: lineString(smoothArc) };
        const withDefault = await emitAndUnwrap({ ...params, runningSpeedKmH: getDefaultRunningSpeedKmH('tram') });
        const withInvalid = await emitAndUnwrap({ ...params, runningSpeedKmH });
        expect(withInvalid).toEqual(withDefault);
    });
});
