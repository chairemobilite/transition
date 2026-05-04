/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import _toString from 'lodash/toString';
import Collapsible from 'react-collapsible';
import { WithTranslation, withTranslation } from 'react-i18next';
import PreferencesResetToDefaultButton from '../PreferencesResetToDefaultButton';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputStringFormatted from 'chaire-lib-frontend/lib/components/input/InputStringFormatted';
import PreferencesSectionProps from '../PreferencesSectionProps';
import { parseIntOrNull } from 'chaire-lib-common/lib/utils/MathUtils';
import {
    WAYPOINT_MIN_ZOOM_ALLOWED_MAX,
    WAYPOINT_MIN_ZOOM_ALLOWED_MIN,
    WAYPOINT_MIN_ZOOM_DEFAULT
} from '../../../../config/layers.config';

const PreferencesSectionTransitPaths: React.FunctionComponent<PreferencesSectionProps & WithTranslation> = (
    props: PreferencesSectionProps & WithTranslation
) => {
    const prefs = props.preferences.attributes;

    return (
        <Collapsible trigger={props.t('transit:transitPath:Paths')} open={true} transitionTime={100}>
            <div className="tr__form-section">
                <InputWrapper
                    twoColumns={true}
                    key="waypointMinZoom"
                    label={props.t('transit:transitPath:WaypointMinZoom')}
                >
                    <InputStringFormatted
                        id="formFieldPreferencesTransitPathWaypointMinZoom"
                        value={prefs.map?.pathWaypointMinZoom ?? WAYPOINT_MIN_ZOOM_DEFAULT}
                        onValueUpdated={(payload) => {
                            // HTML min/max sets valid:false without updating prefs, so validate() never runs.
                            // Always forward so Preferences.validate() can set errors (see FormErrors at bottom of panel).
                            if (payload.valid === false) {
                                props.onValueChange('map.pathWaypointMinZoom', {
                                    value: payload.value,
                                    valid: true
                                });
                            } else {
                                props.onValueChange('map.pathWaypointMinZoom', payload);
                            }
                        }}
                        key={`formFieldPreferencesTransitPathWaypointMinZoom_${props.resetChangesCount}`}
                        stringToValue={parseIntOrNull}
                        valueToString={(val) => _toString(parseIntOrNull(val))}
                        type="number"
                        min={WAYPOINT_MIN_ZOOM_ALLOWED_MIN}
                        max={WAYPOINT_MIN_ZOOM_ALLOWED_MAX}
                    />
                    <PreferencesResetToDefaultButton
                        resetPrefToDefault={props.resetPrefToDefault}
                        path="map.pathWaypointMinZoom"
                        preferences={props.preferences}
                    />
                </InputWrapper>
                <p className="apptr__form-help-text">{props.t('transit:transitPath:WaypointMinZoomHelp')}</p>
                <p className="apptr__form-help-text">{props.t('transit:transitPath:WaypointMinZoomRefreshHint')}</p>
            </div>
        </Collapsible>
    );
};

export default withTranslation(['main', 'transit'])(PreferencesSectionTransitPaths);
