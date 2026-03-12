/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { getDefaultFieldsFromSchema, validateFieldsWithSchema } from '../index';

// Define some default mocks for testing
const stringOptionMock = { type: 'string' as const, default: 'default1', required: true, i18nName: 'Option 1' };
const numberOptionMock = { type: 'number' as const, default: 42, required: false, i18nName: 'Option 2' };
const mockSchema = {
    getTranslatableName: () => 'Test Schema',
    getFields: () => ({
        option1: stringOptionMock,
        option2: numberOptionMock,
        nestedOption: { type: 'nested' as const, schema: mockNestedSchema, i18nName: 'Nested Option' },
    }),
    validateFields: (options: Record<string, unknown>) => ({ valid: true })
};

const mockNestedSchema = {
    getTranslatableName: () => 'Nested Schema',
    getFields: () => ({
        nestedOption1: { type: 'boolean' as const, default: true, i18nName: 'Nested Option 1' },
    }),
    validateFields: (options: Record<string, unknown>) => ({ valid: true })
};

describe('getDefaultFieldsFromSchema', () => {
    
    test.each([{
        description: 'should return default options when no initial options are provided',
        schema: mockSchema,
        initialOptions: {},
        expected: { option1: 'default1', option2: 42, nestedOption: { nestedOption1: true } }
    }, {
        description: 'should override defaults with provided options',
        schema: mockSchema,
        initialOptions: { option1: 'custom', option2: 100, nestedOption: { nestedOption1: false } },
        expected: { option1: 'custom', option2: 100, nestedOption: { nestedOption1: false } }
    }, {
        description: 'not set options without defaults',
        schema: {
            ...mockSchema,
            getFields: () => ({
                option1: { ...stringOptionMock, default: undefined },
                option2: { ...numberOptionMock, default: undefined }
            }),
        },
        initialOptions: { },
        expected: { }
    }])('$description', ({ initialOptions, expected, schema }) => {
        const result = getDefaultFieldsFromSchema(initialOptions, schema);
        expect(result).toEqual(expected);
    });

});

