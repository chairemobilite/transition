/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { WithTranslation, withTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import { mpsToKph, kphToMps } from 'chaire-lib-common/lib/utils/PhysicsUtils';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import PreferencesSectionProps from '../PreferencesSectionProps';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';
import moment from 'moment';

const PreferencesSectionGeneral: React.FunctionComponent<PreferencesSectionProps & WithTranslation> = (
    props: PreferencesSectionProps & WithTranslation
) => {
    const prefs = props.preferences.getAttributes();

    const sections = prefs.sections.transition;
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

    const mapStyles = {
        osmBright: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        darkMatter: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    };

    const mapStyleChoices: { value: string; label: string }[] = [];
    Object.keys(mapStyles).forEach((key) => {
        mapStyleChoices.push({
            label: props.t(`main:preferences:mapStyles:${key}`),
            value: mapStyles[key]
        });
    });

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
                        value={prefs.infoPanelPosition}
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
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="infoPanelPosition"
                        preferences={props.preferences}
                    />
                </InputWrapper>

                <InputWrapper label={props.t('main:preferences:MapStyle')}>
                    <InputSelect
                        id={'formFieldPreferencesMapStyleURL'}
                        value={prefs.mapStyleURL}
                        choices={mapStyleChoices}
                        t={props.t}
                        onValueChange={(e) => props.onValueChange('mapStyleURL', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="mapStyleURL"
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
                <InputWrapper twoColumns={true} label={props.t('main:preferences:EnableMapAnimations')}>
                    <InputCheckboxBoolean
                        id={'formFieldPreferencesGeneralEnableMapAnimation'}
                        isChecked={props.preferences.get('map.enableMapAnimations')}
                        defaultChecked={true}
                        label={props.t('main:Yes')}
                        onValueChange={(e) => props.onValueChange('map.enableMapAnimations', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="map.enableMapAnimations"
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default withTranslation(['main', 'transit'])(PreferencesSectionGeneral);
