/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';

import * as AlgoTypes from '../internalTypes';

const mutate = (oldGene: boolean) => !oldGene;

class Mutation {
    constructor(private runtimeData: AlgoTypes.RuntimeAlgorithmData) {
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
        const randomNumber = this.runtimeData.randomGenerator.float(0.0, 1.0);
        if (randomNumber > this.runtimeData.options.mutationProbability) {
            return inputChromosome;
        }
        const clonedInputChromosome = _cloneDeep(inputChromosome);
        const mutatedGeneIndex = this.runtimeData.randomGenerator.int(
            this.runtimeData.linesToKeep.length,
            inputChromosome.length - 1
        );
        clonedInputChromosome[mutatedGeneIndex] = mutate(clonedInputChromosome[mutatedGeneIndex]);
        return clonedInputChromosome;
    }
}

export default Mutation;
