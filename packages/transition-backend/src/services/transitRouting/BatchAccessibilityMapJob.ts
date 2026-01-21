/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitDemandFromCsvAccessMapAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { TrRoutingBatchJobParameters } from './TrRoutingBatchJobParameters';

export type BatchAccessMapJobType = {
    name: 'batchAccessMap';
    data: {
        parameters: {
            batchAccessMapAttributes: TransitDemandFromCsvAccessMapAttributes;
            accessMapAttributes: AccessibilityMapAttributes;
            trRoutingJobParameters?: TrRoutingBatchJobParameters;
        };
        results?: Omit<TransitBatchCalculationResult, 'errors' | 'warnings'>;
    };
    files: { input: true; csv: true; geojson: true };
};
