/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import {
    OdTripSimulationDescriptor,
    OdTripSimulationOptions
} from '../OdTripSimulationMethod';
import {
    NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS,
    NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS
} from '../nodeWeightingTypes';

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
            expect(options).toHaveProperty('nodeWeighting');
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
            const requiredKeys = [
                'minWaitingTimeSeconds',
                'maxTransferTravelTimeSeconds',
                'maxAccessEgressTravelTimeSeconds',
                'maxWalkingOnlyTravelTimeSeconds',
                'maxFirstWaitingTimeSeconds',
                'maxTotalTravelTimeSeconds',
                'walkingSpeedMps',
                'walkingSpeedFactor'
            ];
            expect(Object.keys(transitOptions)).toEqual(expect.arrayContaining(requiredKeys));
        });

        const transitRoutingOptionSpecs: Array<{
            optionKey: string;
            i18nName: string;
            type: 'seconds' | 'number';
            defaultUndefined: boolean;
            validationCases: Array<[number, boolean]>;
        }> = [
            {
                optionKey: 'minWaitingTimeSeconds',
                i18nName: 'transit:transitRouting.MinimumWaitingTimeMinutes',
                type: 'seconds',
                defaultUndefined: false,
                validationCases: [[0, true], [60, true], [-1, false]]
            },
            {
                optionKey: 'maxTransferTravelTimeSeconds',
                i18nName: 'transit:transitRouting.MaximumTransferTravelTimeMinutes',
                type: 'seconds',
                defaultUndefined: false,
                validationCases: [[0, true], [600, true], [-1, false]]
            },
            {
                optionKey: 'maxAccessEgressTravelTimeSeconds',
                i18nName: 'transit:transitRouting.MaximumAccessEgressTravelTimeMinutes',
                type: 'seconds',
                defaultUndefined: false,
                validationCases: [[0, true], [1200, true], [-1, false]]
            },
            {
                optionKey: 'maxWalkingOnlyTravelTimeSeconds',
                i18nName: 'transit:networkDesign.simulationMethods.odTrips.MaxWalkingOnlyTravelTimeMinutes',
                type: 'seconds',
                defaultUndefined: false,
                validationCases: [[0, true], [1800, true], [-1, false]]
            },
            {
                optionKey: 'maxFirstWaitingTimeSeconds',
                i18nName: 'transit:transitRouting.MaximumFirstWaitingTimeMinutes',
                type: 'seconds',
                defaultUndefined: true,
                validationCases: [[0, true], [1800, true], [-1, false]]
            },
            {
                optionKey: 'maxTotalTravelTimeSeconds',
                i18nName: 'transit:transitRouting.MaximumTotalTravelTimeMinutes',
                type: 'seconds',
                defaultUndefined: false,
                validationCases: [[0, true], [7200, true], [-1, false]]
            },
            {
                optionKey: 'walkingSpeedMps',
                i18nName: 'transit:networkDesign.simulationMethods.odTrips.WalkingSpeedMps',
                type: 'number',
                defaultUndefined: false,
                validationCases: [[1.0, true], [1.5, true], [0, false], [-0.5, false]]
            },
            {
                optionKey: 'walkingSpeedFactor',
                i18nName: 'transit:networkDesign.simulationMethods.odTrips.WalkingSpeedFactor',
                type: 'number',
                defaultUndefined: false,
                validationCases: [[1.0, true], [1.2, true], [0, false], [-0.1, false]]
            }
        ];

        const transitRoutingValidationCases = transitRoutingOptionSpecs.flatMap(
            ({ optionKey, validationCases }) =>
                validationCases.map(([value, expected]) => ({ optionKey, value, expected }))
        );

        test.each(transitRoutingOptionSpecs)(
            'should configure $optionKey',
            ({ optionKey, i18nName, type, defaultUndefined }) => {
                const option = transitOptions[optionKey];
                expect(option.i18nName).toBe(i18nName);
                expect(option.type).toBe(type);
                expect(option.validate).toBeInstanceOf(Function);
                if (defaultUndefined) {
                    expect(option.default).toBeUndefined();
                } else {
                    expect(option.default).toBeDefined();
                    expect(typeof option.default).toBe('number');
                }
            }
        );

        test.each(transitRoutingValidationCases)(
            'validates $optionKey value $value => $expected',
            ({ optionKey, value, expected }) => {
                const option = transitOptions[optionKey];
                expect(option.validate(value)).toBe(expected);
            }
        );

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
            expect(option.type).toBe('percentage');
            expect(option.validate).toBeInstanceOf(Function);
            expect(option.default).toBe(1);
        });

        test.each<[number, boolean]>([
            [0.5, true],
            [1, true],
            [0.001, true],
            [0, false],
            [-0.1, false],
            [1.1, false]
        ])('should validate sampleRatio correctly for value %p', (value, expected) => {
            const validate = simulationOptions.sampleRatio.validate;
            expect(validate(value)).toBe(expected);
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

    describe('nodeWeighting option', () => {
        test('should expose nodeWeighting as nested option with descriptor', () => {
            const options = descriptor.getOptions();
            const nodeWeightingOption = options.nodeWeighting;

            expect(nodeWeightingOption).toBeDefined();
            expect(nodeWeightingOption.type).toBe('nested');
            expect(nodeWeightingOption.descriptor).toBeDefined();
            expect(typeof nodeWeightingOption.descriptor.getTranslatableName).toBe('function');
            expect(typeof nodeWeightingOption.descriptor.getOptions).toBe('function');
            expect(typeof nodeWeightingOption.descriptor.validateOptions).toBe('function');
        });

        test('should have correct i18n name for nodeWeighting', () => {
            const options = descriptor.getOptions();
            const nodeWeightingOption = options.nodeWeighting;

            expect(nodeWeightingOption.i18nName).toBe(
                'transit:networkDesign.simulationMethods.odTrips.nodeWeighting'
            );
        });

        test('nodeWeighting descriptor should expose weighting options with correct types and defaults', () => {
            const options = descriptor.getOptions();
            const nodeWeightingDescriptor = options.nodeWeighting.descriptor;
            const weightingOptions = nodeWeightingDescriptor.getOptions();

            expect(weightingOptions).toHaveProperty('weightingEnabled');
            expect(weightingOptions.weightingEnabled.type).toBe('boolean');
            expect(weightingOptions.weightingEnabled.default).toBe(false);

            expect(weightingOptions).toHaveProperty('weightingSource');
            expect(weightingOptions.weightingSource.type).toBe('select');
            expect(weightingOptions.weightingSource.default).toBe('sameFile');

            expect(weightingOptions).toHaveProperty('odWeightingPoints');
            expect(weightingOptions.odWeightingPoints.type).toBe('select');
            expect(weightingOptions.odWeightingPoints.default).toBe('both');

            expect(weightingOptions).toHaveProperty('maxWalkingTimeSeconds');
            expect(weightingOptions.maxWalkingTimeSeconds.type).toBe('seconds');
            expect(weightingOptions.maxWalkingTimeSeconds.default).toBe(
                NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS
            );

            expect(weightingOptions).toHaveProperty('decayFunctionParameters');
            expect(weightingOptions.decayFunctionParameters.type).toBe('nested');
            expect(weightingOptions.decayFunctionParameters.descriptor).toBeDefined();

            expect(weightingOptions).toHaveProperty('weightingFileAttributes');
            expect(weightingOptions.weightingFileAttributes.type).toBe('csvFile');
        });

        test('nodeWeighting decay descriptor should expose decay type and default power params', () => {
            const options = descriptor.getOptions();
            const decayDescriptor =
                options.nodeWeighting.descriptor.getOptions().decayFunctionParameters.descriptor;
            const decayOptions = decayDescriptor.getOptions();

            expect(decayOptions).toHaveProperty('type');
            expect(decayOptions.type.type).toBe('select');
            expect(decayOptions.type.default).toBe('power');
            expect(decayOptions).toHaveProperty('beta');
            expect(decayOptions.beta.default).toBe(NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS.beta);
        });

        test('nodeWeighting weightingSource choices should include sameFile and separateFile', () => {
            const options = descriptor.getOptions();
            const choices = options.nodeWeighting.descriptor.getOptions().weightingSource.choices({});

            expect(choices).toContainEqual({
                label: 'transit:networkDesign.nodeWeighting.weightingSource.sameFile',
                value: 'sameFile'
            });
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.nodeWeighting.weightingSource.separateFile',
                value: 'separateFile'
            });
        });

        test('nodeWeighting odWeightingPoints choices should include origins, destinations, both', () => {
            const options = descriptor.getOptions();
            const choices = options.nodeWeighting.descriptor.getOptions().odWeightingPoints.choices({});

            expect(choices).toContainEqual({
                label: 'transit:networkDesign.nodeWeighting.odWeightingPoints.origins',
                value: 'origins'
            });
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.nodeWeighting.odWeightingPoints.destinations',
                value: 'destinations'
            });
            expect(choices).toContainEqual({
                label: 'transit:networkDesign.nodeWeighting.odWeightingPoints.both',
                value: 'both'
            });
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

        const defaultDemandAttributes = {
            type: 'csv' as const,
            fileAndMapping: {
                fieldMappings: {
                    id: 'id',
                    projection: '4326',
                    originLat: 'originLat',
                    originLon: 'originLon',
                    destinationLat: 'destinationLat',
                    destinationLon: 'destinationLon'
                },
                csvFile: { location: 'upload' as const, filename: 'test.csv', uploadFilename: 'uploaded.csv' }
            },
            csvFields: ['id', 'originLat', 'originLon', 'destinationLat', 'destinationLon']
        };

        test.each<
            [
                string,
                Partial<OdTripSimulationOptions>,
                { valid: boolean; errorsLength?: number; expectedErrorSubstring?: string }
            ]
        >([
            [
                'nodeWeighting undefined',
                { demandAttributes: defaultDemandAttributes },
                { valid: true, errorsLength: 0 }
            ],
            [
                'nodeWeighting.weightingEnabled false',
                {
                    demandAttributes: defaultDemandAttributes,
                    nodeWeighting: {
                        weightingEnabled: false,
                        weightingSource: 'sameFile',
                        odWeightingPoints: 'both',
                        maxWalkingTimeSeconds: 1200,
                        decayFunctionParameters: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS
                    }
                },
                { valid: true, errorsLength: 0 }
            ],
            [
                'nodeWeighting enabled with sameFile and demand present',
                {
                    demandAttributes: defaultDemandAttributes,
                    nodeWeighting: {
                        weightingEnabled: true,
                        weightingSource: 'sameFile',
                        odWeightingPoints: 'both',
                        maxWalkingTimeSeconds: 1200,
                        decayFunctionParameters: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS
                    }
                },
                { valid: true, errorsLength: 0 }
            ],
            [
                'nodeWeighting separateFile and weightingFileAttributes missing',
                {
                    demandAttributes: defaultDemandAttributes,
                    nodeWeighting: {
                        weightingEnabled: true,
                        weightingSource: 'separateFile',
                        odWeightingPoints: 'both',
                        maxWalkingTimeSeconds: 1200,
                        decayFunctionParameters: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS
                    }
                },
                {
                    valid: false,
                    expectedErrorSubstring: 'weightingFileRequired'
                }
            ],
            [
                'nodeWeighting separateFile and weightingFileAttributes valid',
                {
                    demandAttributes: defaultDemandAttributes,
                    nodeWeighting: {
                        weightingEnabled: true,
                        weightingSource: 'separateFile',
                        odWeightingPoints: 'both',
                        maxWalkingTimeSeconds: 1200,
                        decayFunctionParameters: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS,
                        weightingFileAttributes: {
                            type: 'csv',
                            fileAndMapping: {
                                fieldMappings: {
                                    projection: '4326',
                                    pointLat: 'lat',
                                    pointLon: 'lon',
                                    weight: 'weight'
                                },
                                csvFile: {
                                    location: 'upload',
                                    filename: 'poi.csv',
                                    uploadFilename: 'poi_uploaded.csv'
                                }
                            },
                            csvFields: ['lat', 'lon', 'weight']
                        }
                    }
                },
                { valid: true, errorsLength: 0 }
            ]
        ])('should return %s', (_label, options, expected) => {
            const result = descriptor.validateOptions(options);
            expect(result.valid).toBe(expected.valid);
            if (expected.errorsLength !== undefined) {
                expect(result.errors).toHaveLength(expected.errorsLength);
            } else if (expected.valid === false) {
                expect(result.errors.length).toBeGreaterThan(0);
                if (expected.expectedErrorSubstring !== undefined) {
                    expect(
                        result.errors.some((e) =>
                            String(e).includes(expected.expectedErrorSubstring as string)
                        )
                    ).toBe(true);
                }
            }
        });
    });
});
