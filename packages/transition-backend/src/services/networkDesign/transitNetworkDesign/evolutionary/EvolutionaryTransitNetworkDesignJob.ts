/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import random from 'random';

import type { EvolutionaryTransitNetworkDesignJobType, EvolutionaryTransitNetworkDesignJob, EvolutionaryTransitNetworkDesignJobResult } from './types';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitNetworkDesignJobWrapper } from '../TransitNetworkDesignJobWrapper';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import { EvolutionaryAlgorithmOptions } from 'transition-common/lib/services/networkDesign/transit/algorithm/EvolutionaryAlgorithm';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import Agency from 'transition-common/lib/services/agency/Agency';
import Service from 'transition-common/lib/services/service/Service';
import { randomInRange } from 'chaire-lib-common/lib/utils/RandomUtils';
import { ResultSerialization } from '../../../evolutionaryAlgorithm/candidate/Candidate';
import NetworkCandidate from '../../../evolutionaryAlgorithm/candidate/LineAndNumberOfVehiclesNetworkCandidate';
import Generation from '../../../evolutionaryAlgorithm/generation/Generation';
import * as AlgoTypes from '../../../evolutionaryAlgorithm/internalTypes';
import LineAndNumberOfVehiclesGeneration, { generateFirstCandidates, reproduceCandidates } from '../../../evolutionaryAlgorithm/generation/LineAndNumberOfVehiclesGeneration';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { collectionToCache as serviceCollectionToCache } from '../../../../models/capnpCache/transitServices.cache.queries';
import { objectsToCache as linesToCache } from '../../../../models/capnpCache/transitLines.cache.queries';
import { prepareServices, saveSimulationScenario } from '../../../evolutionaryAlgorithm/preparation/ServicePreparation';

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
    return new EvolutionaryTransitNetworkDesignJobExecutor(job, options).run();
};

class EvolutionaryTransitNetworkDesignJobExecutor extends TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType> {
    private currentIteration = 1;
    private options: EvolutionaryAlgorithmOptions;

    constructor(wrappedJob: EvolutionaryTransitNetworkDesignJob, executorOptions: {
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
    }) {
        super(wrappedJob, executorOptions);
        // Nothing to do
        this.options = this.parameters.algorithmConfiguration.config;
    }

    /**
     * Prepare the data for the current simulation: Create services for the
     * lines to simulate and prepare collections containing only the required
     * data.
     *
     * @param collections Object collections containing the existing objects
     * @returns Data for simulation: `agencies` is an array of all agencies,
     * `lineCollection` contains only the lines that will be simulated, the
     * first ones are the linesToKeep, then the order is arbitrary.
     * `linesToKeep` contains the ID of the lines to keep for all candidates.
     * `services` is the collection of services created for each line, as well
     * as those used by the simulation. `lineServices` are different level of
     * services for each line and `nonSimulatedServices` are the service IDs to
     * use in the simulation, but not associated with simulated lines.
     */
    private prepareData = async (collections: {
        lines: LineCollection;
        agencies: AgencyCollection;
        services: ServiceCollection;
    }): Promise<{
        /**
         * The collection of lines to simulate. The lines to keep are at the
         * beginning of the features array, the rest are in an arbitrary order
         */
        simulatedLineCollection: LineCollection;
        lineServices: AlgoTypes.LineServices;
        /**
         * Contain the services for simulated lines, as well as those to use in the simulation
         */
        simulatedServices: ServiceCollection;
    }> => {
        const {
            nonSimulatedServices,
            simulatedAgencies,
            linesToKeep: linesToKeepParam
        } = this.parameters.transitNetworkDesignParameters;
        const linesToKeep = linesToKeepParam || [];

        const agencies = simulatedAgencies?.map((agencyId) => collections.agencies.getById(agencyId)) || [];
        const lines = agencies.flatMap((agency) => (agency ? agency.getLines() : []));

        // Sort lines so lines to keep are at the beginning
        console.log('Sorting lines...');
        lines.sort((lineA, lineB) =>
            linesToKeep.includes(lineA.getId()) && linesToKeep.includes(lineB.getId())
                ? 0
                : linesToKeep.includes(lineA.getId())
                    ? -1
                    : linesToKeep.includes(lineB.getId())
                        ? 1
                        : 0
        );
        const simulatedLineCollection = new LineCollection(lines, {});

        // Prepare various services for lines
        console.log('Preparing services...');
        console.time(`Preparing services for evolutionary algorithm for job ${this.job.id}`);
        const { lineServices, services, errors } = await prepareServices(
            simulatedLineCollection,
            collections.services,
            this
        );
        console.timeEnd(`Preparing services for evolutionary algorithm for job ${this.job.id}`);
        if (errors.length > 0) {
            await this.addMessages({ errors });
            throw new TrError('Errors while preparing services for evolutionary algorithm', 'ALGOPREP001');
        }

        // FIXME Better handle cache directory
        const cacheDirectoryPath = this.getCacheDirectory();

        // Save services and lines, with their schedules, to cache
        await serviceCollectionToCache(services, cacheDirectoryPath);
        console.log(`Saved service cache file in ${cacheDirectoryPath}.`);
        await linesToCache(simulatedLineCollection.getFeatures(), cacheDirectoryPath);
        console.log(`Saved lines cache files in ${cacheDirectoryPath}.`);

        // Add non simulated services to the collection, ie those used by the simulation, but not generated by it
        const existingServices =
            nonSimulatedServices
                ?.map((serviceId) => collections.services.getById(serviceId))
                .filter((service) => service !== undefined) || [];
        existingServices.forEach((service) => services.add(service as Service));

        return {
            simulatedServices: services,
            lineServices,
            simulatedLineCollection,
        };
    };

