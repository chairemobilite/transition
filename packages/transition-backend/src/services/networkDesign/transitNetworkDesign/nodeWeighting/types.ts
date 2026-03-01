/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import type { NodeWeightingConfig } from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';

/**
 * Parameters for a standalone node weighting job (Nodes section).
 */
export type NodeWeightingJobParameters = {
    /** Optional user-facing name for the job (shown in the list). Stored in data.description as well. */
    description?: string;
    nodeWeighting: NodeWeightingConfig;
};

export type NodeWeightingJobType = {
    name: 'nodeWeighting';
    data: {
        parameters: NodeWeightingJobParameters;
        description?: string;
    };
    files: {
        nodeWeight: true;
    };
};

export type NodeWeightingJob = ExecutableJob<NodeWeightingJobType>;

export type NodeWeightingJobListItem = {
    id: number;
    description?: string;
    hasWeightsFile: boolean;
};
