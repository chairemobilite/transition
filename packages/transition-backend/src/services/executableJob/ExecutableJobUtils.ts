/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { FileConfig } from 'transition-common/lib/services/csv';
import { ExecutableJob } from './ExecutableJob';

export class ExecutableJobUtils {
    /**
     * Prepare the input file for a job based on the requested file location.
     * The result of this function can be passed to the `createJob` function as
     * an input file.
     *
     * @param fileLocation The file location configuration, either in the upload
     * directory or from another job
     * @param userId The user ID requesting the File
     * @returns Either the complete absolute file path of the file to copy, or
     * an object with the absolute filepath and the name to rename to.
     */
    static prepareJobFiles = async (
        fileLocation: FileConfig,
        userId: number
    ): Promise<string | { filepath: string; renameTo: string }> => {
        if (fileLocation.location === 'upload') {
            return {
                filepath: `${directoryManager.userDataDirectory}/${userId}/imports/${fileLocation.uploadFilename}`,
                renameTo: fileLocation.filename
            };
        } else {
            const fromJob = await ExecutableJob.loadTask(fileLocation.jobId);
            if (fromJob.attributes.user_id !== userId) {
                throw 'Not allowed to get the input file from job';
            }
            return fromJob.getFilePath(fileLocation.fileKey);
        }
    };
}
