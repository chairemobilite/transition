/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import moment from 'moment';
import { WithTranslation, withTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import { mpsToKph, kphToMps } from 'chaire-lib-common/lib/utils/PhysicsUtils';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import { MIN_DEFAULT_WALKING_SPEED_KPH, MAX_DEFAULT_WALKING_SPEED_KPH } from 'chaire-lib-common/lib/config/Preferences';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import PreferencesSectionProps from '../PreferencesSectionProps';

const PreferencesSectionGeneral: React.FunctionComponent<PreferencesSectionProps & WithTranslation> = (
    props: PreferencesSectionProps & WithTranslation
) => {
    const prefs = props.preferences.attributes;

    const sectionsChoices = React.useMemo(() => {
        const sections = config.sections;
        const sectionsChoices: { value: string; label: string }[] = [];
        for (const sectionShortname in sections) {
            const section = sections[sectionShortname];
            if (section.enabled !== false) {
                sectionsChoices.push({
                    label: props.t(section.localizedTitle),
                    value: sectionShortname
                });
            }
        }
        return sectionsChoices;
    }, []);

    return (
        <Collapsible trigger={props.t('main:preferences:General')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper label={props.t('main:preferences:DefaultSection')}>
                    <InputSelect
                        id={'formFieldPreferencesDefaultSection'}
                        value={prefs.defaultSection}
                        choices={sectionsChoices}
                        t={props.t}
                        onValueChange={(e) => props.onValueChange('defaultSection', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="defaultSection"
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper label={props.t('main:preferences:InfoPanelPosition')}>
                    <InputSelect
                        id={'formFieldPreferencesInfoPanelPosition'}
                        value={prefs.infoPanelPosition === 'left' ? 'left' : 'right'}
                        choices={[
                            {
                                label: props.t('main:Left'),
                                value: 'left'
                            },
                            {
                                label: props.t('main:Right'),
                                value: 'right'
                            }
                        ]}
                        t={props.t}
                        onValueChange={(e) => props.onValueChange('infoPanelPosition', { value: e.target.value })}
                        noBlank={true}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="infoPanelPosition"
                        preferences={props.preferences}
                    />
                </InputWrapper>

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

                <InputWrapper
                    label={props.t('main:preferences:DefaultWalkingSpeedKph')}
                    help={props.t('main:preferences:DefaultWalkingSpeedKphHelp')}
                >
                    <InputStringFormatted
                        key={`formFieldPreferencesDefaultDefaultWalkingSpeedMetersPerSeconds${props.resetChangesCount}`}
                        id={'formFieldPreferencesDefaultDefaultWalkingSpeedMetersPerSeconds'}
                        value={prefs.defaultWalkingSpeedMetersPerSeconds}
                        onValueUpdated={(value) => props.onValueChange('defaultWalkingSpeedMetersPerSeconds', value)}
                        stringToValue={(value) => (!isNaN(parseFloat(value)) ? kphToMps(parseFloat(value)) : null)}
                        valueToString={(value) =>
                            _toString(!isNaN(parseFloat(value)) ? roundToDecimals(mpsToKph(value), 1) : '')
                        }
                        type="number"
                        min={MIN_DEFAULT_WALKING_SPEED_KPH}
                        max={MAX_DEFAULT_WALKING_SPEED_KPH}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="defaultWalkingSpeedMetersPerSeconds"
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper label={props.t('main:preferences:DateTimeFormat')}>
                    <InputSelect
                        id={'formFieldPreferencesDateTimeFormat'}
                        value={prefs.dateTimeFormat}
                        choices={[
                            {
                                label: props.t('main:preferences:DateTimeFormat24H', {
                                    formatted: moment().format('YYYY-MM-DD HH:mm')
                                }),
                                value: 'YYYY-MM-DD HH:mm'
                            },
                            {
                                label: props.t('main:preferences:DateTimeFormat12H', {
                                    formatted: moment().format('YYYY-MM-DD hh:mm A')
                                }),
                                value: 'YYYY-MM-DD hh:mm A'
                            }
                        ]}
                        t={props.t}
                        onValueChange={(e) => props.onValueChange('dateTimeFormat', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="dateTimeFormat"
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default withTranslation(['main', 'transit'])(PreferencesSectionGeneral);
