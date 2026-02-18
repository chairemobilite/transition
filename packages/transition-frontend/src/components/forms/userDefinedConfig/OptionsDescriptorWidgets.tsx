/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import _isFinite from 'lodash/isFinite';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import {
    secondsToMinutes,
    minutesToSeconds,
    hoursToSeconds,
    secondsToHours
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import {
    getDefaultFieldsFromSchema,
    UserDefinedConfigFieldDescriptor,
    UserDefinedConfigSchema,
    validateFieldsWithSchema
} from 'transition-common/lib/utils/userDefinedConfig';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { parseFloatOrNull } from 'chaire-lib-common/lib/utils/MathUtils';
import GenericCsvImportAndMappingForm from '../csv/GenericCsvImportAndMappingForm';
import { CsvFileAndMapping, CsvFileAndFieldMapper } from 'transition-common/lib/services/csv';
import { InputMultiselect } from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';

type UserDefinedConfigEditComponentProps<T extends Record<string, unknown>> = {
    configSchema: UserDefinedConfigSchema<T>;
    value: T;
    disabled?: boolean;
    onUpdate: (parameters: Partial<T>, isValid: boolean) => void;
};

type FieldComponentProps = {
    fieldDescriptor: UserDefinedConfigFieldDescriptor;
    value?: unknown;
    fieldKey: string;
    completeObject: Record<string, unknown>;
    disabled?: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
};
const SelectOptionComponent: React.FunctionComponent<FieldComponentProps> = (props) => {
    const { t } = useTranslation();
    const option = props.fieldDescriptor;
    if (option.type !== 'select') {
        throw 'SelectOptionComponent can only be used with select options';
    }

    const choices = option.choices(props.completeObject).map((choice) => ({
        value: choice.value,
        label: choice.label ? t(choice.label) : t(choice.value)
    }));

    const value = typeof props.value === 'string' ? props.value : option.default;

    return (
        <InputSelect
            id={`formFieldConfigField${props.fieldKey}`}
            value={value}
            disabled={props.disabled}
            choices={choices}
            onValueChange={(e) =>
                props.onValueChange(props.fieldKey, {
                    value: e.target.value
                })
            }
        />
    );
};

const MultiSelectOptionComponent: React.FunctionComponent<FieldComponentProps> = (props) => {
    const { t } = useTranslation();
    const option = props.fieldDescriptor;
    if (option.type !== 'multiselect') {
        throw 'MultiSelectOptionComponent can only be used with multiselect options';
    }

    const choices = option.choices(props.completeObject).map((choice) => ({
        value: choice.value,
        label: choice.label ? t(choice.label) : t(choice.value)
    }));

    const value = Array.isArray(props.value) ? props.value : option.default;

    return (
        <InputMultiselect
            id={`formFieldConfigField${props.fieldKey}`}
            value={value}
            choices={choices}
            disabled={props.disabled}
            onValueChange={(e) =>
                props.onValueChange(props.fieldKey, {
                    value: e.target.value
                })
            }
        />
    );
};

const CsvFileOptionComponent: React.FunctionComponent<FieldComponentProps> = (props: FieldComponentProps) => {
    const option = props.fieldDescriptor;
    if (option.type !== 'csvFile') {
        throw 'CsvFileOptionComponent can only be used with csvFile options';
    }
    const currentMapping = React.useMemo(
        () => new CsvFileAndFieldMapper(option.mappingDescriptors, props.value as CsvFileAndMapping),
        [props.value, props.fieldDescriptor]
    );

    return (
        <GenericCsvImportAndMappingForm
            csvFieldMapper={currentMapping}
            onUpdate={(csvFieldMapper: CsvFileAndFieldMapper, isValidAndReady: boolean): void => {
                props.onValueChange(props.fieldKey, {
                    value: csvFieldMapper.getCurrentFileAndMapping(),
                    valid: isValidAndReady
                });
            }}
            importFileName={option.importFileName}
        />
    );
};

// FIXME See if we need to put those functions somewhere else to be reused or not
const parsePercentage = function (value: string | number = ''): number | null {
    const numValue = typeof value === 'number' ? value : parseFloat(value);
    if (_isFinite(numValue)) {
        return numValue / 100;
    }
    return null;
};
const toPercentageString = (value: number | null): string => (value === null ? '' : _toString(value * 100));

const FieldComponent: React.FunctionComponent<FieldComponentProps> = (props: FieldComponentProps) => {
    const fieldDescriptor = props.fieldDescriptor;
    if (fieldDescriptor.type === 'string') {
        const value = typeof props.value === 'string' ? props.value : fieldDescriptor.default;
        return (
            <InputString
                id={`formFieldConfigField${props.fieldKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.fieldKey, {
                        value,
                        valid: valid && (fieldDescriptor.validate ? fieldDescriptor.validate(value) === true : true)
                    })
                }
            />
        );
    }
    if (fieldDescriptor.type === 'boolean') {
        const value = typeof props.value === 'boolean' ? props.value : fieldDescriptor.default;
        return (
            <InputCheckboxBoolean
                id={`formFieldConfigField${props.fieldKey}`}
                disabled={props.disabled}
                isChecked={value}
                onValueChange={(e) => props.onValueChange(props.fieldKey, { value: e.target.value })}
            />
        );
    }
    // Handle integer and seconds (asked as integer number of seconds)
    if (
        fieldDescriptor.type === 'integer' ||
        (fieldDescriptor.type === 'seconds' && fieldDescriptor.askAs === undefined)
    ) {
        const value = typeof props.value === 'number' ? props.value : fieldDescriptor.default;
        return (
            <InputStringFormatted
                id={`formFieldConfigField${props.fieldKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.fieldKey, {
                        value,
                        valid: valid && (fieldDescriptor.validate ? fieldDescriptor.validate(value) === true : true)
                    })
                }
                stringToValue={_toInteger}
                valueToString={_toString}
                type={'number'}
            />
        );
    }
    if (fieldDescriptor.type === 'number') {
        const value = typeof props.value === 'number' ? props.value : fieldDescriptor.default;
        return (
            <InputStringFormatted
                id={`formFieldConfigField${props.fieldKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.fieldKey, {
                        value,
                        valid: valid && (fieldDescriptor.validate ? fieldDescriptor.validate(value) === true : true)
                    })
                }
                stringToValue={parseFloatOrNull}
                valueToString={(val) => _toString(parseFloatOrNull(val))}
            />
        );
    }
    if (fieldDescriptor.type === 'percentage') {
        const value = typeof props.value === 'number' ? props.value : fieldDescriptor.default;
        return (
            <InputStringFormatted
                id={`formFieldConfigField${props.fieldKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.fieldKey, {
                        value,
                        valid: valid && (fieldDescriptor.validate ? fieldDescriptor.validate(value) === true : true)
                    })
                }
                stringToValue={parsePercentage}
                valueToString={toPercentageString}
            />
        );
    }
    if (fieldDescriptor.type === 'seconds' && fieldDescriptor.askAs !== undefined) {
        const value = typeof props.value === 'number' ? props.value : fieldDescriptor.default;
        const strToValFct = fieldDescriptor.askAs === 'minutes' ? minutesToSeconds : hoursToSeconds;
        const valToStrFct = fieldDescriptor.askAs === 'minutes' ? secondsToMinutes : secondsToHours;
        return (
            <InputStringFormatted
                id={`formFieldConfigField${props.fieldKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.fieldKey, {
                        value,
                        valid: valid && (fieldDescriptor.validate ? fieldDescriptor.validate(value) === true : true)
                    })
                }
                stringToValue={strToValFct}
                valueToString={(val) => _toString(valToStrFct(val))}
                type={'number'}
            />
        );
    }
    if (fieldDescriptor.type === 'nested') {
        const value = typeof props.value === 'object' && props.value !== null ? props.value : {};
        return (
            <UserDefinedConfigEditComponent
                value={value}
                configSchema={fieldDescriptor.schema}
                disabled={props.disabled}
                onUpdate={(parameters: Partial<any>, isValid: boolean): void => {
                    props.onValueChange(props.fieldKey, {
                        value: parameters,
                        valid: isValid
                    });
                }}
            />
        );
    }
    if (fieldDescriptor.type === 'csvFile') {
        return <CsvFileOptionComponent {...props} />;
    }
    if (fieldDescriptor.type === 'select') {
        return <SelectOptionComponent {...props} />;
    }
    if (fieldDescriptor.type === 'multiselect') {
        return <MultiSelectOptionComponent {...props} />;
    }
    return null;
};

export const UserDefinedConfigEditComponent: React.FunctionComponent<UserDefinedConfigEditComponentProps<any>> = (
    props: UserDefinedConfigEditComponentProps<any>
) => {
    const { t } = useTranslation(['transit', 'main']);
    const fieldDescriptors = React.useMemo(() => props.configSchema.getFields(), [props.configSchema]);

    const [errors, setErrors] = React.useState<TranslatableMessage[]>([]);

    React.useEffect(() => {
        // Set defaults and validate on first load
        const defaultFields = getDefaultFieldsFromSchema(props.value, props.configSchema);
        const { valid, errors } = validateFieldsWithSchema(defaultFields, props.configSchema);
        props.onUpdate(defaultFields, valid);
        setErrors(errors);
    }, [props.configSchema]);

    const onValueChange = (path: string, newValue: { value: any; valid?: boolean }): void => {
        const updatedParameters = { ...props.value, [path]: newValue.value };
        // FIXME Should we validate and update only if valid from the parameters is not `false`?
        const { valid, errors } = validateFieldsWithSchema(updatedParameters, props.configSchema);

        props.onUpdate(updatedParameters, valid);
        setErrors(errors);
    };

    const fieldWidgets = Object.keys(fieldDescriptors).map((fieldName) => {
        const field = fieldDescriptors[fieldName];
        const component = (
            <FieldComponent
                fieldKey={fieldName}
                value={props.value[fieldName]}
                completeObject={props.value}
                disabled={props.disabled}
                fieldDescriptor={field}
                onValueChange={onValueChange}
            />
        );
        if (field.type === 'nested' || field.type === 'csvFile') {
            return (
                <React.Fragment key={`field${fieldName}`}>
                    <h4>{t(field.i18nName)}</h4>
                    {component}
                </React.Fragment>
            );
        }
        return (
            <InputWrapper
                key={`field${fieldName}`}
                smallInput={true}
                label={t(field.i18nName)}
                help={field.i18nHelp ? t(field.i18nHelp) : undefined}
                twoColumns={field.type === 'multiselect' ? false : true}
            >
                {component}
            </InputWrapper>
        );
    });

    return (
        <React.Fragment>
            {fieldWidgets}
            {errors.length > 0 && <FormErrors errors={errors} />}
        </React.Fragment>
    );
};
