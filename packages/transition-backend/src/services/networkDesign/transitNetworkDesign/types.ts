/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { JobDataType } from 'transition-common/lib/services/jobs/Job';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';

// Type constraint for jobs that have transit network parameters
export type TransitNetworkDesignJobType = JobDataType & {
    data: {
        parameters: TransitNetworkJobConfigurationType;
    };
};
