/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { WithTranslation, withTranslation } from 'react-i18next';
import PreferencesSectionProps from '../PreferencesSectionProps';
import PreferencesColorComponent from '../PreferencesColorComponent';

const PreferencesSectionTransitRouting: React.FunctionComponent<PreferencesSectionProps & WithTranslation> = (
    props: PreferencesSectionProps & WithTranslation
) => (
    <Collapsible trigger={props.t('transit:transitRouting:AccessibilityMap')} open={true} transitionTime={100}>
        <div className="tr__form-section">
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transitAccessibilityMap.locationColor"
                label={props.t('transit:preferences:transitAccessibilityMap:LocationColor')}
            />
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transitAccessibilityMap.polygonColor"
                label={props.t('transit:preferences:transitAccessibilityMap:PolygonColor')}
            />
        </div>
    </Collapsible>
);

export default withTranslation('transit')(PreferencesSectionTransitRouting);
