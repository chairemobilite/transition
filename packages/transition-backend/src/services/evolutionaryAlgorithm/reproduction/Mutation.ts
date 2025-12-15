/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import random from 'random';

import * as AlgoTypes from '../internalTypes';
import { EvolutionaryAlgorithmOptions } from 'transition-common/lib/services/networkDesign/transit/algorithm/EvolutionaryAlgorithm';

const mutate = (oldGene: boolean) => !oldGene;

class Mutation {
    constructor(
        private options: EvolutionaryAlgorithmOptions,
        private linesToKeepCount = 0
    ) {
        // Nothing to do
    }

    /**
     * Get a chromosome with one mutated gene in a probability specified by the
     * mutationProbability of the options.
     *
     * @param inputChromosome The original chromosome
     * @returns A mutated chromosome with a probability of `mutationProbability`
     */
    getMutatedChromosome(inputChromosome: boolean[]) {
        const randomNumber = random.float(0.0, 1.0);
        if (randomNumber > this.options.mutationProbability) {
            return inputChromosome;
        }
        const clonedInputChromosome = _cloneDeep(inputChromosome);
        const mutatedGeneIndex = random.int(this.linesToKeepCount, inputChromosome.length - 1);
        clonedInputChromosome[mutatedGeneIndex] = mutate(clonedInputChromosome[mutatedGeneIndex]);
        return clonedInputChromosome;
    }
}

export default Mutation;
