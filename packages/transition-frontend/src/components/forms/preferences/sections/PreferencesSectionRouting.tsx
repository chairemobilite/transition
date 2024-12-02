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
    <Collapsible trigger={props.t('transit:transitRouting:Routing')} open={true} transitionTime={100}>
        <div className="tr__form-section">
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transit.originLocationColor"
                label={props.t('transit:preferences:routing:OriginLocationColor')}
            />
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transit.destinationLocationColor"
                label={props.t('transit:preferences:routing:DestinationLocationColor')}
            />
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transit.walkingSegmentsColor"
                label={props.t('transit:preferences:routing:WalkingSegmentsColor')}
            />
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transit.walking.color"
                label={props.t('transit:preferences:routing:WalkingColor')}
            />
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transit.cycling.color"
                label={props.t('transit:preferences:routing:CyclingColor')}
            />
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transit.driving.color"
                label={props.t('transit:preferences:routing:DrivingColor')}
            />
            <PreferencesColorComponent
                {...props}
                prefPath="transit.routing.transit.default.color"
                label={props.t('transit:preferences:routing:DefaultColor')}
            />
        </div>
    </Collapsible>
);

export default withTranslation('transit')(PreferencesSectionTransitRouting);
