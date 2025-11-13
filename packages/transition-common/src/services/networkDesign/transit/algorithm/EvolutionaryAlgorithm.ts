/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { SimulationAlgorithmDescriptor } from '../../../simulation/SimulationAlgorithm';

// Define evolutionary algorithm options
export type EvolutionaryAlgorithmOptions = {
    populationSizeMin: number;
    populationSizeMax: number;
    numberOfElites: number;
    numberOfRandoms: number;
    crossoverNumberOfCuts: number;
    crossoverProbability: number;
    mutationProbability: number;
    tournamentSize: number;
    tournamentProbability: number;
    numberOfGenerations: number;
    shuffleGenes: boolean;
    keepGenerations: number;
    keepCandidates: number;
};

/**
 * Descriptor class for the evolutionary algorithm options. It documents the
 * options, types, validation and default values. It also validates the whole
 * options object.
 */
export class EvolutionaryAlgorithmDescriptor implements SimulationAlgorithmDescriptor<EvolutionaryAlgorithmOptions> {
    getTranslatableName = (): string => 'transit:simulation:simulationClasses:LineAndNumberOfVehiclesGASimulation';

    // TODO Add help texts
    getOptions = () => ({
        populationSizeMin: {
            i18nName: 'transit:simulation:PopulationSizeMin',
            type: 'integer' as const,
            validate: (value: number) => value > 0,
            default: 20
        },
        populationSizeMax: {
            i18nName: 'transit:simulation:PopulationSizeMax',
            type: 'integer' as const,
            validate: (value: number) => value > 0,
            default: 20
        },
        numberOfElites: {
            i18nName: 'transit:simulation:NumberOfElites',
            type: 'integer' as const,
            validate: (value: number) => value > 0,
            default: 2
        },
        numberOfRandoms: {
            i18nName: 'transit:simulation:NumberOfRandoms',
            type: 'integer' as const,
            validate: (value: number) => value >= 0,
            default: 0
        },
        crossoverNumberOfCuts: {
            i18nName: 'transit:simulation:CrossoverNumberOfCuts',
            type: 'integer' as const,
            validate: (value: number) => value > 0,
            default: 1
        },
        crossoverProbability: {
            i18nName: 'transit:simulation:CrossoverProbability',
            type: 'number' as const,
            validate: (value: number) => value >= 0 && value <= 1,
            default: 0.8
        },
        mutationProbability: {
            i18nName: 'transit:simulation:MutationProbability',
            type: 'number' as const,
            validate: (value: number) => value >= 0 && value <= 1,
            default: 0.08
        },
        tournamentSize: {
            i18nName: 'transit:simulation:TournamentSize',
            type: 'integer' as const,
            validate: (value: number) => value > 0,
            default: 10
        },
        tournamentProbability: {
            i18nName: 'transit:simulation:TournamentProbability',
            type: 'number' as const,
            validate: (value: number) => value >= 0 && value <= 1,
            default: 0.7
        },
        numberOfGenerations: {
            i18nName: 'transit:simulation:NumberOfGenerations',
            type: 'number' as const,
            validate: (value: number) => value >= 0,
            default: 100
        },
        shuffleGenes: {
            i18nName: 'transit:simulation:ShuffleGenes',
            type: 'boolean' as const,
            default: true
        },
        keepGenerations: {
            i18nName: 'transit:simulation:KeepGenerations',
            type: 'number' as const,
            validate: (value: number) => value >= 0,
            default: 1
        },
        keepCandidates: {
            i18nName: 'transit:simulation:KeepCandidates',
            type: 'number' as const,
            validate: (value: number) => value >= 0,
            default: 1
        }
    });

    validateOptions = (options: Partial<EvolutionaryAlgorithmOptions>): { valid: boolean; errors: string[] } => {
        let valid = true;
        const errors: string[] = [];

        const populationSizeMin = options.populationSizeMin;
        const populationSizeMax = options.populationSizeMax;
        if (populationSizeMin !== undefined && populationSizeMax !== undefined) {
            if (populationSizeMin > populationSizeMax) {
                valid = false;
                errors.push('transit:simulation:errors:PopulationSizeMinGreaterThanMax');
            }
        }
        // Candidates to keep must be less than population size min
        const keepCandidates = options.keepCandidates;
        if (keepCandidates !== undefined && populationSizeMin !== undefined && keepCandidates > populationSizeMin) {
            valid = false;
            errors.push('transit:simulation:errors:CandidatesToKeepGreaterThanPopulation');
        }
        // Generations to keep must be less than generations
        const keepGenerations = options.keepGenerations;
        const numberOfGenerations = options.numberOfGenerations;
        if (
            keepGenerations !== undefined &&
            numberOfGenerations !== undefined &&
            keepGenerations > numberOfGenerations
        ) {
            valid = false;
            errors.push('transit:simulation:errors:GenerationsToKeepGreaterThanGenerations');
        }

        // TODO Add more validations

        return { valid, errors };
    };
}
