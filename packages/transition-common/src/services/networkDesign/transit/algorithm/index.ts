/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { SimulationAlgorithmDescriptor } from '../TransitNetworkDesignAlgorithm';
import { EvolutionaryAlgorithmDescriptor, EvolutionaryAlgorithmOptions } from './EvolutionaryAlgorithm';

/**
 * Define the registry of all available algorithms
 */
export type AlgorithmRegistry = {
    evolutionaryAlgorithm: EvolutionaryAlgorithmOptions;
};

/**
 * A type for the available network design algorithms
 */
export type AlgorithmType = keyof AlgorithmRegistry;

/**
 * Configuration for a specific algorithm type
 */
export type AlgorithmConfigurationByType<T extends AlgorithmType> = {
    type: T;
    config: AlgorithmRegistry[T];
};

/**
 * Describe the algorithm configuration type depending on the algorithm
 * selected. This makes sure to compile-time typecheck the algorithm type and
 * the corresponding configuration.
 */
export type AlgorithmConfiguration = {
    [K in AlgorithmType]: AlgorithmConfigurationByType<K>;
}[AlgorithmType];

// Algorithm descriptors, to describe the various options for each algorithm
const ALGORITHM_DESCRIPTORS: {
    [K in AlgorithmType]: SimulationAlgorithmDescriptor<AlgorithmRegistry[K]>;
} = {
    evolutionaryAlgorithm: new EvolutionaryAlgorithmDescriptor()
};

/**
 * Get the descriptor object that describe the various options for a specific
 * algorithm type and validates them
 * @param algorithmType The type of algorithm to use
 * @returns The algorithm descriptor
 */
export const getAlgorithmDescriptor = <T extends AlgorithmType>(
    algorithmType: T
): SimulationAlgorithmDescriptor<AlgorithmRegistry[T]> => {
    return ALGORITHM_DESCRIPTORS[algorithmType];
};

/**
 * Get the list of all available algorithm types
 * @returns The list of all available algorithm types
 */
export const getAllAlgorithmTypes = (): AlgorithmType[] => {
    return Object.keys(ALGORITHM_DESCRIPTORS) as AlgorithmType[];
};
