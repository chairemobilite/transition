/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { SimulationAlgorithmDescriptor } from 'transition-common/lib/services/simulation/SimulationAlgorithm';
import { SimulationRunDataAttributes } from 'transition-common/lib/services/simulation/SimulationRun';
import { TransitRoutingBaseAttributes } from 'chaire-lib-common/lib/services/routing/types';

/**
 * Interface for simulation method implementations. A simulation method will be
 * called to simulate a transit network scenario. It returns a fitness score and
 * the simulation results.
 *
 * TODO Consider defining a proper type for results instead of unknown, could be
 * generic
 */
export interface SimulationMethod {
    simulate: (
        scenarioId: string,
        options: { trRoutingPort: number; transitRoutingParameters: TransitRoutingBaseAttributes }
    ) => Promise<{ fitness: number; results: unknown }>;
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
    create: (options: TOptionsType, simulationDataAttributes: SimulationRunDataAttributes) => SimulationMethod;

    getDescriptor: () => SimulationAlgorithmDescriptor<TOptionsType>;
}
