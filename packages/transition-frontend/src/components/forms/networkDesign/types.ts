/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { AlgorithmConfiguration } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { SimulationMethodConfiguration } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';

/**
 * Partial algorithm configuration type used in forms before completion
 */
export type PartialAlgorithmConfiguration = {
    type: AlgorithmConfiguration['type'];
    config?: Partial<AlgorithmConfiguration['config']>;
};

/**
 * Partial simulation method configuration type used in forms before completion
 */
export type PartialSimulationMethodConfiguration = {
    type: SimulationMethodConfiguration['type'];
    config?: Partial<SimulationMethodConfiguration['config']>;
};

/**
 * Form initial values with optional/partial configurations
 */
export type FormInitialValues = {
    transitNetworkDesignParameters: Partial<TransitNetworkDesignParameters>;
    algorithmConfiguration: PartialAlgorithmConfiguration;
    simulationMethod: PartialSimulationMethodConfiguration;
    /** When set (e.g. when replaying a job), enables "Start weighting" for that job */
    jobId?: number;
    /** When set (e.g. when replaying a job), existing filenames in the job for display next to file inputs */
    existingFileNames?: Record<string, string>;
    /** Optional user-facing name for the job (shown in the job list) */
    description?: string;
};
