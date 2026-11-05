/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';
import type { Position } from 'geojson';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import type { CurveAnalysisResponse } from 'transition-common/lib/services/path/railCurves/types';
import transitRoutes from '../transitPaths.socketRoutes';
import transitPathQueries from '../../models/db/transitPaths.db.queries';

const socketStub = new EventEmitter();
transitRoutes(socketStub);

const mockedDbQuery = jest.fn();

jest.mock('../../models/db/transitPaths.db.queries', () => {
    return {
        geojsonCollection: jest.fn(),
        geojsonCollectionForServices: jest.fn()
    }
});

const mockedGeojsonCollection = transitPathQueries.geojsonCollection as jest.MockedFunction<typeof transitPathQueries.geojsonCollection>;
const mockedCollectionForService = transitPathQueries.geojsonCollectionForServices as jest.MockedFunction<typeof transitPathQueries.geojsonCollectionForServices>;

describe('Schedules: get paths for scenario', () => {

    const scenarioId = uuidV4();

    test('Get paths for scenario correctly', (done) => {
        const pathsGeojsonAttributes = {
            type: 'FeatureCollection' as const,
            features: [
                {
                    type: 'Feature'  as const,
                    properties: {},
                    id: 1,
                    geometry: { type: 'LineString' as const, coordinates: [[-73, 45], [-73.1, 45.1]]}    
                }
            ]
        }
        ;
        mockedGeojsonCollection.mockResolvedValueOnce(pathsGeojsonAttributes);
        socketStub.emit('transitPaths.getForScenario', scenarioId, function (status) {
            expect(Status.isStatusOk(status));
            expect(Status.unwrap(status)).toEqual(pathsGeojsonAttributes);
            expect(mockedGeojsonCollection).toHaveBeenLastCalledWith({ scenarioId });
            done();
        });
    });

    test('Get paths for scenario with error', (done) => {
        mockedGeojsonCollection.mockRejectedValueOnce('DB error');
        socketStub.emit('transitPaths.getForScenario', scenarioId, function (status) {
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect((status as any).error).toBe('Error getting paths for scenario');
            expect(mockedGeojsonCollection).toHaveBeenLastCalledWith({ scenarioId });
            done();
        });
    });
});

describe('Schedules: get paths for services', () => {

    const serviceIds = [uuidV4(), uuidV4()];

    test('Get paths for services correctly', (done) => {
        const pathsGeojsonAttributes = {
            type: 'FeatureCollection' as const,
            features: [
                {
                    type: 'Feature'  as const,
                    properties: {},
                    id: 1,
                    geometry: { type: 'LineString' as const, coordinates: [[-73.2, 45.2], [-73.1, 45.1]]}    
                }
            ]
        }
        ;
        mockedCollectionForService.mockResolvedValueOnce(pathsGeojsonAttributes);
        socketStub.emit('transitPaths.getForServices', serviceIds, function (status) {
            expect(Status.isStatusOk(status));
            expect(Status.unwrap(status)).toEqual(pathsGeojsonAttributes);
            expect(mockedCollectionForService).toHaveBeenLastCalledWith(serviceIds);
            done();
        });
    });

    test('Get paths for services with error', (done) => {
        mockedGeojsonCollection.mockRejectedValueOnce('DB error');
        socketStub.emit('transitPaths.getForServices', serviceIds, function (status) {
            expect(!Status.isStatusOk(status)).toBe(true);
            expect(Status.isStatusError(status)).toBe(true);
            expect(mockedCollectionForService).toHaveBeenLastCalledWith(serviceIds);
            expect((status as any).error).toBe('Error getting paths for services');
            done();
        });
    });
});

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
        const result = await emitAndUnwrap({ mode: 'rail', runningSpeedKmH: 90, geography: lineString(coordinates) });
        expect(result).toEqual({ segments: [], unreliableRadiusVertices: [] });
    });

    test.each([
        { mode: 'rail' },
        { mode: 'tram' },
        { mode: 'metro' },
        { mode: 'highSpeedRail' },
        { mode: 'tramTrain' }
    ])('analyzes a smooth $mode path without unreliable radius vertices', async ({ mode }) => {
        const result = await emitAndUnwrap({ mode, runningSpeedKmH: 80, geography: lineString(smoothArc) });
        // The radius of the arc does not limit the speed at 80 km/h: a single straight-like segment
        expect(result.segments.map(({ startIndex, endIndex, type }) => ({ startIndex, endIndex, type }))).toEqual([
            { startIndex: 0, endIndex: smoothArc.length - 1, type: 'straight' }
        ]);
        expect(result.unreliableRadiusVertices).toEqual([]);
    });

    test('returns the vertices of a coarse geometry as unreliable radius vertices', async () => {
        const result = await emitAndUnwrap({ mode: 'rail', runningSpeedKmH: 90, geography: lineString(coarseCoords) });
        expect(result.unreliableRadiusVertices.map((vertex) => vertex.geometry.coordinates)).toEqual([
            coarseCoords[1],
            coarseCoords[2]
        ]);
    });

    test.each([null, undefined])('returns an error status for a %p payload', async (payload) => {
        const status = await new Promise<Status.Status<CurveAnalysisResponse>>((resolve) =>
            socketStub.emit('transitPaths.curveAnalysis', payload, resolve)
        );
        expect(Status.isStatusError(status)).toBe(true);
    });

    test.each([
        { label: 'bus', mode: 'bus' },
        { label: 'unknown string', mode: 'airplane' },
        { label: 'missing', mode: undefined },
        { label: 'non-string', mode: 42 }
    ])('rejects a $label mode', async ({ mode }) => {
        const status = await emitCurveAnalysis({ mode, runningSpeedKmH: 90, geography: lineString(smoothArc) });
        expect(Status.isStatusError(status)).toBe(true);
    });

    test.each([
        { label: 'missing', runningSpeedKmH: undefined },
        { label: 'zero', runningSpeedKmH: 0 },
        { label: 'negative', runningSpeedKmH: -10 },
        { label: 'NaN', runningSpeedKmH: Number.NaN },
        { label: 'infinite', runningSpeedKmH: Number.POSITIVE_INFINITY },
        { label: 'string', runningSpeedKmH: '80' }
    ])('rejects a $label running speed', async ({ runningSpeedKmH }) => {
        const status = await emitCurveAnalysis({ mode: 'tram', runningSpeedKmH, geography: lineString(smoothArc) });
        expect(Status.isStatusError(status)).toBe(true);
    });
});
