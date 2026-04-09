/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _isEqual from 'lodash/isEqual';
import random from 'random';

import Generation from './Generation';
import NetworkCandidate from '../candidate/LineAndNumberOfVehiclesNetworkCandidate';
import { randomBoolArray, shuffle } from 'chaire-lib-common/lib/utils/RandomUtils';
import KPointCrossover from '../reproduction/KPointCrossover';
import Tournament from '../reproduction/Tournament';
import Mutation from '../reproduction/Mutation';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { sequentialArray } from 'chaire-lib-common/lib/utils/MathUtils';
import LineAndNumberOfVehiclesGenerationLogger from './LineAndNumberOfVehiclesGenerationLogger';
import {
    CandidateSource,
    EvolutionaryTransitNetworkDesignJobType
} from '../../networkDesign/transitNetworkDesign/evolutionary/types';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import LineAndNumberOfVehiclesNetworkCandidate from '../candidate/LineAndNumberOfVehiclesNetworkCandidate';
import _ from 'lodash';

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
    },
    currentChromosomes: boolean[][]
): boolean[] => {
    let linesChromosome: boolean[] = [];
    const nbLines = random.integer(options.numberOfLinesMin, options.numberOfLinesMax) - options.numberOfKeptLines;

    let tentative = 0;
    do {
        linesChromosome = Array(options.numberOfKeptLines);
        linesChromosome.fill(true);

        linesChromosome.push(...randomBoolArray(options.numberOfGenesToGenerate, nbLines));

        tentative++;
    } while (chromosomeExists(linesChromosome, currentChromosomes) && tentative < 10);

    if (chromosomeExists(linesChromosome, currentChromosomes)) {
        throw new TrError('Impossible to generate an unexisting random candidate after 10 tentatives', 'GALNGEN001');
    }

    return linesChromosome;
};

export const generateFirstCandidates = (
    jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>
): NetworkCandidate[] => {
    const candidates: NetworkCandidate[] = [];

    const linesChromosomes: boolean[][] = [];

    const linesToKeepSize = (jobWrapper.parameters.transitNetworkDesignParameters.linesToKeep || []).length;
    const randomLinesCount = jobWrapper.simulatedLineCollection.getFeatures().length - linesToKeepSize;
    for (let i = 0; i < jobWrapper.job.attributes.internal_data.populationSize!; i++) {
        const linesChromosome = generateRandomCandidate(
            {
                numberOfLinesMin: jobWrapper.parameters.transitNetworkDesignParameters.numberOfLinesMin || 1,
                numberOfLinesMax:
                    jobWrapper.parameters.transitNetworkDesignParameters.numberOfLinesMax || randomLinesCount,
                numberOfGenesToGenerate: randomLinesCount,
                numberOfKeptLines: linesToKeepSize
            },
            linesChromosomes
        );

        linesChromosomes.push(linesChromosome);
        candidates.push(
            new NetworkCandidate({ lines: linesChromosome, name: `GEN0_C${i}` }, jobWrapper, {
                source: { type: 'random' }
            })
        );
    }
    return candidates;
};

