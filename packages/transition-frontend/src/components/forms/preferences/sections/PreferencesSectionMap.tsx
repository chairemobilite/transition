/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import { roundToDecimals } from 'chaire-lib-common/lib/utils/MathUtils';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import PreferencesSectionProps from '../PreferencesSectionProps';
import { InputCheckboxBoolean } from 'chaire-lib-frontend/lib/components/input/InputCheckbox';

const PreferencesSectionMap: React.FunctionComponent<PreferencesSectionProps> = (props: PreferencesSectionProps) => {
    const prefs = props.preferences.getAttributes();
    const { t } = useTranslation(['main', 'transit']);

    const sections = prefs.sections.transition;
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

    const mapStyles = {
        osmBright: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
        positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        darkMatter: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    };

    const mapStyleChoices: { value: string; label: string }[] = [];
    Object.keys(mapStyles).forEach((key) => {
        mapStyleChoices.push({
            label: t(`main:preferences:mapStyles:${key}`),
            value: mapStyles[key]
        });
    });

    return (
        <Collapsible trigger={t('main:preferences:Map')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper label={t('main:preferences:MapStyle')} help={t('main:preferences:MapStyleHelp')}>
                    <InputSelect
                        id={'formFieldPreferencesMapStyleURL'}
                        value={prefs.mapStyleURL}
                        choices={mapStyleChoices}
                        t={t}
                        onValueChange={(e) => props.onValueChange('mapStyleURL', { value: e.target.value })}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="mapStyleURL"
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper
                    label={t('main:preferences:RasterTileLayerOpacity')}
                    help={t('main:preferences:RasterTileLayerOpacityHelp')}
                >
                    <InputStringFormatted
                        key={`formFieldPreferencesMapTileLayerOpacity${props.resetChangesCount}`}
                        id={'formFieldPreferencesMapTileLayerOpacity'}
                        value={prefs.mapTileLayerOpacity}
                        onValueUpdated={(value) => props.onValueChange('mapTileLayerOpacity', value)}
                        stringToValue={(value) =>
                            !isNaN(parseFloat(value)) ? roundToDecimals(parseFloat(value) / 100, 2) : null
                        }
                        valueToString={(value) => _toString(!isNaN(parseFloat(value)) ? value * 100 : '')}
                        type="number"
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="mapTileLayerOpacity"
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper twoColumns={true} label={t('main:preferences:EnableMapAnimations')}>
                    <InputCheckboxBoolean
                        id={'formFieldPreferencesGeneralEnableMapAnimation'}
                        isChecked={props.preferences.get('map.enableMapAnimations')}
                        defaultChecked={true}
                        label={t('main:Yes')}
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

export default PreferencesSectionMap;
