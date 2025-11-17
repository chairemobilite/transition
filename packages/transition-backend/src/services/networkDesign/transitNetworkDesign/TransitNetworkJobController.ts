/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { ExecutableJob } from '../../executableJob/ExecutableJob';
import type { EvolutionaryTransitNetworkDesignJobType } from './evolutionary/types';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';
import { fileKey } from 'transition-common/lib/services/jobs/Job';
import { EvolutionaryTransitNetworkDesignJobParameters } from './evolutionary/types';

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

    // TODO Handle the csv files for the job, either from upload and/or from another job

    const job: ExecutableJob<EvolutionaryTransitNetworkDesignJobType> = await ExecutableJob.createJob({
        user_id: userId,
        name: 'evolutionaryTransitNetworkDesign',
        data: {
            parameters: jobParameters
        },
        inputFiles,
        hasOutputFiles: true
    });
    await job.enqueue();
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
