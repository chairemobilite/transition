/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import { SimulationAttributes } from 'transition-common/lib/services/simulation/Simulation';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

export interface BaseSimulationComponentProps extends WithTranslation {
    attributes: SimulationAttributes;
    disabled: boolean;
    onValueChange: (path: string, newValue: { value: any; valid?: boolean }) => void;
}

const BaseSimulationComponent: React.FunctionComponent<BaseSimulationComponentProps> = (
    props: BaseSimulationComponentProps
) => {
    return (
        <React.Fragment>
            <InputWrapper smallInput={true} label={props.t('transit:simulation:Name')}>
                <InputString
                    id={'formFieldSimulationEditName'}
                    disabled={props.disabled}
                    value={props.attributes.name}
                    onValueUpdated={(value) => props.onValueChange('name', value)}
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={props.t('transit:simulation:Shortname')}>
                <InputString
                    id={'formFieldSimulationEditShortname'}
                    disabled={props.disabled}
                    value={props.attributes.shortname}
                    onValueUpdated={(value) => props.onValueChange('shortname', value)}
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={props.t('transit:simulation:Color')}>
                <InputColor
                    id={'formFieldTransitSimulationEditColor'}
                    value={props.attributes.color}
                    onValueChange={(e) => props.onValueChange('color', { value: e.target.value })}
                    defaultColor={Preferences.get('transit.simulations.defaultColor', '#0086FF')}
                />
            </InputWrapper>
            <InputWrapper smallInput={true} label={props.t('transit:simulation:enabled')}>
                <InputCheckboxBoolean
                    id={'formFieldTransitSimulationEditIsEnabled'}
                    label=" "
                    disabled={props.disabled}
                    isChecked={props.attributes.isEnabled}
                    onValueChange={(e) => props.onValueChange('isEnabled', { value: e.target.value })}
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(BaseSimulationComponent);
