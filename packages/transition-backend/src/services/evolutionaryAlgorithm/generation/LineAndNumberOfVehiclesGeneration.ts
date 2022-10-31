/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import _isEqual from 'lodash.isequal';
import { Random } from 'random';

import Generation from './Generation';
import NetworkCandidate from '../candidate/LineAndNumberOfVehiclesNetworkCandidate';
import { randomBoolArray, shuffle } from 'chaire-lib-common/lib/utils/RandomUtils';
import * as AlgoTypes from '../internalTypes';
import KPointCrossover from '../reproduction/KPointCrossover';
import Tournament from '../reproduction/Tournament';
import Mutation from '../reproduction/Mutation';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { sequentialArray } from 'chaire-lib-common/lib/utils/MathUtils';
import LineAndNumberOfVehiclesGenerationLogger from './LineAndNumberOfVehiclesGenerationLogger';

const chromosomeExists = (chrom: boolean[], linesChromosomes: boolean[][]) =>
    linesChromosomes.findIndex((chromosome) => _isEqual(chromosome, chrom)) !== -1;

/**
 * Generate a random candidate with a random number of true lines for options
 *
 * @param options
 * @param currentChromosomes Currently existing chromosomes
 * @returns
 */
const generateRandomCandidate = (
    options: {
        numberOfLinesMin: number;
        numberOfLinesMax: number;
        numberOfKeptLines: number;
        numberOfGenesToGenerate: number;
        randomGenerator: Random;
    },
    currentChromosomes: boolean[][]
): boolean[] => {
    let linesChromosome: boolean[] = [];
    const nbLines =
        options.randomGenerator.integer(options.numberOfLinesMin, options.numberOfLinesMax) - options.numberOfKeptLines;

    let tentative = 0;
    do {
        linesChromosome = Array(options.numberOfKeptLines);
        linesChromosome.fill(true);

        linesChromosome.push(...randomBoolArray(options.numberOfGenesToGenerate, nbLines, options.randomGenerator));

        tentative++;
    } while (chromosomeExists(linesChromosome, currentChromosomes) && tentative < 10);

    if (chromosomeExists(linesChromosome, currentChromosomes)) {
        throw new TrError('Impossible to generate an unexisting random candidate after 10 tentatives', 'GALNGEN001');
    }

    return linesChromosome;
};

export const generateFirstCandidates = (options: AlgoTypes.RuntimeAlgorithmData): NetworkCandidate[] => {
    const candidates: NetworkCandidate[] = [];

    const linesChromosomes: boolean[][] = [];

    const linesToKeepSize = options.linesToKeep.length;
    const randomLinesCount = options.lineCollection.getFeatures().length - linesToKeepSize;
    for (let i = 0; i < options.populationSize; i++) {
        const linesChromosome = generateRandomCandidate(
            {
                numberOfLinesMin: options.simulationRun.attributes.data.simulationParameters.numberOfLinesMin || 1,
                numberOfLinesMax:
                    options.simulationRun.attributes.data.simulationParameters.numberOfLinesMax || randomLinesCount,
                numberOfGenesToGenerate: randomLinesCount,
                numberOfKeptLines: linesToKeepSize,
                randomGenerator: options.randomGenerator
            },
            linesChromosomes
        );

        linesChromosomes.push(linesChromosome);
        candidates.push(new NetworkCandidate({ lines: linesChromosome, name: `GALN_GEN0_C${i}` }, options));
    }
    return candidates;
};

// For more variability and avoid proximity effect of lines, shuffle the lines order in the chromosome. Returns undefined if shuffle is not requested
const shuffleCandidatesInPlace = (
    candidates: NetworkCandidate[],
    runtimeData: AlgoTypes.RuntimeAlgorithmData
): number[] | undefined => {
    if (runtimeData.options.shuffleGenes !== true) {
        return undefined;
    }
    // Do not shuffle the first elements, that are the kept lines
    const originalOrder = sequentialArray(
        runtimeData.lineCollection.size() - runtimeData.linesToKeep.length,
        runtimeData.linesToKeep.length
    );
    const shuffledOrder = sequentialArray(runtimeData.linesToKeep.length).concat(
        shuffle(originalOrder, runtimeData.randomGenerator)
    );
    candidates.forEach((candidate) => {
        const originalLines = _cloneDeep(candidate.getChromosome().lines);
        const lines = candidate.getChromosome().lines;
        shuffledOrder.forEach((indexInOrig, currentIndex) => (lines[currentIndex] = originalLines[indexInOrig]));
    });

    return shuffledOrder;
};

