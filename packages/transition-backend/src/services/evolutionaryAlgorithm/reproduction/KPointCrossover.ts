/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as AlgoTypes from '../internalTypes';
import NetworkCandidate from '../candidate/LineAndNumberOfVehiclesNetworkCandidate';

// chromosome must be an array with the same size for both parents (2 parents are used)
class KPointCrossover {
    constructor(
        private parents: [NetworkCandidate, NetworkCandidate],
        private options: AlgoTypes.RuntimeAlgorithmData
    ) {
        // Nothing to do
    }

    getChildChromosomes(): boolean[] {
        const parent1 = this.parents[0];

        const chromosomeLength = parent1.getChromosome().lines.length;

        const numberOfCuts = this.options.options.crossoverNumberOfCuts;
        const cutIndexes: number[] = [];

        // First cut index should be after the lines to keep
        const firstCutIndex = this.options.linesToKeep.length;

        for (let cutIndex = 0; cutIndex < numberOfCuts; cutIndex++) {
            cutIndexes.push(this.options.randomGenerator.int(firstCutIndex, chromosomeLength - 1));
        }

        cutIndexes.sort((indexA, indexB) => {
            return indexA - indexB;
        });
        cutIndexes.push(chromosomeLength);

        const countIndexes = numberOfCuts + 1;
        const childChromosomes: boolean[] = [];
        let parentIndex = 0;
        for (let i = 0; i < countIndexes; i++) {
            const startIndex = i > 0 ? cutIndexes[i - 1] : 0;
            const endIndex = cutIndexes[i];
            for (let geneI = startIndex; geneI < endIndex; geneI++) {
                childChromosomes.push(this.parents[parentIndex].getChromosome().lines[geneI]);
            }
            parentIndex = parentIndex === 0 ? 1 : 0;
        }
        return childChromosomes;
    }
}

export default KPointCrossover;
