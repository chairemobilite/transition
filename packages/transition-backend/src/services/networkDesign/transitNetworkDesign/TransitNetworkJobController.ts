/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import { EventEmitter } from 'events';

import { ExecutableJob } from '../../executableJob/ExecutableJob';
import type {
    EvolutionaryTransitNetworkDesignJob,
    EvolutionaryTransitNetworkDesignJobType
} from './evolutionary/types';
import { EvolutionaryTransitNetworkDesignJobParameters, NODE_WEIGHTS_OUTPUT_FILENAME } from './evolutionary/types';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';
import { fileKey } from 'transition-common/lib/services/jobs/Job';
import { ExecutableJobUtils } from '../../executableJob/ExecutableJobUtils';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const createAndEnqueueEvolutionaryTransitNetworkDesignJob = async (
    jobParameters: EvolutionaryTransitNetworkDesignJobParameters,
    eventEmitter: EventEmitter,
    userId: number
) => {
    const inputFiles: {
        [Property in keyof EvolutionaryTransitNetworkDesignJobType[fileKey]]?:
            | string
            | { filepath: string; renameTo: string };
    } = {};

    // Handle job files for OdTripSimulation: demand, optional weighting input, and when cloning the node weights output
    if (jobParameters.simulationMethod.type === 'OdTripSimulation') {
        const config = jobParameters.simulationMethod.config;
        const demandCsv = config.demandAttributes?.fileAndMapping?.csvFile;
        const weightingCsv = config.nodeWeighting?.weightingFileAttributes?.fileAndMapping?.csvFile;

        if (demandCsv) {
            inputFiles.transitDemand = await ExecutableJobUtils.prepareJobFiles(demandCsv, userId);
        } else {
            throw new TrError(
                'Missing demand csv file',
                'TRJOBC0001',
                'transit:networkDesign.errors.MissingDemandCsvFile'
            );
        }
        if (
            config.nodeWeighting?.weightingEnabled &&
            config.nodeWeighting.weightingSource === 'separateFile' &&
            weightingCsv
        ) {
            inputFiles.nodeWeight = await ExecutableJobUtils.prepareJobFiles(weightingCsv, userId);
        }

        // When cloning (file refs point to a job), copy node weights output from source job via same inputFiles flow
        const sourceJobId =
            demandCsv?.location === 'job'
                ? demandCsv.jobId
                : weightingCsv?.location === 'job'
                    ? weightingCsv.jobId
                    : undefined;
        if (sourceJobId !== undefined) {
            try {
                const sourceJob = await ExecutableJob.loadTask(sourceJobId);
                if (sourceJob.attributes.user_id === userId) {
                    const sourcePath = path.join(sourceJob.getJobFileDirectory(), NODE_WEIGHTS_OUTPUT_FILENAME);
                    if (fileManager.fileExistsAbsolute(sourcePath)) {
                        inputFiles.nodeWeightsOutput = sourcePath;
                    }
                }
            } catch (error) {
                // Source job not found or inaccessible, skip copying node weights
                console.error('Error copying node weights output from source job:', error);
            }
        }
    }
    // TODO Handle accessibility map simulation when supported

    // FIXME For OdTripSimulation, we need to ensure the demand file is properly
    // set in the job parameters and go from
    // OdTripSimulationDemandFromCsvAttributes in the UI/frontend to simply
    // OdTripSimulationFromCsvAttributes in the backend, but we need different
    // types for the method configuration in backend and frontend to do so
    // correctly.
    const job: EvolutionaryTransitNetworkDesignJob = await ExecutableJob.createJob({
        user_id: userId,
        name: 'evolutionaryTransitNetworkDesign',
        data: {
            parameters: jobParameters
        },
        inputFiles
    });

    await job.enqueue(eventEmitter);
    await job.refresh();
};

export const createAndEnqueueTransitNetworkDesignJob = async (
    jobParameters: TransitNetworkJobConfigurationType,
    eventEmitter: EventEmitter,
    userId: number
) => {
    eventEmitter.emit('progress', { name: 'NetworkDesign', progress: null });

    if (jobParameters.algorithmConfiguration.type === 'evolutionaryAlgorithm') {
        return await createAndEnqueueEvolutionaryTransitNetworkDesignJob(jobParameters, eventEmitter, userId);
    } else {
        throw 'Unsupported algorithm type for transit network design job';
    }
};

export const getParametersFromTransitNetworkDesignJob = async (jobId: number, userId: number) => {
    const fromJob = await ExecutableJob.loadTask(jobId);
    // TODO We only have one job type for transit network design for now, but update when we have more
    if (fromJob.attributes.name !== 'evolutionaryTransitNetworkDesign') {
        throw 'Requested job is not an evolutionaryTransitNetworkDesign job';
    }
    if (fromJob.attributes.user_id !== userId) {
        throw 'Not allowed to get the data from another user\' job';
    }
    const transitNetworkJob = fromJob as EvolutionaryTransitNetworkDesignJob;
    const clonedParameters = structuredClone(transitNetworkJob.attributes.data.parameters);
    if (clonedParameters.simulationMethod.type === 'OdTripSimulation') {
        const config = clonedParameters.simulationMethod.config;
        if (config.demandAttributes?.fileAndMapping) {
            config.demandAttributes.fileAndMapping.csvFile = {
                location: 'job',
                jobId,
                fileKey: 'transitDemand'
            };
        }
        if (
            config.nodeWeighting?.weightingSource === 'separateFile' &&
            config.nodeWeighting.weightingFileAttributes?.fileAndMapping
        ) {
            config.nodeWeighting.weightingFileAttributes.fileAndMapping.csvFile = {
                location: 'job',
                jobId,
                fileKey: 'nodeWeight'
            };
        }
    }
    return clonedParameters;
};
