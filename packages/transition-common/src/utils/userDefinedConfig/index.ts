/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CsvFieldMappingDescriptor } from '../../services/csv';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';

type UserDefinedConfigFieldBase = {
    i18nName: string;
    i18nHelp?: string;
    /** Whether this field is required. If `true`, the field must be provided.
     * Otherwise, at validation, an error message labeled with the i18nName
     * appended with `Required` will be shown. Defaults to `false`. */
    required?: boolean;
};

interface NestedFieldDescriptor<T extends Record<string, unknown>> {
    type: 'nested';
    schema: UserDefinedConfigSchema<T>;
}

/**
 * Type for a single option in the user defined config schema. The type
 * determines what other options are required or available for this field.
 *
 * @type {('integer' | 'number' | 'seconds' | 'percentage' | 'string' |
 * 'boolean' | 'nested' | 'select' | 'multiselect' | 'csvFile')} integer is an
 * integer number while number also supports float, nested is a nested object
 * with its own descriptor. 'percentage' is a value stored as a decimal number
 * where 1 means 100%, but asked to the user as a percentage (between 0 and
 * 100). 'seconds' means the data's unit is in seconds, but the `askAs` property
 * can be used to indicate to ask the value in minutes or hours. 'select' and
 * 'multiselect' are for options where the user must select one or multiple
 * values from a list of choices.
 * @memberof UserDefinedConfigFieldDescriptor
 */
export type UserDefinedConfigFieldByType =
    | {
          /**
           * Integer takes a single integer option while number can take any
           * floating point number.
           * */
          type: 'integer' | 'number';
          default?: number;
          validate?: (value: number) => boolean | TranslatableMessage;
      }
    | {
          /**
           * Represents a value in seconds, which can be entered by the user in
           * different time units (seconds, minutes, hours) based on the `askAs`
           * property. The value will be stored in seconds regardless of the
           * unit entered by the user.
           */
          type: 'seconds';
          default?: number;
          validate?: (value: number) => boolean | TranslatableMessage;
          askAs?: 'minutes' | 'hours';
      }
    | {
          /**
           * Represents a percentage value, which is stored as a decimal number
           * (where 1 means 100%), but can be entered by the user as a percentage
           * (between 0 and 100).
           */
          type: 'percentage';
          default?: number;
          /**
           * Descriptor specific validation function. By default, percentage is
           * expected to be between 0 and 1, but options can override this.
           */
          validate?: (value: number) => boolean | TranslatableMessage;
      }
    | {
          /**
           * Represents a string value
           */
          type: 'string';
          default?: string;
          validate?: (value: string) => boolean | TranslatableMessage;
      }
    | {
          /**
           * Represents a boolean value (true/false)
           */
          type: 'boolean';
          default?: boolean;
      }
    | {
          /**
           * Represents a select option where the user must select a single
           * value from a list of choices. The choices are generated dynamically
           * based on the current configuration object value, which allows to
           * have dependent select options
           */
          type: 'select';
          /**
           * Get the choices for this select option
           * @param object The complete object this descriptor option is part
           * of, with current values set
           * @returns
           */
          choices: (object: Record<string, unknown>) => { value: string; label?: string }[];
          default?: string;
      }
    | {
          /**
           * Represents a multiselect option where the user can select multiple
           * values from a list of choices. The choices are generated
           * dynamically based on the current configuration object value, which
           * allows to have dependent select options. The selected values will
           * be stored as an array of strings.
           */
          type: 'multiselect';
          /**
           * Get the choices for this select option
           * @param object The complete object this descriptor option is part
           * of, with current values set
           * @returns
           */
          choices: (object: Record<string, unknown>) => { value: string; label?: string }[];
          default?: string[];
      }
    | {
          /**
           * Represents a csv file input where the user can upload a csv file
           * and map its fields to specific descriptors defined in
           * `mappingDescriptors`. The file name of the uploaded file will be
           * stored in the config, and the mapping descriptors will be used to
           * validate the mapping of the csv fields to the expected fields
           * defined in the config schema.
           */
          type: 'csvFile';
          mappingDescriptors: CsvFieldMappingDescriptor[];
          importFileName: string;
      };

