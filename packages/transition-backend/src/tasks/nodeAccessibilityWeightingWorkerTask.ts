/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import { EventEmitter } from 'events';

import TrError from 'chaire-lib-common/lib/utils/TrError';
import { JobDataType } from 'transition-common/lib/services/jobs/Job';
import { ExecutableJob } from '../services/executableJob/ExecutableJob';
import type { NodeAccessibilityWeightingJobType } from '../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingJobType';
import {
    executeNodeAccessibilityWeighting,
    enrichNodeWeightsCsvOnDisk,
    enrichedWeightsFilenameForJob,
    loadPartialCheckpointBundle,
    removePartialWeightsFile,
    resolveWeightsFilePath,
    savePartialWeightsMapAtomic,
    weightsFilenameForJob
} from '../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingService';

/** Payload extension for node accessibility weighting: worker finished current chunk after user pause. */
export type NodeAccessibilityWeightingProgressPayload = {
    name: string;
    customText?: string;
    progress: number;
    pauseAtChunkBoundary?: boolean;
    /** Present on pause-boundary events so the client can match the job. */
    jobId?: number;
};

export type NodeAccessibilityWeightingTaskOutcome = 'completed' | 'failed' | 'paused';

/** Shared worker infrastructure injected by the main worker pool entry point. */
export type WorkerHelpers = {
    newProgressEmitter: (task: ExecutableJob<JobDataType>) => EventEmitter;
    getTaskCancelledFct: (task: ExecutableJob<JobDataType>) => () => boolean;
};

/** Tell the client the job is safe to treat as paused (chunk + checkpoint done, or no work started). */
export const emitNodeAccessibilityPauseAtChunkBoundary = (
    task: ExecutableJob<JobDataType>,
    helpers: WorkerHelpers
): void => {
    if (task.attributes.name !== 'nodeAccessibilityWeighting') {
        return;
    }
    const progressEmitter = helpers.newProgressEmitter(task);
    progressEmitter.emit('progress', {
        name: 'NodeAccessibilityWeighting',
        progress: -1,
        pauseAtChunkBoundary: true,
        jobId: task.attributes.id
    });
};

/**
 * Worker wrapper for node accessibility weighting jobs.
 *
 * Uses {@link WorkerHelpers.getTaskCancelledFct} for background status polling (within-chunk)
 * and direct {@link ExecutableJob.getJobStatus} reads between chunks. Checkpoint
 * persistence is delegated to the `'checkpoint'` handler on `newProgressEmitter`.
 *
 * See {@link NodeAccessibilityWeightingJobType} for the full lifecycle model.
 */
export const wrapNodeAccessibilityWeighting = async (
    task: ExecutableJob<NodeAccessibilityWeightingJobType>,
    taskListener: EventEmitter,
    helpers: WorkerHelpers
): Promise<NodeAccessibilityWeightingTaskOutcome> => {
    const config = task.attributes.data.parameters?.config;
    if (!config) {
        throw new TrError(
            'Job has incomplete configuration',
            'NAWJOB001',
            'transit:transitNode.accessibilityWeighting.errors.IncompleteConfig'
        );
    }

    await task.refresh();
    const jobDir = task.getJobFileDirectory();
    const progressEmitter = helpers.newProgressEmitter(task);

    const bundle = loadPartialCheckpointBundle(jobDir);
    const dbCheckpoint =
        typeof task.attributes.internal_data?.checkpoint === 'number' && task.attributes.internal_data.checkpoint >= 0
            ? task.attributes.internal_data.checkpoint
            : 0;
    let resumePointsProcessed = Math.max(dbCheckpoint, bundle.intrinsicPointsProcessed);

    let resumeWeights: Map<string, number> | undefined;
    if (resumePointsProcessed > 0) {
        if (bundle.weights.size === 0) {
            console.warn(
                `Node accessibility weighting job ${task.attributes.id}: checkpoint=${resumePointsProcessed} but partial weights file is missing or empty; restarting from scratch.`
            );
            resumePointsProcessed = 0;
            const internal = { ...(task.attributes.internal_data ?? {}) };
            delete internal.checkpoint;
            task.attributes.internal_data = internal;
            await task.save(taskListener);
        } else {
            resumeWeights = bundle.weights;
        }
    }

    const isCancelled = helpers.getTaskCancelledFct(task);

    /** Between chunks: fresh DB read so pause/cancel is detected immediately. */
    const isCancelledBetweenChunks = async (): Promise<boolean> => {
        const status = await ExecutableJob.getJobStatus(task.attributes.id);
        return status !== 'inProgress';
    };

    /**
     * Inside a chunk: uses the background-polled status from {@link WorkerHelpers.getTaskCancelledFct}
     * (treats paused, cancelled, and undefined as "stop"). Partial chunk results are
     * discarded; on resume the chunk is re-done from the last checkpoint.
     */
    const isCancelledWithinChunk = (): boolean => {
        return isCancelled();
    };

    const stats = await executeNodeAccessibilityWeighting(
        jobDir,
        config,
        {
            onProgress: (processedCount, _totalCount) => {
                if (isCancelled()) return;
                progressEmitter.emit('progress', {
                    name: 'NodeAccessibilityWeighting',
                    progress: -1,
                    customText: `${processedCount} points processed`
                });
            },
            isCancelled: isCancelledBetweenChunks,
            isCancelledWithinChunk
        },
        {
            weightsOutputFilename: weightsFilenameForJob(task.attributes.id),
            resumePointsProcessed: resumePointsProcessed > 0 ? resumePointsProcessed : undefined,
            resumeWeights,
            onCheckpoint: async ({ pointsProcessed, accumulatedWeights }) => {
                savePartialWeightsMapAtomic(jobDir, new Map(accumulatedWeights), pointsProcessed);
                progressEmitter.emit('checkpoint', pointsProcessed);
            }
        }
    );

    await task.refresh();

    if (stats.finishedNormally) {
        removePartialWeightsFile(jobDir);
        const internal = { ...(task.attributes.internal_data ?? {}) };
        delete internal.checkpoint;
        task.attributes.internal_data = internal;

        const rawPath = resolveWeightsFilePath(jobDir, task.attributes.id);
        if (rawPath) {
            const enrichedBasename = enrichedWeightsFilenameForJob(task.attributes.id);
            const enrichedPath = path.join(jobDir, enrichedBasename);
            await enrichNodeWeightsCsvOnDisk(rawPath, enrichedPath);
            task.registerOutputFile('output', enrichedBasename);
        } else {
            task.registerOutputFile('output', weightsFilenameForJob(task.attributes.id));
        }

        task.attributes.data = {
            ...task.attributes.data,
            results: {
                pointCount: stats.pointCount,
                nodeCount: stats.nodeCount,
                nodesWithWeight: stats.nodesWithWeight
            }
        };
        await task.save(taskListener);
        progressEmitter.emit('progress', {
            name: 'NodeAccessibilityWeighting',
            progress: 1.0
        });
        return 'completed';
    }

    if (task.status === 'cancelled') {
        removePartialWeightsFile(jobDir);
        const internal = { ...(task.attributes.internal_data ?? {}) };
        delete internal.checkpoint;
        task.attributes.internal_data = internal;
        await task.save(taskListener);
        return 'failed';
    }

    if (task.status === 'paused') {
        emitNodeAccessibilityPauseAtChunkBoundary(task, helpers);
        return 'paused';
    }

    return 'failed';
};
