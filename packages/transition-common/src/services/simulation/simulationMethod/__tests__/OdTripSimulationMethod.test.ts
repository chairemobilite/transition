/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { OdTripSimulationDescriptor, OdTripSimulationOptions } from '../OdTripSimulationMethod';

describe('OdTripSimulationDescriptor', () => {
    let descriptor: OdTripSimulationDescriptor;

    beforeEach(() => {
        descriptor = new OdTripSimulationDescriptor();
    });

    describe('getTranslatableName', () => {
        test('should return correct translatable name', () => {
            expect(descriptor.getTranslatableName()).toBe('transit:simulation:simulationMethods:OdTrips');
        });
    });

    describe('getOptions', () => {
        test('should return all required options', () => {
            const options = descriptor.getOptions();
            
            expect(options).toHaveProperty('dataSourceId');
            expect(options).toHaveProperty('sampleRatio');
            expect(options).toHaveProperty('odTripFitnessFunction');
            expect(options).toHaveProperty('fitnessFunction');
        });

        test('should configure dataSourceId option correctly', () => {
            const options = descriptor.getOptions();
            const dataSourceOption = options.dataSourceId;
            
            expect(dataSourceOption.i18nName).toBe('transit:simulation:simulationMethods:OdTripsDataSource');
            expect(dataSourceOption.type).toBe('select');
            expect(dataSourceOption.choices).toBeInstanceOf(Function);
        });

        test('should configure sampleRatio option correctly', () => {
            const options = descriptor.getOptions();
            const sampleRatioOption = options.sampleRatio;
            
            expect(sampleRatioOption.i18nName).toBe('transit:simulation:simulationMethods:OdTripsSampleRatio');
            expect(sampleRatioOption.type).toBe('number');
            expect(sampleRatioOption.default).toBe(1);
            expect(sampleRatioOption.validate).toBeInstanceOf(Function);
        });

        test('should validate sampleRatio correctly', () => {
            const options = descriptor.getOptions();
            const validate = options.sampleRatio.validate!;
            
            expect(validate(0.5)).toBe(true);
            expect(validate(1)).toBe(true);
            expect(validate(0)).toBe(false);
            expect(validate(-0.1)).toBe(false);
            expect(validate(1.1)).toBe(false);
        });

        test('should configure odTripFitnessFunction option correctly', () => {
            const options = descriptor.getOptions();
            const odTripFitnessOption = options.odTripFitnessFunction;
            
            expect(odTripFitnessOption.i18nName).toBe('transit:simulation:fitness:odTripFitnessFunction');
            expect(odTripFitnessOption.type).toBe('select');
            expect(odTripFitnessOption.choices).toBeInstanceOf(Function);
        });

        test('should configure fitnessFunction option correctly', () => {
            const options = descriptor.getOptions();
            const fitnessOption = options.fitnessFunction;
            
            expect(fitnessOption.i18nName).toBe('transit:simulation:fitness:fitnessFunction');
            expect(fitnessOption.type).toBe('select');
            expect(fitnessOption.choices).toBeInstanceOf(Function);
        });
    });

    describe('async choices functions', () => {
        test('should return empty array for dataSourceId choices', async () => {
            const options = descriptor.getOptions();
            const choices = await options.dataSourceId.choices();
            
            expect(Array.isArray(choices)).toBe(true);
            expect(choices).toHaveLength(0);
        });

        test('should return correct odTripFitnessFunction choices', async () => {
            const options = descriptor.getOptions();
            const choices = await options.odTripFitnessFunction.choices();
            
            expect(choices).toHaveLength(2);
            expect(choices).toContainEqual({
                label: 'transit:simulation:fitness:travelTimeCost',
                value: 'travelTimeCost'
            });
            expect(choices).toContainEqual({
                label: 'transit:simulation:fitness:travelTimeWithTransferPenalty',
                value: 'travelTimeWithTransferPenalty'
            });
        });

        test('should return correct fitnessFunction choices', async () => {
            const options = descriptor.getOptions();
            const choices = await options.fitnessFunction.choices();
            
            expect(choices).toHaveLength(3);
            expect(choices).toContainEqual({
                label: 'transit:simulation:fitness:hourlyUserPlusOperatingCosts',
                value: 'hourlyUserPlusOperatingCosts'
            });
            expect(choices).toContainEqual({
                label: 'transit:simulation:fitness:hourlyUserCosts',
                value: 'hourlyUserCosts'
            });
            expect(choices).toContainEqual({
                label: 'transit:simulation:fitness:hourlyOperatingCosts',
                value: 'hourlyOperatingCosts'
            });
        });
    });

    describe('validateOptions', () => {
        test('should return valid for any options (current implementation)', () => {
            const validOptions: Partial<OdTripSimulationOptions> = {
                dataSourceId: 'test-id',
                sampleRatio: 0.5,
                odTripFitnessFunction: 'travelTimeCost',
                fitnessFunction: 'hourlyUserCosts'
            };
            
            const result = descriptor.validateOptions(validOptions);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should return valid for empty options', () => {
            const result = descriptor.validateOptions({});
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should return valid for partial options', () => {
            const partialOptions: Partial<OdTripSimulationOptions> = {
                sampleRatio: 0.8
            };
            
            const result = descriptor.validateOptions(partialOptions);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
});
