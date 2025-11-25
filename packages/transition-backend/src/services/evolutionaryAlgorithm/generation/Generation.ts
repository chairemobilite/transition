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
import GenerationLogger from './GenerationLogger';
import { EvolutionaryTransitNetworkDesignJobType } from '../../networkDesign/transitNetworkDesign/evolutionary/types';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { OdTripSimulationOptions } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

abstract class Generation {
    protected fitnessSorter: (fitnessA: number, fitnessB: number) => number;

    constructor(
        protected candidates: NetworkCandidate[],
        protected jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>,
        protected generationNumber = 1,
        protected logger: GenerationLogger
    ) {
        // Now jobWrapper.parameters is automatically typed as EvolutionaryTransitNetworkDesignJobParameters
        this.fitnessSorter =
            Preferences.current.simulations.geneticAlgorithms.fitnessSorters[
                (jobWrapper.parameters.simulationMethod.config as OdTripSimulationOptions).evaluationOptions.fitnessFunction
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

    getGenerationNumber(): number {
        return this.generationNumber;
    }

    async prepareCandidates(socket: EventEmitter): Promise<{warnings: ErrorMessage[];
        errors: ErrorMessage[];}> {
            const errors: ErrorMessage[] = [];
            const warnings: ErrorMessage[] = [];
        console.time(`Prepared candidates for generation ${this.generationNumber}`);

        // TODO Cleanup old data?

        console.log(`  generation ${this.generationNumber}: preparing candidates`);

        const promiseQueue = new pQueue({ concurrency: 1 });

        const candidatePreparationPromises = this.candidates.map(
            async (candidate, candidateIdx) =>
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
        const cachePath = this.jobWrapper.job.getJobFileDirectory() + '/cache';
        // FIXME Job type should provide the cache path if we need it
        await collectionToCache(scenarioCollection, cachePath);
        console.timeEnd(`Prepared candidates for generation ${this.generationNumber}`);
        return { errors, warnings };
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
