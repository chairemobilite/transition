/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { AlgorithmConfiguration } from './algorithm';
import type { SimulationMethodConfiguration } from './simulationMethod';
import type { TransitNetworkDesignParameters } from './TransitNetworkDesignParameters';

export type TransitNetworkJobConfigurationType = {
    transitNetworkDesignParameters: TransitNetworkDesignParameters;
    algorithmConfiguration: AlgorithmConfiguration;
    simulationMethod: SimulationMethodConfiguration;
};
