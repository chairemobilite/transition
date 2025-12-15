/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { AccessibilityMapSimulationDescriptor, AccessibilityMapSimulationOptions } from '../AccessibilityMapSimulationMethod';

describe('AccessibilityMapSimulationDescriptor', () => {
    let descriptor: AccessibilityMapSimulationDescriptor;

    beforeEach(() => {
        descriptor = new AccessibilityMapSimulationDescriptor();
    });

    describe('getTranslatableName', () => {
        test('should return the correct translatable name', () => {
            expect(descriptor.getTranslatableName()).toBe('transit:networkDesign.simulationMethods.accessibilityMap.Title');
        });
    });

    describe('getOptions', () => {
        test('should return options with correct structure', () => {
            const options = descriptor.getOptions();

            expect(options).toHaveProperty('dataSourceId');
            expect(options).toHaveProperty('sampleRatio');
        });

        test('should configure dataSourceId option correctly', () => {
            const options = descriptor.getOptions();
            const dataSourceOption = options.dataSourceId;

            expect(dataSourceOption.i18nName).toBe('transit:networkDesign.simulationMethods.accessibilityMap.AccessMapDataSources');
            expect(dataSourceOption.type).toBe('select');
            expect(typeof dataSourceOption.choices).toBe('function');
        });

        test('should configure sampleRatio option correctly', () => {
            const options = descriptor.getOptions();
            const sampleRatioOption = options.sampleRatio;

            expect(sampleRatioOption.i18nName).toBe('transit:networkDesign.simulationMethods.accessibilityMap.AccessMapMaxSampleRatio');
            expect(sampleRatioOption.type).toBe('number');
            expect(sampleRatioOption.default).toBe(1);
            expect(typeof sampleRatioOption.validate).toBe('function');
        });

        test('should return empty choices for dataSourceId (FIXME case)', async () => {
            const options = descriptor.getOptions();
            const choices = await options.dataSourceId.choices();

            expect(Array.isArray(choices)).toBe(true);
            expect(choices).toHaveLength(0);
        });

        describe('sampleRatio validation', () => {
            test('should validate positive values <= 1', () => {
                const options = descriptor.getOptions();
                const validate = options.sampleRatio.validate!;

                expect(validate(0.5)).toBe(true);
                expect(validate(1)).toBe(true);
                expect(validate(0.1)).toBe(true);
            });

            test('should reject values <= 0', () => {
                const options = descriptor.getOptions();
                const validate = options.sampleRatio.validate!;

                expect(validate(0)).toBe(false);
                expect(validate(-0.1)).toBe(false);
                expect(validate(-1)).toBe(false);
            });

            test('should reject values > 1', () => {
                const options = descriptor.getOptions();
                const validate = options.sampleRatio.validate!;

                expect(validate(1.1)).toBe(false);
                expect(validate(2)).toBe(false);
                expect(validate(10)).toBe(false);
            });
        });
    });

    describe('validateOptions', () => {
        test('should return valid result with empty errors for any options', () => {
            const result = descriptor.validateOptions({});

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should return valid result for complete options', () => {
            const options: AccessibilityMapSimulationOptions = {
                dataSourceId: 'test-source-id',
                sampleRatio: 0.8
            };

            const result = descriptor.validateOptions(options);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should return valid result for partial options', () => {
            const result1 = descriptor.validateOptions({ dataSourceId: 'test-id' });
            const result2 = descriptor.validateOptions({ sampleRatio: 0.5 });

            expect(result1.valid).toBe(true);
            expect(result1.errors).toEqual([]);
            expect(result2.valid).toBe(true);
            expect(result2.errors).toEqual([]);
        });
    });
});
