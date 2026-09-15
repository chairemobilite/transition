/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/*
 * Execution is delegated to the standard worker pool (TransitionWorkerPool.ts).
 * On server restart, enqueueRunningAndPendingJobs() re-enqueues inProgress jobs;
 * the worker reloads `node_weights.partial.csv` plus `internal_data.checkpoint`
 * so intrinsic points are skipped and weights are not double-counted.
 *
 * Pause stops the worker after the current CSV chunk (checkpoint on disk + DB).
 * Resume from pause uses `ExecutableJob.resume` (pending + enqueue). Finished jobs cannot be
 * re-run in place: use **Duplicate** in the list to copy parameters and input CSV into a new job.
 */
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import type { FileAndMappingAttributes } from 'transition-common/lib/services/csv/types';
import type { WeightingFileMapping } from 'transition-common/lib/services/weighting/types';
import type { JobStatus } from 'transition-common/lib/services/jobs/Job';
import { TransitApi } from 'transition-common/lib/api/transit';
import { ExecutableJob } from '../services/executableJob/ExecutableJob';
import { ExecutableJobUtils } from '../services/executableJob/ExecutableJobUtils';
import {
    INPUT_FILENAME,
    removePartialWeightsFile
} from '../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingService';
import type { WeightingExecutionConfig } from '../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingService';
import type { NodeAccessibilityWeightingJobType } from '../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingJobType';
import serverConfig from 'chaire-lib-backend/lib/config/server.config';
import Users from 'chaire-lib-backend/lib/services/users/users';

const JOB_NAME = 'nodeAccessibilityWeighting';

type NodeAccessibilityWeightingJobParameters = {
    description?: string;
    config: Record<string, unknown>;
};

type StatusResponse = {
    status: JobStatus;
    hasWeightsFile: boolean;
    results?: { pointCount: number; nodeCount: number; nodesWithWeight: number };
    statusMessages?: ExecutableJob<NodeAccessibilityWeightingJobType>['attributes']['statusMessages'];
};

/**
 * True when ExecutableJob.loadTask fails because the job row does not exist.
 * jobs.db.queries read throws DBQRD0002 or wraps it in DBQRD0003 while preserving the message.
 */
function isJobNotFoundFromLoadTask(error: unknown): boolean {
    if (!TrError.isTrError(error)) {
        return false;
    }
    if (error.getCode() === 'DBQRD0002') {
        return true;
    }
    return error.message.includes('Cannot find object with id');
}

