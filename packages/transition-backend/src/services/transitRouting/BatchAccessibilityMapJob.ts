/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitDemandFromCsvAccessMapAttributes } from 'transition-common/lib/services/transitDemand/types';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';

export type BatchAccessMapJobType = {
    name: 'batchAccessMap';
    data: {
        parameters: {
            batchAccessMapAttributes: TransitDemandFromCsvAccessMapAttributes;
            accessMapAttributes: AccessibilityMapAttributes;
        };
        results?: TransitBatchCalculationResult;
    };
    files: { input: true; csv: true; geojson: true };
};
