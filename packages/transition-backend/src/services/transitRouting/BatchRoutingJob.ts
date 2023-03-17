/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    TransitBatchCalculationResult,
    TransitBatchRoutingDemandAttributes
} from 'chaire-lib-common/lib/api/TrRouting';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';

export type BatchRouteJobType = {
    name: 'batchRoute';
    data: {
        parameters: {
            demandAttributes: TransitBatchRoutingDemandAttributes;
            transitRoutingAttributes: BatchCalculationParameters;
        };
        results?: TransitBatchCalculationResult;
    };
    files: { input: true; csv: true; detailedCsv: true; geojson: true };
};