export default function nodeAccessibilityWeightingSocketRoutes(socket: EventEmitter, userId: number): void {
    socket.on(
        TransitApi.NODE_ACCESSIBILITY_WEIGHTING_CREATE,
        async (
            parameters: NodeAccessibilityWeightingJobParameters,
            callback: (status: Status.Status<{ jobId: number }>) => void
        ) => {
            try {
                const job = await ExecutableJob.createJob({
                    user_id: userId,
                    name: JOB_NAME,
                    data: { parameters }
                });
                callback(Status.createOk({ jobId: job.attributes.id }));
            } catch (error) {
                console.error('Error creating node accessibility weighting job', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
            }
        }
    );

    socket.on(
        TransitApi.NODE_ACCESSIBILITY_WEIGHTING_DUPLICATE,
        async (sourceJobId: number, callback: (status: Status.Status<{ jobId: number }>) => void) => {
            try {
                const source = await ExecutableJob.loadTask<NodeAccessibilityWeightingJobType>(sourceJobId);
                if (source.attributes.user_id !== userId) {
                    callback(Status.createError('Not allowed'));
                    return;
                }
                if (source.attributes.name !== JOB_NAME) {
                    callback(Status.createError('Job is not a node accessibility weighting job'));
                    return;
                }
                const parametersRaw = (
                    source.attributes.data as { parameters?: NodeAccessibilityWeightingJobParameters }
                )?.parameters;
                const config = parametersRaw?.config as WeightingExecutionConfig | undefined;
                if (!config?.maxWalkingTimeSeconds || !config?.decayFunctionParameters) {
                    callback(Status.createError('Source job has incomplete configuration'));
                    return;
                }
                const parameters: NodeAccessibilityWeightingJobParameters = JSON.parse(
                    JSON.stringify(parametersRaw)
                ) as NodeAccessibilityWeightingJobParameters;
                const desc = parameters.description?.trim();
                parameters.description =
                    desc !== undefined && desc !== '' ? `${desc} (copy)` : `Job #${sourceJobId} (copy)`;

                const hasSourceInput = source.fileExists('input');
                let srcInputPath: string | undefined;
                if (hasSourceInput) {
                    try {
                        srcInputPath = source.getFilePath('input');
                    } catch {
                        /* file registered but missing on disk */
                    }
                }

                const newJob = await ExecutableJob.createJob({
                    user_id: userId,
                    name: JOB_NAME,
                    data: { parameters },
                    ...(srcInputPath !== undefined
                        ? { inputFiles: { input: { filepath: srcInputPath, renameTo: INPUT_FILENAME } } }
                        : {})
                });

                if (srcInputPath !== undefined) {
                    const fileSize = fs.statSync(srcInputPath).size;
                    const quota = Users.getUserQuota(userId);
                    const maxFileSizeMB = Math.min(
                        quota === -1 ? Number.MAX_VALUE : quota / 1024 / 1024,
                        serverConfig.maxFileUploadMB
                    );
                    const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;
                    if (fileSize > maxFileSizeBytes) {
                        callback(Status.createError('Copy of input CSV exceeds maximum allowed size'));
                        await newJob.delete(socket).catch(() => undefined);
                        return;
                    }
                    removePartialWeightsFile(newJob.getJobFileDirectory());
                }

                callback(Status.createOk({ jobId: newJob.attributes.id }));
            } catch (error) {
                console.error('Error duplicating node accessibility weighting job', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
            }
        }
    );

    socket.on(
        TransitApi.NODE_ACCESSIBILITY_WEIGHTING_LIST,
        async (
            callback: (
                status: Status.Status<{
                    jobs: { id: number; description?: string; hasWeightsFile: boolean }[];
                }>
            ) => void
        ) => {
            try {
                const { jobs: loadedJobs } = await ExecutableJob.collection({
                    userId,
                    jobType: JOB_NAME,
                    pageSize: 0,
                    pageIndex: 0
                });
                const jobs = loadedJobs.map((j) => ({
                    id: j.attributes.id,
                    description: (j.attributes.data as any)?.parameters?.description,
                    hasWeightsFile: j.fileExists('output')
                }));
                callback(Status.createOk({ jobs }));
            } catch (error) {
                console.error('Error listing node accessibility weighting jobs', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
            }
        }
    );

    socket.on(
        TransitApi.NODE_ACCESSIBILITY_WEIGHTING_GET_PARAMETERS,
        async (
            jobId: number,
            callback: (
                status: Status.Status<{
                    parameters: NodeAccessibilityWeightingJobParameters;
                    csvFields?: string[];
                }>
            ) => void
        ) => {
            try {
                const job = await ExecutableJob.loadTask<NodeAccessibilityWeightingJobType>(jobId);
                if (job.attributes.user_id !== userId) {
                    callback(Status.createError('Not allowed'));
                    return;
                }
                const parameters = (job.attributes.data as any)?.parameters ?? { config: {} };
                const csvFields = parameters.csvFileAndMapping?.csvFields as string[] | undefined;
                callback(Status.createOk({ parameters, csvFields }));
            } catch (error) {
                console.error('Error getting node accessibility weighting job parameters', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
            }
        }
    );

    socket.on(
        TransitApi.NODE_ACCESSIBILITY_WEIGHTING_START,
        async (
            payload: {
                jobId: number;
                parameters: NodeAccessibilityWeightingJobParameters;
                fileAndMapping?: FileAndMappingAttributes<WeightingFileMapping>;
            },
            callback: (status: Status.Status<{ jobId: number }>) => void
        ) => {
            const { jobId, parameters, fileAndMapping } = payload;
            try {
                const job = await ExecutableJob.loadTask(jobId);
                if (job.attributes.user_id !== userId) {
                    callback(Status.createError('Not allowed'));
                    return;
                }
                if (job.attributes.name !== JOB_NAME) {
                    callback(Status.createError('Job is not a node accessibility weighting job'));
                    return;
                }
                if (job.status === 'inProgress') {
                    callback(Status.createError('Job is already running'));
                    return;
                }

                const config = parameters.config as WeightingExecutionConfig | undefined;
                if (!config?.maxWalkingTimeSeconds || !config?.decayFunctionParameters) {
                    callback(Status.createError('Job has incomplete configuration'));
                    return;
                }

                if (job.status === 'paused') {
                    job.attributes.data = { ...job.attributes.data, parameters };
                    await job.save(socket);
                    const requeued = await job.resume(socket);
                    if (!requeued) {
                        callback(Status.createError('Job could not be re-queued from paused state'));
                        return;
                    }
                    callback(Status.createOk({ jobId }));
                    return;
                }

                if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
                    callback(
                        Status.createError(
                            new TrError(
                                'Use Duplicate in the job list to run this configuration again.',
                                'NAWT010',
                                'transit:transitNode.accessibilityWeighting.errors.CannotStartTerminalJob'
                            ).message
                        )
                    );
                    return;
                }

                if (job.status !== 'pending') {
                    callback(Status.createError('Job cannot be started in its current state'));
                    return;
                }

                // Stage the input CSV from the upload directory (or another job) into this job's directory
                if (fileAndMapping) {
                    const inputFile = await ExecutableJobUtils.prepareJobFiles(fileAndMapping.csvFile, userId);
                    const inputFileSpec =
                        typeof inputFile === 'string'
                            ? { filepath: inputFile, renameTo: INPUT_FILENAME }
                            : { filepath: inputFile.filepath, renameTo: INPUT_FILENAME };
                    const destPath = path.join(job.getJobFileDirectory(), INPUT_FILENAME);
                    fs.copyFileSync(inputFileSpec.filepath, destPath);
                    job.registerOutputFile('input', INPUT_FILENAME);
                }

                // Update in-memory data before save so job.save() writes the new parameters
                job.attributes.data = { ...job.attributes.data, parameters };
                removePartialWeightsFile(job.getJobFileDirectory());
                const internalStart = { ...(job.attributes.internal_data ?? {}) };
                delete internalStart.checkpoint;
                job.attributes.internal_data = internalStart;
                await job.save(socket);
                await job.enqueue();
                callback(Status.createOk({ jobId }));
            } catch (error) {
                console.error('Error starting node accessibility weighting', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
            }
        }
    );

    socket.on(
        TransitApi.NODE_ACCESSIBILITY_WEIGHTING_STATUS,
        async (jobId: number, callback: (status: Status.Status<StatusResponse>) => void) => {
            try {
                const job = await ExecutableJob.loadTask<NodeAccessibilityWeightingJobType>(jobId);
                if (job.attributes.user_id !== userId) {
                    callback(Status.createError('Not allowed'));
                    return;
                }
                const hasWeightsFile = job.fileExists('output');
                const results = (job.attributes.data as any)?.results;
                const statusMessages = job.attributes.statusMessages;
                callback(Status.createOk({ status: job.status, hasWeightsFile, results, statusMessages }));
            } catch (error) {
                if (isJobNotFoundFromLoadTask(error)) {
                    callback(Status.createError('Job not found'));
                    return;
                }
                console.error('Error getting node accessibility weighting job status', error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : 'Unable to load job status'));
            }
        }
    );
}