// For more variability and avoid proximity effect of lines, shuffle the lines order in the chromosome. Returns undefined if shuffle is not requested
const shuffleCandidatesInPlace = (
    candidates: NetworkCandidate[],
    job: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>
): number[] | undefined => {
    const algorithmOptions = job.parameters.algorithmConfiguration.config;
    if (algorithmOptions.shuffleGenes !== true) {
        return undefined;
    }
    const shuffleStartAt = (job.parameters.transitNetworkDesignParameters.linesToKeep || []).length;
    // Do not shuffle the first elements, that are the kept lines
    const originalOrder = sequentialArray(job.simulatedLineCollection.size() - shuffleStartAt, shuffleStartAt);
    const shuffledOrder = sequentialArray(shuffleStartAt).concat(shuffle(originalOrder));
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
    jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>,
    previousGenSorted: NetworkCandidate[],
    currentGeneration: number
): NetworkCandidate[] => {
    console.time(` generation ${currentGeneration}: reproduced candidates`);

    const evolutionaryAlgorithmConfig = jobWrapper.parameters.algorithmConfiguration.config;
    const candidates: NetworkCandidate[] = [];
    const minLineNb = jobWrapper.parameters.transitNetworkDesignParameters.numberOfLinesMin;
    const maxLineNb = jobWrapper.parameters.transitNetworkDesignParameters.numberOfLinesMax;
    const linesToKeepSize = (jobWrapper.parameters.transitNetworkDesignParameters.linesToKeep || []).length;

    const linesChromosomes: boolean[][] = [];
    const shuffledGeneOrder = shuffleCandidatesInPlace(previousGenSorted, jobWrapper);

    const linesNumInRange =
        minLineNb === undefined || maxLineNb === undefined
            ? () => true
            : (count: number) => minLineNb <= count && count <= maxLineNb;

    console.log(`  generation ${currentGeneration}: reproducing candidates`);

    const SelectionClass = Tournament;
    const CrossoverClass = KPointCrossover;
    const MutationClass = Mutation;

    const selection = new SelectionClass(jobWrapper.parameters.algorithmConfiguration.config, previousGenSorted);

    // Create an object to mutate chromosomes
    const lineMutation = new MutationClass(jobWrapper.parameters.algorithmConfiguration.config, linesToKeepSize);

    const elitesToKeep = evolutionaryAlgorithmConfig.numberOfElites;
    const randomToCreate = evolutionaryAlgorithmConfig.numberOfRandoms;

    for (let i = 0; i < elitesToKeep; i++) {
        const linesChromosome = _cloneDeep(previousGenSorted[i].getChromosome().lines);
        linesChromosomes.push(linesChromosome);
        candidates.push(
            // Pass the scenario to the elite candidates to fix the number of vehicles and service level as well
            new NetworkCandidate({ lines: linesChromosome, name: `GEN${currentGeneration}_C${i}` }, jobWrapper, {
                scenario: previousGenSorted[i].getScenario(),
                source: { type: 'elite' }
            })
        );
    }

    // Create random candidates
    const randomLinesCount = jobWrapper.simulatedLineCollection.getFeatures().length - linesToKeepSize;
    for (let i = elitesToKeep; i < elitesToKeep + randomToCreate; i++) {
        const linesChromosome = generateRandomCandidate(
            {
                numberOfLinesMin: jobWrapper.parameters.transitNetworkDesignParameters.numberOfLinesMin || 1,
                numberOfLinesMax:
                    jobWrapper.parameters.transitNetworkDesignParameters.numberOfLinesMax || randomLinesCount,
                numberOfGenesToGenerate: randomLinesCount,
                numberOfKeptLines: linesToKeepSize
            },
            linesChromosomes
        );

        linesChromosomes.push(linesChromosome);
        candidates.push(
            new NetworkCandidate({ lines: linesChromosome, name: `GEN${currentGeneration}_C${i}` }, jobWrapper, {
                source: { type: 'random' }
            })
        );
    }

    for (let i = elitesToKeep + randomToCreate; i < jobWrapper.job.attributes.internal_data.populationSize!; i++) {
        let linesChromosome: boolean[] = [];
        let activeLineCount = 0;
        let source: CandidateSource | undefined = undefined;

        do {
            const firstParentIndex = selection.selectCandidateIdx();
            const firstParent = previousGenSorted[firstParentIndex];
            if (random.float(0.0, 1.0) > evolutionaryAlgorithmConfig.crossoverProbability) {
                // No crossover, take the parent as is
                linesChromosome = _cloneDeep(firstParent.getChromosome().lines);
                source = { type: 'selected' as const, parent: firstParent.getChromosome().name, mutated: false };
            } else {
                const secondParentIdx = selection.selectCandidateIdx([firstParentIndex]);
                const secondParent = previousGenSorted[secondParentIdx];

                const crossover = new CrossoverClass(
                    [firstParent, secondParent],
                    evolutionaryAlgorithmConfig,
                    linesToKeepSize
                );
                linesChromosome = crossover.getChildChromosomes();
                source = {
                    type: 'crossover' as const,
                    parents: [firstParent.getChromosome().name, secondParent.getChromosome().name],
                    mutated: false
                };
            }

            const mutatedChromosome = lineMutation.getMutatedChromosome(linesChromosome);
            // Add whether the chromosome was mutated from the original one
            if (_isEqual(mutatedChromosome, linesChromosome) === false) {
                source.mutated = true;
            }
            linesChromosome = mutatedChromosome;

            activeLineCount = linesChromosome.filter((gene) => gene === true).length;
        } while (chromosomeExists(linesChromosome, linesChromosomes) || !linesNumInRange(activeLineCount));

        linesChromosomes.push(linesChromosome);
        candidates.push(
            new NetworkCandidate({ lines: linesChromosome, name: `GEN${currentGeneration}_C${i}` }, jobWrapper, {
                source
            })
        );
    }
    if (shuffledGeneOrder !== undefined) {
        deshuffleCandidates(candidates, shuffledGeneOrder);
    }
    console.timeEnd(` generation ${currentGeneration}: reproduced candidates`);
    return candidates;
};

