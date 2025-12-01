/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputSelect, { choiceType } from 'chaire-lib-frontend/lib/components/input/InputSelect';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import {
    SimulationAlgorithmDescriptor,
    SimulationAlgorithmOptionDescriptor
} from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { parseFloatOrNull } from 'chaire-lib-common/lib/utils/MathUtils';
import GenericCsvImportAndMappingForm from '../../csv/GenericCsvImportAndMappingForm';
import { CsvFileAndMapping, CsvFileAndFieldMapper } from 'transition-common/lib/services/csv';
import Loader from 'react-spinners/BeatLoader';

type OptionsEditComponentProps<T extends Record<string, unknown>> = {
    optionsDescriptor: SimulationAlgorithmDescriptor<T>;
    value: T;
    disabled?: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
};

type OptionComponentProps = {
    option: SimulationAlgorithmOptionDescriptor;
    value?: unknown;
    optionKey: string;
    disabled?: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
};

const SelectOptionComponent: React.FunctionComponent<OptionComponentProps> = (props) => {
    const [choices, setChoices] = React.useState<choiceType[]>([]);
    const [loading, setLoading] = React.useState(true);

    const option = props.option;
    if (option.type !== 'select') {
        throw 'SelectOptionComponent can only be used with select options';
    }

    React.useEffect(() => {
        setLoading(true);
        const fetchChoices = async () => {
            try {
                const fetchedChoices = await option.choices();
                setChoices(fetchedChoices);
            } finally {
                setLoading(false);
            }
            
        };
        fetchChoices();
    }, [props.option]);

    const value = typeof props.value === 'string' ? props.value : option.default;

    if (loading) {
        return (
            <div>
                <Loader size={8} color={'#aaaaaa'} loading={true} />
            </div>
        );
    }

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
                props.onValueChange(props.optionKey, { value: csvFieldMapper.getCurrentFileAndMapping(), valid: isValidAndReady });
            }}
            importFileName={option.importFileName}
        />
    );
};

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
                        valid: valid && (option.validate ? option.validate(value) : true)
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
    if (option.type === 'integer') {
        const value = typeof props.value === 'number' ? props.value : option.default;
        return (
            <InputStringFormatted
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={value}
                onValueUpdated={({ value, valid }) =>
                    props.onValueChange(props.optionKey, {
                        value,
                        valid: valid && (option.validate ? option.validate(value) : true)
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
                        valid: valid && (option.validate ? option.validate(value) : true)
                    })
                }
                stringToValue={parseFloatOrNull}
                valueToString={(val) => _toString(parseFloatOrNull(val))}
            />
        );
    }
    if (option.type === 'nested') {
        const descriptor = option.descriptor();
        const value = typeof props.value === 'object' && props.value !== null ? props.value : {};
        return (
            <OptionsEditComponent
                value={value}
                optionsDescriptor={descriptor}
                disabled={false}
                onValueChange={(path: string, newValue: { value: any; valid?: boolean }): void => {
                    const updatedObject = { ...value, [path]: newValue.value };
                    props.onValueChange(props.optionKey, {
                        value: updatedObject,
                        valid: newValue.valid !== false
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
    return null;
};

const OptionsEditComponent: React.FunctionComponent<OptionsEditComponentProps<any>> = (
    props: OptionsEditComponentProps<any>
) => {
    const { t } = useTranslation(['transit', 'main']);
    const options = React.useMemo(() => props.optionsDescriptor.getOptions(), [props.optionsDescriptor]);
    const optionWidgets = Object.keys(options).map((optionName) => {
        const option = options[optionName];
        return (
            <InputWrapper
                key={`option${optionName}`}
                smallInput={true}
                label={t(option.i18nName)}
                help={option.i18nHelp ? t(option.i18nHelp) : undefined}
            >
                <OptionComponent
                    optionKey={optionName}
                    value={props.value[optionName]}
                    disabled={props.disabled}
                    option={option}
                    onValueChange={props.onValueChange}
                />
            </InputWrapper>
        );
    });

    return <React.Fragment>{optionWidgets}</React.Fragment>;
};

export default OptionsEditComponent;
