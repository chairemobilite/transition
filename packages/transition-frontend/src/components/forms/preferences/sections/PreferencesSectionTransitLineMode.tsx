/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { withTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import PreferencesSectionLineModeProps from '../PreferencesSectionLineModeProps';
import { parseIntOrNull, parseFloatOrNull } from 'chaire-lib-common/lib/utils/MathUtils';

const PreferencesSectionTransitLineMode: React.FunctionComponent<PreferencesSectionLineModeProps> = (
    props: PreferencesSectionLineModeProps
) => {
    const prefs = props.preferences.getAttributes();

    const routingModes: { value: string; disabled?: boolean }[] = [];
    const compatibleRoutingModes = props.lineModesConfigByMode[props.mode].compatibleRoutingModes;
    for (let i = 0, countI = compatibleRoutingModes.length; i < countI; i++) {
        const routingModeShortname = compatibleRoutingModes[i];
        routingModes.push({
            value: routingModeShortname
        });
    }

    const routingEngines: { value: string }[] = [];
    const compatibleRoutingEngines = props.lineModesConfigByMode[props.mode].compatibleRoutingEngines;
    for (let i = 0, countI = compatibleRoutingEngines.length; i < countI; i++) {
        const routingEngine = compatibleRoutingEngines[i];
        routingEngines.push({
            value: routingEngine
        });
    }

    return (
        <Collapsible trigger={props.t(`transit:transitLine:modes.${props.mode}`)} open={false} transitionTime={100}>
            <div className="tr__form-section">
                {routingModes && (
                    <InputWrapper
                        twoColumns={true}
                        key="defaultRoutingMode"
                        label={props.t('transit:transitPath:DefaultRoutingMode')}
                    >
                        <InputSelect
                            id={`formFieldPreferencesTransitLineModeDefaultRoutingMode_${props.mode}`}
                            value={prefs.transit.lines.lineModesDefaultValues[props.mode].routingMode}
                            choices={routingModes}
                            localePrefix="transit:transitPath:routingModes"
                            t={props.t}
                            onValueChange={(e) =>
                                props.onValueChange(`transit.lines.lineModesDefaultValues.${props.mode}.routingMode`, {
                                    value: e.target.value
                                })
                            }
                        />
                        <PreferencesResetToDefaultButton
                            resetPrefToDefault={props.resetPrefToDefault}
                            path={`transit.lines.lineModesDefaultValues.${props.mode}.routingMode`}
                            preferences={props.preferences}
                        />
                    </InputWrapper>
                )}
                {routingEngines && (
                    <InputWrapper
                        twoColumns={true}
                        key="defaultRoutingEngine"
                        label={props.t('transit:transitPath:DefaultRoutingEngine')}
                    >
                        <InputSelect
                            id={`formFieldPreferencesTransitLineModeDefaultRoutingEngine_${props.mode}`}
                            value={prefs.transit.lines.lineModesDefaultValues[props.mode].routingEngine}
                            choices={routingEngines}
                            localePrefix="transit:transitPath:routingEngines"
                            t={props.t}
                            onValueChange={(e) =>
                                props.onValueChange(
                                    `transit.lines.lineModesDefaultValues.${props.mode}.routingEngine`,
                                    { value: e.target.value }
                                )
                            }
                        />
                        <PreferencesResetToDefaultButton
                            resetPrefToDefault={props.resetPrefToDefault}
                            path={`transit.lines.lineModesDefaultValues.${props.mode}.routingEngine`}
                            preferences={props.preferences}
                        />
                    </InputWrapper>
                )}
                <InputWrapper
                    twoColumns={true}
                    key="defaultAcceleration"
                    label={props.t('transit:transitPath:DefaultAcceleration')}
                >
                    <InputStringFormatted
                        id={`formFieldPreferencesTransitLineModeDefaultAcceleration_${props.mode}`}
                        value={prefs.transit.lines.lineModesDefaultValues[props.mode].defaultAcceleration}
                        onValueUpdated={(value) =>
                            props.onValueChange(
                                `transit.lines.lineModesDefaultValues.${props.mode}.defaultAcceleration`,
                                value
                            )
                        }
                        key={`formFieldPreferencesTransitLineModeDefaultAcceleration_${props.mode}_${props.resetChangesCount}`}
                        stringToValue={parseFloatOrNull}
                        valueToString={(val) => _toString(parseFloatOrNull(val))}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path={`transit.lines.lineModesDefaultValues.${props.mode}.defaultAcceleration`}
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper
                    twoColumns={true}
                    key="defaultDeceleration"
                    label={props.t('transit:transitPath:DefaultDeceleration')}
                >
                    <InputStringFormatted
                        id={`formFieldPreferencesTransitLineModeDefaultDeceleration_${props.mode}`}
                        value={prefs.transit.lines.lineModesDefaultValues[props.mode].defaultDeceleration}
                        onValueUpdated={(value) =>
                            props.onValueChange(
                                `transit.lines.lineModesDefaultValues.${props.mode}.defaultDeceleration`,
                                value
                            )
                        }
                        key={`formFieldPreferencesTransitLineModeDefaultDeceleration_${props.mode}_${props.resetChangesCount}`}
                        stringToValue={parseFloatOrNull}
                        valueToString={(val) => _toString(parseFloatOrNull(val))}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path={`transit.lines.lineModesDefaultValues.${props.mode}.defaultDeceleration`}
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper
                    twoColumns={true}
                    key="defaultRunningSpeedKmH"
                    label={props.t('transit:transitPath:DefaultRunningSpeedKmH')}
                >
                    <InputStringFormatted
                        id={`formFieldPreferencesTransitLineModeDefaultRunningSpeedKmH_${props.mode}`}
                        value={prefs.transit.lines.lineModesDefaultValues[props.mode].defaultRunningSpeedKmH}
                        onValueUpdated={(value) =>
                            props.onValueChange(
                                `transit.lines.lineModesDefaultValues.${props.mode}.defaultRunningSpeedKmH`,
                                value
                            )
                        }
                        key={`formFieldPreferencesTransitLineModeDefaultRunningSpeedKmH_${props.mode}_${props.resetChangesCount}`}
                        stringToValue={parseFloatOrNull}
                        valueToString={(val) => _toString(parseFloatOrNull(val))}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path={`transit.lines.lineModesDefaultValues.${props.mode}.defaultRunningSpeedKmH`}
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <InputWrapper
                    twoColumns={true}
                    key="defaultDwellTimeSeconds"
                    label={props.t('transit:transitPath:DefaultDwellTimeSeconds')}
                >
                    <InputStringFormatted
                        id={`formFieldPreferencesTransitLineModeDefaultDwellTimeSeconds_${props.mode}`}
                        value={prefs.transit.lines.lineModesDefaultValues[props.mode].defaultDwellTimeSeconds}
                        onValueUpdated={(value) =>
                            props.onValueChange(
                                `transit.lines.lineModesDefaultValues.${props.mode}.defaultDwellTimeSeconds`,
                                value
                            )
                        }
                        key={`formFieldPreferencesTransitLineModeDefaultDwellTimeSeconds_${props.mode}_${props.resetChangesCount}`}
                        stringToValue={parseFloatOrNull}
                        valueToString={(val) => _toString(parseFloatOrNull(val))}
                        type="number"
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path={`transit.lines.lineModesDefaultValues.${props.mode}.defaultDwellTimeSeconds`}
                        preferences={props.preferences}
                    />
                </InputWrapper>
            </div>
        </Collapsible>
    );
};

export default withTranslation('transit')(PreferencesSectionTransitLineMode);
