/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { sampleSizeWithOptionalSeed } from 'chaire-lib-common/lib/utils/RandomUtils';
import NetworkCandidate from '../candidate/LineAndNumberOfVehiclesNetworkCandidate';
import { sequentialArray } from 'chaire-lib-common/lib/utils/MathUtils';
import * as AlgoTypes from '../internalTypes';

/**
 * Implementation of the tournament selection algorithm for genetic algorithm:
 * see https://en.wikipedia.org/wiki/Tournament_selection
 */
class Tournament {
    constructor(
        private options: AlgoTypes.RuntimeAlgorithmData,
        private candidates: NetworkCandidate[]
    ) {
        // Nothing to do
    }

    selectCandidateIdx(exceptCandidateIdx: number[] = []): number {
        const allCandidateIndexes = sequentialArray(this.candidates.length);
        // Select candidates to participate in the tournament
        const validCandidateIdx = allCandidateIndexes.filter((candidateIdx) => {
            return !exceptCandidateIdx.includes(candidateIdx);
        });
        // Candidates are already sorted by fitness, we just get indexes and re-sort by fitness
        const tournamentCandidates = sampleSizeWithOptionalSeed(
            validCandidateIdx,
            this.options.options.tournamentSize,
            this.options.randomGenerator
        );

        // Sort selected candidates by index, as those with lower index have the best fitness
        tournamentCandidates.sort((idxA, idxB) => idxA - idxB);

        /**
         * Get the index of the candidate to select
         * From wikipedia:
         * choose the best individual from the tournament with probability p
         * choose the second best individual with probability p*(1-p)
         * choose the third best individual with probability p*((1-p)^2)
         * and so on
         */
        const probability = this.options.options.tournamentProbability;

        let currentProbability = probability;
        let random = this.options.randomGenerator.float(0, 1);
        let i = 0;
        while (random >= currentProbability) {
            i = (i + 1) % this.options.options.tournamentSize;
            random = this.options.randomGenerator.float(0, 1);
            currentProbability = probability * Math.pow(1 - probability, i);
        }
        return tournamentCandidates[i];
    }
}

export default Tournament;
