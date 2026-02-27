/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import { mpsToKph, kphToMps } from 'chaire-lib-common/lib/utils/PhysicsUtils';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import { MIN_DEFAULT_WALKING_SPEED_KPH, MAX_DEFAULT_WALKING_SPEED_KPH } from 'chaire-lib-common/lib/config/Preferences';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import config from 'chaire-lib-common/lib/config/shared/project.config';
import PreferencesSectionProps from '../PreferencesSectionProps';

const PreferencesSectionGeneral: React.FunctionComponent<PreferencesSectionProps> = (props) => {
    const { t } = useTranslation(['main', 'transit']);
    const prefs = props.preferences.attributes;

    const sectionsChoices = React.useMemo(() => {
        const sections = config.sections;
        const sectionsChoices: { value: string; label: string }[] = [];
        for (const sectionShortname in sections) {
            const section = sections[sectionShortname];
            if (section.enabled !== false) {
                sectionsChoices.push({
                    label: t(section.localizedTitle),
                    value: sectionShortname
                });
            }
        }
        return sectionsChoices;
    }, [t]);

    return (
        <Collapsible trigger={t('main:preferences:General')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper label={t('main:preferences:DefaultSection')}>
                    <InputSelect
                        id={'formFieldPreferencesDefaultSection'}
                        value={prefs.defaultSection}
                        choices={sectionsChoices}
                        t={t}
                        onValueChange={(e) => props.onValueChange('defaultSection', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="defaultSection"
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper label={t('main:preferences:InfoPanelPosition')}>
                    <InputSelect
                        id={'formFieldPreferencesInfoPanelPosition'}
                        value={prefs.infoPanelPosition === 'left' ? 'left' : 'right'}
                        choices={[
                            {
                                label: t('main:Left'),
                                value: 'left'
                            },
                            {
                                label: t('main:Right'),
                                value: 'right'
                            }
                        ]}
                        t={t}
                        onValueChange={(e) => props.onValueChange('infoPanelPosition', { value: e.target.value })}
                        noBlank={true}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="infoPanelPosition"
                        preferences={props.preferences}
                    />
                </InputWrapper>

                <InputWrapper
                    label={t('main:preferences:DefaultWalkingSpeedKph')}
                    help={t('main:preferences:DefaultWalkingSpeedKphHelp')}
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
                <InputWrapper label={t('main:preferences:DateTimeFormat')}>
                    <InputSelect
                        id={'formFieldPreferencesDateTimeFormat'}
                        value={prefs.dateTimeFormat}
                        choices={[
                            {
                                label: t('main:preferences:DateTimeFormat24H', {
                                    formatted: moment().format('YYYY-MM-DD HH:mm')
                                }),
                                value: 'YYYY-MM-DD HH:mm'
                            },
                            {
                                label: t('main:preferences:DateTimeFormat12H', {
                                    formatted: moment().format('YYYY-MM-DD hh:mm A')
                                }),
                                value: 'YYYY-MM-DD hh:mm A'
                            }
                        ]}
                        t={t}
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

export default PreferencesSectionGeneral;
