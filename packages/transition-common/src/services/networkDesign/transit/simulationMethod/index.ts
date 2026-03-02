/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { SimulationAlgorithmDescriptor } from '../TransitNetworkDesignAlgorithm';
import {
    AccessibilityMapSimulationDescriptor,
    type AccessibilityMapSimulationOptions
} from './AccessibilityMapSimulationMethod';
import {
    OdTripSimulationDescriptor,
    OdTripSimulationDescriptorForNetworkDesign,
    type OdTripSimulationOptions
} from './OdTripSimulationMethod';

export type { AccessibilityMapSimulationOptions } from './AccessibilityMapSimulationMethod';
export type { OdTripSimulationOptions } from './OdTripSimulationMethod';
export { nodeWeightingOptionsDescriptor, standaloneNodeWeightingOptionsDescriptor } from './OdTripSimulationMethod';

/**
 * Define the registry of all simulation methods
 */
export interface SimulationMethodRegistry {
    OdTripSimulation: OdTripSimulationOptions;
    AccessibilityMapSimulation: AccessibilityMapSimulationOptions;
}

/**
 * A type for the available simulation methods
 */
export type SimulationMethodType = keyof SimulationMethodRegistry;

/**
 * Configuration for specific simulation methods configuration
 */
export type SimulationMethodConfigurationByType<T extends SimulationMethodType> = {
    type: T;
    config: SimulationMethodRegistry[T];
};

/**
 * Describe the simulation method configuration type depending on the selected
 * simulation method. This makes sure to compile-time typecheck the method type
 * and the corresponding configuration.
 */
export type SimulationMethodConfiguration = {
    [K in SimulationMethodType]: SimulationMethodConfigurationByType<K>;
}[SimulationMethodType];

// Simulation method descriptors
const SIMULATION_METHOD_DESCRIPTORS: {
    [K in SimulationMethodType]: SimulationAlgorithmDescriptor<SimulationMethodRegistry[K]>;
} = {
    OdTripSimulation: new OdTripSimulationDescriptor(),
    AccessibilityMapSimulation: new AccessibilityMapSimulationDescriptor()
};

const SIMULATION_METHOD_DESCRIPTORS_FOR_NETWORK_DESIGN: {
    [K in SimulationMethodType]: SimulationAlgorithmDescriptor<SimulationMethodRegistry[K]>;
} = {
    OdTripSimulation: new OdTripSimulationDescriptorForNetworkDesign(),
    AccessibilityMapSimulation: new AccessibilityMapSimulationDescriptor()
};

/**
 * Get the descriptor object that describe the various options for a specific
 * simulation method type and validates them
 * @param algorithmType The simulation method to use
 * @returns The algorithm descriptor
 */
export const getSimulationMethodDescriptor = <T extends SimulationMethodType>(
    methodType: T
): SimulationAlgorithmDescriptor<SimulationMethodRegistry[T]> => {
    return SIMULATION_METHOD_DESCRIPTORS[methodType];
};

/**
 * Get the descriptor for the network design form (reduced node weighting: only "enabled" and upload in form).
 * Use this in ConfigureSimulationMethodForm instead of getSimulationMethodDescriptor.
 */
export const getSimulationMethodDescriptorForNetworkDesign = <T extends SimulationMethodType>(
    methodType: T
): SimulationAlgorithmDescriptor<SimulationMethodRegistry[T]> => {
    return SIMULATION_METHOD_DESCRIPTORS_FOR_NETWORK_DESIGN[methodType];
};

/**
 * Get the list of all available simulation method types
 * @returns The list of all available simulation method types
 */
export const getAllSimulationMethodTypes = (): SimulationMethodType[] => {
    return Object.keys(SIMULATION_METHOD_DESCRIPTORS) as SimulationMethodType[];
};
