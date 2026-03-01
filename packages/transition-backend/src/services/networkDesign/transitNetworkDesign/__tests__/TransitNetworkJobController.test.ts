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
    nodeWeighting?: {
        weightingEnabled: boolean;
        weightingSource: 'sameFile' | 'separateFile';
        weightingFileAttributes?: {
            fileAndMapping: { csvFile: { location: 'upload'; filename: string; uploadFilename: string } };
        };
    };
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

            expect(result.simulationMethod.type).toBe('OdTripSimulation');
            const config =
                result.simulationMethod.type === 'OdTripSimulation' ? result.simulationMethod.config : undefined;
            expect(config?.demandAttributes.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'transitDemand'
            });
        });

        test('rewrites weighting file ref to nodeWeight when weightingSource is separateFile', async () => {
            const params = makeOdTripParams({
                nodeWeighting: {
                    weightingEnabled: true,
                    weightingSource: 'separateFile',
                    weightingFileAttributes: {
                        fileAndMapping: {
                            csvFile: {
                                location: 'upload',
                                filename: 'poi.csv',
                                uploadFilename: 'poi_upload.csv'
                            }
                        }
                    }
                }
            });
            const jobAttrs = makeJobAttributes(jobId, userId, params);
            const mockJob = { attributes: jobAttrs } as unknown as EvolutionaryTransitNetworkDesignJob;
            mockLoadTask.mockResolvedValue(mockJob);

            const result = await getParametersFromTransitNetworkDesignJob(jobId, userId);

            const config =
                result.simulationMethod.type === 'OdTripSimulation' ? result.simulationMethod.config : undefined;
            expect(config?.nodeWeighting?.weightingFileAttributes?.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'nodeWeight'
            });
        });

        test('does not set weighting file ref when weightingSource is sameFile', async () => {
            const params = makeOdTripParams({
                nodeWeighting: {
                    weightingEnabled: true,
                    weightingSource: 'sameFile',
                    weightingFileAttributes: undefined as any
                }
            });
            const jobAttrs = makeJobAttributes(jobId, userId, params);
            const mockJob = { attributes: jobAttrs } as unknown as EvolutionaryTransitNetworkDesignJob;
            mockLoadTask.mockResolvedValue(mockJob);

            const result = await getParametersFromTransitNetworkDesignJob(jobId, userId);

            const config =
                result.simulationMethod.type === 'OdTripSimulation' ? result.simulationMethod.config : undefined;
            expect(config?.demandAttributes.fileAndMapping.csvFile).toEqual({
                location: 'job',
                jobId,
                fileKey: 'transitDemand'
            });
            expect(config?.nodeWeighting?.weightingFileAttributes).toBeUndefined();
        });
    });

    describe('createAndEnqueueTransitNetworkDesignJob', () => {
        test.each<
            [
                string,
                {
                    nodeWeighting: {
                        weightingEnabled: boolean;
                        weightingSource: 'sameFile' | 'separateFile';
                        weightingFileAttributes?:
                            | {
                                fileAndMapping: {
                                    csvFile: {
                                        location: 'upload';
                                        filename: string;
                                        uploadFilename: string;
                                    };
                                };
                            }
                            | undefined;
                    };
                    expectedCalls: number;
                    expectNodeWeight: boolean;
                }
            ]
        >([
            [
                'adds nodeWeight file when node weighting enabled with separateFile',
                {
                    nodeWeighting: {
                        weightingEnabled: true,
                        weightingSource: 'separateFile',
                        weightingFileAttributes: {
                            fileAndMapping: {
                                csvFile: {
                                    location: 'upload',
                                    filename: 'weighting_poi.csv',
                                    uploadFilename: 'weighting_upload.csv'
                                }
                            }
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
                        weightingSource: 'separateFile',
                        weightingFileAttributes: {
                            fileAndMapping: {
                                csvFile: {
                                    location: 'upload',
                                    filename: 'poi.csv',
                                    uploadFilename: 'poi_upload.csv'
                                }
                            }
                        }
                    },
                    expectedCalls: 1,
                    expectNodeWeight: false
                }
            ],
            [
                'does not add nodeWeight file when weightingSource is sameFile',
                {
                    nodeWeighting: {
                        weightingEnabled: true,
                        weightingSource: 'sameFile',
                        weightingFileAttributes: undefined
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
                return { enqueue: jest.fn(), refresh: jest.fn() } as any;
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
                return { enqueue: jest.fn(), refresh: jest.fn() } as any;
            });
            mockFileExistsAbsolute.mockReturnValue(true);

            await createAndEnqueueTransitNetworkDesignJob(params, eventEmitter, userId);

            expect(capturedInputFiles).toHaveProperty('nodeWeightsOutput', sourceJobDir + NODE_WEIGHTS_OUTPUT_FILENAME);
        });
    });
});
