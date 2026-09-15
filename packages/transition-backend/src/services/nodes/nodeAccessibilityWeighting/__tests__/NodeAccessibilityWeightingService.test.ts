/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
    executeNodeAccessibilityWeighting,
    INPUT_FILENAME,
    loadPartialCheckpointBundle,
    removePartialWeightsFile,
    resolveWeightsFilePath,
    savePartialWeightsMapAtomic,
    weightsFilenameForJob
} from '../NodeAccessibilityWeightingService';
import type { WeightingExecutionConfig, ExecutionCallbacks } from '../NodeAccessibilityWeightingService';
import { calculateBatchAccessibilityWeights } from '../BatchAccessibilityWeightCalculator';
import transitNodesDbQueries from '../../../../models/db/transitNodes.db.queries';

jest.mock('chaire-lib-backend/lib/utils/osrm/OSRMService', () => ({ default: {} }));
jest.mock('chaire-lib-backend/lib/config/server.config', () => ({
    __esModule: true,
    default: { maxParallelCalculators: 2 }
}));
jest.mock('../../../../models/db/transitNodes.db.queries');
jest.mock('../BatchAccessibilityWeightCalculator');

const mockCalc = calculateBatchAccessibilityWeights as jest.MockedFunction<typeof calculateBatchAccessibilityWeights>;
const mockNodesDb = transitNodesDbQueries as jest.Mocked<typeof transitNodesDbQueries>;

const MOCK_NODE_COLLECTION = {
    type: 'FeatureCollection' as const,
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.6, 45.5] }, properties: { id: 'node-1' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.7, 45.6] }, properties: { id: 'node-2' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.8, 45.7] }, properties: { id: 'node-3' } }
    ]
};

/** Default output basename when execute omits `weightsOutputFilename` (see service). */
const DEFAULT_EXECUTE_WEIGHTS_BASENAME = weightsFilenameForJob(1);

