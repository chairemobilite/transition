import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import {
    TransitRoutingQueryAttributes,
    validateTrQueryAttributes
} from '../transitRouting/TransitRoutingQueryAttributes';

export const isBatchParametersValid = (parameters: BatchCalculationParameters) => {
    let parametersValid = true;
    const errors: string[] = [];
    if (parameters.routingModes.length === 0) {
        parametersValid = false;
        errors.push('transit:transitRouting:errors:RoutingModesIsEmpty');
    }
    if (parameters.routingModes.includes('transit')) {
        const { valid: queryAttrValid, errors: queryAttrErrors } = validateTrQueryAttributes(parameters);
        if (!queryAttrValid) {
            parametersValid = false;
            errors.push(...queryAttrErrors);
        }
    }
    return { valid: parametersValid, errors };
};

export type BatchCalculationParameters = {
    routingModes: RoutingOrTransitMode[];
} & TransitRoutingQueryAttributes;

export interface TransitBatchCalculationResult {
    calculationName: string;
    detailed: boolean;
    completed: boolean;
    warnings: ErrorMessage[];
    errors: ErrorMessage[];
}
