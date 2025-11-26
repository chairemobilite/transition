/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CsvFileAndMapping } from 'transition-common/lib/services/csv';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { OdTripRouteResult } from './types';
import { TrRoutingBatchJobParameters } from './TrRoutingBatchJobParameters';

export type BatchRouteJobType = {
    name: 'batchRoute';
    data: {
        parameters: {
            demandAttributes: CsvFileAndMapping;
            transitRoutingAttributes: BatchCalculationParameters;
            trRoutingJobParameters?: TrRoutingBatchJobParameters;
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