/**
 * Descriptor for a single field in the user defined config schema. It includes
 * the field's type and options, as well as the i18n name and help text. The
 * type determines what other options are required or available for this field.
 */
export type UserDefinedConfigFieldDescriptor = UserDefinedConfigFieldBase &
    (UserDefinedConfigFieldByType | NestedFieldDescriptor<Record<string, unknown>>);

/**
 * User defined config schema. This interface describes the name and options
 * required by the config. It simplifies the definition and entry of the
 * configuration data by allowing to define the schema of the configuration
 * option types that have builtin functionalities, like type validation,
 * translation management, and default value generation. Using this interface
 * gives access to default validation functions for each option and for the
 * entire object, as well as a way to get default values.  Forms or any other
 * entry mechanism can be dynamically generated from the schema.
 *
 * @export
 * @interface UserDefinedConfigSchema
 * @template T The type of options
 */
export interface UserDefinedConfigSchema<T extends Record<string, unknown>> {
    /** Get the name string of the algorithm that can be translated */
    getTranslatableName: () => string;
    /** Get the fields and their types */
    getFields: () => { [K in keyof T]: UserDefinedConfigFieldDescriptor };
    /**
     * Validate a fields object. This function is in addition to the
     * fields's individual validator and allows to validate the whole object,
     * not just individual values.
     * */
    validateFields: (fields: Partial<T>) => { valid: boolean; errors?: TranslatableMessage[] };
}

/**
 * Creates a config object with default values applied from the schema
 *
 * @param initialFields Partial fields object with some values already set
 * @param schema The schema containing field definitions
 * @returns Fields object with default values applied where not already provided
 */
export function getDefaultFieldsFromSchema<T extends Record<string, unknown>>(
    initialFields: Partial<T>,
    schema: UserDefinedConfigSchema<T>
): Partial<T> {
    const fields = { ...initialFields };
    const fieldDefinitions = schema.getFields();

    for (const [key, fieldDef] of Object.entries(fieldDefinitions)) {
        if (fieldDef.type === 'nested') {
            // Handle nested options recursively
            const nestedDescriptor = fieldDef.schema;
            const existingNestedValue = fields[key as keyof T] as Record<string, unknown> | undefined;
            // If the existing value is undefined and the field is not required,
            // we can skip generating defaults for the nested object, otherwise
            // we will generate defaults for all nested fields
            if (existingNestedValue !== undefined || fieldDef.required === true) {
                const nestedDefaults = getDefaultFieldsFromSchema(existingNestedValue || {}, nestedDescriptor);
                (fields as Record<string, unknown>)[key] = nestedDefaults;
            }
        } else if (fields[key as keyof T] === undefined && 'default' in fieldDef && fieldDef.default !== undefined) {
            (fields as Record<string, unknown>)[key] = fieldDef.default;
        }
    }

    return fields;
}

const validateDataType = <T extends Record<string, unknown>>(
    fieldDef: UserDefinedConfigFieldDescriptor,
    value: unknown,
    fields: Partial<T>
): boolean => {
    if (fieldDef.type === 'percentage') {
        // By default, if there is no validate function, percentage type must be between 0 and 1
        const numberValue = typeof value === 'number' ? value : NaN;
        if (numberValue < 0 || numberValue > 1) {
            return false;
        }
    } else if (fieldDef.type === 'select' || fieldDef.type === 'multiselect') {
        // Validate that the selected value(s) are in the choices list
        const choices = fieldDef.choices(fields as Record<string, unknown>).map((choice) => choice.value);
        if (fieldDef.type === 'select') {
            if (typeof value !== 'string' || !choices.includes(value)) {
                return false;
            }
        } else if (fieldDef.type === 'multiselect') {
            if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !choices.includes(v))) {
                return false;
            }
        }
    } else if (fieldDef.type === 'integer' || fieldDef.type === 'seconds') {
        // For integer and seconds types, also validate that the value is an integer
        const numberValue = typeof value === 'number' ? value : NaN;
        if (!Number.isInteger(numberValue)) {
            return false;
        }
    } else if (fieldDef.type === 'number') {
        // For number type, validate that the value is a number
        const numberValue = typeof value === 'number' ? value : NaN;
        if (isNaN(numberValue)) {
            return false;
        }
    } else if (fieldDef.type === 'boolean') {
        // For boolean type, validate that the value is a boolean
        if (typeof value !== 'boolean') {
            return false;
        }
    } else if (fieldDef.type === 'string') {
        // For string type, validate that the value is a string
        if (typeof value !== 'string') {
            return false;
        }
    }
    return true;
};

