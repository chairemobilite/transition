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
            
            expect(options).toHaveProperty('demandAttributes');
            expect(options).toHaveProperty('transitRoutingAttributes');
            expect(options).toHaveProperty('evaluationOptions');
        });

        test('should configure demandAttributes option correctly', () => {
            const options = descriptor.getOptions();
            const demandAttributesOption = options.demandAttributes;
            
            expect(demandAttributesOption.i18nName).toBe('transit:simulation:simulationMethods:demandAttributes');
            expect(demandAttributesOption.type).toBe('custom');
        });

        test('should configure transitRoutingAttributes option correctly', () => {
            const options = descriptor.getOptions();
            const transitRoutingOption = options.transitRoutingAttributes;
            
            expect(transitRoutingOption.i18nName).toBe('transit:simulation:simulationMethods:transitRoutingAttributes');
            expect(transitRoutingOption.type).toBe('nested');
            expect(transitRoutingOption.descriptor).toBeInstanceOf(Function);
        });

        test('should configure evaluationOptions option correctly', () => {
            const options = descriptor.getOptions();
            const evaluationOption = options.evaluationOptions;
            
            expect(evaluationOption.i18nName).toBe('transit:simulation:simulationMethods:simulationOptions');
            expect(evaluationOption.type).toBe('nested');
            expect(evaluationOption.descriptor).toBeInstanceOf(Function);
        });
    });

    describe('demandAttributes descriptor', () => {
        test('should have custom type (no nested descriptor to test)', () => {
            const options = descriptor.getOptions();
            const demandAttributesOption = options.demandAttributes;
            
            expect(demandAttributesOption.type).toBe('custom');
            // Custom type means it's handled externally, no nested descriptor to test
        });
    });

    describe('transitRoutingAttributes descriptor', () => {
        let transitRoutingDescriptor: any;
        let transitOptions: any;

        beforeEach(() => {
            const options = descriptor.getOptions();
            transitRoutingDescriptor = options.transitRoutingAttributes.descriptor();
            transitOptions = transitRoutingDescriptor.getOptions();
        });

        test('should have correct translatable name', () => {
            expect(transitRoutingDescriptor.getTranslatableName()).toBe('transit:simulation:simulationMethods:transitRoutingAttributes');
        });

        test('should have all required transit routing options', () => {
            expect(transitOptions).toHaveProperty('minWaitingTimeSeconds');
            expect(transitOptions).toHaveProperty('maxTransferTravelTimeSeconds');
            expect(transitOptions).toHaveProperty('maxAccessEgressTravelTimeSeconds');
            expect(transitOptions).toHaveProperty('maxWalkingOnlyTravelTimeSeconds');
            expect(transitOptions).toHaveProperty('maxFirstWaitingTimeSeconds');
            expect(transitOptions).toHaveProperty('maxTotalTravelTimeSeconds');
            expect(transitOptions).toHaveProperty('walkingSpeedMps');
            expect(transitOptions).toHaveProperty('walkingSpeedFactor');
        });

        test('should configure minWaitingTimeSeconds correctly', () => {
            const option = transitOptions.minWaitingTimeSeconds;
            
            expect(option.i18nName).toBe('transit:simulation:minWaitingTimeSeconds');
            expect(option.type).toBe('integer');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBeDefined();
            expect(typeof option.default).toBe('number');
        });

        test('should validate minWaitingTimeSeconds correctly', () => {
            const validate = transitOptions.minWaitingTimeSeconds.validate;
            
            expect(validate(0)).toBe(true);
            expect(validate(60)).toBe(true);
            expect(validate(-1)).toBe(false);
        });

        test('should configure maxTransferTravelTimeSeconds correctly', () => {
            const option = transitOptions.maxTransferTravelTimeSeconds;
            
            expect(option.i18nName).toBe('transit:simulation:maxTransferTravelTimeSeconds');
            expect(option.type).toBe('integer');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBeDefined();
            expect(typeof option.default).toBe('number');
        });

        test('should validate maxTransferTravelTimeSeconds correctly', () => {
            const validate = transitOptions.maxTransferTravelTimeSeconds.validate;
            
            expect(validate(0)).toBe(true);
            expect(validate(600)).toBe(true);
            expect(validate(-1)).toBe(false);
        });

        test('should configure maxAccessEgressTravelTimeSeconds correctly', () => {
            const option = transitOptions.maxAccessEgressTravelTimeSeconds;
            
            expect(option.i18nName).toBe('transit:simulation:maxAccessEgressTravelTimeSeconds');
            expect(option.type).toBe('integer');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBeDefined();
            expect(typeof option.default).toBe('number');
        });

        test('should validate maxAccessEgressTravelTimeSeconds correctly', () => {
            const validate = transitOptions.maxAccessEgressTravelTimeSeconds.validate;
            
            expect(validate(0)).toBe(true);
            expect(validate(1200)).toBe(true);
            expect(validate(-1)).toBe(false);
        });

        test('should configure maxWalkingOnlyTravelTimeSeconds correctly', () => {
            const option = transitOptions.maxWalkingOnlyTravelTimeSeconds;
            
            expect(option.i18nName).toBe('transit:simulation:maxWalkingOnlyTravelTimeSeconds');
            expect(option.type).toBe('integer');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBeDefined();
            expect(typeof option.default).toBe('number');
        });

        test('should validate maxWalkingOnlyTravelTimeSeconds correctly', () => {
            const validate = transitOptions.maxWalkingOnlyTravelTimeSeconds.validate;
            
            expect(validate(0)).toBe(true);
            expect(validate(1800)).toBe(true);
            expect(validate(-1)).toBe(false);
        });

        test('should configure maxFirstWaitingTimeSeconds correctly', () => {
            const option = transitOptions.maxFirstWaitingTimeSeconds;
            
            expect(option.i18nName).toBe('transit:simulation:maxFirstWaitingTimeSeconds');
            expect(option.type).toBe('integer');
            expect(option.validate).toBeInstanceOf(Function);
            // max first waiting time is undefined by default to indicate no limit (if not set in the preferences before)
            expect(option.default).toBeUndefined();
        });

        test('should validate maxFirstWaitingTimeSeconds correctly', () => {
            const validate = transitOptions.maxFirstWaitingTimeSeconds.validate;
            
            expect(validate(0)).toBe(true);
            expect(validate(1800)).toBe(true);
            expect(validate(-1)).toBe(false);
        });

        test('should configure maxTotalTravelTimeSeconds correctly', () => {
            const option = transitOptions.maxTotalTravelTimeSeconds;
            
            expect(option.i18nName).toBe('transit:simulation:maxTotalTravelTimeSeconds');
            expect(option.type).toBe('integer');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBeDefined();
            expect(typeof option.default).toBe('number');
        });

        test('should validate maxTotalTravelTimeSeconds correctly', () => {
            const validate = transitOptions.maxTotalTravelTimeSeconds.validate;
            
            expect(validate(0)).toBe(true);
            expect(validate(7200)).toBe(true);
            expect(validate(-1)).toBe(false);
        });

        test('should configure walkingSpeedMps correctly', () => {
            const option = transitOptions.walkingSpeedMps;
            
            expect(option.i18nName).toBe('transit:simulation:walkingSpeedMps');
            expect(option.type).toBe('number');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBeDefined();
            expect(typeof option.default).toBe('number');
        });

        test('should validate walkingSpeedMps correctly', () => {
            const validate = transitOptions.walkingSpeedMps.validate;
            
            expect(validate(1.0)).toBe(true);
            expect(validate(1.5)).toBe(true);
            expect(validate(0)).toBe(false);
            expect(validate(-0.5)).toBe(false);
        });

        test('should configure walkingSpeedFactor correctly', () => {
            const option = transitOptions.walkingSpeedFactor;
            
            expect(option.i18nName).toBe('transit:simulation:walkingSpeedFactor');
            expect(option.type).toBe('number');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBeDefined();
            expect(typeof option.default).toBe('number');
        });

        test('should validate walkingSpeedFactor correctly', () => {
            const validate = transitOptions.walkingSpeedFactor.validate;
            
            expect(validate(1.0)).toBe(true);
            expect(validate(1.2)).toBe(true);
            expect(validate(0)).toBe(false);
            expect(validate(-0.1)).toBe(false);
        });

        test('should validate options (returns valid for any input)', () => {
            const result = transitRoutingDescriptor.validateOptions({
                minWaitingTimeSeconds: 120,
                walkingSpeedMps: 1.4
            });
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('evaluationOptions descriptor', () => {
        let simulationDescriptor: any;
        let simulationOptions: any;

        beforeEach(() => {
            const options = descriptor.getOptions();
            simulationDescriptor = options.evaluationOptions.descriptor();
            simulationOptions = simulationDescriptor.getOptions();
        });

        test('should have correct translatable name', () => {
            expect(simulationDescriptor.getTranslatableName()).toBe('transit:simulation:simulationMethods:simulationOptions');
        });

        test('should have all required evaluation options', () => {
            expect(simulationOptions).toHaveProperty('sampleRatio');
            expect(simulationOptions).toHaveProperty('odTripFitnessFunction');
            expect(simulationOptions).toHaveProperty('fitnessFunction');
        });

        test('should configure sampleRatio correctly', () => {
            const option = simulationOptions.sampleRatio;
            
            expect(option.i18nName).toBe('transit:simulation:simulationMethods:OdTripsSampleRatio');
            expect(option.type).toBe('number');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBe(1);
        });

        test('should validate sampleRatio correctly', () => {
            const validate = simulationOptions.sampleRatio.validate;
            
            expect(validate(0.5)).toBe(true);
            expect(validate(1)).toBe(true);
            expect(validate(0.001)).toBe(true);
            expect(validate(0)).toBe(false);
            expect(validate(-0.1)).toBe(false);
            expect(validate(1.1)).toBe(false);
        });

        test('should configure odTripFitnessFunction correctly', () => {
            const option = simulationOptions.odTripFitnessFunction;
            
            expect(option.i18nName).toBe('transit:simulation:fitness:odTripFitnessFunction');
            expect(option.type).toBe('select');
            expect(option.choices).toBeInstanceOf(Function);
        });

        test('should return correct odTripFitnessFunction choices', async () => {
            const choices = await simulationOptions.odTripFitnessFunction.choices();
            
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

        test('should configure fitnessFunction correctly', () => {
            const option = simulationOptions.fitnessFunction;
            
            expect(option.i18nName).toBe('transit:simulation:fitness:fitnessFunction');
            expect(option.type).toBe('select');
            expect(option.choices).toBeInstanceOf(Function);
        });

        test('should return correct fitnessFunction choices', async () => {
            const choices = await simulationOptions.fitnessFunction.choices();
            
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

        test('should validate options (returns valid for any input)', () => {
            const result = simulationDescriptor.validateOptions({
                sampleRatio: 0.8,
                odTripFitnessFunction: 'travelTimeCost',
                fitnessFunction: 'hourlyUserCosts'
            });
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('validateOptions', () => {
        test('should return valid for any options (current implementation)', () => {
            const validOptions: Partial<OdTripSimulationOptions> = {
                demandAttributes: {
                    type: 'csv',
                    configuration: {} as any,
                    sampleRatio: 0.5,
                    tripWeightAttribute: 'weight'
                },
                evaluationOptions: {
                    odTripFitnessFunction: 'travelTimeCost',
                    fitnessFunction: 'hourlyUserCosts'
                }
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
                demandAttributes: {
                    type: 'csv',
                    configuration: {} as any,
                    sampleRatio: 0.8
                }
            };
            
            const result = descriptor.validateOptions(partialOptions);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });
});