describe('NodeAccessibilityWeightingService', () => {
    let tmpDir: string;

    test('weightsFilenameForJob and resolveWeightsFilePath use per-job file only', () => {
        expect(weightsFilenameForJob(1234)).toBe('node_weights_1234.csv');
        expect(resolveWeightsFilePath(tmpDir, 9)).toBe(undefined);
        fs.writeFileSync(path.join(tmpDir, weightsFilenameForJob(8)), 'x', 'utf-8');
        expect(resolveWeightsFilePath(tmpDir, 9)).toBe(undefined);
        fs.writeFileSync(path.join(tmpDir, weightsFilenameForJob(9)), 'y', 'utf-8');
        expect(resolveWeightsFilePath(tmpDir, 9)).toBe(path.join(tmpDir, weightsFilenameForJob(9)));
    });

    const makeCallbacks = (overrides?: Partial<ExecutionCallbacks>): ExecutionCallbacks => ({
        onProgress: jest.fn(),
        isCancelled: jest.fn().mockResolvedValue(false),
        ...overrides
    });

    const writeCsv = (content: string) => {
        fs.writeFileSync(path.join(tmpDir, INPUT_FILENAME), content, 'utf-8');
    };

    const readOutput = (): string => {
        return fs.readFileSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME), 'utf-8');
    };

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'naw-service-test-'));
        jest.clearAllMocks();
        mockNodesDb.geojsonCollection.mockResolvedValue(MOCK_NODE_COLLECTION as any);
        mockCalc.mockResolvedValue(new Map());
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // -------------------------------------------------------------------
    // Point extraction per input type
    // -------------------------------------------------------------------

    test.each([
        {
            inputType: 'poi' as const,
            mapping: { pointLat: 'lat', pointLon: 'lon' },
            csv: 'lat,lon\n45.5,-73.6\n45.6,-73.7\n',
            expectedCount: 2
        },
        {
            inputType: 'odOrigins' as const,
            mapping: { originLat: 'oLat', originLon: 'oLon' },
            csv: 'oLat,oLon,dLat,dLon\n45.5,-73.6,45.7,-73.8\n45.6,-73.7,45.8,-73.9\n',
            expectedCount: 2
        },
        {
            inputType: 'odDestinations' as const,
            mapping: { destinationLat: 'dLat', destinationLon: 'dLon' },
            csv: 'oLat,oLon,dLat,dLon\n45.5,-73.6,45.7,-73.8\n',
            expectedCount: 1
        },
        {
            inputType: 'odBoth' as const,
            mapping: { originLat: 'oLat', originLon: 'oLon', destinationLat: 'dLat', destinationLon: 'dLon' },
            csv: 'oLat,oLon,dLat,dLon\n45.5,-73.6,45.7,-73.8\n45.6,-73.7,45.8,-73.9\n',
            expectedCount: 4
        }
    ])('extracts $expectedCount points for inputType=$inputType', async ({ inputType, mapping, csv, expectedCount }) => {
        writeCsv(csv);
        const config: WeightingExecutionConfig = {
            weightingInputType: inputType,
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'exponential', beta: 0.001 },
            weightingFileMapping: mapping
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        expect(mockCalc).toHaveBeenCalledTimes(1);
        const { points } = mockCalc.mock.calls[0][0];
        expect(points).toHaveLength(expectedCount);
    });

    // -------------------------------------------------------------------
    // Coordinate correctness
    // -------------------------------------------------------------------

    test('passes correct [lon, lat] coordinates from CSV', async () => {
        writeCsv('lat,lon\n45.512,-73.623\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'exponential', beta: 0.001 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        const point = mockCalc.mock.calls[0][0].points[0];
        expect(point.geometry.coordinates).toEqual([-73.623, 45.512]);
    });

    // -------------------------------------------------------------------
    // Intrinsic weight column
    // -------------------------------------------------------------------

    test('parses intrinsicWeight from CSV weight column', async () => {
        writeCsv('lat,lon,w\n45.5,-73.6,2.5\n45.6,-73.7,0.8\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon', weight: 'w' }
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        const { points } = mockCalc.mock.calls[0][0];
        expect(points[0].properties.intrinsicWeight).toBe(2.5);
        expect(points[1].properties.intrinsicWeight).toBe(0.8);
    });

    test('sets intrinsicWeight to undefined when weight column is absent', async () => {
        writeCsv('lat,lon\n45.5,-73.6\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        expect(mockCalc.mock.calls[0][0].points[0].properties.intrinsicWeight).toBeUndefined();
    });

    test('treats non-positive or non-numeric weight values as undefined', async () => {
        writeCsv('lat,lon,w\n45.5,-73.6,-1\n45.6,-73.7,abc\n45.7,-73.8,0\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon', weight: 'w' }
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        const { points } = mockCalc.mock.calls[0][0];
        expect(points).toHaveLength(3);
        for (const pt of points) {
            expect(pt.properties.intrinsicWeight).toBeUndefined();
        }
    });

    // -------------------------------------------------------------------
    // Invalid rows
    // -------------------------------------------------------------------

    test('skips rows with invalid or missing coordinates', async () => {
        writeCsv('lat,lon\n45.5,-73.6\nbadLat,-73.7\n45.6,\n\n45.7,-73.8\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        const { points } = mockCalc.mock.calls[0][0];
        expect(points).toHaveLength(2);
    });

    // -------------------------------------------------------------------
    // Multi-chunk streaming and weight accumulation
    // -------------------------------------------------------------------

    test('streams large CSV in multiple chunks and accumulates weights', async () => {
        const rows = ['lat,lon'];
        for (let i = 0; i < 7; i++) {
            rows.push(`${45.5 + i * 0.001},${-73.6 + i * 0.001}`);
        }
        writeCsv(rows.join('\n') + '\n');

        mockCalc
            .mockResolvedValueOnce(new Map([['node-1', 1.0], ['node-2', 0.5]]))
            .mockResolvedValueOnce(new Map([['node-1', 0.3], ['node-2', 0.2]]))
            .mockResolvedValueOnce(new Map([['node-1', 0.1]]));

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        const result = await executeNodeAccessibilityWeighting(
            tmpDir, config, makeCallbacks(), { chunkSize: 3 }
        );

        expect(mockCalc).toHaveBeenCalledTimes(3);
        expect(mockCalc.mock.calls[0][0].points).toHaveLength(3);
        expect(mockCalc.mock.calls[1][0].points).toHaveLength(3);
        expect(mockCalc.mock.calls[2][0].points).toHaveLength(1);

        expect(result.pointCount).toBe(7);
        expect(result.nodesWithWeight).toBe(2);
        expect(result.finishedNormally).toBe(true);

        const output = readOutput();
        const lines = output.trim().split('\n');
        expect(lines[0]).toBe('node_uuid,weight');

        const weightMap = new Map<string, number>();
        for (let i = 1; i < lines.length; i++) {
            const [id, w] = lines[i].split(',');
            weightMap.set(id, parseFloat(w));
        }
        expect(weightMap.get('node-1')).toBeCloseTo(1.4);
        expect(weightMap.get('node-2')).toBeCloseTo(0.7);
    });

    // -------------------------------------------------------------------
    // Output file format
    // -------------------------------------------------------------------

    test('writes only nodes with weight > 0 to output CSV', async () => {
        writeCsv('lat,lon\n45.5,-73.6\n');
        mockCalc.mockResolvedValue(new Map([
            ['node-1', 2.5],
            ['node-2', 0],
            ['node-3', 0.01]
        ]));

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        const result = await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        expect(result.finishedNormally).toBe(true);
        expect(result.nodesWithWeight).toBe(2);
        const output = readOutput();
        expect(output).toContain('node-1,2.5');
        expect(output).toContain('node-3,0.01');
        expect(output).not.toContain('node-2');
    });

    // -------------------------------------------------------------------
    // Progress callbacks
    // -------------------------------------------------------------------

    test('reports cumulative progress across chunks', async () => {
        const rows = ['lat,lon'];
        for (let i = 0; i < 5; i++) {
            rows.push(`${45.5 + i * 0.001},${-73.6}`);
        }
        writeCsv(rows.join('\n') + '\n');

        mockCalc.mockImplementation(async (params) => {
            params.onProgress?.(params.points.length, params.points.length);
            return new Map();
        });

        const onProgress = jest.fn();
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        const result = await executeNodeAccessibilityWeighting(
            tmpDir, config, makeCallbacks({ onProgress }), { chunkSize: 3 }
        );

        expect(result.finishedNormally).toBe(true);
        expect(onProgress).toHaveBeenCalledTimes(2);
        expect(onProgress.mock.calls[0]).toEqual([3, -1]);
        expect(onProgress.mock.calls[1]).toEqual([3 + 2, -1]);
    });

    // -------------------------------------------------------------------
    // Cancellation via isCancelled
    // -------------------------------------------------------------------

    test('stops processing between chunks when isCancelled returns true', async () => {
        const rows = ['lat,lon'];
        for (let i = 0; i < 6; i++) {
            rows.push(`${45.5 + i * 0.001},${-73.6}`);
        }
        writeCsv(rows.join('\n') + '\n');

        const isCancelled = jest.fn()
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);

        mockCalc.mockResolvedValue(new Map([['node-1', 1.0]]));

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        const result = await executeNodeAccessibilityWeighting(
            tmpDir,
            config,
            makeCallbacks({
                isCancelled,
                isCancelledWithinChunk: jest.fn().mockResolvedValue(false)
            }),
            { chunkSize: 3 }
        );

        expect(mockCalc).toHaveBeenCalledTimes(1);
        expect(result.pointCount).toBe(3);
        expect(result.finishedNormally).toBe(false);
        expect(fs.existsSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME))).toBe(false);
    });

    test('isCancelled polled every N CSV rows even when rows yield zero intrinsic points', async () => {
        const rows = ['lat,lon'];
        for (let i = 0; i < 40; i++) {
            rows.push('invalid,invalid');
        }
        writeCsv(rows.join('\n') + '\n');

        let isCancelledCalls = 0;
        const isCancelled = jest.fn().mockImplementation(async () => {
            isCancelledCalls += 1;
            return isCancelledCalls >= 2;
        });

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        const result = await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks({ isCancelled }), {
            chunkSize: 1000
        });

        expect(mockCalc).not.toHaveBeenCalled();
        expect(result.finishedNormally).toBe(false);
        expect(isCancelledCalls).toBeGreaterThanOrEqual(2);
    });

    // -------------------------------------------------------------------
    // Node features
    // -------------------------------------------------------------------

    test('passes filtered node features to calculator', async () => {
        writeCsv('lat,lon\n45.5,-73.6\n');
        mockNodesDb.geojsonCollection.mockResolvedValue({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.6, 45.5] }, properties: { id: 'good' } },
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { id: 'bad-geom' } },
                { type: 'Feature', geometry: { type: 'Point', coordinates: [-73.7, 45.6] }, properties: {} }
            ]
        } as any);

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        const { nodeFeatures } = mockCalc.mock.calls[0][0];
        expect(nodeFeatures).toHaveLength(1);
        expect(nodeFeatures[0].properties.id).toBe('good');
    });

    // -------------------------------------------------------------------
    // Error cases
    // -------------------------------------------------------------------

    test('throws when input file is missing', async () => {
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await expect(
            executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks())
        ).rejects.toThrow('Input file not found');
    });

    test('throws when CSV has no valid points', async () => {
        writeCsv('lat,lon\nbadLat,badLon\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await expect(
            executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks())
        ).rejects.toThrow('No valid points');
    });

    test('throws when database has no transit nodes', async () => {
        writeCsv('lat,lon\n45.5,-73.6\n');
        mockNodesDb.geojsonCollection.mockResolvedValue({
            type: 'FeatureCollection',
            features: []
        } as any);

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await expect(
            executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks())
        ).rejects.toThrow('No transit nodes found');
    });

    test('propagates calculator errors', async () => {
        writeCsv('lat,lon\n45.5,-73.6\n');
        mockCalc.mockRejectedValue(new Error('OSRM down'));

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await expect(
            executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks())
        ).rejects.toThrow('OSRM down');
    });

    // -------------------------------------------------------------------
    // Parameters passed to calculator
    // -------------------------------------------------------------------

    test('passes correct weighting parameters and concurrency to calculator', async () => {
        writeCsv('lat,lon\n45.5,-73.6\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 900,
            decayFunctionParameters: { type: 'exponential', beta: 0.005 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks());

        const callParams = mockCalc.mock.calls[0][0];
        expect(callParams.parameters).toEqual({
            maxWalkingTimeSeconds: 900,
            decayFunctionParameters: { type: 'exponential', beta: 0.005 }
        });
        expect(callParams.concurrency).toBe(2);
    });

    // -------------------------------------------------------------------
    // Checkpoint / resume (intrinsic points + partial file)
    // -------------------------------------------------------------------

    test('savePartialCheckpointBundle round-trips weights and intrinsic point count', () => {
        const m = new Map<string, number>([
            ['node-1', 1.5],
            ['node-2', 2.25]
        ]);
        savePartialWeightsMapAtomic(tmpDir, m, 12345);
        const bundle = loadPartialCheckpointBundle(tmpDir);
        expect(bundle.intrinsicPointsProcessed).toBe(12345);
        expect(bundle.weights.get('node-1')).toBeCloseTo(1.5);
        expect(bundle.weights.get('node-2')).toBeCloseTo(2.25);
        removePartialWeightsFile(tmpDir);
        expect(loadPartialCheckpointBundle(tmpDir).weights.size).toBe(0);
    });

    test('throws when resumePointsProcessed is set without resumeWeights', async () => {
        writeCsv('lat,lon\n45.5,-73.6\n');
        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };
        await expect(
            executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks(), { resumePointsProcessed: 3 })
        ).rejects.toThrow('Invalid resume state');
    });

    test('resume after checkpoint matches single full run (no double count, no skipped points)', async () => {
        const rows = ['lat,lon'];
        for (let i = 0; i < 12; i++) {
            rows.push(`${45.5 + i * 0.001},${-73.6 + i * 0.001}`);
        }
        writeCsv(rows.join('\n') + '\n');

        const config: WeightingExecutionConfig = {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
        };

        const attachCoordRecorder = (bucket: number[][]) => {
            mockCalc.mockImplementation(async (params) => {
                for (const p of params.points) {
                    bucket.push(p.geometry.coordinates as number[]);
                }
                return new Map([['node-1', params.points.length]]);
            });
        };

        const baselineCoords: number[][] = [];
        attachCoordRecorder(baselineCoords);
        const baselineResult = await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks(), {
            chunkSize: 3
        });
        expect(baselineResult.finishedNormally).toBe(true);
        expect(baselineCoords).toHaveLength(12);
        const baselineOutput = fs.readFileSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME), 'utf-8');

        removePartialWeightsFile(tmpDir);
        if (fs.existsSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME))) {
            fs.unlinkSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME));
        }
        writeCsv(rows.join('\n') + '\n');

        let beforeChunk = 0;
        const isCancelled = jest.fn().mockImplementation(async () => {
            beforeChunk++;
            return beforeChunk >= 3;
        });
        const onCheckpoint = jest.fn(async ({ pointsProcessed, accumulatedWeights }) => {
            savePartialWeightsMapAtomic(tmpDir, new Map(accumulatedWeights), pointsProcessed);
        });
        const firstPhaseCoords: number[][] = [];
        attachCoordRecorder(firstPhaseCoords);
        const part1 = await executeNodeAccessibilityWeighting(
            tmpDir,
            config,
            makeCallbacks({ isCancelled }),
            { chunkSize: 3, onCheckpoint }
        );
        expect(part1.finishedNormally).toBe(false);
        expect(part1.pointCount).toBe(6);
        expect(onCheckpoint).toHaveBeenCalledTimes(2);
        expect(fs.existsSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME))).toBe(false);

        const bundle = loadPartialCheckpointBundle(tmpDir);
        expect(bundle.intrinsicPointsProcessed).toBe(6);
        expect(bundle.weights.get('node-1')).toBe(6);

        const secondPhaseCoords: number[][] = [];
        attachCoordRecorder(secondPhaseCoords);
        const part2 = await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks(), {
            chunkSize: 3,
            resumePointsProcessed: bundle.intrinsicPointsProcessed,
            resumeWeights: new Map(bundle.weights)
        });
        expect(part2.finishedNormally).toBe(true);
        expect(secondPhaseCoords).toHaveLength(6);
        expect(firstPhaseCoords.length + secondPhaseCoords.length).toBe(12);
        expect(firstPhaseCoords.concat(secondPhaseCoords)).toEqual(baselineCoords);

        const splitOutput = fs.readFileSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME), 'utf-8');
        expect(splitOutput).toBe(baselineOutput);
    });

    test('resume odBoth matches single run (intrinsic points per row)', async () => {
        const lines = ['oLat,oLon,dLat,dLon'];
        for (let i = 0; i < 6; i++) {
            lines.push(`${45.5 + i * 0.001},${-73.6 + i * 0.001},${45.6 + i * 0.001},${-73.5 + i * 0.001}`);
        }
        const csv = lines.join('\n') + '\n';
        writeCsv(csv);
        const expectedTotalPoints = 12;
        const mapping = { originLat: 'oLat', originLon: 'oLon', destinationLat: 'dLat', destinationLon: 'dLon' };
        const config: WeightingExecutionConfig = {
            weightingInputType: 'odBoth',
            maxWalkingTimeSeconds: 1200,
            decayFunctionParameters: { type: 'power', beta: 1.5 },
            weightingFileMapping: mapping
        };

        mockCalc.mockImplementation(async (params) => {
            return new Map([['node-1', params.points.length]]);
        });

        const baseline = await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks(), { chunkSize: 5 });
        expect(baseline.finishedNormally).toBe(true);
        expect(baseline.pointCount).toBe(expectedTotalPoints);
        const baselineOut = fs.readFileSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME), 'utf-8');

        removePartialWeightsFile(tmpDir);
        fs.unlinkSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME));
        writeCsv(csv);

        let n = 0;
        const isCancelled = jest.fn().mockImplementation(async () => {
            n++;
            return n >= 2;
        });
        const part1 = await executeNodeAccessibilityWeighting(
            tmpDir,
            config,
            makeCallbacks({
                isCancelled,
                isCancelledWithinChunk: jest.fn().mockResolvedValue(false)
            }),
            {
                chunkSize: 5,
                onCheckpoint: async ({ pointsProcessed, accumulatedWeights }) => {
                    savePartialWeightsMapAtomic(tmpDir, new Map(accumulatedWeights), pointsProcessed);
                }
            }
        );
        expect(part1.finishedNormally).toBe(false);
        const bundle = loadPartialCheckpointBundle(tmpDir);
        expect(bundle.intrinsicPointsProcessed).toBe(5);

        const part2 = await executeNodeAccessibilityWeighting(tmpDir, config, makeCallbacks(), {
            chunkSize: 5,
            resumePointsProcessed: bundle.intrinsicPointsProcessed,
            resumeWeights: new Map(bundle.weights)
        });
        expect(part2.finishedNormally).toBe(true);
        expect(part2.pointCount).toBe(expectedTotalPoints);
        expect(fs.readFileSync(path.join(tmpDir, DEFAULT_EXECUTE_WEIGHTS_BASENAME), 'utf-8')).toBe(baselineOut);
    });
});
