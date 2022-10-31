/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation } from 'react-i18next';
import _toString from 'lodash.tostring';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import PreferencesSectionProps from '../PreferencesSectionProps';

const PreferencesSectionTransitNodes: React.FunctionComponent<PreferencesSectionProps> = (
    props: PreferencesSectionProps
) => {
    const prefs = props.preferences.getAttributes();

    return (
        <Collapsible trigger={props.t('transit:transitNode:Nodes')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper twoColumns={true} label={props.t('main:preferences:DefaultColor')}>
                    <InputColor
                        defaultColor={prefs.transit.nodes.defaultColor}
                        id={'formFieldPreferencesTransitNodeDefaultColor'}
                        value={prefs.transit.nodes.defaultColor}
                        onValueChange={(e) =>
                            props.onValueChange('transit.nodes.defaultColor', { value: e.target.value })
                        }
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="transit.nodes.defaultColor"
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default withTranslation(['main', 'transit'])(PreferencesSectionTransitNodes);
