/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { AlgorithmConfigurationByType } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { SimulationMethodConfiguration } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import { ResultSerialization } from '../../../evolutionaryAlgorithm/candidate/types';
import { CandidateChromosome, LineLevelOfService } from '../../../evolutionaryAlgorithm/internalTypes';

/**
 * Fixed filename for the node weights output file (written by "Start weighting", read when job runs).
 * Input file names (transitDemand, nodeWeight) are not fixed—they come from the upload or source job's resources.
 */
export const NODE_WEIGHTS_OUTPUT_FILENAME = 'node_weights.csv';

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
        /** Optional user-facing name for the job (shown in the job list). */
        description?: string;
        results?: {
            generations: ResultSerialization[];
            scenarioIds: string[];
        };
    };
    files: {
        transitDemand: true;
        nodeWeight: true;
        /** Output of "Start weighting"; copied when cloning from another job. */
        nodeWeightsOutput: true;
        linesResult: true;
        simulationResults: true;
    };
    internal_data: {
        populationSize?: number;
        dataPrepared?: boolean;
        lineServices?: { [lineId: string]: (Omit<LineLevelOfService, 'service'> & { serviceId: string })[] };
        currentGeneration?: {
            candidates: {
                chromosome: CandidateChromosome;
                scenarioId?: string;
                fitness?: number;
            }[];
        };
    };
};

export type EvolutionaryTransitNetworkDesignJob = ExecutableJob<EvolutionaryTransitNetworkDesignJobType>;

export interface EvolutionaryTransitNetworkDesignJobResult {
    /** Status of the job: 'success' means the job has completedly successfully,
     * 'failed' means there was an unrecoverable exception during execution,
     * 'paused' means the job should exit, waiting for child jobs to execute and
     * terminate */
    status: 'success' | 'failed' | 'paused';
    warnings: TranslatableMessage[];
    errors: TranslatableMessage[];
}