// Bring back the lines genes to their original location
const deshuffleCandidates = (candidates: NetworkCandidate[], shuffledOrder: number[]): void => {
    candidates.forEach((candidate) => {
        const shuffledLines = _cloneDeep(candidate.getChromosome().lines);
        const lines = candidate.getChromosome().lines;
        shuffledOrder.forEach((indexInOrig, currentIndex) => (lines[indexInOrig] = shuffledLines[currentIndex]));
    });
};

export const reproduceCandidates = (
    options: AlgoTypes.RuntimeAlgorithmData,
    previousGenSorted: NetworkCandidate[],
    currentGeneration: number
): NetworkCandidate[] => {
    const time = Date.now();
    const candidates: NetworkCandidate[] = [];
    const minLineNb =
        options.simulationRun.attributes.data.simulationParameters.numberOfLinesMin ||
        options.simulationRun.attributes.data.simulationParameters.numberOfLinesMax;
    const maxLineNb =
        options.simulationRun.attributes.data.simulationParameters.numberOfLinesMax ||
        options.simulationRun.attributes.data.simulationParameters.numberOfLinesMin;

    const linesChromosomes: boolean[][] = [];
    const shuffledGeneOrder = shuffleCandidatesInPlace(previousGenSorted, options);

    const linesNumInRange =
        minLineNb === undefined || maxLineNb === undefined
            ? () => true
            : (count: number) => minLineNb <= count && count <= maxLineNb;

    console.log(`  generation ${currentGeneration}: reproducing candidates`);

    const SelectionClass = Tournament;
    const CrossoverClass = KPointCrossover;
    const MutationClass = Mutation;

    const selection = new SelectionClass(options, previousGenSorted);

    // Create an object to mutate chromosomes
    const lineMutation = new MutationClass(options);

    const elitesToKeep = options.options.numberOfElites;
    const randomToCreate = options.options.numberOfRandoms;

    for (let i = 0; i < elitesToKeep; i++) {
        const linesChromosome = _cloneDeep(previousGenSorted[i].getChromosome().lines);
        linesChromosomes.push(linesChromosome);
        candidates.push(
            new NetworkCandidate({ lines: linesChromosome, name: `GALN_GEN${currentGeneration}_C${i}` }, options)
        );
    }

    // Create random candidates
    const linesToKeepSize = options.linesToKeep.length;
    const randomLinesCount = options.lineCollection.getFeatures().length - linesToKeepSize;
    for (let i = elitesToKeep; i < elitesToKeep + randomToCreate; i++) {
        const linesChromosome = generateRandomCandidate(
            {
                numberOfLinesMin: options.simulationRun.attributes.data.simulationParameters.numberOfLinesMin || 1,
                numberOfLinesMax:
                    options.simulationRun.attributes.data.simulationParameters.numberOfLinesMax || randomLinesCount,
                numberOfGenesToGenerate: randomLinesCount,
                numberOfKeptLines: linesToKeepSize,
                randomGenerator: options.randomGenerator
            },
            linesChromosomes
        );

        linesChromosomes.push(linesChromosome);
        candidates.push(
            new NetworkCandidate({ lines: linesChromosome, name: `GALN_GEN${currentGeneration}_C${i}` }, options)
        );
    }

    for (let i = elitesToKeep + randomToCreate; i < options.populationSize; i++) {
        let linesChromosome: boolean[] = [];
        let activeLineCount = 0;

        do {
            const firstParentIndex = selection.selectCandidateIdx();
            const firstParent = previousGenSorted[firstParentIndex];
            if (options.randomGenerator.float(0.0, 1.0) > options.options.crossoverProbability) {
                // No crossover, take the parent as is
                linesChromosome = _cloneDeep(firstParent.getChromosome().lines);
            } else {
                const secondParentIdx = selection.selectCandidateIdx([firstParentIndex]);
                const secondParent = previousGenSorted[secondParentIdx];

                const crossover = new CrossoverClass([firstParent, secondParent], options);
                linesChromosome = crossover.getChildChromosomes();
            }

            linesChromosome = lineMutation.getMutatedChromosome(linesChromosome);

            activeLineCount = linesChromosome.filter((gene) => gene === true).length;
        } while (chromosomeExists(linesChromosome, linesChromosomes) || !linesNumInRange(activeLineCount));

        linesChromosomes.push(linesChromosome);
        candidates.push(
            new NetworkCandidate({ lines: linesChromosome, name: `GALN_GEN${currentGeneration}_C${i}` }, options)
        );
    }
    if (shuffledGeneOrder !== undefined) {
        deshuffleCandidates(candidates, shuffledGeneOrder);
    }
    console.log(`  generation ${currentGeneration}: candidates reproduced in ${(Date.now() - time) / 1000} sec.`);
    return candidates;
};

