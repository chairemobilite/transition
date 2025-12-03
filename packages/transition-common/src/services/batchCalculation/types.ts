/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { validateTrQueryAttributes } from '../transitRouting/TransitRoutingQueryAttributes';
import { TransitRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';

/**
 * Verify that batch parameters are valid
 * @param parameters The parameters to validate
 * @param maxParallelCalculations The maximum number of parallel calculations
 * allowed, to validate the `parallelCalculations` parameter. Only positive
 * values are considered, otherwise the validation will be ignored.
 * @returns Returns whether the parameters are valid and a list of translatable
 * error strings if not
 */
export const isBatchParametersValid = (
    parameters: BatchCalculationParameters,
    maxParallelCalculations: number = -1
): { valid: boolean; errors: string[] } => {
    let parametersValid = true;
    const errors: string[] = [];
    if (!Array.isArray(parameters.routingModes) || parameters.routingModes.length === 0) {
        parametersValid = false;
        errors.push('transit:transitRouting:errors:RoutingModesIsEmpty');
    } else if (parameters.routingModes.includes('transit')) {
        const { valid: queryAttrValid, errors: queryAttrErrors } = validateTrQueryAttributes(parameters);
        if (!queryAttrValid) {
            parametersValid = false;
            errors.push(...queryAttrErrors);
        }
    }
    if (typeof parameters.parallelCalculations === 'number') {
        if (parameters.parallelCalculations < 1) {
            parametersValid = false;
            errors.push('transit:batchCalculation:errors:ParallelCalculationsIsTooLow');
        }
        if (maxParallelCalculations > 0 && parameters.parallelCalculations > maxParallelCalculations) {
            parameters.parallelCalculations = maxParallelCalculations;
        }
    }
    return { valid: parametersValid, errors };
};

export type BatchCalculationParameters = {
    withGeometries: boolean;
    detailed: boolean;
    /**
     * The number of desired parallel calculations to run for this job. Leave
     * empty to use the server's maximum value. The actual calculation may use
     * less parallel calculations if the server does not support as much.
     */
    parallelCalculations?: number;
} & TransitRoutingQueryAttributes;

export interface TransitBatchCalculationResult {
    detailed: boolean;
    completed: boolean;
    warnings: ErrorMessage[];
    errors: ErrorMessage[];
}
