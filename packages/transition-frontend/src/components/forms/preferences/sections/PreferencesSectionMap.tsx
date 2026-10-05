/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { useTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import PreferencesSectionProps from '../PreferencesSectionProps';

/**
 * Map preferences section.
 * @param props Section callbacks and the preferences object being edited
 */
const PreferencesSectionMap: React.FunctionComponent<PreferencesSectionProps> = (props) => {
    const { t } = useTranslation('main');

    return (
        <Collapsible trigger={t('main:preferences:Map')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper twoColumns={true} label={t('main:preferences:EnableAnimation')}>
                    <InputCheckboxBoolean
                        id={'formFieldPreferencesMapEnableAnimation'}
                        isChecked={props.preferences.get('map.enableAnimation', true)}
                        defaultChecked={true}
                        label={t('main:Yes')}
                        onValueChange={(e) => props.onValueChange('map.enableAnimation', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="map.enableAnimation"
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default PreferencesSectionMap;
