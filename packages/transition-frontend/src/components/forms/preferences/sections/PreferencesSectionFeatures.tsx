/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation, WithTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import PreferencesSectionProps from '../PreferencesSectionProps';

const PreferencesSectionFeatures: React.FunctionComponent<PreferencesSectionProps & WithTranslation> = (
    props: PreferencesSectionProps & WithTranslation
) => {
    return (
        <Collapsible trigger={props.t('main:preferences:ExperimentalFeatures')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                {/* Dark and Light mode */}
                <InputWrapper label={props.t('main:preferences:DarkMode')}>
                    <InputCheckboxBoolean
                        id={'formFieldPreferencesDarkMode'}
                        isChecked={props.preferences.get('isDarkMode') !== false}
                        defaultChecked={true}
                        label={props.t('main:preferences:DarkModeLabel')}
                        onValueChange={(e) => props.onValueChange('isDarkMode', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="isDarkMode"
                        preferences={props.preferences}
                    />
                </InputWrapper>

                <InputWrapper twoColumns={true} label={props.t('main:preferences:MapPrettyDisplay')}>
                    <InputCheckboxBoolean
                        id={'formFieldPreferencesFeatureMapPrettyDisplay'}
                        isChecked={props.preferences.get('features.map.prettyDisplay')}
                        defaultChecked={false}
                        label={props.t('main:Yes')}
                        onValueChange={(e) =>
                            props.onValueChange('features.map.prettyDisplay', { value: e.target.value })
                        }
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="features.map.prettyDisplay"
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default withTranslation('main')(PreferencesSectionFeatures);
