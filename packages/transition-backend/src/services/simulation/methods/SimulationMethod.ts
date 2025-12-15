/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { SimulationAlgorithmDescriptor } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import {
    SimulationMethodRegistry,
    SimulationMethodType
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import { OdTripSimulationFactory } from './OdTripSimulation';
import { AccessibilityMapSimulationFactory } from './AccessibilityMapSimulation';

/**
 * Interface for simulation method implementations. A simulation method will be
 * called to simulate a transit network scenario. It returns a fitness score and
 * the simulation results.
 *
 * TODO Consider defining a proper type for results instead of unknown, could be
 * generic
 */
export interface SimulationMethod {
    simulate: (scenarioId: string) => Promise<{ fitness: number; results: unknown }>;
}

/**
 * Factory interface for creating SimulationMethod instances. A simulation
 * method will run the simulation on a transit network scenario and return a
 * fitness score
 *
 * @export
 * @interface SimulationMethodFactory
 * @template TOptionsType The type of options used to configure the simulation
 * method
 */
export interface SimulationMethodFactory<TOptionsType extends Record<string, unknown>> {
    create: (options: TOptionsType, jobWrapper: TransitNetworkDesignJobWrapper) => SimulationMethod;

    getDescriptor: () => SimulationAlgorithmDescriptor<TOptionsType>;
}

// Predefined algorithm factories
export const SIMULATION_METHODS_FACTORY: {
    [K in SimulationMethodType]: SimulationMethodFactory<SimulationMethodRegistry[K]>;
} = {
    OdTripSimulation: new OdTripSimulationFactory(),
    AccessibilityMapSimulation: new AccessibilityMapSimulationFactory()
};
