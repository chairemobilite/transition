import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import {
    TransitRoutingQueryAttributes,
    validateTrQueryAttributes
} from '../transitRouting/TransitRoutingQueryAttributes';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

export const isBatchParametersValid = (parameters: BatchCalculationParameters) => {
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
    if (typeof parameters.cpuCount !== 'number' && typeof parameters.maxCpuCount === 'number') {
        parameters.cpuCount = parameters.maxCpuCount as number;
    } else if (
        typeof parameters.cpuCount === 'number' &&
        typeof parameters.maxCpuCount === 'number' &&
        parameters.cpuCount > parameters.maxCpuCount
    ) {
        // Automatically set the number of CPU to the max count
        parameters.cpuCount = parameters.maxCpuCount;
    } else if (typeof parameters.cpuCount === 'number' && parameters.cpuCount <= 0) {
        // Minimum number of CPU is 1
        parameters.cpuCount = 1;
    }
    return { valid: parametersValid, errors };
};

export type BatchCalculationParameters = {
    routingModes: RoutingOrTransitMode[];
    withGeometries: boolean;
    detailed: boolean;
    // TODO Remove these from this object once trRouting is parallel
    cpuCount?: number;
    maxCpuCount?: number;
} & TransitRoutingQueryAttributes;

export interface TransitBatchCalculationResult {
    calculationName: string;
    detailed: boolean;
    completed: boolean;
    warnings: ErrorMessage[];
    errors: ErrorMessage[];
}
