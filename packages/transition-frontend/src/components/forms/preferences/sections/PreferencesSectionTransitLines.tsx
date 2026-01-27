/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { WithTranslation, withTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import PreferencesSectionProps from '../PreferencesSectionProps';
import lineModesConfig from 'transition-common/lib/config/lineModes';
import { transitModes } from 'transition-common/lib/services/line/types';
import PreferencesSectionTransitLineMode from './PreferencesSectionTransitLineMode';

const lineModesConfigByMode = {};
for (let i = 0, countI = lineModesConfig.length; i < countI; i++) {
    const lineMode = lineModesConfig[i];
    lineModesConfigByMode[lineMode.value] = lineMode;
}

const PreferencesSectionTransitLines: React.FunctionComponent<PreferencesSectionProps & WithTranslation> = (
    props: PreferencesSectionProps & WithTranslation
) => {
    const prefs = props.preferences.attributes;

    const lineModesDefaultValuesPrefs = transitModes.map((mode) => {
        return (
            <PreferencesSectionTransitLineMode
                key={mode}
                preferences={props.preferences}
                onValueChange={props.onValueChange}
                resetChangesCount={props.resetChangesCount}
                resetPrefToDefault={props.resetPrefToDefault}
                mode={mode}
                lineModesConfigByMode={lineModesConfigByMode}
            />
        );
    });

    return (
        <Collapsible trigger={props.t('transit:transitLine:Lines')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper twoColumns={true} key="lineDefaultColor" label={props.t('main:preferences:DefaultColor')}>
                    <InputColor
                        defaultColor={prefs.transit.lines.defaultColor}
                        id={'formFieldPreferencesTransitLineDefaultColor'}
                        value={prefs.transit.lines.defaultColor}
                        onValueChange={(e) =>
                            props.onValueChange('transit.lines.defaultColor', { value: e.target.value })
                        }
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="transit.lines.defaultColor"
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
            <div className="tr__form-section">
                <h3>{props.t('transit:transitLine:modes:Modes')}</h3>
                {lineModesDefaultValuesPrefs}
            </div>
        </Collapsible>
    );
};

export default withTranslation(['main', 'transit'])(PreferencesSectionTransitLines);
