/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import {
    createAndEnqueueTransitNetworkDesignJob,
    getParametersFromTransitNetworkDesignJob
} from '../TransitNetworkJobController';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import { ExecutableJobUtils } from '../../../executableJob/ExecutableJobUtils';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import {
    type EvolutionaryTransitNetworkDesignJob,
    NODE_WEIGHTS_OUTPUT_FILENAME
} from '../evolutionary/types';
import type { NodeWeightingConfig } from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';

jest.mock('../../../executableJob/ExecutableJob');
jest.mock('../../../executableJob/ExecutableJobUtils');
jest.mock('chaire-lib-backend/lib/utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn()
    }
}));

const mockLoadTask = ExecutableJob.loadTask as jest.MockedFunction<typeof ExecutableJob.loadTask>;
const mockCreateJob = ExecutableJob.createJob as jest.MockedFunction<typeof ExecutableJob.createJob>;
const mockPrepareJobFiles = ExecutableJobUtils.prepareJobFiles as jest.MockedFunction<
    typeof ExecutableJobUtils.prepareJobFiles
>;
const mockFileExistsAbsolute = fileManager.fileExistsAbsolute as jest.MockedFunction<
    typeof fileManager.fileExistsAbsolute
>;

function makeOdTripParams(overrides: {
    demandCsvFile?:
        | { location: 'upload'; filename: string; uploadFilename: string }
        | { location: 'job'; jobId: number; fileKey: string };
    nodeWeighting?: NodeWeightingConfig;
}) {
    const demandCsvFile = overrides.demandCsvFile ?? {
        location: 'upload' as const,
        filename: 'demand.csv',
        uploadFilename: 'demand_upload.csv'
    };
    return {
        transitNetworkDesignParameters: { projectShortname: 'test' },
        algorithmConfiguration: { type: 'evolutionaryAlgorithm' as const, config: {} },
        simulationMethod: {
            type: 'OdTripSimulation' as const,
            config: {
                demandAttributes: { fileAndMapping: { csvFile: demandCsvFile } },
                transitRoutingAttributes: {},
                evaluationOptions: {},
                ...(overrides.nodeWeighting && { nodeWeighting: overrides.nodeWeighting })
            }
        }
    };
}

function makeJobAttributes(jobId: number, userId: number, parameters: ReturnType<typeof makeOdTripParams>) {
    return {
        id: jobId,
        name: 'evolutionaryTransitNetworkDesign' as const,
        status: 'pending' as const,
        user_id: userId,
        internal_data: {},
        data: { parameters: parameters },
        resources: { files: {} }
    };
}

