/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { ExecutableJob } from '../../executableJob/ExecutableJob';
import type {
    EvolutionaryTransitNetworkDesignJob,
    EvolutionaryTransitNetworkDesignJobType
} from './evolutionary/types';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';
import { fileKey } from 'transition-common/lib/services/jobs/Job';
import { EvolutionaryTransitNetworkDesignJobParameters } from './evolutionary/types';
import { ExecutableJobUtils } from '../../executableJob/ExecutableJobUtils';

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

    // Handle the csv files for the job, either from upload and/or from another job
    if (jobParameters.simulationMethod.type === 'OdTripSimulation') {
        inputFiles.transitDemand = await ExecutableJobUtils.prepareJobFiles(
            jobParameters.simulationMethod.config.demandAttributes?.fileAndMapping.csvFile!,
            userId
        );
    }
    // TODO Handle node weight file when supported
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
    const parameters = transitNetworkJob.attributes.data.parameters;
    if (
        parameters.simulationMethod.type === 'OdTripSimulation' &&
        parameters.simulationMethod.config.demandAttributes
    ) {
        parameters.simulationMethod.config.demandAttributes.fileAndMapping.csvFile = {
            location: 'job',
            jobId,
            fileKey: 'transitDemand'
        };
    }
    return parameters;
};
