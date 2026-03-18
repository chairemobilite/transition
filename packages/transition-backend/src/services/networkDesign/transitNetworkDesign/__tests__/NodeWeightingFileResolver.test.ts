/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import { ExecutableJobUtils } from '../../../executableJob/ExecutableJobUtils';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import {
    resolveNodeWeightingInputFilesForEvolutionaryJob,
    rewriteNodeWeightingCsvFileToJobLocation
} from '../nodeWeighting/NodeWeightingFileResolver';
import { NODE_WEIGHTS_OUTPUT_FILENAME } from '../evolutionary/types';

jest.mock('../../../executableJob/ExecutableJob');
jest.mock('../../../executableJob/ExecutableJobUtils');
jest.mock('chaire-lib-backend/lib/utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn()
    }
}));

const mockLoadTask = ExecutableJob.loadTask as jest.MockedFunction<typeof ExecutableJob.loadTask>;
const mockPrepareJobFiles = ExecutableJobUtils.prepareJobFiles as jest.MockedFunction<
    typeof ExecutableJobUtils.prepareJobFiles
>;
const mockFileExistsAbsolute = fileManager.fileExistsAbsolute as jest.MockedFunction<
    typeof fileManager.fileExistsAbsolute
>;

describe('NodeWeightingFileResolver', () => {
    const userId = 13;

    beforeEach(() => {
        jest.clearAllMocks();
        mockPrepareJobFiles.mockResolvedValue('/resolved/path/weighting.csv');
        mockFileExistsAbsolute.mockReturnValue(false);
    });

    test('resolves nodeWeight input file when weighting is enabled', async () => {
        const parameters = {
            simulationMethod: {
                type: 'OdTripSimulation',
                config: {
                    nodeWeighting: {
                        weightingEnabled: true,
                        weightingFileAttributes: {
                            fileAndMapping: {
                                csvFile: {
                                    location: 'upload',
                                    filename: 'weighting.csv',
                                    uploadFilename: 'weighting_upload.csv'
                                }
                            }
                        }
                    }
                }
            }
        } as any;

        const inputFiles = await resolveNodeWeightingInputFilesForEvolutionaryJob(parameters, userId);

        expect(mockPrepareJobFiles).toHaveBeenCalledTimes(1);
        expect(inputFiles.nodeWeight).toEqual('/resolved/path/weighting.csv');
        expect(inputFiles.nodeWeightsOutput).toBeUndefined();
    });

    test('resolves nodeWeightsOutput from fallback source job when available', async () => {
        const sourceJobId = 999;
        const sourceJobDir = '/userData/13/999/';
        const parameters = {
            simulationMethod: {
                type: 'OdTripSimulation',
                config: {
                    nodeWeighting: {
                        weightingEnabled: true
                    }
                }
            }
        } as any;
        mockLoadTask.mockResolvedValue({
            attributes: { user_id: userId },
            getJobFileDirectory: () => sourceJobDir
        } as any);
        mockFileExistsAbsolute.mockReturnValue(true);

        const inputFiles = await resolveNodeWeightingInputFilesForEvolutionaryJob(parameters, userId, {
            fallbackSourceJobId: sourceJobId
        });

        expect(mockLoadTask).toHaveBeenCalledWith(sourceJobId);
        expect(mockFileExistsAbsolute).toHaveBeenCalledWith(sourceJobDir + NODE_WEIGHTS_OUTPUT_FILENAME);
        expect(inputFiles.nodeWeightsOutput).toEqual(sourceJobDir + NODE_WEIGHTS_OUTPUT_FILENAME);
    });

    test('rewriteNodeWeightingCsvFileToJobLocation rewrites existing weighting csv reference', () => {
        const simulationConfig = {
            nodeWeighting: {
                weightingFileAttributes: {
                    fileAndMapping: {
                        csvFile: {
                            location: 'upload',
                            filename: 'weighting.csv',
                            uploadFilename: 'weighting_upload.csv'
                        }
                    }
                }
            }
        };

        rewriteNodeWeightingCsvFileToJobLocation(simulationConfig, 1234);

        expect(simulationConfig.nodeWeighting.weightingFileAttributes.fileAndMapping.csvFile).toEqual({
            location: 'job',
            jobId: 1234,
            fileKey: 'nodeWeight'
        });
    });

    test('rewriteNodeWeightingCsvFileToJobLocation is a no-op without file mapping', () => {
        const simulationConfig = {
            nodeWeighting: {
                weightingEnabled: true
            }
        };

        expect(() => rewriteNodeWeightingCsvFileToJobLocation(simulationConfig as any, 1234)).not.toThrow();
    });
});
