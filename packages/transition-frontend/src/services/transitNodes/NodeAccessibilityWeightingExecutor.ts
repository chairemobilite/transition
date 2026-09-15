/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import type { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import { TransitApi } from 'transition-common/lib/api/transit';
import { JobsConstants } from 'transition-common/lib/api/jobs';
import type { JobStatus } from 'transition-common/lib/services/jobs/Job';
import type { CsvFileAndMapping, FileAndMappingAttributes } from 'transition-common/lib/services/csv/types';
import type {
    DecayFunctionParameters,
    WeightingFileMapping,
    WeightingInputType
} from 'transition-common/lib/services/weighting/types';

export type { WeightingFileMapping } from 'transition-common/lib/services/weighting/types';
export type { WeightingInputType } from 'transition-common/lib/services/weighting/types';

/**
 * Configuration for one node accessibility weighting job.
 * Stored server-side in the job's data JSON.
 */
export type NodeAccessibilityWeightingConfig = {
    weightingInputType: WeightingInputType;
    maxWalkingTimeSeconds: number;
    decayFunctionParameters: DecayFunctionParameters;
    weightingFileMapping?: WeightingFileMapping;
};

/** Parameters sent when creating or updating a job. */
export type NodeAccessibilityWeightingJobParameters = {
    description?: string;
    config: NodeAccessibilityWeightingConfig;
    /** CSV file location, field mappings, and available columns (set by GenericCsvImportAndMappingForm). */
    csvFileAndMapping?: CsvFileAndMapping<WeightingFileMapping>;
};

/** Summary item returned by the list endpoint. */
export type NodeAccessibilityWeightingJobListItem = {
    id: number;
    description?: string;
    hasWeightsFile: boolean;
};

/** Status returned by the STATUS endpoint; mirrors DB state. */
export type WeightingStatusResponse = {
    status: JobStatus;
    hasWeightsFile: boolean;
    results?: { pointCount: number; nodeCount: number; nodesWithWeight: number };
    statusMessages?: { errors?: TranslatableMessage[]; warnings?: TranslatableMessage[] };
};

/**
 * Standard worker pool progress payload forwarded through ClientEventManager.
 * Emitted as a 'progress' socket event with name 'NodeAccessibilityWeighting'.
 */
export type WorkerProgressPayload = {
    name: string;
    progress: number;
    customText?: string;
    /** Worker finished the current CSV chunk and checkpoint after pause (socket signal for UI). */
    pauseAtChunkBoundary?: boolean;
    jobId?: number;
};

/**
 * Wraps all socket.io calls for node accessibility weighting jobs.
 * Stateless -- every method is static and uses serviceLocator.socketEventManager.
 *
 * Execution is handled by the worker pool. Progress arrives as standard
 * 'progress' events (name = 'NodeAccessibilityWeighting') via ClientEventManager.
 * Status changes arrive as 'executableJob.updated' events.
 */
const INTRINSIC_ACCESSIBILITY_WEIGHTS_DOC_BASE =
    'https://github.com/chairemobilite/transition/blob/main/docs/weighting/IntrinsicAndAccessibilityWeights';

/**
 * GitHub doc URL: English has no suffix; any other language uses `_<lang>.md`.
 *
 * @see https://github.com/chairemobilite/transition/tree/main/docs/weighting
 */
export function getIntrinsicAccessibilityWeightsDocUrl(i18nLanguage: string): string {
    const lang = i18nLanguage.split(/[-_]/)[0].toLowerCase();
    if (lang === 'en') {
        // default language has no suffix
        return `${INTRINSIC_ACCESSIBILITY_WEIGHTS_DOC_BASE}.md`;
    }
    return `${INTRINSIC_ACCESSIBILITY_WEIGHTS_DOC_BASE}_${lang}.md`;
}

function emitWithStatus<T>(event: string, ...args: unknown[]): Promise<T> {
    return new Promise((resolve, reject) => {
        serviceLocator.socketEventManager.emit(event, ...args, (status: Status.Status<T>) => {
            if (Status.isStatusOk(status)) {
                resolve(Status.unwrap(status));
            } else {
                reject(status.error);
            }
        });
    });
}

export class NodeAccessibilityWeightingExecutor {
    /** Standard progress event name used by the worker pool. */
    static readonly PROGRESS_EVENT_NAME = 'NodeAccessibilityWeighting';

    static createJob(parameters: NodeAccessibilityWeightingJobParameters): Promise<{ jobId: number }> {
        return emitWithStatus(TransitApi.NODE_ACCESSIBILITY_WEIGHTING_CREATE, parameters);
    }

    static listJobs(): Promise<{ jobs: NodeAccessibilityWeightingJobListItem[] }> {
        return emitWithStatus(TransitApi.NODE_ACCESSIBILITY_WEIGHTING_LIST);
    }

    static getParameters(jobId: number): Promise<{
        parameters: NodeAccessibilityWeightingJobParameters;
        csvFields?: string[];
    }> {
        return emitWithStatus(TransitApi.NODE_ACCESSIBILITY_WEIGHTING_GET_PARAMETERS, jobId);
    }

    static duplicateJob(sourceJobId: number): Promise<{ jobId: number }> {
        return emitWithStatus(TransitApi.NODE_ACCESSIBILITY_WEIGHTING_DUPLICATE, sourceJobId);
    }

    static startWeighting(
        jobId: number,
        parameters: NodeAccessibilityWeightingJobParameters,
        fileAndMapping?: FileAndMappingAttributes<WeightingFileMapping>
    ): Promise<{ jobId: number }> {
        return emitWithStatus(TransitApi.NODE_ACCESSIBILITY_WEIGHTING_START, { jobId, parameters, fileAndMapping });
    }

    static cancelWeighting(jobId: number): void {
        emitWithStatus(JobsConstants.CANCEL_JOB, jobId).catch(() => {
            /* fire and forget */
        });
    }

    static pauseWeighting(jobId: number): void {
        emitWithStatus(JobsConstants.PAUSE_JOB, jobId).catch(() => {
            /* fire and forget */
        });
    }

    static resumeWeighting(jobId: number): void {
        emitWithStatus(JobsConstants.RESUME_JOB, jobId).catch(() => {
            /* fire and forget */
        });
    }

    static getStatus(jobId: number): Promise<WeightingStatusResponse> {
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_ACCESSIBILITY_WEIGHTING_STATUS,
                jobId,
                (status: Status.Status<WeightingStatusResponse>) => {
                    if (Status.isStatusOk(status)) {
                        resolve(Status.unwrap(status));
                    } else {
                        console.error('[NodeAccessibilityWeightingExecutor.getStatus] non-OK socket response', {
                            event: TransitApi.NODE_ACCESSIBILITY_WEIGHTING_STATUS,
                            jobId,
                            status
                        });
                        resolve({ status: 'pending', hasWeightsFile: false });
                    }
                }
            );
        });
    }
}