describe('validateFieldsWithSchema', () => {
    const mockSchema = {
        getTranslatableName: () => 'Test Schema',
        getFields: () => ({
            option1: { type: 'string' as const, required: true, i18nName: 'Option1' },
            option2: { type: 'number' as const, required: false, i18nName: 'Option2' }
        }),
        validateFields: (options: Record<string, unknown>) => ({ valid: true })
    };

    const validateMock = jest.fn();

    beforeEach(() => {
        validateMock.mockClear().mockReturnValue(true);
    });

    // Tests for the required validations
    test.each([{
        description: 'should return valid when all required options are provided',
        schema: mockSchema,
        initialOptions: { option1: 'value' },
        expected: { valid: true, errors: [] }
    }, {
        description: 'should return invalid when required options are missing',
        schema: mockSchema,
        initialOptions: { },
        expected: { valid: false, errors: ['Option1Required'] }
    }, {
        description: 'should validate boolean type options',
        schema: {
            ...mockSchema,
            getFields: () => ({
                boolOption: { type: 'boolean' as const, required: true, i18nName: 'Boolean Option ' }
            })
        },
        initialOptions: { boolOption: true },
        expected: { valid: true, errors: [] }
    }, {
        description: 'should validate nested schema options',
        schema: {
            ...mockSchema,
            getFields: () => ({
                nested: { 
                    type: 'nested' as const, 
                    schema: {
                        getTranslatableName: () => 'Nested Schema',
                        getFields: () => ({
                            nestedField: { type: 'string' as const, required: true, i18nName: 'Nested Field ' }
                        }),
                        validateFields: (options: Record<string, unknown>) => ({ valid: true })
                    },
                    i18nName: 'Nested ',
                    required: true
                }
            })
        },
        initialOptions: { nested: { nestedField: 'value' } },
        expected: { valid: true, errors: [] }
    }, {
        description: 'should return errors for missing nested required fields',
        schema: {
            ...mockSchema,
            getFields: () => ({
                nested: { 
                    type: 'nested' as const, 
                    schema: {
                        getTranslatableName: () => 'Nested Schema',
                        getFields: () => ({
                            nestedField: { type: 'string' as const, required: true, i18nName: 'NestedField' }
                        }),
                        validateFields: (options: Record<string, unknown>) => ({ valid: true })
                    },
                    i18nName: 'Nested',
                    required: true
                }
            })
        },
        initialOptions: { nested: {} },
        expected: { valid: false, errors: ['NestedFieldRequired'] }
    }, {
        description: 'should validate multiple required fields',
        schema: {
            ...mockSchema,
            getFields: () => ({
                field1: { type: 'string' as const, required: true, i18nName: 'Field1' },
                field2: { type: 'number' as const, required: true, i18nName: 'Field2' },
                field3: { type: 'boolean' as const, required: true, i18nName: 'Field3' }
            })
        },
        initialOptions: { field1: 'value' },
        expected: { valid: false, errors: ['Field2Required', 'Field3Required'] }
    }, {
        description: 'should handle optional fields correctly',
        schema: {
            ...mockSchema,
            getFields: () => ({
                required1: { type: 'string' as const, required: true, i18nName: 'RequiredField' },
                optional1: { type: 'string' as const, required: false, i18nName: 'OptionalField' }
            })
        },
        initialOptions: { required1: 'value' },
        expected: { valid: true, errors: [] }
    }, {
        description: 'should validate when nested object is missing but required',
        schema: {
            ...mockSchema,
            getFields: () => ({
                nested: { 
                    type: 'nested' as const, 
                    schema: mockNestedSchema,
                    i18nName: 'NestedObject',
                    required: true
                }
            })
        },
        initialOptions: {},
        expected: { valid: false, errors: ['NestedObjectRequired'] }
    }])('required fields: $description', ({ initialOptions, expected, schema }) => {
        const result = validateFieldsWithSchema(initialOptions, schema);
        expect(result).toEqual(expected);
    });

    // Tests for the custom field validation functions
    test.each([{
        description: 'should call validate for valid integer field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                integerField: { type: 'integer' as const, i18nName: 'IntegerField', validate: validateMock }
            })
        },
        initialOptions: { integerField: 1 },
        expected: { valid: true, errors: [] },
        expectedValidateValue: 1
    }, {
        description: 'should call validate for invalid integer field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                integerField: { type: 'integer' as const, i18nName: 'IntegerField', validate: validateMock.mockReturnValueOnce(false) }
            })
        },
        initialOptions: { integerField: -1 },
        expected: { valid: false, errors: ['IntegerFieldInvalid'] },
        expectedValidateValue: -1
    }, {
        description: 'should call validate for valid number field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                numberField: { type: 'number' as const, i18nName: 'NumberField', validate: validateMock }
            })
        },
        initialOptions: { numberField: 3.14 },
        expected: { valid: true, errors: [] },
        expectedValidateValue: 3.14
    }, {
        description: 'should call validate for invalid number field, with false',
        schema: {
            ...mockSchema,
            getFields: () => ({
                numberField: { type: 'number' as const, i18nName: 'NumberField', validate: validateMock.mockReturnValueOnce(false) }
            })
        },
        initialOptions: { numberField: 3.14 },
        expected: { valid: false, errors: ['NumberFieldInvalid'] },
        expectedValidateValue: 3.14
    }, {
        description: 'should call validate for invalid number field, with custom error message',
        schema: {
            ...mockSchema,
            getFields: () => ({
                numberField: { type: 'number' as const, i18nName: 'NumberField', validate: validateMock.mockReturnValueOnce('NumberFieldCustomError') }
            })
        },
        initialOptions: { numberField: 3.14 },
        expected: { valid: false, errors: ['NumberFieldCustomError'] },
        expectedValidateValue: 3.14
    }, {
        description: 'should not call validate for number field that are not a number type',
        schema: {
            ...mockSchema,
            getFields: () => ({
                numberField: { type: 'number' as const, i18nName: 'NumberField', validate: validateMock }
            })
        },
        initialOptions: { numberField: 'pi' },
        expected: { valid: false, errors: ['NumberFieldInvalid'] },
        expectedValidateValue: []
    }, {
        description: 'should call validate for valid seconds field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                secondsField: { type: 'seconds' as const, i18nName: 'SecondsField', validate: validateMock.mockReturnValueOnce(true) }
            })
        },
        initialOptions: { secondsField: 3600 },
        expected: { valid: true, errors: [] },
        expectedValidateValue: 3600
    }, {
        description: 'should call validate for invalid seconds field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                secondsField: { type: 'seconds' as const, i18nName: 'SecondsField', validate: validateMock.mockReturnValueOnce(false) }
            })
        },
        initialOptions: { secondsField: 3600 },
        expected: { valid: false, errors: ['SecondsFieldInvalid'] },
        expectedValidateValue: 3600
    }, {
        description: 'should call validate for valid percentage field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                percentageField: { type: 'percentage' as const, i18nName: 'PercentageField', validate: validateMock.mockReturnValueOnce(true) }
            })
        },
        initialOptions: { percentageField: 0.5 },
        expected: { valid: true, errors: [] },
        expectedValidateValue: 0.5
    }, {
        description: 'should call validate for invalid percentage field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                percentageField: { type: 'percentage' as const, i18nName: 'PercentageField', validate: validateMock.mockReturnValueOnce('CustomPercentageError') }
            })
        },
        initialOptions: { percentageField: 0.5 },
        expected: { valid: false, errors: ['CustomPercentageError'] },
        expectedValidateValue: 0.5
    }, {
        description: 'should validate a percentage between 0 and 1 if no custom validation is provided',
        schema: {
            ...mockSchema,
            getFields: () => ({
                percentageField: { type: 'percentage' as const, i18nName: 'PercentageField' }
            })
        },
        initialOptions: { percentageField: 0.5 },
        expected: { valid: true, errors: [] },
        expectedValidateValue: [] // No custom validate function, so no expected calls
    }, {
        description: 'should invalidate a percentage above 1 if no custom validation is provided',
        schema: {
            ...mockSchema,
            getFields: () => ({
                percentageField: { type: 'percentage' as const, i18nName: 'PercentageField' }
            })
        },
        initialOptions: { percentageField: 1.5 },
        expected: { valid: false, errors: ['PercentageFieldInvalid'] },
        expectedValidateValue: [] // No custom validate function, so no expected calls
    }, {
        description: 'should call validate for valid string field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                stringField: { type: 'string' as const, i18nName: 'StringField', validate: validateMock.mockReturnValueOnce(true) }
            })
        },
        initialOptions: { stringField: 'value' },
        expected: { valid: true, errors: [] },
        expectedValidateValue: 'value'
    }, {
        description: 'should call validate for invalid string field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                stringField: { type: 'string' as const, i18nName: 'StringField', validate: validateMock.mockReturnValueOnce(false) }
            })
        },
        initialOptions: { stringField: 'value' },
        expected: { valid: false, errors: ['StringFieldInvalid'] },
        expectedValidateValue: 'value'
    }, {
        description: 'should not call validate for string field that are not string',
        schema: {
            ...mockSchema,
            getFields: () => ({
                stringField: { type: 'string' as const, i18nName: 'StringField', validate: validateMock }
            })
        },
        initialOptions: { stringField: ['anArray!'] },
        expected: { valid: false, errors: ['StringFieldInvalid'] },
        expectedValidateValue: []
    }, {
        description: 'should call validate for valid field in nested field',
        schema: {
            ...mockSchema,
            getFields: () => ({
                nested: { 
                    type: 'nested' as const, 
                    schema: {
                        ...mockSchema,
                        getFields: () => ({
                            stringField: { type: 'string' as const, i18nName: 'StringField', validate: validateMock.mockReturnValueOnce(true) },
                            integerField: { type: 'integer' as const, i18nName: 'IntegerField', validate: validateMock.mockReturnValueOnce(true) }
                        })
                    },
                    i18nName: 'NestedObject',
                    required: true
                }
            })
        },
        initialOptions: { nested: { stringField: 'value', integerField: 3 } },
        expected: { valid: true, errors: [] },
        expectedValidateValue: ['value', 3]
    }, {
        description: 'should call validate on all fields, nested or not',
        schema: {
            ...mockSchema,
            getFields: () => ({
                integerField: { type: 'integer' as const, i18nName: 'IntegerField', validate: validateMock.mockReturnValueOnce(false) },
                nested: { 
                    type: 'nested' as const, 
                    schema: {
                        ...mockSchema,
                        getFields: () => ({
                            stringField: { type: 'string' as const, i18nName: 'StringField', validate: validateMock.mockReturnValueOnce(true) },
                            integerField: { type: 'integer' as const, i18nName: 'IntegerField', validate: validateMock.mockReturnValueOnce('CustomNestedError') }
                        })
                    },
                    i18nName: 'NestedObject',
                    required: true
                }
            })
        },
        initialOptions: { integerField: 4, nested: { stringField: 'value', integerField: 3 } },
        expected: { valid: false, errors: ['IntegerFieldInvalid', 'CustomNestedError'] },
        expectedValidateValue: [4, 'value', 3]
    }])('field specific validations: $description', ({ initialOptions, expected, schema, expectedValidateValue }) => {
        const result = validateFieldsWithSchema(initialOptions, schema);
        expect(result).toEqual(expected);
        if (Array.isArray(expectedValidateValue)) {
            if (expectedValidateValue.length === 0) {
                expect(validateMock).not.toHaveBeenCalled();
            } else {
                expectedValidateValue.forEach(value => {expect(validateMock).toHaveBeenCalledWith(value)});
            }
        } else {
            expect(validateMock).toHaveBeenCalledWith(expectedValidateValue);
        }
    });

    test.each([{
        description: 'should validate if a select option value is in the choices list',
        schema: {
            ...mockSchema,
            getFields: () => ({
                selectField: { type: 'select' as const, i18nName: 'SelectField', choices: () => [{ value: 'choice1' }, { value: 'choice2' }] }
            })
        },
        initialOptions: { selectField: 'choice1' },
        expected: { valid: true, errors: [] }
    }, {
        description: 'should be invalid if a select option value is not in the choices list',
        schema: {
            ...mockSchema,
            getFields: () => ({
                selectField: { type: 'select' as const, i18nName: 'SelectField', choices: () => [{ value: 'choice1' }, { value: 'choice2' }] }
            })
        },
        initialOptions: { selectField: 'notAChoice' },
        expected: { valid: false, errors: ['SelectFieldInvalid'] }
    }, {
        description: 'should be invalid if a select option value is not a string',
        schema: {
            ...mockSchema,
            getFields: () => ({
                selectField: { type: 'select' as const, i18nName: 'SelectField', choices: () => [{ value: 'choice1' }, { value: 'choice2' }] }
            })
        },
        initialOptions: { selectField: ['choice1'] },
        expected: { valid: false, errors: ['SelectFieldInvalid'] }
    },{
        description: 'should validate if single multiselect option value are in the choices list',
        schema: {
            ...mockSchema,
            getFields: () => ({
                multiselectField: { type: 'multiselect' as const, i18nName: 'SelectField', choices: () => [{ value: 'choice1' }, { value: 'choice2' }] }
            })
        },
        initialOptions: { selectField: ['choice1'] },
        expected: { valid: true, errors: [] }
    }, {
        description: 'should validate if many multiselect options value are in the choices list',
        schema: {
            ...mockSchema,
            getFields: () => ({
                selectField: { type: 'multiselect' as const, i18nName: 'SelectField', choices: () => [{ value: 'choice1' }, { value: 'choice2' }] }
            })
        },
        initialOptions: { selectField: ['choice1', 'choice2'] },
        expected: { valid: true, errors: [] }
    }, {
        description: 'should be invalid if any multiselect options value are notin the choices list',
        schema: {
            ...mockSchema,
            getFields: () => ({
                multiselectField: { type: 'multiselect' as const, i18nName: 'SelectField', choices: () => [{ value: 'choice1' }, { value: 'choice2' }] }
            })
        },
        initialOptions: { multiselectField: ['choice1', 'notAChoice'] },
        expected: { valid: false, errors: ['SelectFieldInvalid'] }
    }, {
        description: 'should be invalid if multiselect options value is not an array',
        schema: {
            ...mockSchema,
            getFields: () => ({
                multiselectField: { type: 'multiselect' as const, i18nName: 'SelectField', choices: () => [{ value: 'choice1' }, { value: 'choice2' }] }
            })
        },
        initialOptions: { multiselectField: 'choice1' },
        expected: { valid: false, errors: ['SelectFieldInvalid'] }
    }])('selection fields: $description', ({ initialOptions, expected, schema }) => {
        const result = validateFieldsWithSchema(initialOptions, schema);
        expect(result).toEqual(expected);
    });

    // Tests for the overall options validation
    test.each([{
        description: 'should call overall validateFields when individual fields are valid',
        schema: {
            ...mockSchema,
            getFields: () => ({
                field1: { type: 'string' as const, required: true, i18nName: 'Field1' },
                field2: { type: 'number' as const, required: true, i18nName: 'Field2' }
            }),
            validateFields: jest.fn().mockReturnValue({ valid: true })
        },
        initialOptions: { field1: 'value', field2: 3 },
        expected: { valid: true, errors: [] },
        expectedOverallValidationCallCount: 1
    }, {
        description: 'should return errors from overall validateFields',
        schema: {
            ...mockSchema,
            getFields: () => ({
                field1: { type: 'string' as const, required: true, i18nName: 'Field1' },
                field2: { type: 'number' as const, required: true, i18nName: 'Field2' }
            }),
            validateFields: jest.fn().mockReturnValue({ valid: false, errors: ['OverallError'] })
        },
        initialOptions: { field1: 'value', field2: 3 },
        expected: { valid: false, errors: ['OverallError'] },
        expectedOverallValidationCallCount: 1
    }, {
        description: 'should not call overall validateFields if individual fields are invalid',
        schema: {
            ...mockSchema,
            getFields: () => ({
                field1: { type: 'string' as const, required: true, i18nName: 'Field1' },
                field2: { type: 'number' as const, required: true, i18nName: 'Field2' }
            }),
            validateFields: jest.fn()
        },
        initialOptions: { field1: 'value' }, // Missing field2 which is required
        expected: { valid: false, errors: ['Field2Required'] },
        expectedOverallValidationCallCount: 0
    }])('overall options validation: $description', ({ initialOptions, expected, schema, expectedOverallValidationCallCount }) => {
        const result = validateFieldsWithSchema(initialOptions, schema);
        expect(result).toEqual(expected);
        if (expectedOverallValidationCallCount === 0) {
            expect(schema.validateFields).not.toHaveBeenCalled();
        } else {
            expect(schema.validateFields).toHaveBeenCalledTimes(expectedOverallValidationCallCount);
            expect(schema.validateFields).toHaveBeenCalledWith(initialOptions);
        }
    });

});
