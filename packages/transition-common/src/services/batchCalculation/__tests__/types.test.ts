/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BatchCalculationParameters, isBatchParametersValid } from '../types';

describe('Test is valid', () => {
    test('Test valid, without transit', () => {
        const parameters = { routingModes: ['walking' as const]};
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
    });

    test('Test valid, with transit, minimal', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const],
            scenarioId: 'arbitrary'
        };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
    });

    test('Test valid, with transit, complete', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const],
            scenarioId: 'arbitrary',
            withAlternatives: true,
            minWaitingTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 900,
            maxAccessEgressTravelTimeSeconds: 900,
            maxWalkingOnlyTravelTimeSeconds: 900,
            maxFirstWaitingTimeSeconds: 600,
            maxTotalTravelTimeSeconds: 3600,
            walkingSpeedMps: 5,
            walkingSpeedFactor: 1
        };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
    });

    test('Test invalid, missing routing modes', () => {
        const parameters = { routingModes: []};
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:transitRouting:errors:RoutingModesIsEmpty']});
    });

    test('Test invalid, with transit missing scenario id', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const]
        };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:transitRouting:errors:ScenarioIsMissing']});
    });

});