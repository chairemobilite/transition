/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import type { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import type { TrRoutingBatchJobParameters } from './TrRoutingBatchJobParameters';
import type { OdTripRouteResult } from './types';
import type { TransitDemandFromCsvRoutingAttributes } from 'transition-common/lib/services/transitDemand/types';

export type BatchRouteJobType = {
    name: 'batchRoute';
    data: {
        parameters: {
            demandAttributes: TransitDemandFromCsvRoutingAttributes;
            transitRoutingAttributes: BatchCalculationParameters;
            trRoutingJobParameters?: TrRoutingBatchJobParameters; // Parameters to adjust trRouting startup
        };
        results?: Omit<TransitBatchCalculationResult, 'errors' | 'warnings'>;
    };
    files: { input: true; csv: true; detailedCsv: true; geojson: true };
};

export interface BatchRouteResultVisitor<TReturnType> {
    visitTripResult: (routingResult: OdTripRouteResult) => Promise<void>;
    end: () => void;
    getResult: () => TReturnType;
}
