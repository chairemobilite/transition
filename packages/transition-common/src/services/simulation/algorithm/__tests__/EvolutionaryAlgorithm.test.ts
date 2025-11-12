/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { EvolutionaryAlgorithmDescriptor, EvolutionaryAlgorithmOptions } from '../EvolutionaryAlgorithm';

describe('EvolutionaryAlgorithmDescriptor', () => {
    let descriptor: EvolutionaryAlgorithmDescriptor;

    beforeEach(() => {
        descriptor = new EvolutionaryAlgorithmDescriptor();
    });

    describe('getTranslatableName', () => {
        test('should return the correct translatable name', () => {
            expect(descriptor.getTranslatableName()).toBe('transit:simulation:simulationClasses:LineAndNumberOfVehiclesGASimulation');
        });
    });

    describe('getOptions', () => {
        test('should return all required options', () => {
            const options = descriptor.getOptions();

            const expectedKeys = [
                'populationSizeMin',
                'populationSizeMax',
                'numberOfElites',
                'numberOfRandoms',
                'crossoverNumberOfCuts',
                'crossoverProbability',
                'mutationProbability',
                'tournamentSize',
                'tournamentProbability',
                'numberOfGenerations',
                'shuffleGenes',
                'keepGenerations',
                'keepCandidates'
            ];

            expectedKeys.forEach(key => {
                expect(options).toHaveProperty(key);
            });
        });

        describe('integer options', () => {
            const integerOptions = [
                { key: 'populationSizeMin', default: 20, i18nName: 'transit:simulation:PopulationSizeMin' },
                { key: 'populationSizeMax', default: 20, i18nName: 'transit:simulation:PopulationSizeMax' },
                { key: 'numberOfElites', default: 2, i18nName: 'transit:simulation:NumberOfElites' },
                { key: 'numberOfRandoms', default: 0, i18nName: 'transit:simulation:NumberOfRandoms' },
                { key: 'crossoverNumberOfCuts', default: 1, i18nName: 'transit:simulation:CrossoverNumberOfCuts' },
                { key: 'tournamentSize', default: 10, i18nName: 'transit:simulation:TournamentSize' }
            ];

            integerOptions.forEach(({ key, default: defaultValue, i18nName }) => {
                test(`should configure ${key} correctly`, () => {
                    const options = descriptor.getOptions();
                    const option = options[key as keyof typeof options];

                    expect(option.type).toBe('integer');
                    expect(option.default).toBe(defaultValue);
                    expect(option.i18nName).toBe(i18nName);
                    expect(typeof (option as any).validate).toBe('function');
                });
            });
        });

        describe('number options', () => {
            const numberOptions = [
                { key: 'crossoverProbability', default: 0.8, i18nName: 'transit:simulation:CrossoverProbability' },
                { key: 'mutationProbability', default: 0.08, i18nName: 'transit:simulation:MutationProbability' },
                { key: 'tournamentProbability', default: 0.7, i18nName: 'transit:simulation:TournamentProbability' },
                { key: 'numberOfGenerations', default: 100, i18nName: 'transit:simulation:NumberOfGenerations' },
                { key: 'keepGenerations', default: 1, i18nName: 'transit:simulation:KeepGenerations' },
                { key: 'keepCandidates', default: 1, i18nName: 'transit:simulation:KeepCandidates' }
            ];

            numberOptions.forEach(({ key, default: defaultValue, i18nName }) => {
                test(`should configure ${key} correctly`, () => {
                    const options = descriptor.getOptions();
                    const option = options[key as keyof typeof options];

                    expect(option.type).toBe('number');
                    expect(option.default).toBe(defaultValue);
                    expect(option.i18nName).toBe(i18nName);
                    expect(typeof (option as any).validate).toBe('function');
                });
            });
        });

        test('should configure shuffleGenes as boolean', () => {
            const options = descriptor.getOptions();
            const shuffleGenes = options.shuffleGenes;

            expect(shuffleGenes.type).toBe('boolean');
            expect(shuffleGenes.default).toBe(true);
            expect(shuffleGenes.i18nName).toBe('transit:simulation:ShuffleGenes');
            expect((shuffleGenes as any).validate).toBeUndefined();
        });

        describe('validation functions', () => {
            test('should validate positive values for population sizes and counts', () => {
                const options = descriptor.getOptions();
                const positiveValidators = [
                    'populationSizeMin',
                    'populationSizeMax',
                    'numberOfElites',
                    'crossoverNumberOfCuts',
                    'tournamentSize'
                ];

                positiveValidators.forEach(key => {
                    const validate = (options[key as keyof typeof options] as any).validate!;
                    expect(validate(1)).toBe(true);
                    expect(validate(10)).toBe(true);
                    expect(validate(0)).toBe(false);
                    expect(validate(-1)).toBe(false);
                });
            });

            test('should validate non-negative values for numberOfRandoms', () => {
                const options = descriptor.getOptions();
                const validate = options.numberOfRandoms.validate!;

                expect(validate(0)).toBe(true);
                expect(validate(1)).toBe(true);
                expect(validate(10)).toBe(true);
                expect(validate(-1)).toBe(false);
            });

            test('should validate probability ranges (0-1)', () => {
                const options = descriptor.getOptions();
                const probabilityValidators = [
                    'crossoverProbability',
                    'mutationProbability',
                    'tournamentProbability'
                ];

                probabilityValidators.forEach(key => {
                    const validate = (options[key as keyof typeof options] as any).validate!;
                    expect(validate(0)).toBe(true);
                    expect(validate(0.5)).toBe(true);
                    expect(validate(1)).toBe(true);
                    expect(validate(-0.1)).toBe(false);
                    expect(validate(1.1)).toBe(false);
                });
            });

            test('should validate non-negative values for generations and candidates', () => {
                const options = descriptor.getOptions();
                const nonNegativeValidators = [
                    'numberOfGenerations',
                    'keepGenerations',
                    'keepCandidates'
                ];

                nonNegativeValidators.forEach(key => {
                    const validate = (options[key as keyof typeof options] as any).validate!;
                    expect(validate(0)).toBe(true);
                    expect(validate(1)).toBe(true);
                    expect(validate(100)).toBe(true);
                    expect(validate(-1)).toBe(false);
                });
            });
        });
    });

    describe('validateOptions', () => {
        test('should return valid for empty options', () => {
            const result = descriptor.validateOptions({});

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should return valid for valid complete options', () => {
            const options: EvolutionaryAlgorithmOptions = {
                populationSizeMin: 10,
                populationSizeMax: 20,
                numberOfElites: 2,
                numberOfRandoms: 1,
                crossoverNumberOfCuts: 1,
                crossoverProbability: 0.8,
                mutationProbability: 0.1,
                tournamentSize: 5,
                tournamentProbability: 0.7,
                numberOfGenerations: 50,
                shuffleGenes: true,
                keepGenerations: 5,
                keepCandidates: 3
            };

            const result = descriptor.validateOptions(options);

            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should reject when populationSizeMin > populationSizeMax', () => {
            const options = {
                populationSizeMin: 30,
                populationSizeMax: 20
            };

            const result = descriptor.validateOptions(options);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('transit:simulation:errors:PopulationSizeMinGreaterThanMax');
        });

        test('should accept when populationSizeMin <= populationSizeMax', () => {
            const options1 = {
                populationSizeMin: 20,
                populationSizeMax: 20
            };
            const options2 = {
                populationSizeMin: 10,
                populationSizeMax: 20
            };

            const result1 = descriptor.validateOptions(options1);
            const result2 = descriptor.validateOptions(options2);

            expect(result1.valid).toBe(true);
            expect(result2.valid).toBe(true);
        });

        test('should reject when keepCandidates > populationSizeMin', () => {
            const options = {
                populationSizeMin: 10,
                keepCandidates: 15
            };

            const result = descriptor.validateOptions(options);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('transit:simulation:errors:CandidatesToKeepGreaterThanPopulation');
        });

        test('should accept when keepCandidates <= populationSizeMin', () => {
            const options1 = {
                populationSizeMin: 10,
                keepCandidates: 10
            };
            const options2 = {
                populationSizeMin: 20,
                keepCandidates: 5
            };

            const result1 = descriptor.validateOptions(options1);
            const result2 = descriptor.validateOptions(options2);

            expect(result1.valid).toBe(true);
            expect(result2.valid).toBe(true);
        });

        test('should reject when keepGenerations > numberOfGenerations', () => {
            const options = {
                numberOfGenerations: 50,
                keepGenerations: 60
            };

            const result = descriptor.validateOptions(options);

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('transit:simulation:errors:GenerationsToKeepGreaterThanGenerations');
        });

        test('should accept when keepGenerations <= numberOfGenerations', () => {
            const options1 = {
                numberOfGenerations: 50,
                keepGenerations: 50
            };
            const options2 = {
                numberOfGenerations: 100,
                keepGenerations: 25
            };

            const result1 = descriptor.validateOptions(options1);
            const result2 = descriptor.validateOptions(options2);

            expect(result1.valid).toBe(true);
            expect(result2.valid).toBe(true);
        });

        test('should handle multiple validation errors', () => {
            const options = {
                populationSizeMin: 30,
                populationSizeMax: 20,
                keepCandidates: 40,
                numberOfGenerations: 50,
                keepGenerations: 60
            };

            const result = descriptor.validateOptions(options);

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(3);
            expect(result.errors).toContain('transit:simulation:errors:PopulationSizeMinGreaterThanMax');
            expect(result.errors).toContain('transit:simulation:errors:CandidatesToKeepGreaterThanPopulation');
            expect(result.errors).toContain('transit:simulation:errors:GenerationsToKeepGreaterThanGenerations');
        });

        test('should not validate when only one of the paired values is provided', () => {
            const result1 = descriptor.validateOptions({ populationSizeMin: 30 });
            const result2 = descriptor.validateOptions({ populationSizeMax: 20 });
            const result3 = descriptor.validateOptions({ keepCandidates: 15 });
            const result4 = descriptor.validateOptions({ keepGenerations: 60 });

            expect(result1.valid).toBe(true);
            expect(result2.valid).toBe(true);
            expect(result3.valid).toBe(true);
            expect(result4.valid).toBe(true);
        });
    });
});
