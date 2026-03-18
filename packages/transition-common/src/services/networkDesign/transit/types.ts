/*
 * Copyright 2025, Polytechnique Montreal and contributors
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
    /** Optional user-facing name for the job (shown in the job list). */
    description?: string;
};
