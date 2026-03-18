/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import fs from 'fs';
import path from 'path';

import Papa from 'papaparse';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import transitNodesDbQueries from '../../../../models/db/transitNodes.db.queries';
import { StreamingNodeWeightingService } from '../StreamingNodeWeightingService';
import type { EvolutionaryTransitNetworkDesignJob } from '../evolutionary/types';

jest.mock('papaparse', () => ({
    __esModule: true,
    default: { parse: jest.fn() }
}));

jest.mock('chaire-lib-common/lib/services/routing/RoutingServiceManager', () => ({
    __esModule: true,
    default: {
        getRoutingServiceForEngine: jest.fn()
    }
}));

jest.mock('chaire-lib-common/lib/config/Preferences', () => ({
    __esModule: true,
    default: { get: jest.fn(() => 1.39) }
}));

jest.mock('../../../../models/db/transitNodes.db.queries', () => ({
    __esModule: true,
    default: {
        geojsonCollection: jest.fn(),
        getNodesInBirdDistanceFromPoint: jest.fn()
    }
}));

const mockPapaParse = Papa.parse as jest.Mock;
const mockGetRoutingServiceForEngine = routingServiceManager.getRoutingServiceForEngine as jest.Mock;

const mockTableFrom = jest.fn();
mockGetRoutingServiceForEngine.mockReturnValue({ tableFrom: mockTableFrom });

function createMockStream(): fs.ReadStream {
    const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    return {
        path: '/job/42/weights.csv',
        on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
        })
    } as unknown as fs.ReadStream;
}

/**
 * Sets up mockPapaParse to simulate row-by-row parsing with header: false.
 * Emits the header row as a string[] first, then each data row as a string[].
 * Supports pause/resume via mock parser.
 */
function setupParseMock(rows: Record<string, string>[]) {
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const allArrayRows: string[][] = [
        headers,
        ...rows.map((r) => headers.map((h) => r[h]))
    ];
    const avgRowBytes = 1024 / Math.max(rows.length, 1);
    mockPapaParse.mockImplementation(
        (_stream: unknown, config: { step?: (result: unknown, parser: unknown) => void; complete?: () => void; error?: (err: unknown) => void }) => {
            const parser = { pause: jest.fn(), resume: jest.fn(), abort: jest.fn() };
            let paused = false;
            const pending = [...allArrayRows];
            let globalRowIndex = 0;

            const processNext = () => {
                while (pending.length > 0 && !paused) {
                    const row = pending.shift()!;
                    globalRowIndex++;
                    const cursor = Math.round(globalRowIndex * avgRowBytes);
                    config.step?.({ data: row, errors: [], meta: { cursor } }, parser);
                    if (parser.pause.mock.calls.length > 0) {
                        paused = true;
                        parser.pause.mockClear();
                        const originalResume = parser.resume;
                        parser.resume = jest.fn(() => {
                            paused = false;
                            parser.resume = originalResume;
                            Promise.resolve().then(processNext);
                        }) as jest.Mock;
                        return;
                    }
                }
                if (pending.length === 0 && !paused) {
                    config.complete?.();
                }
            };

            processNext();
        }
    );
}

