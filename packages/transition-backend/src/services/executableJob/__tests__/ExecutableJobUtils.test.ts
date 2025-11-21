/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { ExecutableJobUtils } from '../ExecutableJobUtils';
import jobsDbQueries from '../../../models/db/jobs.db.queries';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';

// Mock job type
type TestJobType = {
    name: 'test';
    data: {
        parameters: {
            foo: string
        };
        results?: number;
    },
    files: {
        testFile: boolean;
        testFile2: boolean;
    }
}

const jobAttributes = {
    id: 2,
    status: 'pending' as const,
    internal_data: {},
    name: 'test' as const,
    user_id: 3,
    data: { parameters: { foo: 'bar' } },
    resources: { files: { testFile: 'path/to/file' } }
};

// Mock db queries
jest.mock('../../../models/db/jobs.db.queries', () => {
    return {
        read: jest.fn()
    }
});
const mockedJobRead = jobsDbQueries.read as jest.MockedFunction<typeof jobsDbQueries.read>;

jest.mock('chaire-lib-backend/lib/utils/filesystem/directoryManager', () => ({
    directoryManager: {
        userDataDirectory: '/path/to/userData',
        getFilesAbsolute: jest.fn().mockReturnValue([])
    }
}));
const mockedGetDirFilesAbsolute = directoryManager.getFilesAbsolute as jest.MockedFunction<typeof directoryManager.getFilesAbsolute>;

beforeEach(() => {
    mockedJobRead.mockClear();
    jest.restoreAllMocks();
});

describe('ExecutableJobUtils', () => {
    describe('handleJobFile', () => {
        const userId = 123;
        const importFileName = 'import.csv';

        test('should handle upload file location', async () => {
            const fileLocation = {
                location: 'upload' as const,
                filename: 'renamed.csv',
                uploadFilename: importFileName 
            };

            const result = await ExecutableJobUtils.prepareJobFiles(fileLocation, userId);

            expect(result).toEqual({
                filepath: expect.stringContaining(`userData/${userId}/imports/${importFileName}`),
                renameTo: 'renamed.csv'
            });
        });

        test('should handle job file location', async () => {
            const jobId = 456;
            const fileKey = 'output';
            const fileLocation = {
                location: 'job' as const,
                jobId,
                fileKey
            };

            // Mock the job that contains the file
            const sourceJobAttributes = {
                ...jobAttributes,
                id: jobId,
                user_id: userId,
                resources: { files: { output: 'result.csv' } }
            };
            mockedJobRead.mockResolvedValueOnce(sourceJobAttributes);
            
            // Mock getFilesAbsolute to return a file path
            mockedGetDirFilesAbsolute.mockReturnValueOnce(['result.csv'] as any);
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);

            const result = await ExecutableJobUtils.prepareJobFiles(fileLocation, userId);

            // Should contain the file name
            expect(result).toEqual(expect.stringContaining('result.csv'));
            // Shoud also contain the original job's id in the path
            expect(result).toEqual(expect.stringContaining(String(jobId)));
            expect(mockedJobRead).toHaveBeenCalledWith(jobId);
        });

        test('should throw error when accessing job file from different user', async () => {
            const jobId = 456;
            const fileLocation = {
                location: 'job' as const,
                jobId,
                fileKey: 'output'
            };

            // Mock a job owned by a different user
            const sourceJobAttributes = {
                ...jobAttributes,
                id: jobId,
                user_id: userId + 1, // Different user
                resources: { files: { output: 'result.csv' } }
            };
            mockedJobRead.mockResolvedValueOnce(sourceJobAttributes);

            await expect(
                ExecutableJobUtils.prepareJobFiles(fileLocation, userId)
            ).rejects.toEqual('Not allowed to get the input file from job');
        });

        test('should propagate error when source job file does not exist', async () => {
            const jobId = 456;
            const fileLocation = {
                location: 'job' as const,
                jobId,
                fileKey: 'output'
            };

            // Mock the job that contains the file
            const sourceJobAttributes = {
                ...jobAttributes,
                id: jobId,
                user_id: userId,
                resources: { files: { output: 'result.csv' } }
            };
            mockedJobRead.mockResolvedValueOnce(sourceJobAttributes);
            
            // Mock file not existing
            mockedGetDirFilesAbsolute.mockReturnValueOnce(['notTheRightFile.csv'] as any);

            await expect(
                ExecutableJobUtils.prepareJobFiles(fileLocation, userId)
            ).rejects.toEqual('File not available');
        });
    });
});