describe('TransitNetworkJobController', () => {
    const userId = 10;
    const jobId = 42;
    const eventEmitter = new EventEmitter();

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrepareJobFiles.mockResolvedValue('/resolved/path/file.csv');
        mockFileExistsAbsolute.mockReturnValue(false);
    });

    describe('getParametersFromTransitNetworkDesignJob', () => {
        test('rewrites demand file ref to job location', async () => {
            const params = makeOdTripParams({});
            const jobAttrs = makeJobAttributes(jobId, userId, params);
            const mockJob = { attributes: jobAttrs } as unknown as EvolutionaryTransitNetworkDesignJob;
            mockLoadTask.mockResolvedValue(mockJob);

            const result = await getParametersFromTransitNetworkDesignJob(jobId, userId);

            expect(result.parameters.simulationMethod.type).toBe('OdTripSimulation');
            const config =
                result.parameters.simulationMethod.type === 'OdTripSimulation'
                    ? result.parameters.simulationMethod.config
                    : undefined;
            expect(config?.demandAttributes.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'transitDemand'
            });
        });

        test('rewrites weighting file ref to nodeWeight when weightingFileAttributes present', async () => {
            const params = makeOdTripParams({
                nodeWeighting: {
                    weightingEnabled: true,
                    odWeightingPoints: 'both',
                    maxWalkingTimeSeconds: 1200,
                    decayFunctionParameters: { type: 'power', beta: 1.5 },
                    weightingFileAttributes: {
                        type: 'csv',
                        fileAndMapping: {
                            fieldMappings: {
                                projection: '4326',
                                pointLat: 'lat',
                                pointLon: 'lon',
                                weight: 'weight'
                            },
                            csvFile: {
                                location: 'upload',
                                filename: 'poi.csv',
                                uploadFilename: 'poi_upload.csv'
                            }
                        },
                        csvFields: ['lat', 'lon', 'weight']
                    }
                }
            });
            const jobAttrs = makeJobAttributes(jobId, userId, params);
            const mockJob = { attributes: jobAttrs } as unknown as EvolutionaryTransitNetworkDesignJob;
            mockLoadTask.mockResolvedValue(mockJob);

            const result = await getParametersFromTransitNetworkDesignJob(jobId, userId);

            const config =
                result.parameters.simulationMethod.type === 'OdTripSimulation'
                    ? result.parameters.simulationMethod.config
                    : undefined;
            const nodeWeighting = config?.nodeWeighting;
            expect(nodeWeighting?.weightingFileAttributes?.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'nodeWeight'
            });
        });

        test('does not set weighting file ref when weightingFileAttributes absent', async () => {
            const params = makeOdTripParams({
                nodeWeighting: {
                    weightingEnabled: true,
                    odWeightingPoints: 'both',
                    maxWalkingTimeSeconds: 1200,
                    decayFunctionParameters: { type: 'power', beta: 1.5 }
                }
            });
            const jobAttrs = makeJobAttributes(jobId, userId, params);
            const mockJob = { attributes: jobAttrs } as unknown as EvolutionaryTransitNetworkDesignJob;
            mockLoadTask.mockResolvedValue(mockJob);

            const result = await getParametersFromTransitNetworkDesignJob(jobId, userId);

            const config =
                result.parameters.simulationMethod.type === 'OdTripSimulation'
                    ? result.parameters.simulationMethod.config
                    : undefined;
            expect(config?.demandAttributes.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'transitDemand'
            });
            expect(config?.nodeWeighting?.weightingFileAttributes).toBeUndefined();
        });

        test('returns existingFileNames from job resources.files', async () => {
            const params = makeOdTripParams({});
            const jobAttrs = makeJobAttributes(jobId, userId, params);
            (jobAttrs as any).resources = { files: { transitDemand: 'demand.csv', nodeWeight: 'poi.csv' } };
            const mockJob = { attributes: jobAttrs } as unknown as EvolutionaryTransitNetworkDesignJob;
            mockLoadTask.mockResolvedValue(mockJob);

            const result = await getParametersFromTransitNetworkDesignJob(jobId, userId);

            expect(result.existingFileNames).toEqual({ transitDemand: 'demand.csv', nodeWeight: 'poi.csv' });
        });
    });

    describe('createAndEnqueueTransitNetworkDesignJob', () => {
        test.each<
            [
                string,
                {
                    nodeWeighting: NodeWeightingConfig;
                    expectedCalls: number;
                    expectNodeWeight: boolean;
                }
            ]
        >([
            [
                'adds nodeWeight file when node weighting enabled with weightingFileAttributes',
                {
                    nodeWeighting: {
                        weightingEnabled: true,
                        odWeightingPoints: 'both',
                        maxWalkingTimeSeconds: 1200,
                        decayFunctionParameters: { type: 'power', beta: 1.5 },
                        weightingFileAttributes: {
                            type: 'csv',
                            fileAndMapping: {
                                fieldMappings: {
                                    projection: '4326',
                                    pointLat: 'lat',
                                    pointLon: 'lon',
                                    weight: 'weight'
                                },
                                csvFile: {
                                    location: 'upload',
                                    filename: 'weighting_poi.csv',
                                    uploadFilename: 'weighting_upload.csv'
                                }
                            },
                            csvFields: ['lat', 'lon', 'weight']
                        }
                    },
                    expectedCalls: 2,
                    expectNodeWeight: true
                }
            ],
            [
                'does not add nodeWeight file when node weighting disabled',
                {
                    nodeWeighting: {
                        weightingEnabled: false,
                        odWeightingPoints: 'both',
                        maxWalkingTimeSeconds: 1200,
                        decayFunctionParameters: { type: 'power', beta: 1.5 },
                        weightingFileAttributes: {
                            type: 'csv',
                            fileAndMapping: {
                                fieldMappings: {
                                    projection: '4326',
                                    pointLat: 'lat',
                                    pointLon: 'lon',
                                    weight: 'weight'
                                },
                                csvFile: {
                                    location: 'upload',
                                    filename: 'poi.csv',
                                    uploadFilename: 'poi_upload.csv'
                                }
                            },
                            csvFields: ['lat', 'lon', 'weight']
                        }
                    },
                    expectedCalls: 1,
                    expectNodeWeight: false
                }
            ],
            [
                'does not add nodeWeight file when no weightingFileAttributes',
                {
                    nodeWeighting: {
                        weightingEnabled: true,
                        odWeightingPoints: 'both',
                        maxWalkingTimeSeconds: 1200,
                        decayFunctionParameters: { type: 'power', beta: 1.5 }
                    },
                    expectedCalls: 1,
                    expectNodeWeight: false
                }
            ]
        ])('%s', async (_name, { nodeWeighting, expectedCalls, expectNodeWeight }) => {
            const params = makeOdTripParams({ nodeWeighting }) as any;
            let capturedInputFiles: Record<string, unknown> = {};
            mockCreateJob.mockImplementation(async (opts: any) => {
                capturedInputFiles = opts.inputFiles ?? {};
                return {
                    attributes: { id: jobId },
                    enqueue: jest.fn(),
                    refresh: jest.fn()
                } as any;
            });

            await createAndEnqueueTransitNetworkDesignJob(params, eventEmitter, userId);

            expect(mockPrepareJobFiles).toHaveBeenCalledTimes(expectedCalls);
            expect(capturedInputFiles).toHaveProperty('transitDemand');
            if (expectNodeWeight) {
                expect(capturedInputFiles).toHaveProperty('nodeWeight');
            } else {
                expect(capturedInputFiles).not.toHaveProperty('nodeWeight');
            }
        });

        test('adds nodeWeightsOutput to inputFiles when cloning so createJob copies it (same flow as demand)', async () => {
            const sourceJobId = 999;
            const sourceJobDir = '/userData/10/999/';
            const params = makeOdTripParams({
                demandCsvFile: { location: 'job', jobId: sourceJobId, fileKey: 'transitDemand' }
            }) as any;
            const mockSourceJob = {
                attributes: { user_id: userId },
                getJobFileDirectory: () => sourceJobDir,
                getFilePath: () => sourceJobDir + 'transit_demand.csv'
            };
            mockLoadTask.mockResolvedValue(mockSourceJob as any);
            let capturedInputFiles: Record<string, unknown> = {};
            mockCreateJob.mockImplementation(async (opts: any) => {
                capturedInputFiles = opts.inputFiles ?? {};
                return {
                    attributes: { id: jobId },
                    enqueue: jest.fn(),
                    refresh: jest.fn()
                } as any;
            });
            mockFileExistsAbsolute.mockReturnValue(true);

            await createAndEnqueueTransitNetworkDesignJob(params, eventEmitter, userId);

            expect(mockFileExistsAbsolute).toHaveBeenCalledWith(sourceJobDir + NODE_WEIGHTS_OUTPUT_FILENAME);
            expect(capturedInputFiles).toHaveProperty('nodeWeightsOutput', sourceJobDir + NODE_WEIGHTS_OUTPUT_FILENAME);
        });
    });
});