function makeMockJob(overrides: Partial<{
    simulationMethod: { type: string; config: Record<string, unknown> };
    fileExists: (k: string) => boolean;
    getReadStream: (k: string) => fs.ReadStream;
    getJobFileDirectory: () => string;
}>): EvolutionaryTransitNetworkDesignJob {
    const jobDir = '/job/42/';
    return {
        attributes: {
            data: {
                parameters: {
                    simulationMethod: overrides.simulationMethod ?? {
                        type: 'OdTripSimulation',
                        config: {
                            demandAttributes: {
                                fileAndMapping: {
                                    fieldMappings: {
                                        originLat: 'olat',
                                        originLon: 'olon',
                                        destinationLat: 'dlat',
                                        destinationLon: 'dlon',
                                        expansionFactor: 'exp'
                                    }
                                }
                            },
                            nodeWeighting: {
                                weightingEnabled: true,
                                odWeightingPoints: 'both',
                                maxWalkingTimeSeconds: 1200,
                                decayFunctionParameters: { type: 'power', beta: 1.5 },
                                weightingFileAttributes: {
                                    fileAndMapping: {
                                        fieldMappings: {
                                            pointLat: 'olat',
                                            pointLon: 'olon',
                                            weight: 'exp'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        fileExists: overrides.fileExists ?? (() => true),
        getReadStream: overrides.getReadStream ?? (() => createMockStream()),
        getJobFileDirectory: overrides.getJobFileDirectory ?? (() => jobDir)
    } as unknown as EvolutionaryTransitNetworkDesignJob;
}

describe('StreamingNodeWeightingService', () => {
    const nodeFeatures = [
        {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [-73.5, 45.5] },
            properties: { id: 'node-1' }
        },
        {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [-73.51, 45.51] },
            properties: { id: 'node-2' }
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        (transitNodesDbQueries.geojsonCollection as jest.Mock).mockResolvedValue({
            type: 'FeatureCollection',
            features: nodeFeatures
        });
        (transitNodesDbQueries.getNodesInBirdDistanceFromPoint as jest.Mock).mockResolvedValue([
            { id: 'node-1', distance: 100 },
            { id: 'node-2', distance: 200 }
        ]);
        mockTableFrom.mockResolvedValue({
            durations: [300, 800],
            distances: [500, 1200]
        });
        jest.spyOn(fs, 'writeFileSync').mockImplementation(() => { /* no-op */ });
        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        jest.spyOn(fs, 'statSync').mockReturnValue({ size: 1024 } as fs.Stats);

        setupParseMock([{
            olat: '45.5',
            olon: '-73.5',
            dlat: '45.51',
            dlon: '-73.51',
            exp: '2'
        }]);
    });

    describe('validation', () => {
        test('throws when simulation method is not OdTripSimulation', async () => {
            const job = makeMockJob({
                simulationMethod: { type: 'OtherSimulation', config: {} }
            });

            await expect(StreamingNodeWeightingService.run(job)).rejects.toThrow(
                /Node weighting is only supported for OdTripSimulation/
            );
        });

        test('throws when node weighting is not enabled', async () => {
            const job = makeMockJob({
                simulationMethod: {
                    type: 'OdTripSimulation',
                    config: {
                        demandAttributes: { fileAndMapping: { fieldMappings: {} } },
                        nodeWeighting: {
                            weightingEnabled: false,
                            odWeightingPoints: 'both',
                            maxWalkingTimeSeconds: 1200,
                            decayFunctionParameters: { type: 'power', beta: 1.5 }
                        }
                    }
                }
            } as Record<string, unknown>);

            await expect(StreamingNodeWeightingService.run(job)).rejects.toThrow(
                /Node weighting is not enabled/
            );
        });

        test('throws when maxWalkingTimeSeconds is 0', async () => {
            const job = makeMockJob({});
            (job.attributes.data.parameters.simulationMethod.config as Record<string, unknown>).nodeWeighting = {
                weightingEnabled: true,
                odWeightingPoints: 'both',
                maxWalkingTimeSeconds: 0,
                decayFunctionParameters: { type: 'power', beta: 1.5 },
                weightingFileAttributes: { fileAndMapping: { fieldMappings: { pointLat: 'lat', pointLon: 'lon' } } }
            };

            await expect(StreamingNodeWeightingService.run(job)).rejects.toThrow(
                /maxWalkingTimeSeconds must be a positive number/
            );
        });

        test('throws when decay type is invalid', async () => {
            const job = makeMockJob({});
            (job.attributes.data.parameters.simulationMethod.config as Record<string, unknown>).nodeWeighting = {
                weightingEnabled: true,
                odWeightingPoints: 'both',
                maxWalkingTimeSeconds: 1200,
                decayFunctionParameters: { type: 'invalid', beta: 1.5 },
                weightingFileAttributes: { fileAndMapping: { fieldMappings: { pointLat: 'lat', pointLon: 'lon' } } }
            };

            await expect(StreamingNodeWeightingService.run(job)).rejects.toThrow(
                /Decay type must be one of|decayTypeInvalid/
            );
        });

        test('throws when decay beta is missing for power type', async () => {
            const job = makeMockJob({});
            (job.attributes.data.parameters.simulationMethod.config as Record<string, unknown>).nodeWeighting = {
                weightingEnabled: true,
                odWeightingPoints: 'both',
                maxWalkingTimeSeconds: 1200,
                decayFunctionParameters: { type: 'power' },
                weightingFileAttributes: { fileAndMapping: { fieldMappings: { pointLat: 'lat', pointLon: 'lon' } } }
            };

            await expect(StreamingNodeWeightingService.run(job)).rejects.toThrow(
                /Beta is required|decayBetaRequired/
            );
        });

    });

    describe('run with weighting file', () => {
        test('loads nodes, streams CSV, calls OSRM and writes node_weights.csv', async () => {
            const job = makeMockJob({});
            const jobDir = job.getJobFileDirectory();

            await StreamingNodeWeightingService.run(job);

            expect(transitNodesDbQueries.geojsonCollection).toHaveBeenCalledWith({});
            expect(mockPapaParse).toHaveBeenCalled();
            expect(transitNodesDbQueries.getNodesInBirdDistanceFromPoint).toHaveBeenCalled();
            expect(mockTableFrom).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'walking',
                    origin: expect.objectContaining({ type: 'Feature', geometry: expect.any(Object) }),
                    destinations: expect.any(Array)
                })
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(jobDir, 'node_weights.csv'),
                expect.stringMatching(/^node_uuid,weight\n/),
                'utf-8'
            );
        });

        test('calls onProgress with messageKey and rowsProcessed', async () => {
            const job = makeMockJob({});
            const progressCalls: Array<Record<string, unknown>> = [];
            await StreamingNodeWeightingService.run(job, (p) => progressCalls.push(p));

            expect(progressCalls.length).toBeGreaterThan(0);
            expect(progressCalls.some((p) => p.messageKey !== undefined)).toBe(true);
        });
    });

    describe('row integrity across pause/resume cycles', () => {
        test.each([
            { rowCount: 50, label: '50 rows (3 pause/resume cycles with BATCH_SIZE=16)' },
            { rowCount: 17, label: '17 rows (exactly 1 pause/resume + 1 remaining)' },
            { rowCount: 1, label: '1 row (no pause/resume, single row in final batch)' }
        ])('processes every CSV row: $label', async ({ rowCount }) => {
            const rows = Array.from({ length: rowCount }, (_, i) => ({
                lat: (45.5 + i * 0.001).toFixed(4),
                lon: (-73.5 + i * 0.001).toFixed(4),
                w: String(i + 1)
            }));
            const totalFileSize = rowCount * 30;
            jest.spyOn(fs, 'statSync').mockReturnValue({ size: totalFileSize } as fs.Stats);
            setupParseMock(rows);

            const job = makeMockJob({
                simulationMethod: {
                    type: 'OdTripSimulation',
                    config: {
                        demandAttributes: { fileAndMapping: { fieldMappings: {} } },
                        nodeWeighting: {
                            weightingEnabled: true,
                            odWeightingPoints: 'both',
                            maxWalkingTimeSeconds: 1200,
                            decayFunctionParameters: { type: 'power', beta: 1.5 },
                            weightingFileAttributes: {
                                fileAndMapping: {
                                    fieldMappings: { pointLat: 'lat', pointLon: 'lon', weight: 'w' }
                                }
                            }
                        }
                    }
                }
            });

            const progressCalls: Array<Record<string, unknown>> = [];
            await StreamingNodeWeightingService.run(job, (p) => progressCalls.push(p));

            expect(transitNodesDbQueries.getNodesInBirdDistanceFromPoint).toHaveBeenCalledTimes(rowCount);
            expect(mockTableFrom).toHaveBeenCalledTimes(rowCount);

            const finalProgress = progressCalls.filter((p) => p.messageKey === 'RowsProcessed');
            const lastRowsProcessed = finalProgress[finalProgress.length - 1]?.rowsProcessed;
            expect(lastRowsProcessed).toBe(rowCount);
        });
    });

    describe('run with POI weighting file', () => {
        test('reads nodeWeight CSV, calls nodes/OSRM, writes node_weights.csv and invokes onProgress', async () => {
            const jobDir = '/job/42/';
            const mockStream = createMockStream();
            const mockGetReadStream = jest.fn(() => mockStream);

            setupParseMock([{ lat: '45.5', lon: '-73.5', w: '2' }]);

            const job = makeMockJob({
                simulationMethod: {
                    type: 'OdTripSimulation',
                    config: {
                        demandAttributes: { fileAndMapping: { fieldMappings: {} } },
                        nodeWeighting: {
                            weightingEnabled: true,
                            odWeightingPoints: 'both',
                            maxWalkingTimeSeconds: 1200,
                            decayFunctionParameters: { type: 'power', beta: 1.5 },
                            weightingFileAttributes: {
                                fileAndMapping: {
                                    fieldMappings: {
                                        pointLat: 'lat',
                                        pointLon: 'lon',
                                        weight: 'w'
                                    }
                                }
                            }
                        }
                    }
                },
                fileExists: (k) => k === 'nodeWeight',
                getReadStream: mockGetReadStream as unknown as (k: string) => fs.ReadStream,
                getJobFileDirectory: () => jobDir
            });

            const progressCalls: Array<Record<string, unknown>> = [];
            await StreamingNodeWeightingService.run(job, (p) => progressCalls.push(p));

            expect(mockGetReadStream).toHaveBeenCalledWith('nodeWeight');
            expect(mockPapaParse).toHaveBeenCalledWith(
                mockStream,
                expect.objectContaining({ header: false, skipEmptyLines: 'greedy' })
            );
            expect(transitNodesDbQueries.geojsonCollection).toHaveBeenCalledWith({});
            expect(transitNodesDbQueries.getNodesInBirdDistanceFromPoint).toHaveBeenCalled();
            expect(mockTableFrom).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'walking',
                    origin: expect.objectContaining({ type: 'Feature', geometry: expect.any(Object) }),
                    destinations: expect.any(Array)
                })
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                path.join(jobDir, 'node_weights.csv'),
                expect.stringMatching(/^node_uuid,weight\n/),
                'utf-8'
            );
            expect(progressCalls.length).toBeGreaterThan(0);
            expect(progressCalls.some((p) => p.messageKey !== undefined)).toBe(true);
        });
    });
});
