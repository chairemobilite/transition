/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { SimulationAlgorithmDescriptor } from 'transition-common/lib/services/simulation/SimulationAlgorithm';
import { SimulationRunDataAttributes } from 'transition-common/lib/services/simulation/SimulationRun';
import { TransitRoutingBaseAttributes } from 'transition-common/lib/services/transitRouting/TransitRoutingQueryAttributes';

export interface SimulationMethod {
    simulate: (
        scenarioId: string,
        options: { trRoutingPort: number; transitRoutingParameters: TransitRoutingBaseAttributes }
    ) => Promise<{ fitness: number; results: unknown }>;
}

export interface SimulationMethodFactory<T> {
    create: (options: T, simulationDataAttributes: SimulationRunDataAttributes) => SimulationMethod;

    getDescriptor: () => SimulationAlgorithmDescriptor<T>;
}
