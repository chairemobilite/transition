/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitBatchRoutingDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';

export type BatchRouteJobType = {
    name: 'batchRoute';
    data: {
        parameters: {
            demandAttributes: TransitBatchRoutingDemandAttributes;
            transitRoutingAttributes: BatchCalculationParameters;
        };
        results?: Omit<TransitBatchCalculationResult, 'errors' | 'warnings'>;
    };
    files: { input: true; csv: true; detailedCsv: true; geojson: true };
};
