/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import path from 'path';

import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import { ExecutableJobUtils } from '../../../executableJob/ExecutableJobUtils';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import type {
    NodeWeightingJob,
    NodeWeightingJobParameters,
    NodeWeightingJobType,
    NodeWeightingJobListItem
} from './types';

type NodeWeightingInputFiles = {
    [Property in keyof NodeWeightingJobType['files']]?: string | { filepath: string; renameTo: string };
};

async function buildInputFilesForNodeWeightingJob(
    parameters: NodeWeightingJobParameters,
    userId: number
): Promise<NodeWeightingInputFiles> {
    const inputFiles: NodeWeightingInputFiles = {};
    const nodeWeighting = parameters.nodeWeighting;
    if (nodeWeighting?.weightingFileAttributes?.fileAndMapping?.csvFile) {
        const csvFile = nodeWeighting.weightingFileAttributes.fileAndMapping.csvFile;
        inputFiles.nodeWeight = await ExecutableJobUtils.prepareJobFiles(csvFile, userId);
    }
    return inputFiles;
}

/**
 * Create a new node weighting job (pending). Returns the job id.
 */
export async function createNodeWeightingJob(
    parameters: NodeWeightingJobParameters,
    userId: number
): Promise<NodeWeightingJob> {
    const inputFiles = await buildInputFilesForNodeWeightingJob(parameters, userId);
    const job = await ExecutableJob.createJob({
        user_id: userId,
        name: 'nodeWeighting',
        data: {
            parameters,
            description: parameters.description
        },
        inputFiles
    });
    return job as NodeWeightingJob;
}

/**
 * Save node weighting config: create a new job or update an existing one.
 * Returns the job id.
 */
export async function saveNodeWeightingConfig(
    parameters: NodeWeightingJobParameters,
    userId: number,
    existingJobId?: number
): Promise<number> {
    const isUpdate = typeof existingJobId === 'number' && Number.isInteger(existingJobId) && existingJobId > 0;
    if (isUpdate) {
        const job = await ExecutableJob.loadTask(existingJobId);
        if (job.attributes.user_id !== userId) {
            throw new TrError(
                'Not allowed to update this job',
                'NWJC001',
                'transit:networkDesign.errors.NotAllowedToUpdateJob'
            );
        }
        if (job.attributes.name !== 'nodeWeighting') {
            throw new TrError(
                'Job is not a node weighting job',
                'NWJC002',
                'transit:networkDesign.errors.InvalidJobType'
            );
        }
        const nodeWeightingJob = job as NodeWeightingJob;
        const jobDir = nodeWeightingJob.getJobFileDirectory();
        if (!fs.existsSync(jobDir)) {
            fs.mkdirSync(jobDir, { recursive: true });
        }
        const inputFiles = await buildInputFilesForNodeWeightingJob(parameters, userId);
        const resourcesFiles: Record<string, string> = {
            ...(nodeWeightingJob.attributes.resources?.files || {})
        };
        for (const [inputFileKey, inputFile] of Object.entries(inputFiles)) {
            if (inputFile === undefined) {
                continue;
            }
            const filePath = typeof inputFile === 'string' ? inputFile : inputFile.filepath;
            const jobFileName = typeof inputFile === 'string' ? path.parse(filePath).base : inputFile.renameTo;
            if (fileManager.fileExistsAbsolute(filePath)) {
                const destPath = path.join(jobDir, jobFileName);
                fileManager.copyFileAbsolute(filePath, destPath, true);
                resourcesFiles[inputFileKey] = jobFileName;
            }
        }
        nodeWeightingJob.attributes.data = {
            ...nodeWeightingJob.attributes.data,
            parameters,
            description: parameters.description
        };
        nodeWeightingJob.attributes.resources = {
            ...nodeWeightingJob.attributes.resources,
            files: resourcesFiles
        };
        await nodeWeightingJob.save();
        return nodeWeightingJob.attributes.id;
    }

    const job = await createNodeWeightingJob(parameters, userId);
    return job.attributes.id;
}

/**
 * List all node weighting jobs for the user.
 */
export async function listNodeWeightingJobs(userId: number): Promise<NodeWeightingJobListItem[]> {
    const { jobs } = await ExecutableJob.collection({
        userId,
        jobType: 'nodeWeighting',
        pageIndex: 0,
        pageSize: 1000,
        sort: [{ field: 'id', direction: 'desc' }]
    });
    const result: NodeWeightingJobListItem[] = [];
    for (const job of jobs) {
        const nodeWeightingJob = job as NodeWeightingJob;
        const jobDir = nodeWeightingJob.getJobFileDirectory();
        const nodeWeightsPath = path.join(jobDir, 'node_weights.csv');
        const hasWeightsFile = fs.existsSync(nodeWeightsPath);
        const description = nodeWeightingJob.attributes.data?.description;
        result.push({
            id: nodeWeightingJob.attributes.id,
            description,
            hasWeightsFile
        });
    }
    return result;
}

export type NodeWeightingGetParametersResponse = {
    parameters: NodeWeightingJobParameters;
    existingFileNames?: Record<string, string>;
};

/**
 * Get parameters and existing file names for a node weighting job (for form replay).
 */
export async function getNodeWeightingJobParameters(
    jobId: number,
    userId: number
): Promise<NodeWeightingGetParametersResponse> {
    const job = await ExecutableJob.loadTask(jobId);
    if (job.attributes.user_id !== userId) {
        throw new TrError('Not allowed to get parameters for this job', 'NWJC003', 'transit:main:errors:Forbidden');
    }
    if (job.attributes.name !== 'nodeWeighting') {
        throw new TrError('Job is not a node weighting job', 'NWJC004', 'transit:networkDesign.errors.InvalidJobType');
    }
    const nodeWeightingJob = job as NodeWeightingJob;
    const data = nodeWeightingJob.attributes.data;
    const params = data?.parameters as NodeWeightingJobParameters;
    const description = data?.description;
    const parameters: NodeWeightingJobParameters = {
        ...params,
        description,
        nodeWeighting: { ...params.nodeWeighting }
    };
    if (parameters.nodeWeighting?.weightingFileAttributes?.fileAndMapping) {
        parameters.nodeWeighting.weightingFileAttributes.fileAndMapping.csvFile = {
            location: 'job',
            jobId,
            fileKey: 'nodeWeight'
        };
    }
    const existingFileNames =
        nodeWeightingJob.attributes.resources?.files !== undefined
            ? { ...nodeWeightingJob.attributes.resources.files }
            : undefined;
    return { parameters, existingFileNames };
}
