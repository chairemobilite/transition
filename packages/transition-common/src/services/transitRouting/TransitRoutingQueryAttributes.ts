/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { minutesToSeconds } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    TransitRoutingBaseAttributes,
    TransitRoutingQueryAttributes
} from 'chaire-lib-common/lib/services/routing/types';

const MAX_MAX_TRANSFER_TIME = minutesToSeconds(20) as number;
const MIN_MIN_WAITING_TIME = minutesToSeconds(1) as number;

export const validateTrBaseAttributes = (
    attributes: Partial<TransitRoutingBaseAttributes>
): { valid: boolean; errors: string[] } => {
    let valid = true;
    const errors: string[] = [];

    const maxAccessEgress = attributes.maxAccessEgressTravelTimeSeconds;
    if (maxAccessEgress !== undefined) {
        if (maxAccessEgress < 0) {
            valid = false;
            errors.push('transit:transitRouting:errors:AccessEgressTravelTimeSecondsNoNegative');
        }
    }
    const maxTransferTime = attributes.maxTransferTravelTimeSeconds;
    if (maxTransferTime !== undefined) {
        if (maxTransferTime > MAX_MAX_TRANSFER_TIME) {
            valid = false;
            errors.push('transit:transitRouting:errors:TransferTravelTimeSecondsTooLarge');
        } else if (maxTransferTime < 0) {
            valid = false;
            errors.push('transit:transitRouting:errors:TransferTravelTimeSecondsNoNegative');
        }
    }
    const minWaitingTime = attributes.minWaitingTimeSeconds;
    if (minWaitingTime !== undefined) {
        if (minWaitingTime < MIN_MIN_WAITING_TIME) {
            valid = false;
            errors.push('transit:transitRouting:errors:MinimumWaitingTimeSecondsMustBeAtLeast1Minute');
        }
    }
    return { valid, errors };
};

export const validateTrQueryAttributes = (
    attributes: Partial<TransitRoutingQueryAttributes>
): { valid: boolean; errors: string[] } => {
    const baseResult = validateTrBaseAttributes(attributes);
    let valid = baseResult.valid;
    const errors = baseResult.errors;

    if (_isBlank(attributes.scenarioId)) {
        valid = false;
        errors.push('transit:transitRouting:errors:ScenarioIsMissing');
    }
    return { valid, errors };
};
