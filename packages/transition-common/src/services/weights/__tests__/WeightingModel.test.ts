/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import WeightingModel, {
    WeightingModelAttributes,
    CALCULATION_CHOICES,
    getCalculationChoiceByValue,
    TravelTimeData
} from '../WeightingModel';

describe('WeightingModel', () => {
    const minimalAttributes: WeightingModelAttributes = {
        id: 1,
        name: 'Test Model'
    };

    const fullAttributes: WeightingModelAttributes = {
        id: 2,
        name: 'Full Model',
        calculation: 'weight / (travel_time_walking^2)',
        notes: 'This is a test model with gravity exponent of 2',
        references: 'Doe, J. (2020). Name of the publication.'
    };

    describe('Constructor', () => {
        it('should create a WeightingModel with minimal attributes', () => {
            const model = new WeightingModel(minimalAttributes);
            expect(model.attributes).toEqual(minimalAttributes);
            expect(model.id).toBe(1);
            expect(model.name).toBe('Test Model');
        });

        it('should create a WeightingModel with all attributes', () => {
            const model = new WeightingModel(fullAttributes);
            expect(model.attributes).toEqual(fullAttributes);
            expect(model.id).toBe(2);
            expect(model.name).toBe('Full Model');
            expect(model.calculation).toBe('weight / (travel_time_walking^2)');
            expect(model.notes).toBe('This is a test model with gravity exponent of 2');
            expect(model.references).toBe('Doe, J. (2020). Name of the publication.');
        });
    });

    describe('Getters', () => {
        it.each([
            ['id', { id: 5, name: 'Model 5' }, 5],
            ['name', { id: 1, name: 'My Model' }, 'My Model']
        ])('should return correct %s', (field, attributes, expected) => {
            const model = new WeightingModel(attributes);
            expect(model[field as keyof WeightingModel]).toBe(expected);
        });

        it.each([
            ['calculation', minimalAttributes, undefined],
            ['notes', minimalAttributes, undefined],
            ['references', minimalAttributes, undefined]
        ])('should return undefined for optional %s when not provided', (field, attributes, expected) => {
            const model = new WeightingModel(attributes);
            expect(model[field as keyof WeightingModel]).toBe(expected);
        });

        it.each([
            ['calculation', fullAttributes, 'weight / (travel_time_walking^2)'],
            ['notes', fullAttributes, 'This is a test model with gravity exponent of 2'],
            ['references', fullAttributes, 'Doe, J. (2020). Name of the publication.']
        ])('should return %s when provided', (field, attributes, expected) => {
            const model = new WeightingModel(attributes);
            expect(model[field as keyof WeightingModel]).toBe(expected);
        });

        it('should return all attributes', () => {
            const model = new WeightingModel(fullAttributes);
            expect(model.attributes).toEqual(fullAttributes);
        });
    });

    describe('toString', () => {
        it('should return the model name', () => {
            const model = new WeightingModel({ id: 1, name: 'Gravity Model' });
            expect(model.toString()).toBe('Gravity Model');
        });

        it('should return empty string if name is empty', () => {
            const model = new WeightingModel({ id: 1, name: '' });
            expect(model.toString()).toBe('');
        });
    });

    describe('getCalculationChoice', () => {
        it.each([
            ['not provided', minimalAttributes],
            ['does not match any choice', { id: 1, name: 'Test', calculation: 'custom_formula' }]
        ])('should return undefined when calculation is %s', (_description, attributes) => {
            const model = new WeightingModel(attributes);
            expect(model.getCalculationChoice()).toBeUndefined();
        });

        it.each(CALCULATION_CHOICES.map((choice) => [choice.value]))(
            'should find calculation choice for %s',
            (value) => {
                const model = new WeightingModel({
                    id: 1,
                    name: 'Test',
                    calculation: value
                });
                const choice = model.getCalculationChoice();
                expect(choice).toBeDefined();
                expect(choice?.value).toBe(value);
                expect(typeof choice?.formula).toBe('function');
            }
        );

        it('should delegate to getCalculationChoiceByValue helper', () => {
            const value = 'gravity_walking_1';
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: value
            });
            const choice = model.getCalculationChoice();
            const expectedChoice = getCalculationChoiceByValue(value);
            expect(choice).toEqual(expectedChoice);
        });
    });

    describe('calculateWeight', () => {
        it('should return undefined when calculation choice is not found', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'non_existent'
            });
            const travelData: TravelTimeData = { travel_time_walking: 100 };
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it('should return undefined when calculation is not provided', () => {
            const model = new WeightingModel(minimalAttributes);
            const travelData: TravelTimeData = { travel_time_walking: 100 };
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it.each([
            [50, {}, 50],
            [100, {}, 100]
        ])('should calculate weight_only correctly for weight %d', (weight, travelData, expected) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'weight_only'
            });
            expect(model.calculateWeight(weight, travelData)).toBe(expected);
        });

        it.each([
            [50, { travel_time_walking: 100 }, 0.5],
            [200, { travel_time_walking: 100 }, 2]
        ])(
            'should calculate gravity_walking_1 correctly for weight %d and travel time %d',
            (weight, travelData, expected) => {
                const model = new WeightingModel({
                    id: 1,
                    name: 'Test',
                    calculation: 'gravity_walking_1'
                });
                expect(model.calculateWeight(weight, travelData)).toBe(expected);
            }
        );

        it.each([
            [{}, 'empty object'],
            [{ travel_time_walking: undefined }, 'undefined travel_time_walking'],
            [{ travel_time_walking: 0 }, 'zero travel_time_walking'],
            [{ travel_time_walking: -10 }, 'negative travel_time_walking'],
            [{ travel_time_walking: NaN }, 'NaN travel_time_walking'],
            [{ travel_time_walking: Infinity }, 'Infinity travel_time_walking'],
            [{ travel_time_walking: -Infinity }, 'negative Infinity travel_time_walking']
        ])('should return undefined for gravity_walking_1 when travel data is %s', (travelData, _description) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_walking_1'
            });
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it('should calculate gravity_walking_2 correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_walking_2'
            });
            const travelData: TravelTimeData = { travel_time_walking: 100 };
            expect(model.calculateWeight(10000, travelData)).toBe(1);
        });

        it.each([
            [{}, 'empty object'],
            [{ travel_time_walking: undefined }, 'undefined travel_time_walking'],
            [{ travel_time_walking: 0 }, 'zero travel_time_walking'],
            [{ travel_time_walking: -10 }, 'negative travel_time_walking'],
            [{ travel_time_walking: NaN }, 'NaN travel_time_walking'],
            [{ travel_time_walking: Infinity }, 'Infinity travel_time_walking'],
            [{ travel_time_walking: -Infinity }, 'negative Infinity travel_time_walking']
        ])('should return undefined for gravity_walking_2 when travel data is %s', (travelData, _description) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_walking_2'
            });
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it('should calculate gravity_cycling_1 correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_cycling_1'
            });
            const travelData: TravelTimeData = { travel_time_cycling: 60 };
            expect(model.calculateWeight(120, travelData)).toBe(2);
        });

        it.each([
            [{}, 'empty object'],
            [{ travel_time_cycling: undefined }, 'undefined travel_time_cycling'],
            [{ travel_time_cycling: 0 }, 'zero travel_time_cycling'],
            [{ travel_time_cycling: -5 }, 'negative travel_time_cycling'],
            [{ travel_time_cycling: NaN }, 'NaN travel_time_cycling'],
            [{ travel_time_cycling: Infinity }, 'Infinity travel_time_cycling'],
            [{ travel_time_cycling: -Infinity }, 'negative Infinity travel_time_cycling']
        ])('should return undefined for gravity_cycling_1 when travel data is %s', (travelData, _description) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_cycling_1'
            });
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it('should calculate gravity_cycling_2 correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_cycling_2'
            });
            const travelData: TravelTimeData = { travel_time_cycling: 50 };
            expect(model.calculateWeight(5000, travelData)).toBe(2); // 5000 / (50^2) = 2
        });

        it.each([
            [{}, 'empty object'],
            [{ travel_time_cycling: undefined }, 'undefined travel_time_cycling'],
            [{ travel_time_cycling: 0 }, 'zero travel_time_cycling'],
            [{ travel_time_cycling: -5 }, 'negative travel_time_cycling'],
            [{ travel_time_cycling: NaN }, 'NaN travel_time_cycling'],
            [{ travel_time_cycling: Infinity }, 'Infinity travel_time_cycling'],
            [{ travel_time_cycling: -Infinity }, 'negative Infinity travel_time_cycling']
        ])('should return undefined for gravity_cycling_2 when travel data is %s', (travelData, _description) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_cycling_2'
            });
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it('should calculate gravity_driving_1 correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_driving_1'
            });
            const travelData: TravelTimeData = { travel_time_driving: 40 };
            expect(model.calculateWeight(200, travelData)).toBe(5); // 200 / 40 = 5
        });

        it.each([
            [{}, 'empty object'],
            [{ travel_time_driving: undefined }, 'undefined travel_time_driving'],
            [{ travel_time_driving: 0 }, 'zero travel_time_driving'],
            [{ travel_time_driving: -10 }, 'negative travel_time_driving'],
            [{ travel_time_driving: NaN }, 'NaN travel_time_driving'],
            [{ travel_time_driving: Infinity }, 'Infinity travel_time_driving'],
            [{ travel_time_driving: -Infinity }, 'negative Infinity travel_time_driving']
        ])('should return undefined for gravity_driving_1 when travel data is %s', (travelData, _description) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_driving_1'
            });
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it('should calculate gravity_driving_2 correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_driving_2'
            });
            const travelData: TravelTimeData = { travel_time_driving: 30 };
            expect(model.calculateWeight(900, travelData)).toBe(1); // 900 / (30^2) = 1
        });

        it.each([
            [{}, 'empty object'],
            [{ travel_time_driving: undefined }, 'undefined travel_time_driving'],
            [{ travel_time_driving: 0 }, 'zero travel_time_driving'],
            [{ travel_time_driving: -10 }, 'negative travel_time_driving'],
            [{ travel_time_driving: NaN }, 'NaN travel_time_driving'],
            [{ travel_time_driving: Infinity }, 'Infinity travel_time_driving'],
            [{ travel_time_driving: -Infinity }, 'negative Infinity travel_time_driving']
        ])('should return undefined for gravity_driving_2 when travel data is %s', (travelData, _description) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_driving_2'
            });
            expect(model.calculateWeight(50, travelData)).toBeUndefined();
        });

        it('should calculate gravity_distance correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_distance'
            });
            const travelData: TravelTimeData = { bird_distance: 500 };
            expect(model.calculateWeight(1000, travelData)).toBe(2);
        });

        it('should calculate gravity_distance_squared correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_distance_squared'
            });
            const travelData: TravelTimeData = { bird_distance: 10 };
            expect(model.calculateWeight(1000, travelData)).toBe(10); // 1000 / (10^2) = 10
        });

        it.each([
            ['gravity_distance', 'distance'],
            ['gravity_distance_squared', 'distance squared']
        ])('should return undefined for %s when distance is missing or invalid', (calculation, _description) => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation
            });
            expect(model.calculateWeight(50, {})).toBeUndefined();
            expect(model.calculateWeight(50, { bird_distance: undefined })).toBeUndefined();
            expect(model.calculateWeight(50, { bird_distance: 0 })).toBeUndefined();
            expect(model.calculateWeight(50, { bird_distance: -5 })).toBeUndefined();
            expect(model.calculateWeight(50, { bird_distance: NaN })).toBeUndefined();
            expect(model.calculateWeight(50, { bird_distance: Infinity })).toBeUndefined();
            expect(model.calculateWeight(50, { bird_distance: -Infinity })).toBeUndefined();
        });

        it('should handle partial travel data correctly', () => {
            const model = new WeightingModel({
                id: 1,
                name: 'Test',
                calculation: 'gravity_walking_1'
            });
            // Should work with only walking time
            expect(model.calculateWeight(100, { travel_time_walking: 50 })).toBe(2);
            // Should return undefined if walking time is missing
            expect(model.calculateWeight(100, { travel_time_cycling: 50 })).toBeUndefined();
        });
    });

    describe('CALCULATION_CHOICES constant', () => {
        it('should have at least one calculation choice', () => {
            expect(CALCULATION_CHOICES.length).toBeGreaterThan(0);
        });

        it('should have unique values for all choices', () => {
            const values = CALCULATION_CHOICES.map((choice) => choice.value);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });

        it('should have formula functions for all choices', () => {
            for (const choice of CALCULATION_CHOICES) {
                expect(choice.formula).toBeDefined();
                expect(typeof choice.formula).toBe('function');
            }
        });

        it('should have getCalculationChoiceByValue function working', () => {
            const choice = getCalculationChoiceByValue('gravity_walking_1');
            expect(choice).toBeDefined();
            expect(choice?.value).toBe('gravity_walking_1');
            expect(typeof choice?.formula).toBe('function');
        });

        it('should return undefined for non-existent choice value', () => {
            const choice = getCalculationChoiceByValue('non_existent');
            expect(choice).toBeUndefined();
        });

        it('should have working formula functions', () => {
            const weightOnly = getCalculationChoiceByValue('weight_only');
            expect(weightOnly).toBeDefined();
            if (weightOnly) {
                expect(weightOnly.formula(100, {})).toBe(100);
            }

            const gravityWalking = getCalculationChoiceByValue('gravity_walking_1');
            expect(gravityWalking).toBeDefined();
            if (gravityWalking) {
                expect(gravityWalking.formula(100, { travel_time_walking: 50 })).toBe(2);
                expect(gravityWalking.formula(100, {})).toBeUndefined();
            }
        });

        it.each([
            ['gravity_walking_1', { travel_time_walking: -10 }, 'negative walking time'],
            ['gravity_walking_1', { travel_time_walking: 0 }, 'zero walking time'],
            ['gravity_walking_1', { travel_time_walking: NaN }, 'NaN walking time'],
            ['gravity_walking_1', { travel_time_walking: Infinity }, 'Infinity walking time'],
            ['gravity_walking_1', { travel_time_walking: -Infinity }, 'negative Infinity walking time']
        ])('should return undefined for %s with %s', (value, travelData, _description) => {
            const choice = getCalculationChoiceByValue(value);
            expect(choice).toBeDefined();
            if (choice) {
                expect(choice.formula(100, travelData)).toBeUndefined();
            }
        });

        it.each([
            ['gravity_distance', { bird_distance: -5 }, 'negative distance'],
            ['gravity_distance', { bird_distance: 0 }, 'zero distance'],
            ['gravity_distance', { bird_distance: NaN }, 'NaN distance'],
            ['gravity_distance', { bird_distance: Infinity }, 'Infinity distance'],
            ['gravity_distance', { bird_distance: -Infinity }, 'negative Infinity distance']
        ])('should return undefined for %s with %s', (value, travelData, _description) => {
            const choice = getCalculationChoiceByValue(value);
            expect(choice).toBeDefined();
            if (choice) {
                expect(choice.formula(100, travelData)).toBeUndefined();
            }
        });

        it.each([
            ['gravity_cycling_2', { travel_time_cycling: undefined }, undefined, 'undefined cycling time'],
            ['gravity_cycling_2', { travel_time_cycling: 0 }, undefined, 'zero cycling time'],
            ['gravity_cycling_2', { travel_time_cycling: -5 }, undefined, 'negative cycling time'],
            ['gravity_cycling_2', { travel_time_cycling: NaN }, undefined, 'NaN cycling time'],
            ['gravity_cycling_2', { travel_time_cycling: Infinity }, undefined, 'Infinity cycling time'],
            ['gravity_cycling_2', { travel_time_cycling: -Infinity }, undefined, 'negative Infinity cycling time'],
            ['gravity_cycling_2', { travel_time_cycling: 100 }, 1, 'valid cycling time']
        ])('should test gravity_cycling_2 formula with %s', (_value, travelData, expected, _description) => {
            const choice = getCalculationChoiceByValue('gravity_cycling_2');
            expect(choice).toBeDefined();
            if (choice) {
                const result = choice.formula(10000, travelData);
                if (expected === undefined) {
                    expect(result).toBeUndefined();
                } else {
                    expect(result).toBe(expected);
                }
            }
        });

        it.each([
            ['gravity_driving_1', { travel_time_driving: undefined }, undefined, 'undefined driving time'],
            ['gravity_driving_1', { travel_time_driving: 0 }, undefined, 'zero driving time'],
            ['gravity_driving_1', { travel_time_driving: -10 }, undefined, 'negative driving time'],
            ['gravity_driving_1', { travel_time_driving: NaN }, undefined, 'NaN driving time'],
            ['gravity_driving_1', { travel_time_driving: Infinity }, undefined, 'Infinity driving time'],
            ['gravity_driving_1', { travel_time_driving: -Infinity }, undefined, 'negative Infinity driving time'],
            ['gravity_driving_1', { travel_time_driving: 40 }, 5, 'valid driving time']
        ])('should test gravity_driving_1 formula with %s', (_value, travelData, expected, _description) => {
            const choice = getCalculationChoiceByValue('gravity_driving_1');
            expect(choice).toBeDefined();
            if (choice) {
                const result = choice.formula(200, travelData);
                if (expected === undefined) {
                    expect(result).toBeUndefined();
                } else {
                    expect(result).toBe(expected);
                }
            }
        });

        it.each([
            ['gravity_driving_2', { travel_time_driving: undefined }, undefined, 'undefined driving time'],
            ['gravity_driving_2', { travel_time_driving: 0 }, undefined, 'zero driving time'],
            ['gravity_driving_2', { travel_time_driving: -10 }, undefined, 'negative driving time'],
            ['gravity_driving_2', { travel_time_driving: NaN }, undefined, 'NaN driving time'],
            ['gravity_driving_2', { travel_time_driving: Infinity }, undefined, 'Infinity driving time'],
            ['gravity_driving_2', { travel_time_driving: -Infinity }, undefined, 'negative Infinity driving time'],
            ['gravity_driving_2', { travel_time_driving: 30 }, 1, 'valid driving time']
        ])('should test gravity_driving_2 formula with %s', (_value, travelData, expected, _description) => {
            const choice = getCalculationChoiceByValue('gravity_driving_2');
            expect(choice).toBeDefined();
            if (choice) {
                const result = choice.formula(900, travelData);
                if (expected === undefined) {
                    expect(result).toBeUndefined();
                } else {
                    expect(result).toBe(expected);
                }
            }
        });

        it.each([
            ['gravity_distance_squared', { bird_distance: undefined }, undefined, 'undefined distance'],
            ['gravity_distance_squared', { bird_distance: 0 }, undefined, 'zero distance'],
            ['gravity_distance_squared', { bird_distance: -5 }, undefined, 'negative distance'],
            ['gravity_distance_squared', { bird_distance: NaN }, undefined, 'NaN distance'],
            ['gravity_distance_squared', { bird_distance: Infinity }, undefined, 'Infinity distance'],
            ['gravity_distance_squared', { bird_distance: -Infinity }, undefined, 'negative Infinity distance'],
            ['gravity_distance_squared', { bird_distance: 10 }, 10, 'valid distance']
        ])('should test gravity_distance_squared formula with %s', (_value, travelData, expected, _description) => {
            const choice = getCalculationChoiceByValue('gravity_distance_squared');
            expect(choice).toBeDefined();
            if (choice) {
                const result = choice.formula(1000, travelData);
                if (expected === undefined) {
                    expect(result).toBeUndefined();
                } else {
                    expect(result).toBe(expected);
                }
            }
        });
    });

    describe('Static methods', () => {
        it.each([
            [WeightingModel.getDisplayName, 'WeightingModel'],
            [WeightingModel.getPluralName, 'weightingModels'],
            [WeightingModel.getCapitalizedPluralName, 'WeightingModels']
        ])('should return correct value', (method, expected) => {
            expect(method()).toBe(expected);
        });
    });
});
