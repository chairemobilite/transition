/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validateTrQueryAttributes, validateTrBaseAttributes } from '../TransitRoutingQueryAttributes';
import { minutesToSeconds } from 'chaire-lib-common/lib/utils/DateTimeUtils';
import each from 'jest-each';

const MAX_MAX_ACCESS_EGRESS = minutesToSeconds(40) as number;
const MAX_MAX_TRANSFER_TIME = minutesToSeconds(20) as number;
const MIN_MIN_WAITING_TIME = minutesToSeconds(1) as number;

let msgErrors = {
    scenarioIsMissing: 'transit:transitRouting:errors:ScenarioIsMissing',
    accessEgressTravelTimeSecondsTooLarge: 'transit:transitRouting:errors:AccessEgressTravelTimeSecondsTooLarge',
    maxAccessEgressNoNegative: 'transit:transitRouting:errors:AccessEgressTravelTimeSecondsNoNegative',
    transferTravelTimeSecondsTooLarge: 'transit:transitRouting:errors:TransferTravelTimeSecondsTooLarge',
    transferTravelTimeSecondsNoNegative: 'transit:transitRouting:errors:TransferTravelTimeSecondsNoNegative',
    minimumWaitingTimeSecondsMustBeAtLeast1Minute: 'transit:transitRouting:errors:MinimumWaitingTimeSecondsMustBeAtLeast1Minute'
};

describe('Validate function for query attributes', () => {
    const objtestNoScenario = {
        attributes: {
            
        },
        isValid: false,
        errors: [msgErrors.scenarioIsMissing]
    };

    const objtestMaxAccessEgressNoNegative = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: -1,
            scenarioId: '0'
        },
        isValid: false,
        errors: [msgErrors.maxAccessEgressNoNegative]
    };

    const objtestMaxAccessEgressTooLarge = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: MAX_MAX_ACCESS_EGRESS + 1,
            scenarioId: '0'
        },
        isValid: false,
        errors: [msgErrors.accessEgressTravelTimeSecondsTooLarge]
    };

    const objtestMaxTransferTimeNoNegative = {
        attributes: {
            maxTransferTravelTimeSeconds: -1,
            scenarioId: '0'
        },
        isValid: false,
        errors: [msgErrors.transferTravelTimeSecondsNoNegative]
    };

    const objtestMaxTransferTimeTooLarge = {
        attributes: {
            maxTransferTravelTimeSeconds: MAX_MAX_TRANSFER_TIME + 1,
            scenarioId: '0'
        },
        isValid: false,
        errors: [msgErrors.transferTravelTimeSecondsTooLarge]
    };

    const objtestMinWaitingTimeAtLeast1Minute = {
        attributes: {
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME - 1,
            scenarioId: '0'
        },
        isValid: false,
        errors: [msgErrors.minimumWaitingTimeSecondsMustBeAtLeast1Minute]
    };

    const objtestValidateMaxMaxAccessEgressAndMaxMaxTransferTime = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: MAX_MAX_ACCESS_EGRESS,
            maxTransferTravelTimeSeconds: MAX_MAX_TRANSFER_TIME,
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME,
            scenarioId: '0'
        },
        isValid: true,
        errors: []
    };

    const objtestValidateMinMaxAccessEgressAndMinMaxTransferTime = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: 0,
            maxTransferTravelTimeSeconds: 0,
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME,
            scenarioId: '0'
        },
        isValid: true,
        errors: []
    };

    each([
        ['no scenario selected', objtestNoScenario],
        ['maxAccessEgress no negative', objtestMaxAccessEgressNoNegative],
        ['maxAccessEgress too large', objtestMaxAccessEgressTooLarge],
        ['maxTransferTime no negative', objtestMaxTransferTimeNoNegative],
        ['maxTransferTime too large', objtestMaxTransferTimeTooLarge],
        ['minWaitingTime at least 1 minute', objtestMinWaitingTimeAtLeast1Minute],
        ['validate max maxAccessEgress and max maxTransferTime', objtestValidateMaxMaxAccessEgressAndMaxMaxTransferTime],
        ['validate min maxAccessEgress and min maxTransferTime', objtestValidateMinMaxAccessEgressAndMinMaxTransferTime],
    ]).test('%s', (nameTest, objTest) => {
        const allAttributes = Object.assign({}, objTest.attributes);
        const { valid, errors } = validateTrQueryAttributes(allAttributes)
        expect(valid).toEqual(objTest.isValid);

        expect(errors.length).toEqual(objTest.errors.length);

        expect(errors).toEqual(objTest.errors);
    })
});

describe('Validate function for base attributes', () => {
    const objtestEmpty = {
        attributes: {
            
        },
        isValid: true,
        errors: []
    };

    const objtestMaxAccessEgressNoNegative = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: -1,
        },
        isValid: false,
        errors: [msgErrors.maxAccessEgressNoNegative]
    };

    const objtestMaxAccessEgressTooLarge = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: MAX_MAX_ACCESS_EGRESS + 1,
        },
        isValid: false,
        errors: [msgErrors.accessEgressTravelTimeSecondsTooLarge]
    };

    const objtestMaxTransferTimeNoNegative = {
        attributes: {
            maxTransferTravelTimeSeconds: -1,
        },
        isValid: false,
        errors: [msgErrors.transferTravelTimeSecondsNoNegative]
    };

    const objtestMaxTransferTimeTooLarge = {
        attributes: {
            maxTransferTravelTimeSeconds: MAX_MAX_TRANSFER_TIME + 1,
        },
        isValid: false,
        errors: [msgErrors.transferTravelTimeSecondsTooLarge]
    };

    const objtestMinWaitingTimeAtLeast1Minute = {
        attributes: {
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME - 1,
        },
        isValid: false,
        errors: [msgErrors.minimumWaitingTimeSecondsMustBeAtLeast1Minute]
    };

    const objtestValidateMaxMaxAccessEgressAndMaxMaxTransferTime = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: MAX_MAX_ACCESS_EGRESS,
            maxTransferTravelTimeSeconds: MAX_MAX_TRANSFER_TIME,
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME,
        },
        isValid: true,
        errors: []
    };

    const objtestValidateMinMaxAccessEgressAndMinMaxTransferTime = {
        attributes: {
            maxAccessEgressTravelTimeSeconds: 0,
            maxTransferTravelTimeSeconds: 0,
            minWaitingTimeSeconds: MIN_MIN_WAITING_TIME,
        },
        isValid: true,
        errors: []
    };

    each([
        ['empty object', objtestEmpty],
        ['maxAccessEgress no negative', objtestMaxAccessEgressNoNegative],
        ['maxAccessEgress too large', objtestMaxAccessEgressTooLarge],
        ['maxTransferTime no negative', objtestMaxTransferTimeNoNegative],
        ['maxTransferTime too large', objtestMaxTransferTimeTooLarge],
        ['minWaitingTime at least 1 minute', objtestMinWaitingTimeAtLeast1Minute],
        ['validate max maxAccessEgress and max maxTransferTime', objtestValidateMaxMaxAccessEgressAndMaxMaxTransferTime],
        ['validate min maxAccessEgress and min maxTransferTime', objtestValidateMinMaxAccessEgressAndMinMaxTransferTime],
    ]).test('%s', (nameTest, objTest) => {
        const allAttributes = Object.assign({}, objTest.attributes);
        const { valid, errors } = validateTrBaseAttributes(allAttributes)
        expect(valid).toEqual(objTest.isValid);

        expect(errors.length).toEqual(objTest.errors.length);

        expect(errors).toEqual(objTest.errors);
    })
});
