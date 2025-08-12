/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitBatchValidationDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitValidationAttributes } from './TransitRoutingValidation';

export type BatchValidationJobType = {
    name: 'batchValidation';
    data: {
        parameters: {
            demandAttributes: TransitBatchValidationDemandAttributes;
            validationAttributes: TransitValidationAttributes;
        };
        results?: {
            calculationName: string;
            completed: boolean;
            validCount: number;
            invalidCount: number;
        };
    };
    files: { input: true; csv: true };
};
