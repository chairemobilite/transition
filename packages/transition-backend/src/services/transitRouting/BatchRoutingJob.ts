/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitBatchCalculationResult, TransitBatchRoutingAttributes } from 'chaire-lib-common/lib/api/TrRouting';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';

export type BatchRouteJobType = {
    name: 'batchRoute';
    data: {
        parameters: {
            batchRoutingAttributes: TransitBatchRoutingAttributes;
            transitRoutingAttributes: Partial<TransitRoutingAttributes>;
        };
        results?: TransitBatchCalculationResult;
    };
    files: { input: true; csv: true; detailedCsv: true; geojson: true };
};
