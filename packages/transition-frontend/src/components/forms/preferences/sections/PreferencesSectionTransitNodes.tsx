/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _toString from 'lodash/toString';
import Collapsible from 'react-collapsible';
import { withTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import PreferencesSectionProps from '../PreferencesSectionProps';
import { parseFloatOrNull } from 'chaire-lib-common/lib/utils/MathUtils';

const PreferencesSectionTransitNodes: React.FunctionComponent<PreferencesSectionProps> = (
    props: PreferencesSectionProps
) => {
    const prefs = props.preferences.getAttributes();

    return (
        <Collapsible trigger={props.t('transit:transitNode:Nodes')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper twoColumns={true} key="defaultColor" label={props.t('main:preferences:DefaultColor')}>
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
                <InputWrapper
                    twoColumns={true}
                    key="defaultDwellTimeSeconds"
                    label={props.t('transit:transitNode:DefaultDwellTimeSeconds')}
                >
                    <InputStringFormatted
                        id={'formFieldPreferencesTransitNodeDefaultDwellTimeSeconds'}
                        value={prefs.transit.nodes.defaultDwellTimeSeconds}
                        onValueUpdated={(value) => props.onValueChange('transit.nodes.defaultDwellTimeSeconds', value)}
                        key={`formFieldPreferencesTransitNodeDefaultDwellTimeSeconds_${props.resetChangesCount}`}
                        stringToValue={parseFloatOrNull}
                        valueToString={(val) => _toString(parseFloatOrNull(val))}
                        type="number"
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path={'transit.nodes.defaultDwellTimeSeconds'}
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default withTranslation(['main', 'transit'])(PreferencesSectionTransitNodes);
