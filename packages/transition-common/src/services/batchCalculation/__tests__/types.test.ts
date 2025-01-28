/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BatchCalculationParameters, isBatchParametersValid } from '../types';

describe('Test isBatchParametersValid', () => {
    test('Test valid, without transit', () => {
        const parameters = { routingModes: ['walking' as const], withGeometries: true, detailed: true, withAlternatives: false, engines: [] };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
    });

    test('Test valid, with transit, minimal', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const],
            scenarioId: 'arbitrary',
            withGeometries: true,
            detailed: true,
            withAlternatives: false
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
            walkingSpeedFactor: 1,
            withGeometries: false,
            detailed: false
        };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
    });

    test('Test invalid, missing routing modes', () => {
        const parameters = { routingModes: [], withGeometries: true, detailed: true, withAlternatives: false };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:transitRouting:errors:RoutingModesIsEmpty']});
    });

    test('Test invalid, with transit missing scenario id', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const], withGeometries: true, detailed: true, withAlternatives: false
        };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:transitRouting:errors:ScenarioIsMissing']});
    });

    test('Validate parallel calculations', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const],
            scenarioId: 'arbitrary',
            withGeometries: true,
            detailed: true,
            withAlternatives: false
        };
        
        // parallel calculation is not set, no max set, should remain unset
        parameters.parallelCalculations = undefined;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.parallelCalculations).toBeUndefined();

        // parallel calculation is not set, with a max, should remain unset
        expect(isBatchParametersValid(parameters, 4)).toEqual({ valid: true, errors: []});
        expect(parameters.parallelCalculations).toBeUndefined();

        // parallel calculation set to 3, no max set, should remain 3
        const parallelCalculations = 3;
        parameters.parallelCalculations = parallelCalculations;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.parallelCalculations).toEqual(parallelCalculations);

        // parallel calculation set to lower than max, should remain as set
        expect(isBatchParametersValid(parameters, parallelCalculations + 1)).toEqual({ valid: true, errors: []});
        expect(parameters.parallelCalculations).toEqual(parallelCalculations);

        // parallel calculation set to higher than max, should fallback to max
        expect(isBatchParametersValid(parameters, parallelCalculations - 1)).toEqual({ valid: true, errors: []});
        expect(parameters.parallelCalculations).toEqual(parallelCalculations - 1);

        // parallel calculation negative, should be invalid
        parameters.parallelCalculations = -1;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:batchCalculation:errors:ParallelCalculationsIsTooLow']});
        expect(parameters.parallelCalculations).toEqual(-1);

        // parallel calculation 0, should be invalid
        parameters.parallelCalculations = -1;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:batchCalculation:errors:ParallelCalculationsIsTooLow']});
        expect(parameters.parallelCalculations).toEqual(-1);

    });
});

