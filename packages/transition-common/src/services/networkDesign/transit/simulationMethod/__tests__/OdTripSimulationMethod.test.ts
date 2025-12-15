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
            expect(descriptor.getTranslatableName()).toBe('transit:networkDesign.simulationMethods.odTrips.Title');
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

            expect(demandAttributesOption.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.demandAttributes');
            expect(demandAttributesOption.type).toBe('csvFile');
        });

        test('should configure transitRoutingAttributes option correctly', () => {
            const options = descriptor.getOptions();
            const transitRoutingOption = options.transitRoutingAttributes;

            expect(transitRoutingOption.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.transitRoutingAttributes');
            expect(transitRoutingOption.type).toBe('nested');
            expect(transitRoutingOption.descriptor).toBeDefined();
        });

        test('should configure evaluationOptions option correctly', () => {
            const options = descriptor.getOptions();
            const evaluationOption = options.evaluationOptions;

            expect(evaluationOption.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.simulationOptions');
            expect(evaluationOption.type).toBe('nested');
            expect(evaluationOption.descriptor).toBeDefined();
        });
    });

    describe('demandAttributes descriptor', () => {
        test('should have correct i18nName for demandAttributes', () => {
            const options = descriptor.getOptions();
            const demandAttributesOption = options.demandAttributes;

            expect(demandAttributesOption.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.demandAttributes');
        });

        test('should have correct type for demandAttributes', () => {
            const options = descriptor.getOptions();
            const demandAttributesOption = options.demandAttributes;

            expect(demandAttributesOption.type).toBe('csvFile');
        });

        test('should have correct mappingDescriptors for demandAttributes', () => {
            const options = descriptor.getOptions();
            const demandAttributesOption = options.demandAttributes;

            expect(demandAttributesOption.mappingDescriptors).toBeDefined();
            expect(Array.isArray(demandAttributesOption.mappingDescriptors)).toBe(true);
            expect(demandAttributesOption.mappingDescriptors).toHaveLength(4);

            const keys = demandAttributesOption.mappingDescriptors.map((desc: any) => desc.key);
            expect(keys).toEqual(['id', 'origin', 'destination', 'expansionFactor']);
        });

        test('should have correct importFileName for demandAttributes', () => {
            const options = descriptor.getOptions();
            const demandAttributesOption = options.demandAttributes;

            expect(demandAttributesOption.importFileName).toBe('transit_od_trips.csv');
        });

        test('should validate demandAttributes with all required fields', () => {
            const validOptions: Partial<OdTripSimulationOptions> = {
                demandAttributes: {
                    type: 'csv',
                    fileAndMapping: {
                        fieldMappings: {
                            id: 'id',
                            projection: '4326',
                            originLat: 'originLat',
                            originLon: 'originLon',
                            destinationLat: 'destinationLat',
                            destinationLon: 'destinationLon'
                        },
                        csvFile: { location: 'upload', filename: 'test.csv', uploadFilename: 'uploaded.csv' }
                    },
                    csvFields: ['id', 'originLat', 'originLon', 'destinationLat', 'destinationLon']
                }
            };

            const result = descriptor.validateOptions(validOptions);

            expect(result.errors).toEqual([]);
            expect(result.valid).toBe(true);
        });

        test('should return invalid for demandAttributes with missing required fields', () => {
            const invalidOptions: Partial<OdTripSimulationOptions> = {
                demandAttributes: {
                    type: 'csv',
                    fileAndMapping: {
                        fieldMappings: {
                            id: 'id',
                            // missing originLon (empty string)
                            projection: '4326',
                            originLat: 'originLat',
                            originLon: '',
                            destinationLat: 'destinationLat',
                            destinationLon: 'destinationLon'
                        },
                        csvFile: { location: 'upload', filename: 'test.csv', uploadFilename: 'uploaded.csv' }
                    },
                    csvFields: ['id', 'originLat', 'destinationLat', 'destinationLon']
                }
            };

            const result = descriptor.validateOptions(invalidOptions);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('transit:transitRouting:errors:OriginIsMissingLon');
        });

        test('should return valid for demandAttributes with invalid file location (file validation is done elsewhere)', () => {
            const options: Partial<OdTripSimulationOptions> = {
                demandAttributes: {
                    type: 'csv',
                    fileAndMapping: {
                        fieldMappings: {
                            id: 'id',
                            projection: '4326',
                            originLat: 'originLat',
                            originLon: 'originLon',
                            destinationLat: 'destinationLat',
                            destinationLon: 'destinationLon'
                        },
                        csvFile: { location: 'invalidLocation' as any, filename: 'test.csv', uploadFilename: 'uploaded.csv' }
                    },
                    csvFields: ['id', 'originLat', 'originLon', 'destinationLat', 'destinationLon']
                }
            };

            const result = descriptor.validateOptions(options);

            // File location validation is done elsewhere, not in options validator
            expect(result.valid).toBe(true);
        });

        test('should return valid for demandAttributes with empty filename (file validation is done elsewhere)', () => {
            const options: Partial<OdTripSimulationOptions> = {
                demandAttributes: {
                    type: 'csv',
                    fileAndMapping: {
                        fieldMappings: {
                            id: 'id',
                            projection: '4326',
                            originLat: 'originLat',
                            originLon: 'originLon',
                            destinationLat: 'destinationLat',
                            destinationLon: 'destinationLon'
                        },
                        csvFile: { location: 'upload', filename: '', uploadFilename: 'uploaded.csv' }
                    },
                    csvFields: ['id', 'originLat', 'originLon', 'destinationLat', 'destinationLon']
                }
            };

            const result = descriptor.validateOptions(options);

            // Filename validation is done elsewhere, not in options validator
            expect(result.valid).toBe(true);
        });
    });

    describe('transitRoutingAttributes descriptor', () => {
        let transitRoutingDescriptor: any;
        let transitOptions: any;

        beforeEach(() => {
            const options = descriptor.getOptions();
            transitRoutingDescriptor = options.transitRoutingAttributes.descriptor;
            transitOptions = transitRoutingDescriptor.getOptions();
        });

        test('should have correct translatable name', () => {
            expect(transitRoutingDescriptor.getTranslatableName()).toBe('transit:networkDesign.simulationMethods.transitRoutingAttributes');
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

            expect(option.i18nName).toBe('transit:transitRouting.MinimumWaitingTimeMinutes');
            expect(option.type).toBe('seconds');
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

            expect(option.i18nName).toBe('transit:transitRouting.MaximumTransferTravelTimeMinutes');
            expect(option.type).toBe('seconds');
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

            expect(option.i18nName).toBe('transit:transitRouting.MaximumAccessEgressTravelTimeMinutes');
            expect(option.type).toBe('seconds');
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

            expect(option.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.MaxWalkingOnlyTravelTimeMinutes');
            expect(option.type).toBe('seconds');
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

            expect(option.i18nName).toBe('transit:transitRouting.MaximumFirstWaitingTimeMinutes');
            expect(option.type).toBe('seconds');
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

            expect(option.i18nName).toBe('transit:transitRouting.MaximumTotalTravelTimeMinutes');
            expect(option.type).toBe('seconds');
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

            expect(option.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.WalkingSpeedMps');
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

            expect(option.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.WalkingSpeedFactor');
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
            simulationDescriptor = options.evaluationOptions.descriptor;
            simulationOptions = simulationDescriptor.getOptions();
        });

        test('should have correct translatable name', () => {
            expect(simulationDescriptor.getTranslatableName()).toBe('transit:networkDesign.simulationMethods.odTrips.simulationOptions');
        });

        test('should have all required evaluation options', () => {
            expect(simulationOptions).toHaveProperty('sampleRatio');
            expect(simulationOptions).toHaveProperty('odTripFitnessFunction');
            expect(simulationOptions).toHaveProperty('fitnessFunction');
        });

        test('should configure sampleRatio correctly', () => {
            const option = simulationOptions.sampleRatio;

            expect(option.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.OdTripsSampleRatio');
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

            expect(option.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.fitness.odTripFitnessFunction');
            expect(option.type).toBe('select');
            expect(option.choices).toBeInstanceOf(Function);
        });

        test('should return correct odTripFitnessFunction choices', async () => {
            const choices = await simulationOptions.odTripFitnessFunction.choices();

            expect(choices).toHaveLength(2);
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.simulationMethods.odTrips.fitness.travelTimeCost',
                value: 'travelTimeCost'
            });
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.simulationMethods.odTrips.fitness.travelTimeWithTransferPenalty',
                value: 'travelTimeWithTransferPenalty'
            });
        });

        test('should configure fitnessFunction correctly', () => {
            const option = simulationOptions.fitnessFunction;

            expect(option.i18nName).toBe('transit:networkDesign.simulationMethods.odTrips.fitness.fitnessFunction');
            expect(option.type).toBe('select');
            expect(option.choices).toBeInstanceOf(Function);
        });

        test('should return correct fitnessFunction choices', async () => {
            const choices = await simulationOptions.fitnessFunction.choices();

            expect(choices).toHaveLength(3);
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.simulationMethods.odTrips.fitness.hourlyUserPlusOperatingCosts',
                value: 'hourlyUserPlusOperatingCosts'
            });
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.simulationMethods.odTrips.fitness.hourlyUserCosts',
                value: 'hourlyUserCosts'
            });
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.simulationMethods.odTrips.fitness.hourlyOperatingCosts',
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
                    fileAndMapping: {
                        fieldMappings: {
                            projection: '4326',
                            id: 'id',
                            originLon: 'originX',
                            originLat: 'originY',
                            destinationLon: 'destinationX',
                            destinationLat: 'destinationY'
                        },
                        csvFile: { location: 'upload', filename: 'test.csv', uploadFilename: 'uploaded.csv' }
                    },
                    csvFields: ['originX', 'originY', 'destinationX', 'destinationY', 'id']
                },
                evaluationOptions: {
                    sampleRatio: 0.5,
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

        test('should return invalid for partial options with empty fieldMappings', () => {
            const partialOptions: Partial<OdTripSimulationOptions> = {
                demandAttributes: {
                    type: 'csv',
                    fileAndMapping: {
                        csvFile: {
                            location: 'upload',
                            filename: '',
                            uploadFilename: 'uploaded.csv'
                        },
                        fieldMappings: {
                            id: '',
                            projection: '',
                            originLat: '',
                            originLon: '',
                            destinationLat: '',
                            destinationLon: ''
                        }
                    },
                    csvFields: []
                }
            };

            const result = descriptor.validateOptions(partialOptions);

            // Empty fieldMappings values fail validation
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });
});
