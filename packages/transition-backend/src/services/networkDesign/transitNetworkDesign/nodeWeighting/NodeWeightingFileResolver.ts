/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';

import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import { ExecutableJobUtils } from '../../../executableJob/ExecutableJobUtils';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import type { EvolutionaryTransitNetworkDesignJobParameters } from '../evolutionary/types';
import { NODE_WEIGHTS_OUTPUT_FILENAME } from '../evolutionary/types';

type InputFileReference = string | { filepath: string; renameTo: string };

export type EvolutionaryNodeWeightingInputFiles = {
    nodeWeight?: InputFileReference;
    nodeWeightsOutput?: InputFileReference;
};

/**
 * Resolve node-weighting related input files for an evolutionary transit network
 * design job. Includes optional weighting input csv and precomputed
 * node_weights.csv lineage from a source job.
 */
export async function resolveNodeWeightingInputFilesForEvolutionaryJob(
    parameters: EvolutionaryTransitNetworkDesignJobParameters,
    userId: number,
    options?: { fallbackSourceJobId?: number }
): Promise<EvolutionaryNodeWeightingInputFiles> {
    const inputFiles: EvolutionaryNodeWeightingInputFiles = {};
    if (parameters.simulationMethod.type !== 'OdTripSimulation') {
        return inputFiles;
    }

    const nodeWeighting = parameters.simulationMethod.config.nodeWeighting;
    const weightingCsv = nodeWeighting?.weightingFileAttributes?.fileAndMapping?.csvFile;
    if (nodeWeighting?.weightingEnabled && weightingCsv) {
        try {
            inputFiles.nodeWeight = await ExecutableJobUtils.prepareJobFiles(weightingCsv, userId);
        } catch {
            // Non-fatal: the weighting input CSV may not exist when the user
            // uploaded a pre-computed node_weights.csv directly.
        }
    }

    const sourceJobId = weightingCsv?.location === 'job' ? weightingCsv.jobId : options?.fallbackSourceJobId;
    if (sourceJobId === undefined) {
        return inputFiles;
    }
    try {
        const sourceJob = await ExecutableJob.loadTask(sourceJobId);
        if (sourceJob.attributes.user_id === userId) {
            const sourcePath = path.join(sourceJob.getJobFileDirectory(), NODE_WEIGHTS_OUTPUT_FILENAME);
            if (fileManager.fileExistsAbsolute(sourcePath)) {
                inputFiles.nodeWeightsOutput = sourcePath;
            }
        } else {
            console.error('Node weights not copied: source job owner differs', {
                sourceJobId,
                sourceJobUserId: sourceJob.attributes.user_id,
                userId
            });
        }
    } catch (error) {
        console.error(`Error copying node weights output from source job ${sourceJobId}:`, error);
    }
    return inputFiles;
}

/**
 * Rewrites node-weighting csv file references to point to files stored in a
 * persisted job directory.
 */
export function rewriteNodeWeightingCsvFileToJobLocation(
    simulationConfig: {
        nodeWeighting?: {
            weightingFileAttributes?: {
                fileAndMapping?: {
                    csvFile?: unknown;
                };
            };
        };
    },
    jobId: number
): void {
    const fileAndMapping = simulationConfig.nodeWeighting?.weightingFileAttributes?.fileAndMapping;
    if (!fileAndMapping) {
        return;
    }
    fileAndMapping.csvFile = {
        location: 'job',
        jobId,
        fileKey: 'nodeWeight'
    };
}
