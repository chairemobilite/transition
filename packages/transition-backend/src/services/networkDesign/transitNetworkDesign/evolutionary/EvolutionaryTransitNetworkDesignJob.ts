/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import type { EvolutionaryTransitNetworkDesignJobType, EvolutionaryTransitNetworkDesignJob, EvolutionaryTransitNetworkDesignJobResult } from './types';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { evolutionaryAlgorithmFactory } from '../../../evolutionaryAlgorithm';
import { TransitNetworkDesignJobWrapper } from '../TransitNetworkDesignJobWrapper';

/**
 * Do batch calculation on a csv file input
 *
 * @param demandParameters The parameters for the batch calculation task
 * @param batchRoutingQueryAttributes The transit routing parameters, for
 * individual calculation
 * @param options Options for this calculation: the absoluteBaseDirectory is the
 * directory where the source files are and where the output files should be
 * saved. The progress emitters allows to emit progress data to clients. The
 * isCancelled function is periodically called to see if the task is cancelled.
 * The currentCheckpoint, if specified, is the last checkpoint that was
 * registered for this task. In batch routing, it represents the number of
 * completed od trips routed.
 * @returns
 */

export const runEvolutionaryTransitNetworkDesignJob = async (
    job: EvolutionaryTransitNetworkDesignJob,
    options: {
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
    }
): Promise<EvolutionaryTransitNetworkDesignJobResult> => {
    return new EvolutionaryTransitNetworkDesignJobExecutor(new TransitNetworkDesignJobWrapper(job), options).run();
};

class EvolutionaryTransitNetworkDesignJobExecutor {
    constructor(
        private jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>,
        private options: {
            progressEmitter: EventEmitter;
            isCancelled: () => boolean;
        }
    ) {
        // Nothing else to do
    }

    run = async (): Promise<EvolutionaryTransitNetworkDesignJobResult> => {
        // TODO Actually implement!! See ../simulation/SimulationExecution.ts file, the runSimulation function
        try {
            
            // Prepare the data: copy the main cache
            const jobId = this.jobWrapper.job.id;
            console.time(`Preparing data for evolutionary transit network design job ${jobId}`);
            await this.jobWrapper.loadServerData(serviceLocator.socketEventManager);
            console.timeEnd(`Preparing data for evolutionary transit network design job ${jobId}`);
            console.time(`Preparing cache directory for job ${jobId}`);
            this.jobWrapper.prepareCacheDirectory();
            console.timeEnd(`Preparing cache directory for job ${jobId}`);

            const algorithm = evolutionaryAlgorithmFactory(
                this.jobWrapper
            );
            console.time(`Running evolutionary transit network design algorithm for job ${jobId}`);
            const result = await algorithm.run(this.options.progressEmitter);
            console.timeEnd(`Running evolutionary transit network design algorithm for job ${jobId}`);
            return {
                status: 'success',
                warnings: [],
                errors: []
            };
        } catch (error) {
            console.log('error running evolutionary transit network design job', error);
            return {
                status: 'failed',
                warnings: [],
                errors: [error instanceof Error ? error.message : String(error)]
            };
        } finally {
            // Do not cleanup all cache for now, as we may come back to this job
            // later, after children have completed
        }
    };
}
