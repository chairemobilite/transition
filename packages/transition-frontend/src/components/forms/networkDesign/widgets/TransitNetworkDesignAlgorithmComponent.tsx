/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import {
    AlgorithmConfiguration,
    getAlgorithmDescriptor,
    getAllAlgorithmTypes
} from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { _toInteger } from 'chaire-lib-common/lib/utils/LodashExtensions';
import OptionsEditComponent from './OptionsDescriptorWidgets';

export interface SimulationAlgorithmComponentProps {
    algorithmConfig?: AlgorithmConfiguration;
    disabled: boolean;
    onValueChange: (path: 'type' | 'config', newValue: { value: any; valid?: boolean }) => void;
}

const SimulationAlgorithmComponent: React.FunctionComponent<SimulationAlgorithmComponentProps> = (
    props: SimulationAlgorithmComponentProps
) => {
    const algorithmTypes = getAllAlgorithmTypes();
    const { t } = useTranslation(['transit', 'main']);

    const algorithmChoices = algorithmTypes.map((algoId) => ({
        value: algoId,
        label: t(getAlgorithmDescriptor(algoId).getTranslatableName())
    }));

    const algoDescriptor = props.algorithmConfig?.type ? getAlgorithmDescriptor(props.algorithmConfig.type) : undefined;

    return (
        <React.Fragment>
            <InputWrapper smallInput={true} label={t('transit:simulation:Algorithm')}>
                <InputSelect
                    id={'formFieldSimulationAlgorithmType'}
                    disabled={props.disabled}
                    value={props.algorithmConfig?.type}
                    choices={algorithmChoices}
                    onValueChange={(e) => props.onValueChange('type', { value: e.target.value })}
                />
            </InputWrapper>
            {algoDescriptor && (
                <OptionsEditComponent
                    key={`algorithmConfigOptions${_toInteger(props.algorithmConfig?.type)}`}
                    value={props.algorithmConfig?.config}
                    optionsDescriptor={algoDescriptor}
                    disabled={props.disabled}
                    onUpdate={(parameters, isValid) =>
                        props.onValueChange('config', { value: parameters, valid: isValid })
                    }
                />
            )}
        </React.Fragment>
    );
};

export default SimulationAlgorithmComponent;