/**
 * Validate a fields object against a schema. This will make sure that all
 * required fields are present and that individual field validators are
 * called. It will also call the overall schema validator if all individual
 * values are valid.
 *
 * @param fields The fields to validate
 * @param schema The schema to validate against
 * @returns Validation result with validity and error messages
 */
export function validateFieldsWithSchema<T extends Record<string, unknown>>(
    fields: Partial<T>,
    schema: UserDefinedConfigSchema<T>
): { valid: boolean; errors: TranslatableMessage[] } {
    let valid = true;
    const errors: TranslatableMessage[] = [];
    const fieldDefinitions = schema.getFields();

    const setFieldInvalid = (fieldDef: UserDefinedConfigFieldDescriptor, messageSuffix: string) => {
        valid = false;
        errors.push(fieldDef.i18nName + messageSuffix);
    };

    // First validate the fields individually
    for (const [key, fieldDef] of Object.entries(fieldDefinitions)) {
        const value = fields[key as keyof T];
        // Validate required fields should have a value
        if (fieldDef.required && (value === undefined || value === null || value === '')) {
            setFieldInvalid(fieldDef, 'Required');
            continue;
        }
        if (fieldDef.type === 'nested') {
            // Handle nested options recursively
            const nestedDescriptor = fieldDef.schema;
            if (value === undefined) {
                // If not required and not provided, we can skip nested validation, the case of value undefined and required is already handled by the required validation above
                continue;
            }
            const nestedValidation = validateFieldsWithSchema(
                (value as Record<string, unknown>) || {},
                nestedDescriptor
            );
            if (!nestedValidation.valid) {
                valid = false;
                errors.push(...nestedValidation.errors);
            }
        } else if (value !== undefined) {
            // Validate the type of the value first, if the value is provided.
            // If the type is invalid, we can skip the specific validation
            // function since it may expect a specific type and would not work
            // correctly if the type is wrong
            const isTypeValid = validateDataType(fieldDef, value, fields);
            if (!isTypeValid) {
                setFieldInvalid(fieldDef, 'Invalid');
                continue;
            }
            // Validate against the field's specific validator if it exists
            if ('validate' in fieldDef && fieldDef.validate) {
                let isValid: TranslatableMessage | boolean = true;
                if (
                    fieldDef.type === 'integer' ||
                    fieldDef.type === 'number' ||
                    fieldDef.type === 'seconds' ||
                    fieldDef.type === 'percentage'
                ) {
                    isValid = typeof value === 'number' ? fieldDef.validate(value) : false;
                } else if (fieldDef.type === 'string') {
                    isValid = typeof value === 'string' ? fieldDef.validate(value) : false;
                }
                if (isValid !== true) {
                    valid = false;
                    // If the return value is a string, it is a custom error message, otherwise use the default message based on the field name and "Invalid"
                    errors.push(typeof isValid === 'boolean' ? fieldDef.i18nName + 'Invalid' : isValid);
                }
            }
        }
    }
    // If all individual options are valid, validate overall options
    if (valid) {
        const overallValidation = schema.validateFields(fields);
        if (!overallValidation.valid) {
            valid = false;
            errors.push(...(overallValidation.errors || []));
        }
    }

    return { valid, errors };
}
