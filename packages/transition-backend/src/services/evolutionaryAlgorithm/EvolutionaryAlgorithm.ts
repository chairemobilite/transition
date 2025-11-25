/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import random from 'random';

import { TransitNetworkDesignAlgorithm } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import { EvolutionaryAlgorithmOptions } from 'transition-common/lib/services/networkDesign/transit/algorithm/EvolutionaryAlgorithm';
import Agency from 'transition-common/lib/services/agency/Agency';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import { collectionToCache as serviceCollectionToCache } from '../../models/capnpCache/transitServices.cache.queries';
import { objectsToCache as linesToCache } from '../../models/capnpCache/transitLines.cache.queries';
import { randomInRange } from 'chaire-lib-common/lib/utils/RandomUtils';
import LineAndNumberOfVehiclesGeneration, {
    generateFirstCandidates,
    reproduceCandidates
} from './generation/LineAndNumberOfVehiclesGeneration';
import { prepareServices, saveSimulationScenario } from './preparation/ServicePreparation';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import * as AlgoTypes from './internalTypes';
import NetworkCandidate from './candidate/LineAndNumberOfVehiclesNetworkCandidate';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import Service from 'transition-common/lib/services/service/Service';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Generation from './generation/Generation';
import { EvolutionaryTransitNetworkDesignJobType } from '../networkDesign/transitNetworkDesign/evolutionary/types';
import { ResultSerialization } from './candidate/Candidate';
import { TransitNetworkDesignAlgorithmFactory, TransitNetworkDesignJobWrapper } from '../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';

export const evolutionaryAlgorithmFactory: TransitNetworkDesignAlgorithmFactory<
    EvolutionaryTransitNetworkDesignJobType
> = (jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>): EvolutionaryAlgorithm =>
    new EvolutionaryAlgorithm(jobWrapper);

export class EvolutionaryAlgorithm implements TransitNetworkDesignAlgorithm {
    private currentIteration = 1;
    private options: EvolutionaryAlgorithmOptions;

    constructor(private jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>) {
        this.options = this.jobWrapper.parameters.algorithmConfiguration.config;
        // Nothing to do
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
        agencies: Agency[];
        /**
         * The collection of lines to simulate. The lines to keep are at the
         * beginning of the features array, the rest are in an arbitrary order
         */
        simulatedLineCollection: LineCollection;
        linesToKeep: string[];
        /**
         * Contain the services for simulated lines, as well as those to keep
         */
        simulatedServices: ServiceCollection;
        lineServices: AlgoTypes.LineServices;
        nonSimulatedServices: string[];
    }> => {
        const {
            nonSimulatedServices,
            simulatedAgencies,
            linesToKeep: linesToKeepParam
        } = this.jobWrapper.parameters.transitNetworkDesignParameters;
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
        const { lineServices, services } = await prepareServices(
            simulatedLineCollection,
            collections.services,
            this.jobWrapper
        );

        // FIXME Better handle cache directory
        const cacheDirectoryPath = this.jobWrapper.getCacheDirectory();

        await serviceCollectionToCache(services, cacheDirectoryPath);
        console.log(`Saved service cache file in ${cacheDirectoryPath}.`);
        await linesToCache(simulatedLineCollection.getFeatures(), cacheDirectoryPath);
        console.log(`Saved lines cache files in ${cacheDirectoryPath}.`);

        const existingServices =
            nonSimulatedServices
                ?.map((serviceId) => collections.services.getById(serviceId))
                .filter((service) => service !== undefined) || [];
        existingServices.forEach((service) => services.add(service as Service));

        return {
            agencies: collections.agencies.getFeatures(),
            linesToKeep: linesToKeep || [],
            simulatedServices: services,
            lineServices,
            simulatedLineCollection,
            nonSimulatedServices: nonSimulatedServices || []
        };
    };

    isFinished = (): boolean => {
        return this.currentIteration > (this.options.numberOfGenerations || 0);
    };

    run = async (
        socket: EventEmitter
    ): Promise<boolean> => {
        // FIXME Use a seed from the job data?
        const randomGenerator = random;
        // Get the agencies data
        const { agencies, simulatedLineCollection, linesToKeep, lineServices, simulatedServices, nonSimulatedServices } =
            await this.prepareData({ agencies: this.jobWrapper.agencyCollection, lines: this.jobWrapper.allLineCollection, services: this.jobWrapper.serviceCollection });
        this.jobWrapper.setLineServices(lineServices);
        this.jobWrapper.simulatedLineCollection = simulatedLineCollection;

        const populationSize = randomInRange(
            [this.options.populationSizeMin, this.options.populationSizeMax],
            randomGenerator
        );
        this.jobWrapper.job.attributes.internal_data.populationSize = populationSize;
        const algorithmResults: { generations: ResultSerialization[], scenarioIds: string[] } = { generations: [], scenarioIds: [] };
        this.jobWrapper.job.attributes.data.results = algorithmResults;

        let candidates: NetworkCandidate[] = [];
        let previousGeneration: Generation | undefined = undefined;
        // TODO Add a checkpoint here and cancellation check
        try {
            while (!this.isFinished()) {
                candidates =
                    this.currentIteration === 1
                        ? generateFirstCandidates(this.jobWrapper)
                        : reproduceCandidates(this.jobWrapper, candidates, this.currentIteration);
                previousGeneration = new LineAndNumberOfVehiclesGeneration(
                    candidates,
                    this.jobWrapper,
                    this.currentIteration
                );
                const messages = await previousGeneration.prepareCandidates(socket);
                await this.jobWrapper.addMessages(messages);
                await previousGeneration.simulate();
                // TODO For now, we keep the best of each generation, but we should
                // be smarter about it, knowing that the end of the simulation can
                // follow various rules, like a number of generation or convergence
                // of results
                algorithmResults.generations.push(previousGeneration.serializeBestResult());
                this.jobWrapper.job.attributes.data.results = algorithmResults;
                // Await saving simulation to avoid race condition if next generation is very fast
                await this.jobWrapper.job.save(socket);
                this.currentIteration++;

                // Save best scenarios if necessary
                if (this.options.numberOfGenerations - this.currentIteration < this.options.keepGenerations) {
                    const bestScenarios = previousGeneration.getBestScenarios(this.options.keepCandidates);
                    const scenarioSavePromises = bestScenarios?.map((scenario) =>
                        saveSimulationScenario(socket, scenario, this.jobWrapper)
                    );
                    const scenarioIds = (await Promise.all(scenarioSavePromises)).filter(
                        (scenarioId) => scenarioId !== undefined
                    ) as string[];
                    algorithmResults.scenarioIds.push(...scenarioIds);
                    this.jobWrapper.job.attributes.data.results = algorithmResults;
                    await this.jobWrapper.job.save(socket);
                }
            }
        } finally {
            
        }
        if (!previousGeneration) {
            throw new TrError('Evolutionary Algorithm: no generation was done!', 'ALGOGEN001');
        }

        this.jobWrapper.job.setCompleted();
        await this.jobWrapper.job.save(socket);

        return true;
    };
}
