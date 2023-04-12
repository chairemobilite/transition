/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BatchCalculationParameters, isBatchParametersValid } from '../types';

describe('Test isBatchParametersValid', () => {
    test('Test valid, without transit', () => {
        const parameters = { routingModes: ['walking' as const], withGeometries: true, detailed: true };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
    });

    test('Test valid, with transit, minimal', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const],
            scenarioId: 'arbitrary',
            withGeometries: true,
            detailed: true
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
        const parameters = { routingModes: [], withGeometries: true, detailed: true};
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:transitRouting:errors:RoutingModesIsEmpty']});
    });

    test('Test invalid, with transit missing scenario id', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const], withGeometries: true, detailed: true
        };
        expect(isBatchParametersValid(parameters)).toEqual({ valid: false, errors: ['transit:transitRouting:errors:ScenarioIsMissing']});
    });

    test('Validate number of CPUs', () => {
        const parameters: BatchCalculationParameters = { 
            routingModes: ['walking' as const, 'transit' as const],
            scenarioId: 'arbitrary',
            withGeometries: true,
            detailed: true
        };
        
        // all cpu count has not been set, they should remain unset
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toBeUndefined();
        expect(parameters.maxCpuCount).toBeUndefined();
    
        // Set a max count, the count should be the max count
        const maxCpu = 4;
        parameters.maxCpuCount = maxCpu;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toEqual(maxCpu);
        expect(parameters.maxCpuCount).toEqual(maxCpu);
    
        // Set a valid count, should be unchanged
        let cpuCount = 2;
        parameters.cpuCount = cpuCount;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toEqual(cpuCount);
        expect(parameters.maxCpuCount).toEqual(maxCpu);
    
        // Set a CPU count too high, should be back to max count
        cpuCount = maxCpu + 2;
        parameters.cpuCount = cpuCount;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toEqual(maxCpu);
        expect(parameters.maxCpuCount).toEqual(maxCpu);
    
        // Set a CPU count below 0, should be set to 1
        cpuCount = -1;
        parameters.cpuCount = cpuCount;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toEqual(1);
        expect(parameters.maxCpuCount).toEqual(maxCpu);
    
        // Set max to undefined, then set cpu count below to 0 or negative, should be 1
        parameters.maxCpuCount = undefined;
        parameters.cpuCount = 0;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toEqual(1);
        expect(parameters.maxCpuCount).toBeUndefined();
        parameters.cpuCount = -1;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toEqual(1);
        expect(parameters.maxCpuCount).toBeUndefined();
    
        cpuCount = 10;
        parameters.cpuCount = cpuCount;
        expect(isBatchParametersValid(parameters)).toEqual({ valid: true, errors: []});
        expect(parameters.cpuCount).toEqual(cpuCount);
        expect(parameters.maxCpuCount).toBeUndefined();
    });
});