export const resumeCandidatesFromChromosomes = (
    jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>,
    currentGeneration: Exclude<
        EvolutionaryTransitNetworkDesignJobType['internal_data']['currentGeneration'],
        undefined
    >,
    scenarioCollection: ScenarioCollection
): NetworkCandidate[] => {
    return currentGeneration.candidates.map(
        (candidateData) =>
            new NetworkCandidate(candidateData.chromosome, jobWrapper, {
                scenario: scenarioCollection.getById(candidateData.scenarioId!),
                source: candidateData.source
            })
    );
};

/**
 * Represents the current generation of the simulation
 */
class LineAndNumberOfVehiclesGeneration extends Generation {
    constructor(
        candidates: NetworkCandidate[],
        jobWrapper: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>,
        generationNumber = 1,
        generationLogger?: LineAndNumberOfVehiclesGenerationLogger
    ) {
        super(
            candidates,
            jobWrapper,
            generationNumber,
            generationLogger ||
                new LineAndNumberOfVehiclesGenerationLogger({
                    formats: ['csv', 'json', 'log']
                })
        );
    }

    getCandidates(): LineAndNumberOfVehiclesNetworkCandidate[] {
        return this.candidates as LineAndNumberOfVehiclesNetworkCandidate[];
    }

    /**
     * Get the per-trip normalized fitness for a candidate's method result.
     * Dividing by totalCount makes fitness comparable across runs with
     * different demand sample ratios (e.g. 5% vs 100%).
     */
    private getNormalizedFitness(candidate: NetworkCandidate, methodId: string): number {
        const methodResult = candidate.getResult().results[methodId];
        const stats = methodResult.results as { totalCount?: number } | undefined;
        const totalCount = stats?.totalCount;
        if (typeof totalCount === 'number' && totalCount > 0) {
            return methodResult.fitness / totalCount;
        }
        return methodResult.fitness;
    }

    // TODO Sorting candidates and calculating totalFitness maybe should not be
    // part of the evolutionary algorithm code, but we may need to extract some
    // result types. For now, it's the only algorithm we have, so keep it here
    sortCandidates() {
        const candidates = this.getCandidates();

        const simulationFunctions = this.jobWrapper.parameters.simulationMethod;
        // FIXME Used to support combination of simulation method, now we have only 1
        const methodIds = [simulationFunctions.type];
        // TODO Figure out how to get the totalFitness of a candidate given the
        // results. For now, we use an approach inspired by the climbing Olympic
        // discipline: the totalFitness is the product of the rank of each
        // candidate for each method.  The rank of each candidate for each
        // method is defined as the power of the actual rank order and the
        // weight of the method.
        const candidateWithRanks = candidates.map((candidate) => ({ ranks: {}, candidate }));
        // For each method, sort the candidate with ranks by the normalized
        // per-trip fitness so that candidates simulated with different demand
        // sample ratios are ranked fairly.
        methodIds.forEach((methodId) => {
            candidateWithRanks.sort((candidateA, candidateB) =>
                this.fitnessSorter(
                    this.getNormalizedFitness(candidateA.candidate, methodId),
                    this.getNormalizedFitness(candidateB.candidate, methodId)
                )
            );
            const methodWeight = 1;
            let prevRank = -1;
            let prevFitness = -1;
            candidateWithRanks.forEach((candidate, index) => {
                const fitness = this.getNormalizedFitness(candidate.candidate, methodId);
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
