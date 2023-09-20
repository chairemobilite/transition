/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import PreferencesSectionProps from '../PreferencesSectionProps';

const PreferencesSectionTransitAgencies: React.FunctionComponent<PreferencesSectionProps> = (
    props: PreferencesSectionProps
) => {
    const prefs = props.preferences.getAttributes();

    return (
        <Collapsible trigger={props.t('transit:transitAgency:Agencies')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper twoColumns={true} label={props.t('main:preferences:DefaultColor')}>
                    <InputColor
                        defaultColor={prefs.transit.agencies.defaultColor}
                        id={'formFieldPreferencesTransitAgencyDefaultColor'}
                        value={prefs.transit.agencies.defaultColor}
                        onValueChange={(e) =>
                            props.onValueChange('transit.agencies.defaultColor', { value: e.target.value })
                        }
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="transit.agencies.defaultColor"
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default withTranslation(['main', 'transit'])(PreferencesSectionTransitAgencies);
