/*
 * Copyright 2025, Polytechnique Montreal and contributors
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
    getDefaultOptionsFromDescriptor,
    SimulationAlgorithmDescriptor,
    SimulationAlgorithmOptionDescriptor,
    validateOptionsWithDescriptor
} from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { parseFloatOrNull } from 'chaire-lib-common/lib/utils/MathUtils';
import GenericCsvImportAndMappingForm from '../../csv/GenericCsvImportAndMappingForm';
import { CsvFileAndMapping, CsvFileAndFieldMapper } from 'transition-common/lib/services/csv';
import { InputMultiselect } from 'chaire-lib-frontend/lib/components/input/InputMultiselect';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';

type OptionsEditComponentProps<T extends Record<string, unknown>> = {
    optionsDescriptor: SimulationAlgorithmDescriptor<T>;
    value: T;
    disabled?: boolean;
    onUpdate: (parameters: Partial<T>, isValid: boolean) => void;
};

type OptionComponentProps = {
    option: SimulationAlgorithmOptionDescriptor;
    value?: unknown;
    optionKey: string;
    completeObject: Record<string, unknown>;
    disabled?: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
};
const SelectOptionComponent: React.FunctionComponent<OptionComponentProps> = (props) => {
    const { t } = useTranslation();
    const option = props.option;
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
            id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
            value={value}
            choices={choices}
            onValueChange={(e) =>
                props.onValueChange(props.optionKey, {
                    value: e.target.value
                })
            }
        />
    );
};

const MultiSelectOptionComponent: React.FunctionComponent<OptionComponentProps> = (props) => {
    const option = props.option;
    if (option.type !== 'multiselect') {
        throw 'MultiSelectOptionComponent can only be used with multiselect options';
    }

    const choices = option.choices(props.completeObject);

    const value = Array.isArray(props.value) ? props.value : option.default;

    return (
        <InputMultiselect
            id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
            value={value}
            choices={choices}
            onValueChange={(e) =>
                props.onValueChange(props.optionKey, {
                    value: e.target.value
                })
            }
        />
    );
};

const CsvFileOptionComponent: React.FunctionComponent<OptionComponentProps> = (props: OptionComponentProps) => {
    const option = props.option;
    if (option.type !== 'csvFile') {
        throw 'CsvFileOptionComponent can only be used with csvFile options';
    }
    const currentMapping = React.useMemo(
        () => new CsvFileAndFieldMapper(option.mappingDescriptors, props.value as CsvFileAndMapping),
        [props.value]
    );

    return (
        <GenericCsvImportAndMappingForm
            csvFieldMapper={currentMapping}
            onUpdate={(csvFieldMapper: CsvFileAndFieldMapper, isValidAndReady: boolean): void => {
                props.onValueChange(props.optionKey, {
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

const OptionComponent: React.FunctionComponent<OptionComponentProps> = (props: OptionComponentProps) => {
    const option = props.option;
    if (option.type === 'string') {
        const value = typeof props.value === 'string' ? props.value : option.default;
        return (
            <InputString
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.optionKey, {
                        value,
                        valid: valid && (option.validate ? option.validate(value) === true : true)
                    })
                }
            />
        );
    }
    if (option.type === 'boolean') {
        const value = typeof props.value === 'boolean' ? props.value : option.default;
        return (
            <InputCheckboxBoolean
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                isChecked={value}
                onValueChange={(e) => props.onValueChange(props.optionKey, { value: e.target.value })}
            />
        );
    }
    // Handle integer and seconds (asked as integer number of seconds)
    if (option.type === 'integer' || (option.type === 'seconds' && option.askAs === undefined)) {
        const value = typeof props.value === 'number' ? props.value : option.default;
        return (
            <InputStringFormatted
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.optionKey, {
                        value,
                        valid: valid && (option.validate ? option.validate(value) === true : true)
                    })
                }
                stringToValue={_toInteger}
                valueToString={_toString}
                type={'number'}
            />
        );
    }
    if (option.type === 'number') {
        const value = typeof props.value === 'number' ? props.value : option.default;
        return (
            <InputStringFormatted
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.optionKey, {
                        value,
                        valid: valid && (option.validate ? option.validate(value) === true : true)
                    })
                }
                stringToValue={parseFloatOrNull}
                valueToString={(val) => _toString(parseFloatOrNull(val))}
            />
        );
    }
    if (option.type === 'percentage') {
        const value = typeof props.value === 'number' ? props.value : option.default;
        return (
            <InputStringFormatted
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.optionKey, {
                        value,
                        valid: valid && (option.validate ? option.validate(value) === true : true)
                    })
                }
                stringToValue={parsePercentage}
                valueToString={toPercentageString}
            />
        );
    }
    if (option.type === 'seconds' && option.askAs !== undefined) {
        const value = typeof props.value === 'number' ? props.value : option.default;
        const strToValFct = option.askAs === 'minutes' ? minutesToSeconds : hoursToSeconds;
        const valToStrFct = option.askAs === 'minutes' ? secondsToMinutes : secondsToHours;
        return (
            <InputStringFormatted
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.optionKey, {
                        value,
                        valid: valid && (option.validate ? option.validate(value) === true : true)
                    })
                }
                stringToValue={strToValFct}
                valueToString={(val) => _toString(valToStrFct(val))}
                type={'number'}
            />
        );
    }
    if (option.type === 'nested') {
        const value = typeof props.value === 'object' && props.value !== null ? props.value : {};
        return (
            <OptionsEditComponent
                value={value}
                optionsDescriptor={option.descriptor}
                disabled={false}
                onUpdate={(parameters: Partial<any>, isValid: boolean): void => {
                    props.onValueChange(props.optionKey, {
                        value: parameters,
                        valid: isValid
                    });
                }}
            />
        );
    }
    if (option.type === 'csvFile') {
        return <CsvFileOptionComponent {...props} />;
    }
    if (option.type === 'select') {
        return <SelectOptionComponent {...props} />;
    }
    if (option.type === 'multiselect') {
        return <MultiSelectOptionComponent {...props} />;
    }
    return null;
};

const OptionsEditComponent: React.FunctionComponent<OptionsEditComponentProps<any>> = (
    props: OptionsEditComponentProps<any>
) => {
    const { t } = useTranslation(['transit', 'main']);
    const options = React.useMemo(() => props.optionsDescriptor.getOptions(), [props.optionsDescriptor]);

    const [errors, setErrors] = React.useState<TranslatableMessage[]>([]);

    React.useEffect(() => {
        // Set defaults and validate on first load
        const defaultedOptions = getDefaultOptionsFromDescriptor(props.value, props.optionsDescriptor);
        const { valid } = validateOptionsWithDescriptor(defaultedOptions, props.optionsDescriptor);
        props.onUpdate(defaultedOptions, valid);
    }, [props.optionsDescriptor]);

    const onValueChange = (path: string, newValue: { value: any; valid?: boolean }): void => {
        const updatedParameters = { ...props.value, [path]: newValue.value };
        const { valid, errors } = validateOptionsWithDescriptor(updatedParameters, props.optionsDescriptor);

        props.onUpdate(updatedParameters, valid);
        setErrors(errors);
    };

    const optionWidgets = Object.keys(options).map((optionName) => {
        const option = options[optionName];
        const component = (
            <OptionComponent
                optionKey={optionName}
                value={props.value[optionName]}
                completeObject={props.value}
                disabled={props.disabled}
                option={option}
                onValueChange={onValueChange}
            />
        );
        if (option.type === 'nested' || option.type === 'csvFile') {
            return (
                <React.Fragment key={`option${optionName}`}>
                    <h4>{t(option.i18nName)}</h4>
                    {component}
                </React.Fragment>
            );
        }
        return (
            <InputWrapper
                key={`option${optionName}`}
                smallInput={true}
                label={t(option.i18nName)}
                help={option.i18nHelp ? t(option.i18nHelp) : undefined}
                twoColumns={option.type === 'multiselect' ? false : true}
            >
                {component}
            </InputWrapper>
        );
    });

    return (
        <React.Fragment>
            {optionWidgets}
            {errors.length > 0 && <FormErrors errors={errors} />}
        </React.Fragment>
    );
};

export default OptionsEditComponent;