    isFinished = (): boolean => {
        return this.currentIteration > (this.options.numberOfGenerations || 0);
    };

    private _run = async (

    ): Promise<boolean> => {

         // Load the necessary data from the server
         const jobId = this.job.id;
         console.time(`Preparing data for evolutionary transit network design job ${jobId}`);
         // FIXME This loads everything! we don't need all that
         await this.loadServerData(serviceLocator.socketEventManager);
         console.timeEnd(`Preparing data for evolutionary transit network design job ${jobId}`);

         // Prepare the cache data for this job
         // FIXME Add checkpoint here
         console.time(`Preparing cache directory for job ${jobId}`);
         this.prepareCacheDirectory();
         console.timeEnd(`Preparing cache directory for job ${jobId}`);

        
         console.time(`Running evolutionary transit network design algorithm for job ${jobId}`);
         console.timeEnd(`Running evolutionary transit network design algorithm for job ${jobId}`);

        // FIXME Use a seed from the job data?
        const randomGenerator = random;
        // Get the agencies data

        // FIXME Cache preparation and service preparation are linked. There should be a checkpoint after and data reloaded from there
        // FIXME2 see if we need to keep anything in checkpoints
        // FIXME3 Some of them might be in the class instead
        const { simulatedLineCollection, lineServices } =
            await this.prepareData({ agencies: this.agencyCollection, lines: this.allLineCollection, services: this.serviceCollection });
        this.setLineServices(lineServices);
        this.simulatedLineCollection = simulatedLineCollection;
        // FIXME There's something to checkpoint here

        // Initialize population size if not done yet, as well as results
        if (this.job.attributes.internal_data.populationSize === undefined) {
            const populationSize = randomInRange(
                [this.options.populationSizeMin, this.options.populationSizeMax],
                randomGenerator
            );
            this.job.attributes.internal_data.populationSize = populationSize;
            // FIXME Make sure results structure is well defined
            const algorithmResults: { generations: ResultSerialization[], scenarioIds: string[] } = { generations: [], scenarioIds: [] };
            this.job.attributes.data.results = algorithmResults;
            this.job.save(this.executorOptions.progressEmitter);
        }
        const algorithmResults = this.job.attributes.data.results!;
        

        let candidates: NetworkCandidate[] = [];
        let previousGeneration: Generation | undefined = undefined;
        // FIXME Add a checkpoint here and cancellation check
        try {
            // FIXME Recover from checkpoint
            while (!this.isFinished()) {
                candidates =
                    this.currentIteration === 1
                        ? generateFirstCandidates(this)
                        : reproduceCandidates(this, candidates, this.currentIteration);
                previousGeneration = new LineAndNumberOfVehiclesGeneration(
                    candidates,
                    this,
                    this.currentIteration
                );
                const messages = await previousGeneration.prepareCandidates(this.executorOptions.progressEmitter);
                await this.addMessages(messages);
                await previousGeneration.simulate();
                // TODO For now, we keep the best of each generation, but we should
                // be smarter about it, knowing that the end of the simulation can
                // follow various rules, like a number of generation or convergence
                // of results
                algorithmResults.generations.push(previousGeneration.serializeBestResult());
                this.job.attributes.data.results = algorithmResults;
                // Await saving simulation to avoid race condition if next generation is very fast
                await this.job.save(this.executorOptions.progressEmitter);
                this.currentIteration++;

                // Save best scenarios if necessary
                if (this.options.numberOfGenerations - this.currentIteration < this.options.keepGenerations) {
                    const bestScenarios = previousGeneration.getBestScenarios(this.options.keepCandidates);
                    const scenarioSavePromises = bestScenarios?.map((scenario) =>
                        saveSimulationScenario(this.executorOptions.progressEmitter, scenario, this)
                    );
                    const scenarioIds = (await Promise.all(scenarioSavePromises)).filter(
                        (scenarioId) => scenarioId !== undefined
                    ) as string[];
                    algorithmResults.scenarioIds.push(...scenarioIds);
                    this.job.attributes.data.results = algorithmResults;
                    await this.job.save(this.executorOptions.progressEmitter);
                }
            }
        } finally {
            
        }
        if (!previousGeneration) {
            throw new TrError('Evolutionary Algorithm: no generation was done!', 'ALGOGEN001');
        }

        console.log('Evolutionary transit network design job completed.');
        this.job.setCompleted();
        await this.job.save(this.executorOptions.progressEmitter);

        return true;
    };
    
    run = async (): Promise<EvolutionaryTransitNetworkDesignJobResult> => {
        // TODO Actually implement!! See ../simulation/SimulationExecution.ts file, the runSimulation function
        try {
            
            const result = await this._run();
           
            return {
                status: 'success',
                warnings: [],
                errors: []
            };
        } catch (error) {
            console.log('error running evolutionary transit network design job', error);
            await this.addMessages({errors: [error instanceof Error ? error.message : String(error)]});
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
