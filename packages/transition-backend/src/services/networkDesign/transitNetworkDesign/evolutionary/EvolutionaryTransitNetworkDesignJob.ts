/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import random from 'random';
import { unparse } from 'papaparse';

import type {
    EvolutionaryTransitNetworkDesignJob,
    EvolutionaryTransitNetworkDesignJobType,
    EvolutionaryTransitNetworkDesignJobResult
} from './types';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitNetworkDesignJobWrapper } from '../TransitNetworkDesignJobWrapper';
import { EvolutionaryAlgorithmOptions } from 'transition-common/lib/services/networkDesign/transit/algorithm/EvolutionaryAlgorithm';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import Service from 'transition-common/lib/services/service/Service';
import { randomInRange } from 'chaire-lib-common/lib/utils/RandomUtils';
import { ResultSerialization } from '../../../evolutionaryAlgorithm/candidate/types';
import * as AlgoTypes from '../../../evolutionaryAlgorithm/internalTypes';
import LineAndNumberOfVehiclesGeneration, {
    generateFirstCandidates,
    reproduceCandidates,
    resumeCandidatesFromChromosomes
} from '../../../evolutionaryAlgorithm/generation/LineAndNumberOfVehiclesGeneration';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import {
    collectionToCache as serviceCollectionToCache,
    collectionFromCache as serviceCollectionFromCache
} from '../../../../models/capnpCache/transitServices.cache.queries';
import { collectionFromCache as scenarioCollectionFromCache } from '../../../../models/capnpCache/transitScenarios.cache.queries';
import {
    objectsToCache as linesToCache,
    objectFromCache as lineFromCache,
    collectionToCache as lineCollectionToCache,
    collectionFromCache as lineCollectionFromCache
} from '../../../../models/capnpCache/transitLines.cache.queries';
import { prepareServices, saveSimulationScenario } from '../../../evolutionaryAlgorithm/preparation/ServicePreparation';
import Line from 'transition-common/lib/services/line/Line';
import resultsDbQueries from '../../../../models/db/networkDesignResults.db.queries';
import {
    loadAndSaveLinesByIdsToCache,
    loadAndSaveScenariosToCache,
    loadAndSaveServicesToCache
} from '../../../capnpCache/dbToCache';

