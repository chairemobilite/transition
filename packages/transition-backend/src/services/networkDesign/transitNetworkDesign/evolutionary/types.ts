/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { AlgorithmConfigurationByType } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { SimulationMethodConfiguration } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';

export type EvolutionaryTransitNetworkDesignJobParameters = {
    transitNetworkDesignParameters: TransitNetworkDesignParameters;
    algorithmConfiguration: AlgorithmConfigurationByType<'evolutionaryAlgorithm'>;
    // FIXME Should we support more than one simulation method here, with weight for each as previously?
    simulationMethod: SimulationMethodConfiguration;
};

export type EvolutionaryTransitNetworkDesignJobType = {
    name: 'evolutionaryTransitNetworkDesign';
    data: {
        parameters: EvolutionaryTransitNetworkDesignJobParameters;
        // TODO Type the results when actual implementation is done
        results?: never;
    };
    files: { transitDemand: true; nodeWeight: true };
};

export interface EvolutionaryTransitNetworkDesignJobResult {
    /** Status of the job: 'success' means the job has completedly successfully,
     * 'failed' means there was an unrecoverable exception during execution,
     * 'paused' means the job should exit, waiting for child jobs to execute and
     * terminate */
    status: 'success' | 'failed' | 'paused';
    warnings: ErrorMessage[];
    errors: ErrorMessage[];
}
