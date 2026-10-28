/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { TransitDemandFromCsvAccessMapAttributes } from 'transition-common/lib/services/transitDemand/types';
import type { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import type { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import type { TrRoutingBatchJobParameters } from './TrRoutingBatchJobParameters';

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
