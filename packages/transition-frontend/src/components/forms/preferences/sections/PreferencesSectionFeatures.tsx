/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import PreferencesSectionProps from '../PreferencesSectionProps';

const PreferencesSectionFeatures: React.FunctionComponent<PreferencesSectionProps> = (
    props: PreferencesSectionProps
) => {
    const prefs = props.preferences.getAttributes();

    return (
        <Collapsible trigger={props.t('main:preferences:ExperimentalFeatures')} open={true} transitionTime={100}>
            <div className="tr__form-section">
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

export default withTranslation(['main', 'transit'])(PreferencesSectionFeatures);
