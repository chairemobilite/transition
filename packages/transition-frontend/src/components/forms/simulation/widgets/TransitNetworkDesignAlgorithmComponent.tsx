/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash/toString';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import Simulation from 'transition-common/lib/services/simulation/Simulation';
import {
    AlgorithmConfiguration,
    getAlgorithmDescriptor,
    getAllAlgorithmTypes
} from 'transition-common/lib/services/networkDesign/transit/algorithm';
import {
    SimulationAlgorithmDescriptor,
    SimulationAlgorithmOptionDescriptor
} from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { parseFloatOrNull } from 'chaire-lib-common/lib/utils/MathUtils';

interface SimulationAlgorithmOptionsComponentProps extends WithTranslation {
    algorithmDescriptor: SimulationAlgorithmDescriptor<any>;
    algorithmConfig?: AlgorithmConfiguration;
    disabled: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
}

interface AlgorithmOptionComponentProps extends WithTranslation {
    option: SimulationAlgorithmOptionDescriptor;
    value: unknown;
    optionKey: string;
    disabled: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
}

export interface SimulationAlgorithmComponentProps extends WithTranslation {
    algorithmConfig?: AlgorithmConfiguration;
    simulation: Simulation;
    disabled: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
}

const AlgorithmOptionComponentBase: React.FunctionComponent<AlgorithmOptionComponentProps> = (
    props: AlgorithmOptionComponentProps
) => {
    const option = props.option;
    if (option.type === 'string') {
        return (
            <InputString
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={props.value as string}
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
        return (
            <InputCheckboxBoolean
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                isChecked={props.value as boolean}
                onValueChange={(e) => props.onValueChange(props.optionKey, { value: e.target.value })}
            />
        );
    }
    if (option.type === 'integer') {
        return (
            <InputStringFormatted
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={props.value as number}
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
        return (
            <InputStringFormatted
                id={`formFieldSimulationAlgorithmOptions${props.optionKey}`}
                disabled={props.disabled}
                value={props.value as number}
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
    return null;
};

const AlgorithmOptionComponent = withTranslation(['transit', 'main'])(AlgorithmOptionComponentBase);

const SimulationAlgorithmOptionsComponentBase: React.FunctionComponent<SimulationAlgorithmOptionsComponentProps> = (
    props: SimulationAlgorithmOptionsComponentProps
) => {
    const options = props.algorithmDescriptor.getOptions();
    const optionWidgets = Object.keys(options).map((optionName) => {
        const option = options[optionName];
        return (
            <InputWrapper
                key={`algoOption${optionName}`}
                smallInput={true}
                label={props.t(option.i18nName)}
                help={option.i18nHelp ? props.t(option.i18nHelp) : undefined}
            >
                <AlgorithmOptionComponent
                    optionKey={optionName}
                    value={props.algorithmConfig ? props.algorithmConfig.config[optionName] : undefined}
                    disabled={props.disabled}
                    option={option}
                    onValueChange={props.onValueChange}
                />
            </InputWrapper>
        );
    });

    return <React.Fragment>{optionWidgets}</React.Fragment>;
};

const SimulationAlgorithmOptionsComponent = withTranslation(['transit', 'main'])(
    SimulationAlgorithmOptionsComponentBase
);

const SimulationAlgorithmComponent: React.FunctionComponent<SimulationAlgorithmComponentProps> = (
    props: SimulationAlgorithmComponentProps
) => {
    const algorithmTypes = getAllAlgorithmTypes();

    const algorithmChoices = algorithmTypes.map((algoId) => ({
        value: algoId,
        label: props.t(getAlgorithmDescriptor(algoId).getTranslatableName())
    }));

    const algoDescriptor = props.algorithmConfig?.type ? getAlgorithmDescriptor(props.algorithmConfig.type) : undefined;

    return (
        <React.Fragment>
            <InputWrapper smallInput={true} label={props.t('transit:simulation:Algorithm')}>
                <InputSelect
                    id={'formFieldSimulationAlgorithmType'}
                    disabled={props.disabled}
                    value={props.algorithmConfig?.type}
                    choices={algorithmChoices}
                    onValueChange={(e) => props.onValueChange('type', { value: e.target.value })}
                />
            </InputWrapper>
            {algoDescriptor && (
                <SimulationAlgorithmOptionsComponent
                    algorithmConfig={props.algorithmConfig}
                    algorithmDescriptor={algoDescriptor}
                    disabled={props.disabled}
                    onValueChange={(path, value) => props.onValueChange(`config.${path}`, value)}
                />
            )}
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(SimulationAlgorithmComponent);
