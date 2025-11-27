/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitBatchRoutingDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { TrRoutingBatchJobParameters } from './TrRoutingBatchJobParameters';
import { OdTripRouteResult } from './types';

export type BatchRouteJobType = {
    name: 'batchRoute';
    data: {
        parameters: {
            demandAttributes: TransitBatchRoutingDemandAttributes;
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
