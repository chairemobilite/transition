/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { SimulationAlgorithm } from 'transition-common/lib/services/simulation/SimulationAlgorithm';
import { EvolutionAlgorithmOptions } from 'transition-common/lib/services/evolutionaryAlgorithm';
import { SimulationAlgorithmFactory } from '../simulation/SimulationExecution';
import Agency from 'transition-common/lib/services/agency/Agency';
import SimulationRun from '../simulation/SimulationRun';
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

export const evolutionaryAlgorithmFactory: SimulationAlgorithmFactory<EvolutionAlgorithmOptions> = (
    options: EvolutionAlgorithmOptions,
    simulationRun: SimulationRun
): EvolutionaryAlgorithm => new EvolutionaryAlgorithm(options, simulationRun);

export class EvolutionaryAlgorithm implements SimulationAlgorithm {
    private currentIteration = 1;

    constructor(
        private options: EvolutionAlgorithmOptions,
        private simulationRun: SimulationRun
    ) {
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
    prepareData = async (collections: {
        lines: LineCollection;
        agencies: AgencyCollection;
        services: ServiceCollection;
    }): Promise<{
        agencies: Agency[];
        lineCollection: LineCollection;
        linesToKeep: string[];
        services: ServiceCollection;
        lineServices: AlgoTypes.LineServices;
        nonSimulatedServices: string[];
    }> => {
        const {
            nonSimulatedServices,
            simulatedAgencies,
            linesToKeep: linesToKeepParam
        } = this.simulationRun.attributes.data.simulationParameters;
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
        const lineCollection = new LineCollection(lines, {});

        // Prepare various services for lines
        console.log('Preparing services...');
        const { lineServices, services } = await prepareServices(
            lineCollection,
            collections.services,
            this.simulationRun
        );

        const cacheDirectoryPath = this.simulationRun.getCacheDirectoryPath();
        const projectRelativeCacheDirectoryPath = this.simulationRun.getProjectRelativeCacheDirectoryPath();

        await serviceCollectionToCache(services, cacheDirectoryPath);
        console.log(`Saved service cache file in ${projectRelativeCacheDirectoryPath}.`);
        await linesToCache(lineCollection.getFeatures(), cacheDirectoryPath);
        console.log(`Saved lines cache files in ${projectRelativeCacheDirectoryPath}.`);

        const existingServices =
            nonSimulatedServices
                ?.map((serviceId) => collections.services.getById(serviceId))
                .filter((service) => service !== undefined) || [];
        existingServices.forEach((service) => services.add(service as Service));

        return {
            agencies: collections.agencies.getFeatures(),
            linesToKeep: linesToKeep || [],
            services,
            lineServices,
            lineCollection,
            nonSimulatedServices: nonSimulatedServices || []
        };
    };

    isFinished = (): boolean => {
        return this.currentIteration > (this.options.numberOfGenerations || 0);
    };

    run = async (
        socket: EventEmitter,
        collections: { lines: LineCollection; agencies: AgencyCollection; services: ServiceCollection }
    ): Promise<boolean> => {
        const randomGenerator = this.simulationRun.getRandomGenerator();
        // Get the agencies data
        const { agencies, lineCollection, linesToKeep, lineServices, services, nonSimulatedServices } =
            await this.prepareData(collections);

        const populationSize = randomInRange(
            [this.options.populationSizeMin, this.options.populationSizeMax],
            randomGenerator
        );
        this.simulationRun.attributes.options = {
            ...this.simulationRun.attributes.options,
            populationSize: populationSize
        };
        const generationResults: { generations: unknown[] } = { generations: [] };
        this.simulationRun.attributes.results = generationResults;

        this.simulationRun.setStarted();
        await this.simulationRun.save(socket);

        const runtimeData = {
            agencies,
            randomGenerator,
            lineServices,
            lineCollection,
            services,
            nonSimulatedServices,
            simulationRun: this.simulationRun,
            linesToKeep,
            populationSize,
            options: this.options
        };
        let candidates: NetworkCandidate[] = [];
        let previousGeneration: Generation | undefined = undefined;
        try {
            // Start trRouting instances
            await this.simulationRun.restartTrRoutingInstances();
            while (!this.isFinished()) {
                candidates =
                    this.currentIteration === 1
                        ? generateFirstCandidates(runtimeData)
                        : reproduceCandidates(runtimeData, candidates, this.currentIteration);
                previousGeneration = new LineAndNumberOfVehiclesGeneration(
                    candidates,
                    runtimeData,
                    this.currentIteration
                );
                await previousGeneration.prepareCandidates(socket);
                // Reload trRouting cache data
                await this.simulationRun.reloadTrRoutingData(['scenarios']);
                await previousGeneration.simulate();
                // TODO For now, we keep the best of each generation, but we should
                // be smarter about it, knowing that the end of the simulation can
                // follow various rules, like a number of generation or convergence
                // of results
                generationResults.generations.push(previousGeneration.serializeBestResult());
                this.simulationRun.attributes.results = generationResults;
                // Await saving simulation to avoid race condition if next generation is very fast
                await this.simulationRun.save(socket);
                this.currentIteration++;

                // Save best scenarios if necessary
                if (this.options.numberOfGenerations - this.currentIteration < this.options.keepGenerations) {
                    const bestScenarios = previousGeneration.getBestScenarios(this.options.keepCandidates);
                    const scenarioSavePromises = bestScenarios?.map((scenario) =>
                        saveSimulationScenario(socket, scenario, runtimeData)
                    );
                    const scenarioIds = (await Promise.all(scenarioSavePromises)).filter(
                        (scenarioId) => scenarioId !== undefined
                    ) as string[];
                    await this.simulationRun.saveSimulationScenarios(scenarioIds);
                }
            }
        } finally {
            this.simulationRun.stopTrRoutingInstances();
        }
        if (!previousGeneration) {
            throw new TrError('Evolutionary Algorithm: no generation was done!', 'ALGOGEN001');
        }

        this.simulationRun.setCompleted();
        await this.simulationRun.save(socket);

        return true;
    };
}