/**
 * Represents the current generation of the simulation
 */
class LineAndNumberOfVehiclesGeneration extends Generation {
    constructor(
        candidates: NetworkCandidate[],
        options: AlgoTypes.RuntimeAlgorithmData,
        generationNumber = 1,
        generationLogger?: LineAndNumberOfVehiclesGenerationLogger
    ) {
        super(
            candidates,
            options,
            generationNumber,
            generationLogger ||
                new LineAndNumberOfVehiclesGenerationLogger({
                    formats: ['csv', 'json', 'log']
                })
        );
    }

    // TODO Sorting candidates and calculating totalFitness maybe should not be
    // part of the evolutionary algorithm code, but we may need to extract some
    // result types. For now, it's the only algorithm we have, so keep it here
    async sortCandidates(): Promise<void> {
        const candidates = this.getCandidates();

        const simulationFunctions = this.options.simulationRun.attributes.options.functions;
        const methodIds = Object.keys(simulationFunctions);
        // TODO Figure out how to get the totalFitness of a candidate given the
        // results. For now, we use an approach inspired by the climbing Olympic
        // discipline: the totalFitness is the product of the rank of each
        // candidate for each method.  The rank of each candidate for each
        // method is defined as the power of the actual rank order and the
        // weight of the method.
        const candidateWithRanks = candidates.map((candidate) => ({ ranks: {}, candidate }));
        // For each method, sort the candidate with ranks by the fitness, then add the rank
        methodIds.forEach((methodId) => {
            // TODO The fitness sorter should be specified for each method as fitness order may vary
            candidateWithRanks.sort((candidateA, candidateB) =>
                this.fitnessSorter(
                    candidateA.candidate.getResult().results[methodId].fitness,
                    candidateB.candidate.getResult().results[methodId].fitness
                )
            );
            const methodWeight = simulationFunctions[methodId].weight;
            let prevRank = -1;
            let prevFitness = -1;
            candidateWithRanks.forEach((candidate, index) => {
                const fitness = candidate.candidate.getResult().results[methodId].fitness;
                const rank = fitness === prevFitness ? prevRank : index;
                candidate.ranks[methodId] = Math.pow(rank + 1, methodWeight);
                prevRank = rank;
                prevFitness = fitness;
            });
        });
        // For each candidate, calculate the product of the rank for each method
        candidateWithRanks.forEach((candidateWithRank) => {
            let totalFitness = 1;
            for (const index in methodIds) {
                totalFitness *= candidateWithRank.ranks[methodIds[index]];
            }
            candidateWithRank.candidate.getResult().totalFitness = totalFitness;
        });
        candidates.sort(
            (candidateA, candidateB) => candidateA.getResult().totalFitness - candidateB.getResult().totalFitness
        );
    }
}

export default LineAndNumberOfVehiclesGeneration;
