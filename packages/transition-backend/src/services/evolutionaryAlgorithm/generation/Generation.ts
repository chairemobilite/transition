/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import pQueue from 'p-queue';
import { EventEmitter } from 'events';

import NetworkCandidate from '../candidate/Candidate';
import { collectionToCache } from '../../../models/capnpCache/transitScenarios.cache.queries';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import GenerationLogger from './GenerationLogger';
import { EvolutionaryTransitNetworkDesignJobType } from '../../networkDesign/transitNetworkDesign/evolutionary/types';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ResultSerialization } from '../candidate/types';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import { TrRoutingBatchManager } from '../../transitRouting/TrRoutingBatchManager';

abstract class Generation {
    protected fitnessSorter: (fitnessA: number, fitnessB: number) => number;

    constructor(
        protected candidates: NetworkCandidate[],
        protected jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>,
        protected generationNumber = 1,
        protected logger: GenerationLogger
    ) {
        // Use the minimize sorter if method type is OdTripSimulation, maximize otherwise
        // FIXME This should be a parameter of something, it goes with the simulation method or set of methods
        this.fitnessSorter =
            jobWrapper.parameters.simulationMethod.type === 'OdTripSimulation'
                ? Preferences.current.simulations.geneticAlgorithms.fitnessSorters['minimize']
                : Preferences.current.simulations.geneticAlgorithms.fitnessSorters['maximize'];

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

    getGenerationNumber(): number {
        return this.generationNumber;
    }

    async prepareCandidates(
        socket: EventEmitter
    ): Promise<{ warnings: TranslatableMessage[]; errors: TranslatableMessage[] }> {
        const errors: TranslatableMessage[] = [];
        const warnings: TranslatableMessage[] = [];
        console.time(` generation ${this.generationNumber}: prepared candidates`);

        // TODO Cleanup old data?

        console.log(`  generation ${this.generationNumber}: preparing candidates`);

        const promiseQueue = new pQueue({ concurrency: 1 });

        const candidatePreparationPromises = this.candidates.map(
            async (candidate, _candidateIdx) =>
                await promiseQueue.add(async () => await candidate.prepareScenario(socket))
        );

        const results = await Promise.allSettled(candidatePreparationPromises);

        // Handle fulfilled and rejected promises separately
        const scenarios: Scenario[] = [];
        results.forEach((result, candidateIdx) => {
            if (result.status === 'fulfilled') {
                scenarios.push(result.value!);
            } else {
                // Handle failed simulation
                const warning = `Error preparing scenario for candidate ${candidateIdx} of ${this.generationNumber}th generation: ${result.reason}`;
                warnings.push(warning);
                console.warn(warning);
            }
        });
        const scenarioCollection = new ScenarioCollection(scenarios, {});
        const cachePath = this.jobWrapper.getCacheDirectory();
        console.log(`  generation ${this.generationNumber}: writing ${scenarios.length} scenarios to cache`);
        // FIXME Job type should provide the cache path if we need it
        await collectionToCache(scenarioCollection, cachePath);
        const scenariosCacheFile = `${cachePath}/scenarios.capnpbin`;
        const fileExists = fs.existsSync(scenariosCacheFile);
        const fileSize = fileExists ? fs.statSync(scenariosCacheFile).size : 0;
        console.log(
            `  generation ${this.generationNumber}: scenarios cache file ${scenariosCacheFile} exists=${fileExists} size=${fileSize}`
        );
        console.timeEnd(` generation ${this.generationNumber}: prepared candidates`);
        return { errors, warnings };
    }

    /**
     * Run the simulation on this generation. At the end of the simulation, if
     * this method returns true, the candidates are sorted by best cost first.
     *
     * @returns `true` if the simulation was completed successfully.
     */
    async simulate(): Promise<boolean> {
        console.time(` generation ${this.generationNumber}: simulated candidates`);
        console.log(`  generation ${this.generationNumber}: simulating candidates`);

        // Start TrRouting for the generation
        const cacheDir = this.jobWrapper.getCacheDirectory();
        const memcachedServer = this.jobWrapper.getMemcachedInstance()?.getServer();
        const realBatchManager = new TrRoutingBatchManager(new EventEmitter());
        const startResults = await realBatchManager.startBatch(
            1000, // TODO Fake high number to get above maxparallelCalculator
            { cacheDirectoryPath: cacheDir, memcachedServer }
        );
        this.jobWrapper.setTrRoutingBatchStartResult(startResults);

        const candidatesCount = this.getSize();
        const validCandidates = this.getCandidates().filter((candidate) => candidate.getScenario() !== undefined);
        if (validCandidates.length < this.jobWrapper.parameters.algorithmConfiguration.config.populationSizeMin) {
            throw new TrError(
                'Not enough valid candidates to continue the evolutionary algorithm at generation',
                'GALGEN001',
                {
                    text: 'transit:networkDesign:evolutionaryAlgorithm:errors:NotEnoughValidCandidates',
                    params: { generationNumber: String(this.generationNumber) }
                }
            );
        }
        // Run the simulation for each candidate
        // Create p-queue with concurrency of 1
        const promiseQueue = new pQueue({ concurrency: 1 });

        for (let i = 0; i < candidatesCount; i++) {
            const candidateIdx = i;
            if (validCandidates[candidateIdx].getScenario() !== undefined) {
                promiseQueue.add(async () => {
                    console.log(
                        `  generation ${this.generationNumber}: simulating candidate ${candidateIdx + 1}/${candidatesCount}`
                    );
                    await validCandidates[candidateIdx].simulate();
                });
            }
        }

        await promiseQueue.onIdle();
        this.sortCandidates();
        await realBatchManager.stopBatch();
        console.timeEnd(` generation ${this.generationNumber}: simulated candidates`);

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
    getBestCandidates(top = 1): NetworkCandidate[] {
        this.sortCandidates();
        return this.candidates.slice(0, top);
    }

    abstract sortCandidates(): void;

    async cleanupCandidates(): Promise<void> {
        const promiseQueue = new pQueue({ concurrency: 1 });

        for (const candidate of this.candidates) {
            promiseQueue.add(async () => {
                await candidate.cleanup();
            });
        }
    }
}

export default Generation;