const CANDIDATE_LINES_RESULTS_CSV_FILE_PREFIX = 'ndCandidateLinesResults';
const CANDIDATE_SIMULATION_RESULTS_CSV_FILE_PREFIX = 'ndCandidateSimulationResults';

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

    constructor(
        wrappedJob: EvolutionaryTransitNetworkDesignJob,
        executorOptions: {
            progressEmitter: EventEmitter;
            isCancelled: () => boolean;
        }
    ) {
        super(wrappedJob, executorOptions);
        // Nothing to do
        this.options = this.parameters.algorithmConfiguration.config;
    }

    private _getSimulatedLineCollection = (collections: {
        lines: LineCollection;
        agencies: AgencyCollection;
        services: ServiceCollection;
    }): LineCollection => {
        const { simulatedAgencies, linesToKeep: linesToKeepParam } = this.parameters.transitNetworkDesignParameters;
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
        return simulatedLineCollection;
    };

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
        const simulatedLineCollection = this._getSimulatedLineCollection(collections);

        // FIXME Better handle cache directory
        const cacheDirectoryPath = this.getCacheDirectory();
        // Save the line collection in a special cache directory. The order of
        // the lines is very important for the chromosome and we should make
        // sure it remains the same upon resume of the Job. Save it before it is
        // prepared, as after, the lines will have all their schedules and it
        // will try to serialize them too.
        await lineCollectionToCache(simulatedLineCollection, cacheDirectoryPath + '/simulatedLines');

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

        // Save services and lines, with their schedules, to cache
        await serviceCollectionToCache(services, cacheDirectoryPath);
        console.log(`Saved service cache file in ${cacheDirectoryPath}.`);
        await linesToCache(simulatedLineCollection.getFeatures(), cacheDirectoryPath);
        console.log(`Saved lines cache files in ${cacheDirectoryPath}.`);

        // Add non simulated services to the collection, ie those used by the simulation, but not generated by it
        const existingServices =
            this.parameters.transitNetworkDesignParameters.nonSimulatedServices
                ?.map((serviceId) => collections.services.getById(serviceId))
                .filter((service) => service !== undefined) || [];
        existingServices.forEach((service) => services.add(service as Service));

        return {
            simulatedServices: services,
            lineServices,
            simulatedLineCollection
        };
    };

    isFinished = (): boolean => {
        return this.currentIteration > (this.options.numberOfGenerations || 0);
    };

    private _loadAndPrepareData = async (): Promise<void> => {
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

        // FIXME Use a seed from the job data?
        const randomGenerator = random;
        // Get the agencies data

        const { simulatedLineCollection, lineServices } = await this.prepareData({
            agencies: this.agencyCollection,
            lines: this.allLineCollection,
            services: this.serviceCollection
        });
        this.setLineServices(lineServices);
        this.simulatedLineCollection = simulatedLineCollection;

        // Initialize population size if not done yet, as well as results
        const populationSize = randomInRange(
            [this.options.populationSizeMin, this.options.populationSizeMax],
            randomGenerator
        );

        // Checkoint the data preparation and initialize results
        this.job.attributes.internal_data.populationSize = populationSize;
        this.job.attributes.internal_data.dataPrepared = true;
        this.job.attributes.internal_data.lineServices = Object.keys(lineServices).reduce((acc, lineId) => {
            acc[lineId] = lineServices[lineId].map(({ service, ...lvlOfService }) => ({
                serviceId: service.getId(),
                ...lvlOfService
            }));
            return acc;
        }, {});

        // FIXME Make sure results structure is well defined
        const algorithmResults: { generations: ResultSerialization[]; scenarioIds: string[] } = {
            generations: [],
            scenarioIds: []
        };
        this.job.attributes.data.results = algorithmResults;
        this.job.save(this.executorOptions.progressEmitter);
    };

    private _loadAndPrepareDataFromCache = async (): Promise<void> => {
        // Load the necessary data from the server
        const jobId = this.job.id;
        console.time(`Preparing data for evolutionary transit network design job from cache ${jobId}`);
        // FIXME We need to have the paths and lines loaded in a CollectionManager to save the scenarios and re-generate schedules at the end. But not the whole data
        await this.loadServerData(serviceLocator.socketEventManager);

        // Get the simulated lines from cache, to make sure the order is the same as before
        const simulatedLineCollection = await lineCollectionFromCache(this.getCacheDirectory() + '/simulatedLines');
        this.simulatedLineCollection = simulatedLineCollection;

        // Read the services from the cache, with all individual line services
        // Save services and lines, with their schedules, to cache
        const serviceCollection = await serviceCollectionFromCache(this.getCacheDirectory());
        this.serviceCollection.setFeatures(serviceCollection.getFeatures());
        // Read each of the simulation line from cache
        for (let i = 0; i < simulatedLineCollection.getFeatures().length; i++) {
            const line = simulatedLineCollection.getFeatures()[i];
            const lineWithSchedule = (await lineFromCache(line.getId(), this.getCacheDirectory())) as Line;
            simulatedLineCollection.updateFeature(lineWithSchedule);
        }
        // Recreate the line level of services
        const lineServicesSerialized = this.job.attributes.internal_data.lineServices || {};
        const lineServices: AlgoTypes.LineServices = Object.keys(lineServicesSerialized).reduce((acc, lineId) => {
            acc[lineId] = lineServicesSerialized[lineId].map(({ serviceId, ...lvlOfService }) => {
                const service = serviceCollection.getById(serviceId);
                if (!service) {
                    throw new TrError(
                        'Service not found in cache while preparing evolutionary transit network design job',
                        'ALGOCACHE001'
                    );
                }
                return { service, ...lvlOfService };
            });
            return acc;
        }, {});
        this.setLineServices(lineServices);

        console.timeEnd(`Preparing data for evolutionary transit network design job from cache ${jobId}`);
    };

    private _prepareOrResumeGeneration = async (
        previousGeneration: LineAndNumberOfVehiclesGeneration | undefined
    ): Promise<LineAndNumberOfVehiclesGeneration> => {
        // Resume candidates from checkpoint if possible, scenarios are prepared
        if (
            previousGeneration === undefined &&
            this.job.attributes.internal_data.checkpoint !== undefined &&
            this.job.attributes.internal_data.checkpoint > 0 &&
            this.job.attributes.internal_data.currentGeneration !== undefined
        ) {
            this.currentIteration = this.job.attributes.internal_data.checkpoint;
            const currentGenerationData = this.job.attributes.internal_data.currentGeneration;
            // Get the current scenario collection from cache to recover previous scenarios
            const scenarioCollection = await scenarioCollectionFromCache(this.getCacheDirectory());
            const candidates = resumeCandidatesFromChromosomes(this, currentGenerationData, scenarioCollection);
            console.log(
                `Resumed generation ${this.currentIteration} with ${candidates.length} candidates from checkpoint.`
            );
            // Reset the results in the database for this generation
            await resultsDbQueries.deleteForJob(this.job.id, this.currentIteration);

            return new LineAndNumberOfVehiclesGeneration(candidates, this, this.currentIteration);
        }
        // Generate or reproduce candidates
        const candidates =
            this.currentIteration === 1 || previousGeneration === undefined
                ? generateFirstCandidates(this)
                : reproduceCandidates(this, previousGeneration.getCandidates(), this.currentIteration);
        const currentGeneration = new LineAndNumberOfVehiclesGeneration(candidates, this, this.currentIteration);
        const messages = await currentGeneration.prepareCandidates(this.executorOptions.progressEmitter);
        await this.addMessages(messages);
        // Add a checkpoint for the current generation
        this.job.attributes.internal_data.checkpoint = this.currentIteration;
        this.job.attributes.internal_data.currentGeneration = {
            candidates: candidates.map((candidate) => ({
                chromosome: candidate.getChromosome(),
                scenarioId: candidate.getScenario()?.id
            }))
        };
        await this.job.save(this.executorOptions.progressEmitter);
        return currentGeneration;
    };

    private _run = async (): Promise<boolean> => {
        // Prepare and load data, either from cache when resuming a started job or from server at first run
        if (this.job.attributes.internal_data.dataPrepared !== true) {
            await this._loadAndPrepareData();
        } else {
            await this._loadAndPrepareDataFromCache();
        }

        const algorithmResults = this.job.attributes.data.results!;

        let previousGeneration: LineAndNumberOfVehiclesGeneration | undefined = undefined;
        try {
            do {
                previousGeneration = await this._prepareOrResumeGeneration(previousGeneration);

                // FIXME Handle checkpointing with simulations that can be long
                // Simulate the generation
                await previousGeneration.simulate();

                // TODO For now, we keep the best of each generation, but we
                // should be smarter about it, knowing that the end of the
                // simulation can follow various rules, like a number of
                // generation or convergence of results. edit: Now that we save
                // results to db at each generation, we may not even need this.
                // See if runtime messages are useful or not.
                algorithmResults.generations.push(previousGeneration.serializeBestResult());
                await this.addMessages({
                    infos: [
                        `Completed generation ${this.currentIteration} with best results: ${JSON.stringify(previousGeneration.serializeBestResult())}.`
                    ]
                });
                this.job.attributes.data.results = algorithmResults;
                // Await saving simulation to avoid race condition if next generation is very fast
                await this.job.save(this.executorOptions.progressEmitter);

                // Save best scenarios if necessary
                // FIXME Refactor this so we can map a candidate with the scenario it generated and save it in the result's data for output in files
                // FIXME2 Extract this block to a function when we clean up this class
                if (this.options.numberOfGenerations - this.currentIteration < this.options.keepGenerations) {
                    const bestScenarios = previousGeneration.getBestScenarios(this.options.keepCandidates);
                    const scenarioSavePromises = bestScenarios?.map((scenario) =>
                        saveSimulationScenario(scenario, this)
                    );
                    const scenarioSaveResults = (await Promise.all(scenarioSavePromises)).filter(
                        (scenarioSaveResult) => scenarioSaveResult !== undefined
                    );
                    algorithmResults.scenarioIds.push(...scenarioSaveResults.map((result) => result!.scenarioId));
                    this.job.attributes.data.results = algorithmResults;
                    await this.job.save(this.executorOptions.progressEmitter);

                    // Update the main cache with the saved scenarios to allow analyzing them from Transition UI
                    await loadAndSaveScenariosToCache();
                    await loadAndSaveServicesToCache();
                    await loadAndSaveLinesByIdsToCache({ lineIds: scenarioSaveResults.flatMap((result) => result!.lineIds) });
                    // FIXME Should signal the main thread to restart trRouting. Or maybe it works directly?
                }

                // Save the results of this generation to the database

                // FIXME Consider doing it somewhere else, and maybe in multiple
                // steps (save candidate at the beginning and simulation results
                // at the end), to help with checkpoint recovery. It could avoid
                // saving the big blog of current generation in the job's
                // checkpointing, as well as re-run already completed candidate
                // simulations.
                const candidateResultsPromises = previousGeneration.getCandidates().map((candidate, index) =>
                    resultsDbQueries.create({
                        jobId: this.job.id,
                        generationIndex: this.currentIteration,
                        candidateIndex: index,
                        scenarioName: candidate.getScenario()?.attributes.name || '',
                        resultData: candidate.serialize()
                    })
                );
                await Promise.all(candidateResultsPromises);

                // Increment generation number
                this.currentIteration++;
            } while (!this.isFinished() && !this.executorOptions.isCancelled());
        } catch (error) {
            console.log('error during evolutionary algorithm generations', error);
            throw error;
        }
        if (!previousGeneration) {
            throw new TrError('Evolutionary Algorithm: no generation was done!', 'ALGOGEN001');
        }

        return true;
    };

    run = async (): Promise<EvolutionaryTransitNetworkDesignJobResult> => {
        // TODO Actually implement!! See ../simulation/SimulationExecution.ts file, the runSimulation function
        try {
            await this._run();

            if (this.executorOptions.isCancelled()) {
                console.log('Evolutionary transit network design job cancelled.');
                return {
                    status: 'paused',
                    warnings: [],
                    errors: []
                };
            }

            // Create the results output files, if any
            await this.saveResultFiles();

            console.log('Evolutionary transit network design job completed.');
            this.job.setCompleted();
            await this.job.save(this.executorOptions.progressEmitter);

            return {
                status: 'success',
                warnings: [],
                errors: []
            };
        } catch (error) {
            console.log('error running evolutionary transit network design job', error);
            await this.addMessages({ errors: [error instanceof Error ? error.message : String(error)] });
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

    private saveResultFiles = async (): Promise<void> => {
        console.time(`Saving results to files for evolutionary algorithm for job ${this.job.id}`);

        // TODO See if we need to put this in a class, leaving it here as is for the prototyping phase

        const linesResulsCsvAttributes = {
            generationIndex: undefined,
            candidateIndex: undefined,
            totalFitness: undefined,
            lineId: '',
            shortname: '',
            longname: '',
            numberOfVehicles: undefined,
            intervalSeconds: undefined,
            outboundPathId: '',
            inboundPathId: '',
            outboundTimeWithoutLayerSeconds: undefined,
            inboundTimeWithoutLayerSeconds: undefined
        };

        const simulationResultsCsvAttributes = {
            generationIndex: undefined,
            candidateIndex: undefined,
            totalFitness: undefined,
            scenarioName: '',
            simulationMethod: '',
            fitnessScore: undefined,
            routedCount: undefined,
            nonRoutedCount: undefined
        };

        // Register the output files and create streams
        this.job.registerOutputFile('linesResult', `${CANDIDATE_LINES_RESULTS_CSV_FILE_PREFIX}_${this.job.id}.csv`);
        const linesCsvStream = this.job.getWriteStream('linesResult');
        linesCsvStream.on('error', console.error);
        linesCsvStream.write(Object.keys(linesResulsCsvAttributes).join(',') + '\n');

        this.job.registerOutputFile(
            'simulationResults',
            `${CANDIDATE_SIMULATION_RESULTS_CSV_FILE_PREFIX}_${this.job.id}.csv`
        );
        const simulationsCsvStream = this.job.getWriteStream('simulationResults');
        simulationsCsvStream.on('error', console.error);
        simulationsCsvStream.write(Object.keys(simulationResultsCsvAttributes).join(',') + '\n');

        // Save the candidate lines file
        const resultStream = resultsDbQueries.streamCandidatesLinesData(this.job.id);

        for await (const row of resultStream) {
            const csvAttributes = {
                generationIndex: row.generation_index,
                candidateIndex: row.candidate_index,
                totalFitness: parseFloat(row.total_fitness),
                lineId: row.line_id,
                shortname: row.shortname,
                longname: row.longname,
                numberOfVehicles: parseInt(row.number_of_vehicles),
                intervalSeconds: row.time_between_passages,
                outboundPathId: row.outbound_path_id,
                inboundPathId: row.inbound_path_id,
                outboundTimeWithoutLayerSeconds: row.outbound_path_data?.operatingTimeWithoutLayoverTimeSeconds,
                inboundTimeWithoutLayerSeconds: row.inbound_path_data?.operatingTimeWithoutLayoverTimeSeconds
            };
            linesCsvStream.write(unparse([csvAttributes], { header: false }) + '\n');
        }
        linesCsvStream.end();

        // Save the candidate simulation results file
        const simulationResultStream = resultsDbQueries.streamSimulationResults(this.job.id);
        for await (const row of simulationResultStream) {
            const csvAttributes = {
                generationIndex: row.generation_index,
                candidateIndex: row.candidate_index,
                totalFitness: parseFloat(row.total_fitness),
                scenarioName: row.candidate_data?.scenarioName || '',
                simulationMethod: row.simulation_method,
                fitnessScore: parseFloat(row.fitness_score),
                routedCount: typeof row.data?.routedCount === 'number' ? row.data.routedCount : undefined,
                nonRoutedCount: typeof row.data?.nonRoutedCount === 'number' ? row.data.nonRoutedCount : undefined
            };
            simulationsCsvStream.write(unparse([csvAttributes], { header: false }) + '\n');
        }
        simulationsCsvStream.end();

        console.timeEnd(`Saving results to files for evolutionary algorithm for job ${this.job.id}`);
    };
}
