/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import pQueue from 'p-queue';
import { EventEmitter } from 'events';

import NetworkCandidate, { ResultSerialization } from '../candidate/Candidate';
import { collectionToCache } from '../../../models/capnpCache/transitScenarios.cache.queries';
import * as AlgoTypes from '../internalTypes';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import SimulationRunBackend from '../../simulation/SimulationRun';
import GenerationLogger from './GenerationLogger';

abstract class Generation {
    protected fitnessSorter: (fitnessA: number, fitnessB: number) => number;

    constructor(
        protected candidates: NetworkCandidate[],
        protected options: AlgoTypes.RuntimeAlgorithmData,
        protected generationNumber = 1,
        protected logger: GenerationLogger
    ) {
        this.fitnessSorter =
            Preferences.current.simulations.geneticAlgorithms.fitnessSorters[
                options.simulationRun.attributes.options?.fitnessSorter as string
            ];
        this.logger =
            logger ||
            new GenerationLogger({
                formats: ['csv', 'json', 'log']
            });
    }

    getCandidates(): NetworkCandidate[] {
        return this.candidates;
    }

    getSize(): number {
        return this.getCandidates().length;
    }

    getSimulationRun(): SimulationRunBackend {
        return this.options.simulationRun;
    }

    getGenerationNumber(): number {
        return this.generationNumber;
    }

    async prepareCandidates(socket: EventEmitter) {
        const time = Date.now();

        // TODO Cleanup old data?

        console.log(`  generation ${this.generationNumber}: preparing candidates`);

        const promiseQueue = new pQueue({ concurrency: 1 });

        const candidatePreparationPromises = this.candidates.map(
            async (candidate, candidateIdx) =>
                await promiseQueue.add(async () => {
                    try {
                        return await candidate.prepareScenario(socket);
                    } catch (err) {
                        console.error(
                            `Error preparing scenario for candidate ${candidateIdx} of ${this.generationNumber}th generation: ${err}`
                        );
                    }
                })
        );

        try {
            const scenarios = await Promise.all(candidatePreparationPromises);
            const scenarioCollection = new ScenarioCollection(scenarios, {});
            await collectionToCache(scenarioCollection, this.options.simulationRun.getCacheDirectoryPath());
            console.log(
                `  generation ${this.generationNumber}: preparation completed in ${
                    (Date.now() - time) / 1000
                } sec. and saved in ${this.options.simulationRun.getProjectRelativeCacheDirectoryPath()}`
            );
        } catch {
            console.log('Some candidates could not be prepared');
        }
    }

    /**
     * Run the simulation on this generation. At the end of the simulation, if
     * this method returns true, the candidates are sorted by best cost first.
     *
     * @returns `true` if the simulation was completed successfully.
     */
    async simulate(): Promise<boolean> {
        const time = Date.now();

        console.log(`  generation ${this.generationNumber}: simulating candidates`);

        const candidatesCount = this.getSize();
        const candidates = this.getCandidates();
        // Run the simulation for each candidate
        const promises: Promise<{
            results: { [key: string]: { fitness: number; results: unknown } };
        }>[] = [];
        for (let i = 0; i < candidatesCount; i++) {
            promises.push(candidates[i].simulate());
        }

        await Promise.all(promises);
        this.sortCandidates();

        console.log(
            `  generation ${this.generationNumber}: simulation completed in ${(Date.now() - time) / 1000} sec.`
        );

        this.logger.doLog(this);

        return true;
    }

    serializeBestResult(): ResultSerialization {
        return this.candidates[0].serialize();
    }

    /**
     * Get the scenarios associated with the top best candidates
     *
     * @param top The number of top scenarios to return
     * @returns An array of the top scenarios
     */
    getBestScenarios(top = 1): Scenario[] {
        const bestScenarios: Scenario[] = [];
        for (let i = 0; i < Math.min(top, this.candidates.length); i++) {
            const bestCandidate = this.candidates[i];
            const scenario = bestCandidate.getScenario();
            if (scenario !== undefined) {
                bestScenarios.push(scenario);
            }
        }
        return bestScenarios;
    }

    abstract sortCandidates(): Promise<void>;
}

export default Generation;
