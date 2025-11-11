/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import TrError from 'chaire-lib-common/lib/utils/TrError';
import { DecayFunctionCalculator } from '../DecayFunctionCalculator';
import {
    PowerDecayParameters,
    ExponentialDecayParameters,
    GammaDecayParameters,
    CombinedDecayParameters,
    LogisticDecayParameters,
    DecayFunctionParameters,
    MIN_DISTANCE_METERS,
    MIN_TRAVEL_TIME_SECONDS,
    DecayInputValueType,
    DecayInputValue
} from '../types';

describe('DecayFunctionCalculator', () => {
    /**
     * Helper function to create a DecayInputValue object
     * Ensures at least one value is defined (enforced by type system)
     */
    const createInputValue = (distance: number | undefined, time: number | undefined): DecayInputValue => {
        if (distance !== undefined) {
            return { distanceMeters: distance, travelTimeSeconds: time };
        } else if (time !== undefined) {
            return { travelTimeSeconds: time, distanceMeters: distance };
        } else {
            throw new Error('At least one of distanceMeters or travelTimeSeconds must be defined');
        }
    };

    describe('getInputValue (tested indirectly through calculateDecay)', () => {
        const params: PowerDecayParameters = { type: 'power', beta: 2 };

        it.each([
            ['distance', 500, 300, Math.pow(500, -2)],
            ['time', 500, 300, Math.pow(300, -2)],
            ['distance', 1000, 600, Math.pow(1000, -2)],
            ['time', 1000, 600, Math.pow(600, -2)]
        ])('should use correct value when inputValueType is %s for distance=%d, time=%d', (inputValueType, distance, time, expected) => {
            const inputValue = createInputValue(distance, time);
            const result = DecayFunctionCalculator.calculateDecay(inputValue, inputValueType as DecayInputValueType, params);
            expect(result).toBeCloseTo(expected, 5);
        });
    });

    describe('getAdjustedValue (tested indirectly through calculateDecay)', () => {
        const params: PowerDecayParameters = { type: 'power', beta: 2 };

        describe('for distance values', () => {
            it.each([
                ['below threshold', 50, MIN_DISTANCE_METERS],
                ['zero', 0, MIN_DISTANCE_METERS],
                ['MIN_DISTANCE_METERS - 1', MIN_DISTANCE_METERS - 1, MIN_DISTANCE_METERS],
                ['MIN_DISTANCE_METERS', MIN_DISTANCE_METERS, MIN_DISTANCE_METERS],
                ['above MIN_DISTANCE_METERS', 500, 500],
                ['much larger than MIN_DISTANCE_METERS', 10000, 10000]
            ])('should return correct adjusted value when distance is %s', (description, distance, expectedAdjusted) => {
                const inputValue = createInputValue(distance, 300);
                const result = DecayFunctionCalculator.calculateDecay(inputValue, 'distance', params);
                const expectedResult = Math.pow(expectedAdjusted, -params.beta);
                expect(result).toBeCloseTo(expectedResult, 5);
            });
        });

        describe('for time values', () => {
            it.each([
                ['below threshold', 30, MIN_TRAVEL_TIME_SECONDS],
                ['zero', 0, MIN_TRAVEL_TIME_SECONDS],
                ['MIN_TRAVEL_TIME_SECONDS - 1', MIN_TRAVEL_TIME_SECONDS - 1, MIN_TRAVEL_TIME_SECONDS],
                ['MIN_TRAVEL_TIME_SECONDS', MIN_TRAVEL_TIME_SECONDS, MIN_TRAVEL_TIME_SECONDS],
                ['above MIN_TRAVEL_TIME_SECONDS', 300, 300],
                ['much larger than MIN_TRAVEL_TIME_SECONDS', 6000, 6000]
            ])('should return correct adjusted value when time is %s', (description, time, expectedAdjusted) => {
                const inputValue = createInputValue(500, time);
                const result = DecayFunctionCalculator.calculateDecay(inputValue, 'time', params);
                const expectedResult = Math.pow(expectedAdjusted, -params.beta);
                expect(result).toBeCloseTo(expectedResult, 5);
            });
        });

        describe('edge cases', () => {
            it.each([
                ['distance', 50, 300, MIN_DISTANCE_METERS, 300],
                ['time', 500, 30, MIN_TRAVEL_TIME_SECONDS, 500]
            ])('should not affect the other value when adjusting %s', (inputValueType, distance, time, expectedAdjusted, expectedOther) => {
                const inputValue = createInputValue(distance, time);
                const result = DecayFunctionCalculator.calculateDecay(inputValue, inputValueType as DecayInputValueType, params);
                const expectedResult = Math.pow(expectedAdjusted, -params.beta);
                expect(result).toBeCloseTo(expectedResult, 5);
                const otherResult = DecayFunctionCalculator.calculateDecay(inputValue, inputValueType === 'distance' ? 'time' : 'distance', params);
                const expectedOtherResult = Math.pow(expectedOther, -params.beta);
                expect(otherResult).toBeCloseTo(expectedOtherResult, 5);
            });

            it.each([
                ['both below threshold', 50, 30, MIN_DISTANCE_METERS, MIN_TRAVEL_TIME_SECONDS],
                ['very small fractional values', 0.001, 0.001, MIN_DISTANCE_METERS, MIN_TRAVEL_TIME_SECONDS]
            ])('should handle %s independently', (description, distance, time, expectedDistance, expectedTime) => {
                const inputValue = createInputValue(distance, time);
                const distanceResult = DecayFunctionCalculator.calculateDecay(inputValue, 'distance', params);
                const expectedDistanceResult = Math.pow(expectedDistance, -params.beta);
                expect(distanceResult).toBeCloseTo(expectedDistanceResult, 5);
                const timeResult = DecayFunctionCalculator.calculateDecay(inputValue, 'time', params);
                const expectedTimeResult = Math.pow(expectedTime, -params.beta);
                expect(timeResult).toBeCloseTo(expectedTimeResult, 5);
            });
        });
    });

    describe('Power decay', () => {
        const params: PowerDecayParameters = { type: 'power', beta: 2 };

        it.each([
            [300, Math.pow(300, -2)],
            [600, Math.pow(600, -2)],
            [120, Math.pow(120, -2)]
        ])('should calculate power decay correctly for input %d', (input, expected) => {
            expect(DecayFunctionCalculator.calculateDecay(createInputValue(0, input), 'time', params)).toBeCloseTo(expected, 5);
        });

        it.each([
            [500, 0.000004],
            [100, 0.0001],
            [2000, 0.00000025]
        ])('should calculate power decay correctly for input %d', (input, expected) => {
            expect(DecayFunctionCalculator.calculateDecay(createInputValue(input, 0), 'distance', params)).toBeCloseTo(expected, 5);
        });

        it('should throw error for negative input', () => {
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, -1), 'time', params)).toThrow(TrError);
        });

        it('should throw error for invalid beta parameter', () => {
            const invalidParams: PowerDecayParameters = { type: 'power', beta: -1 };
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 300), 'time', invalidParams)).toThrow(TrError);
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 300), 'time', invalidParams)).toThrow(TrError);
        });

        describe.each([
            ['distance', 'distance' as DecayInputValueType],
            ['time', 'time' as DecayInputValueType]
        ])('should throw error for %s input type', (description, inputType) => {
            it.each([
                ['NaN', NaN],
                ['Infinity', Infinity],
                ['negative value', -1],
                ['negative infinity', -Infinity]
            ])('should throw error for %s', (valueDescription, value) => {
                const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                expect(() => DecayFunctionCalculator.calculateDecay(inputValue, inputType, params)).toThrow(TrError);
            });
        });

        it.each([
            ['zero', 'distance', 0],
            ['zero', 'time', 0],
            ['very small value below MIN_DISTANCE_METERS','distance', MIN_DISTANCE_METERS * 0.5],
            ['very small value below MIN_TRAVEL_TIME_SECONDS', 'time', MIN_TRAVEL_TIME_SECONDS * 0.5],
            ['small fraction', 'distance', 0.001],
            ['small fraction', 'time', 0.001]
        ])('should apply minimum threshold for %s', (description, inputType, value) => {
            const expected = inputType === 'distance' ? Math.pow(MIN_DISTANCE_METERS, -params.beta) : Math.pow(MIN_TRAVEL_TIME_SECONDS, -params.beta);
            const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
            const result = DecayFunctionCalculator.calculateDecay(inputValue, inputType as DecayInputValueType, params);
            expect(result).toBeCloseTo(expected, 5);
            expect(Number.isFinite(result)).toBe(true);
        });
    });

    describe('Exponential decay', () => {
        const params: ExponentialDecayParameters = { type: 'exponential', beta: 0.1 };

        it.each([
            [300, Math.exp(-0.1 * 300)],
            [600, Math.exp(-0.1 * 600)],
            [0, Math.exp(-0.1 * MIN_TRAVEL_TIME_SECONDS)]
        ])('should calculate exponential decay correctly for input %d', (input, expected) => {
            expect(DecayFunctionCalculator.calculateDecay(createInputValue(0, input), 'time', params)).toBeCloseTo(expected, 5);
        });

        it('should throw error for zero beta (constant value of 1)', () => {
            const zeroBetaParams: ExponentialDecayParameters = { type: 'exponential', beta: 0 };
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', zeroBetaParams)).toThrow(TrError);
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', zeroBetaParams)).toThrow(TrError);
        });

        it('should throw error for negative beta in validation', () => {
            const invalidParams: ExponentialDecayParameters = { type: 'exponential', beta: -0.1 };
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', invalidParams)).toThrow(TrError);
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', invalidParams)).toThrow(TrError);
        });

        describe.each([
            ['distance', 'distance' as DecayInputValueType],
            ['time', 'time' as DecayInputValueType]
        ])('should throw error for %s input type', (description, inputType) => {
            it.each([
                ['NaN', NaN],
                ['Infinity', Infinity],
                ['negative value', -1],
                ['negative infinity', -Infinity]
            ])('should throw error for %s', (valueDescription, value) => {
                const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                expect(() => DecayFunctionCalculator.calculateDecay(inputValue, inputType, params)).toThrow(TrError);
            });
        });

        it.each([
            ['zero', 'distance', 0],
            ['zero', 'time', 0],
            ['very small value below MIN_DISTANCE_METERS', 'distance', MIN_DISTANCE_METERS * 0.5],
            ['very small value below MIN_TRAVEL_TIME_SECONDS', 'time', MIN_TRAVEL_TIME_SECONDS * 0.5],
            ['small fraction', 'distance', 0.001],
            ['small fraction', 'time', 0.001]
        ])('should apply minimum threshold for %s', (description, inputType, value) => {
            const expected = inputType === 'distance' ? Math.exp(-params.beta * MIN_DISTANCE_METERS) : Math.exp(-params.beta * MIN_TRAVEL_TIME_SECONDS);
            const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
            const result = DecayFunctionCalculator.calculateDecay(inputValue, inputType as DecayInputValueType, params);
            expect(result).toBeCloseTo(expected, 5);
            expect(Number.isFinite(result)).toBe(true);
        });
    });

    describe('Gamma decay', () => {
        const params: GammaDecayParameters = { type: 'gamma', a: 5280, b: 0.926, c: 0.087 };

        it('should calculate gamma decay correctly (NCHRP 716 example)', () => {
            const result = DecayFunctionCalculator.calculateDecay(createInputValue(0, 900), 'time', params);
            expect(result).toBeGreaterThan(0);
            expect(Number.isFinite(result)).toBe(true);
        });

        it('should calculate gamma decay for other values', () => {
            const result = DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', params);
            expect(result).toBeGreaterThan(0);
            expect(Number.isFinite(result)).toBe(true);
        });

        it('should throw error for invalid parameters', () => {
            const invalidParams: GammaDecayParameters = { type: 'gamma', a: -1, b: 0.926, c: 0.087 };
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', invalidParams)).toThrow(TrError);
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', invalidParams)).toThrow(TrError);
        });

        describe.each([
            ['distance', 'distance' as DecayInputValueType],
            ['time', 'time' as DecayInputValueType]
        ])('should throw error for %s input type', (description, inputType) => {
            it.each([
                ['NaN', NaN],
                ['Infinity', Infinity],
                ['negative value', -1],
                ['negative infinity', -Infinity]
            ])('should throw error for %s', (valueDescription, value) => {
                const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                expect(() => DecayFunctionCalculator.calculateDecay(inputValue, inputType, params)).toThrow(TrError);
            });
        });

        it.each([
            ['zero', 'distance', 0],
            ['zero', 'time', 0],
            ['very small value below MIN_DISTANCE_METERS', 'distance', MIN_DISTANCE_METERS * 0.5],
            ['very small value below MIN_TRAVEL_TIME_SECONDS', 'time', MIN_TRAVEL_TIME_SECONDS * 0.5],
            ['small fraction', 'distance', 0.001],
            ['small fraction', 'time', 0.001]
        ])('should apply minimum threshold for %s', (description, inputType, value) => {
            const expected = inputType === 'distance'
                ? params.a * Math.pow(MIN_DISTANCE_METERS, -params.b) * Math.exp(-params.c * MIN_DISTANCE_METERS)
                : params.a * Math.pow(MIN_TRAVEL_TIME_SECONDS, -params.b) * Math.exp(-params.c * MIN_TRAVEL_TIME_SECONDS);
            const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
            const result = DecayFunctionCalculator.calculateDecay(inputValue, inputType as DecayInputValueType, params);
            expect(result).toBeCloseTo(expected, 5);
            expect(Number.isFinite(result)).toBe(true);
        });
    });

    describe('Combined decay', () => {
        const params: CombinedDecayParameters = { type: 'combined', beta1: 1.0, beta2: 0.1 };

        it('should calculate combined decay correctly', () => {
            const result = DecayFunctionCalculator.calculateDecay(createInputValue(0, 300), 'time', params);
            const expected = Math.pow(300, -1.0) * Math.exp(-0.1 * 300);
            expect(result).toBeCloseTo(expected, 5);
        });

        it.each([
            ['negative beta1', { type: 'combined' as const, beta1: -1, beta2: 0.1 }],
            ['zero beta1', { type: 'combined' as const, beta1: 0, beta2: 0.1 }],
            ['negative beta2', { type: 'combined' as const, beta1: 1.0, beta2: -0.1 }],
            ['zero beta2', { type: 'combined' as const, beta1: 1.0, beta2: 0 }]
        ])('should throw error for %s in validation', (description, invalidParams) => {
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', invalidParams as DecayFunctionParameters)).toThrow(TrError);
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', invalidParams as DecayFunctionParameters)).toThrow(TrError);
        });

        describe.each([
            ['distance', 'distance' as DecayInputValueType],
            ['time', 'time' as DecayInputValueType]
        ])('should throw error for %s input type', (description, inputType) => {
            it.each([
                ['NaN', NaN],
                ['Infinity', Infinity],
                ['negative value', -1],
                ['negative infinity', -Infinity]
            ])('should throw error for %s', (valueDescription, value) => {
                const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                expect(() => DecayFunctionCalculator.calculateDecay(inputValue, inputType, params)).toThrow(TrError);
            });
        });

        it.each([
            ['zero', 'distance', 0],
            ['zero', 'time', 0],
            ['very small value below MIN_DISTANCE_METERS', 'distance', MIN_DISTANCE_METERS * 0.5],
            ['very small value below MIN_TRAVEL_TIME_SECONDS', 'time', MIN_TRAVEL_TIME_SECONDS * 0.5],
            ['small fraction', 'distance', 0.001],
            ['small fraction', 'time', 0.001]
        ])('should apply minimum threshold for %s', (description, inputType, value) => {
            const expected = inputType === 'distance'
                ? Math.pow(MIN_DISTANCE_METERS, -params.beta1) * Math.exp(-params.beta2 * MIN_DISTANCE_METERS)
                : Math.pow(MIN_TRAVEL_TIME_SECONDS, -params.beta1) * Math.exp(-params.beta2 * MIN_TRAVEL_TIME_SECONDS);
            const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
            const result = DecayFunctionCalculator.calculateDecay(inputValue, inputType as DecayInputValueType, params);
            expect(result).toBeCloseTo(expected, 5);
            expect(Number.isFinite(result)).toBe(true);
        });
    });

    describe('Logistic decay', () => {
        const params: LogisticDecayParameters = { type: 'logistic', beta: 0.5, x0: 600 };

        it('should calculate logistic decay correctly', () => {
            const result = DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', params);
            expect(result).toBeCloseTo(0.5, 5); // At x0, should be 0.5
        });

        it('should approach 1 for values much less than x0', () => {
            const result = DecayFunctionCalculator.calculateDecay(createInputValue(0, 0), 'time', params);
            // With MIN_TRAVEL_TIME_SECONDS = 60, result should be calculated with x = 60
            const expected = 1 / (1 + Math.exp(params.beta * (MIN_TRAVEL_TIME_SECONDS - params.x0)));
            expect(result).toBeCloseTo(expected, 5);
        });

        it('should approach 0 for values much greater than x0', () => {
            const result = DecayFunctionCalculator.calculateDecay(createInputValue(0, 3000), 'time', params);
            expect(result).toBeLessThan(0.1);
        });

        it.each([
            ['non-finite beta', { type: 'logistic' as const, beta: Infinity, x0: 600 }],
            ['non-finite x0', { type: 'logistic' as const, beta: 0.5, x0: Infinity }],
            ['NaN beta', { type: 'logistic' as const, beta: NaN, x0: 600 }],
            ['NaN x0', { type: 'logistic' as const, beta: 0.5, x0: NaN }],
            ['zero beta', { type: 'logistic' as const, beta: 0, x0: 600 }],
            ['negative beta', { type: 'logistic' as const, beta: -0.5, x0: 600 }]
        ])('should throw error for %s in validation', (description, invalidParams) => {
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', invalidParams as DecayFunctionParameters)).toThrow(TrError);
        });

        describe.each([
            ['distance', 'distance' as DecayInputValueType],
            ['time', 'time' as DecayInputValueType]
        ])('should throw error for %s input type', (description, inputType) => {
            it.each([
                ['NaN', NaN],
                ['Infinity', Infinity],
                ['negative value', -1],
                ['negative infinity', -Infinity]
            ])('should throw error for %s', (valueDescription, value) => {
                const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                expect(() => DecayFunctionCalculator.calculateDecay(inputValue, inputType, params)).toThrow(TrError);
            });
        });

        it.each([
            ['zero', 'distance', 0],
            ['zero', 'time', 0],
            ['very small value below MIN_DISTANCE_METERS', 'distance', MIN_DISTANCE_METERS * 0.5],
            ['very small value below MIN_TRAVEL_TIME_SECONDS', 'time', MIN_TRAVEL_TIME_SECONDS * 0.5],
            ['small fraction', 'distance', 0.001],
            ['small fraction', 'time', 0.001]
        ])('should apply minimum threshold for %s', (description, inputType, value) => {
            const expected = inputType === 'distance'
                ? 1 / (1 + Math.exp(params.beta * (MIN_DISTANCE_METERS - params.x0)))
                : 1 / (1 + Math.exp(params.beta * (MIN_TRAVEL_TIME_SECONDS - params.x0)));
            const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
            const result = DecayFunctionCalculator.calculateDecay(inputValue, inputType as DecayInputValueType, params);
            expect(result).toBeCloseTo(expected, 5);
            expect(Number.isFinite(result)).toBe(true);
        });
    });

    describe('Parameter validation', () => {
        it.each([
            ['power', { type: 'power' as const, beta: 2 }],
            ['exponential', { type: 'exponential' as const, beta: 0.1 }],
            ['gamma', { type: 'gamma' as const, a: 5280, b: 0.926, c: 0.087 }],
            ['combined', { type: 'combined' as const, beta1: 1.0, beta2: 0.1 }],
            ['logistic', { type: 'logistic' as const, beta: 0.5, x0: 600 }]
        ])('should validate valid %s parameters', (decayType, params) => {
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', params)).not.toThrow();
        });

        it('should throw error for unknown decay function type in validateParameters', () => {
            // Use type assertion to create an invalid decay function type
            const invalidParams = { type: 'unknown' as never, beta: 2 } as DecayFunctionParameters;
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', invalidParams)).toThrow(TrError);
        });
    });

    describe('Edge cases', () => {
        describe.each([
            ['Power', { type: 'power' as const, beta: 2 }],
            ['Exponential', { type: 'exponential' as const, beta: 0.1 }],
            ['Gamma', { type: 'gamma' as const, a: 5280, b: 0.926, c: 0.087 }],
            ['Combined', { type: 'combined' as const, beta1: 1.0, beta2: 0.1 }],
            ['Logistic', { type: 'logistic' as const, beta: 0.5, x0: 10 }]
        ])('Invalid inputs for %s decay', (decayType, params) => {
            describe.each([
                ['distance', 'distance' as DecayInputValueType],
                ['time', 'time' as DecayInputValueType]
            ])('should throw error for %s input type', (description, inputType) => {
                it.each([
                    ['NaN', NaN],
                    ['Infinity', Infinity],
                    ['negative value', -1],
                    ['negative infinity', -Infinity]
                ])('should throw error for %s', (valueDescription, value) => {
                    const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                    expect(() => DecayFunctionCalculator.calculateDecay(inputValue, inputType, params)).toThrow(TrError);
                });
            });
        });

        describe.each([
            ['Power', { type: 'power' as const, beta: 2 }, (x: number) => Math.pow(x, -2)],
            ['Exponential', { type: 'exponential' as const, beta: 0.1 }, (x: number) => Math.exp(-0.1 * x)],
            ['Gamma', { type: 'gamma' as const, a: 5280, b: 0.926, c: 0.087 }, (x: number) => 5280 * Math.pow(x, -0.926) * Math.exp(-0.087 * x)],
            ['Combined', { type: 'combined' as const, beta1: 1.0, beta2: 0.1 }, (x: number) => Math.pow(x, -1.0) * Math.exp(-0.1 * x)],
            ['Logistic', { type: 'logistic' as const, beta: 0.5, x0: 10 }, (x: number) => 1 / (1 + Math.exp(0.5 * (x - 10)))]
        ])('Very small values for %s decay', (decayType, params, expectedFn) => {
            it.each([
                ['zero', 'distance', 0],
                ['zero', 'time', 0],
                ['very small value below MIN_DISTANCE_METERS', 'distance', MIN_DISTANCE_METERS * 0.5],
                ['very small value below MIN_TRAVEL_TIME_SECONDS', 'time', MIN_TRAVEL_TIME_SECONDS * 0.5],
                ['small fraction', 'distance', 0.001],
                ['small fraction', 'time', 0.001]
            ])('should apply minimum threshold for %s', (description, inputType, value) => {
                const expected = inputType === 'distance' ? expectedFn(MIN_DISTANCE_METERS) : expectedFn(MIN_TRAVEL_TIME_SECONDS);
                const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                const result = DecayFunctionCalculator.calculateDecay(inputValue, inputType as DecayInputValueType, params);
                expect(result).toBeCloseTo(expected, 5);
                expect(Number.isFinite(result)).toBe(true);
                expect(result).toBeGreaterThan(0);
            });
        });

        describe.each([
            ['Power', { type: 'power' as const, beta: 2 }],
            ['Exponential', { type: 'exponential' as const, beta: 0.1 }],
            ['Gamma', { type: 'gamma' as const, a: 5280, b: 0.926, c: 0.087 }],
            ['Combined', { type: 'combined' as const, beta1: 1.0, beta2: 0.1 }],
            ['Logistic', { type: 'logistic' as const, beta: 0.5, x0: 10 }]
        ])('Very large values for %s decay', (decayType, params) => {
            it.each([
                ['very large distance', 10000, 'distance'],
                ['very large time', 60000, 'time'],
                ['extremely large distance', 100000, 'distance'],
                ['extremely large time', 600000, 'time']
            ])('should handle %s', (valueDescription, value, inputType) => {
                const inputValue = inputType === 'distance' ? createInputValue(value, 0) : createInputValue(0, value);
                const result = DecayFunctionCalculator.calculateDecay(inputValue, inputType as DecayInputValueType, params);
                expect(Number.isFinite(result)).toBe(true);
                expect(result).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('Error handling for invalid types', () => {
        it('should throw error for unknown decay function type in calculateDecay', () => {
            // Use type assertion to create an invalid decay function type
            const invalidParams = { type: 'unknown' as never, beta: 2 } as DecayFunctionParameters;
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', invalidParams)).toThrow(TrError);
        });

        it('should throw error for unknown decay function type in calculateDecay default case', () => {
            // Mock validateParameters to bypass validation and test the default case in calculateDecay
            const validateSpy = jest.spyOn(DecayFunctionCalculator, 'validateParameters').mockReturnValue(true);
            // Use type assertion to create an invalid decay function type
            const invalidParams = { type: 'unknown' as never, beta: 2 } as DecayFunctionParameters;
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', invalidParams)).toThrow(TrError);
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', invalidParams)).toThrow('Unknown decay function type');
            validateSpy.mockRestore();
        });

        it('should throw error when inputValueType is neither distance nor time', () => {
            // Mock validateParameters to bypass validation, but getInputValue will still throw
            const validateSpy = jest.spyOn(DecayFunctionCalculator, 'validateParameters').mockReturnValue(true);
            const validParams: PowerDecayParameters = { type: 'power', beta: 2 };
            // Use type assertion to bypass TypeScript checking and test invalid inputValueType
            const invalidInputValueType = 'other' as DecayInputValueType;
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 300), invalidInputValueType, validParams)).toThrow(TrError);
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 300), invalidInputValueType, validParams)).toThrow('Unsupported inputValueType');
            validateSpy.mockRestore();
        });

        it('should throw error for invalid inputValueType in validateParameters', () => {
            const validParams: PowerDecayParameters = { type: 'power', beta: 2 };
            // Use type assertion to bypass TypeScript checking and test invalid inputValueType
            const invalidInputValueType = 'invalid' as DecayInputValueType;
            expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), invalidInputValueType, validParams)).toThrow('Input value type must be either "distance" or "time"');
            expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), invalidInputValueType, validParams)).toThrow('Input value type must be either "distance" or "time"');
        });


        describe('should only validate the requested inputValueType value in DecayInputValue', () => {
            const validParams: PowerDecayParameters = { type: 'power', beta: 2 };

            describe('when inputValueType is distance', () => {
                it.each([
                    ['NaN time', NaN],
                    ['Infinity time', Infinity],
                    ['negative time', -1],
                    ['negative infinity time', -Infinity]
                ])('should not throw error for invalid time value (%s) when distance is valid', (description, invalidTime) => {
                    expect(() => DecayFunctionCalculator.validateParameters(createInputValue(100, invalidTime), 'distance', validParams)).not.toThrow();
                    expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(100, invalidTime), 'distance', validParams)).not.toThrow();
                });
            });

            describe('when inputValueType is time', () => {
                it.each([
                    ['NaN distance', NaN],
                    ['Infinity distance', Infinity],
                    ['negative distance', -1],
                    ['negative infinity distance', -Infinity]
                ])('should not throw error for invalid distance value (%s) when time is valid', (description, invalidDistance) => {
                    expect(() => DecayFunctionCalculator.validateParameters(createInputValue(invalidDistance, 600), 'time', validParams)).not.toThrow();
                    expect(() => DecayFunctionCalculator.calculateDecay(createInputValue(invalidDistance, 600), 'time', validParams)).not.toThrow();
                });
            });
        });

        describe('should accept input value when non-selected type is 0 or undefined', () => {
            const validParams: PowerDecayParameters = { type: 'power', beta: 2 };

            describe('when inputValueType is distance', () => {
                it('should accept input when travelTimeSeconds is 0', () => {
                    expect(() => DecayFunctionCalculator.validateParameters(createInputValue(100, 0), 'distance', validParams)).not.toThrow();
                    const result = DecayFunctionCalculator.calculateDecay(createInputValue(100, 0), 'distance', validParams);
                    expect(Number.isFinite(result)).toBe(true);
                    expect(result).toBeGreaterThanOrEqual(0);
                });

                it('should accept input when travelTimeSeconds is undefined', () => {
                    const inputValue = createInputValue(100, undefined);
                    expect(() => DecayFunctionCalculator.validateParameters(inputValue, 'distance', validParams)).not.toThrow();
                    const result = DecayFunctionCalculator.calculateDecay(inputValue, 'distance', validParams);
                    expect(Number.isFinite(result)).toBe(true);
                    expect(result).toBeGreaterThanOrEqual(0);
                });
            });

            describe('when inputValueType is time', () => {
                it('should accept input when distanceMeters is 0', () => {
                    expect(() => DecayFunctionCalculator.validateParameters(createInputValue(0, 600), 'time', validParams)).not.toThrow();
                    const result = DecayFunctionCalculator.calculateDecay(createInputValue(0, 600), 'time', validParams);
                    expect(Number.isFinite(result)).toBe(true);
                    expect(result).toBeGreaterThanOrEqual(0);
                });

                it('should accept input when distanceMeters is undefined', () => {
                    const inputValue = createInputValue(undefined, 600);
                    expect(() => DecayFunctionCalculator.validateParameters(inputValue, 'time', validParams)).not.toThrow();
                    const result = DecayFunctionCalculator.calculateDecay(inputValue, 'time', validParams);
                    expect(Number.isFinite(result)).toBe(true);
                    expect(result).toBeGreaterThanOrEqual(0);
                });
            });
        });

        describe('should throw error when selected type is undefined', () => {
            const validParams: PowerDecayParameters = { type: 'power', beta: 2 };

            it('should throw error when distanceMeters is undefined and inputValueType is distance', () => {
                const inputValue = createInputValue(undefined, 600);
                expect(() => DecayFunctionCalculator.validateParameters(inputValue, 'distance', validParams)).toThrow(TrError);
                expect(() => DecayFunctionCalculator.validateParameters(inputValue, 'distance', validParams)).toThrow('Distance value is required but was undefined');
                expect(() => DecayFunctionCalculator.calculateDecay(inputValue, 'distance', validParams)).toThrow(TrError);
            });

            it('should throw error when travelTimeSeconds is undefined and inputValueType is time', () => {
                const inputValue = createInputValue(100, undefined);
                expect(() => DecayFunctionCalculator.validateParameters(inputValue, 'time', validParams)).toThrow(TrError);
                expect(() => DecayFunctionCalculator.validateParameters(inputValue, 'time', validParams)).toThrow('Time value is required but was undefined');
                expect(() => DecayFunctionCalculator.calculateDecay(inputValue, 'time', validParams)).toThrow(TrError);
            });
        });
    });
});
