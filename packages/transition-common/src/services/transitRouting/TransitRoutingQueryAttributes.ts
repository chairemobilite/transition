/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { minutesToSeconds } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

/**
 * Attributes to parameterize a transit routing calculation, that can be used in
 * many contexts of transit routing, not necessarily a calculation.
 */
export interface TransitRoutingBaseAttributes {
    minWaitingTimeSeconds?: number;
    maxTransferTravelTimeSeconds?: number;
    maxAccessEgressTravelTimeSeconds?: number;
    maxWalkingOnlyTravelTimeSeconds?: number;
    maxFirstWaitingTimeSeconds?: number;
    maxTotalTravelTimeSeconds?: number;
    walkingSpeedMps?: number;
    walkingSpeedFactor?: number;
}

/**
 * Attributes to parameterize a transit routing calculation, that are not
 * specific to a trip, but specific to a calculation query
 */
export interface TransitRoutingQueryAttributes extends TransitRoutingBaseAttributes {
    scenarioId?: string;
    withAlternatives?: boolean;
}

const MAX_MAX_ACCESS_EGRESS = minutesToSeconds(40) as number;
const MAX_MAX_TRANSFER_TIME = minutesToSeconds(20) as number;
const MIN_MIN_WAITING_TIME = minutesToSeconds(1) as number;

export const validateTrBaseAttributes = (
    attributes: TransitRoutingBaseAttributes
): { valid: boolean; errors: string[] } => {
    let valid = true;
    const errors: string[] = [];

    const maxAccessEgress = attributes.maxAccessEgressTravelTimeSeconds;
    if (maxAccessEgress !== undefined) {
        if (maxAccessEgress > MAX_MAX_ACCESS_EGRESS) {
            valid = false;
            errors.push('transit:transitRouting:errors:AccessEgressTravelTimeSecondsTooLarge');
        } else if (maxAccessEgress < 0) {
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
    attributes: TransitRoutingQueryAttributes
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
