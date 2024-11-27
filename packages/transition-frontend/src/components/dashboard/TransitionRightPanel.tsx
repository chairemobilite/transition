/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation } from 'react-i18next';

import TransitNodesPanel from '../forms/node/TransitNodePanel';
import TransitAgenciesPanel from '../forms/agency/TransitAgencyPanel';
import TransitScenariosPanel from '../forms/scenario/TransitScenarioPanel';
import TransitServicesPanel from '../forms/service/TransitServicePanel';
import TransitRoutingForm from '../forms/transitRouting/TransitRoutingForm';
import TransitAccessibilityMapForm from '../forms/accessibilityMap/AccessibilityMapForm';
import GtfsImportForm from '../forms/gtfs/GtfsImportForm';
import GtfsExportForm from '../forms/gtfs/GtfsExportForm';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { LayoutSectionProps } from 'chaire-lib-frontend/lib/services/dashboard/DashboardContribution';
import PreferencesPanel from '../forms/preferences/PreferencesEdit';

interface RightPanelProps extends LayoutSectionProps {
    availableRoutingModes: string[];
    parentRef?: React.RefObject<HTMLDivElement>;
}

const RightPanel: React.FunctionComponent<RightPanelProps> = (props: RightPanelProps) => {
    return (
        <React.Fragment>
            {props.activeSection === 'nodes' && <TransitNodesPanel />}

            {props.activeSection === 'agencies' && (
                <TransitAgenciesPanel availableRoutingModes={props.availableRoutingModes} parentRef={props.parentRef} />
            )}

            {props.activeSection === 'scenarios' && <TransitScenariosPanel />}

            {props.activeSection === 'services' && <TransitServicesPanel />}

            {props.activeSection === 'accessibilityMap' && <TransitAccessibilityMapForm />}

            {props.activeSection === 'routing' && (
                <TransitRoutingForm availableRoutingModes={props.availableRoutingModes} />
            )}

            {props.activeSection === 'gtfsImport' && serviceLocator.socketEventManager && <GtfsImportForm />}

            {props.activeSection === 'gtfsExport' && serviceLocator.socketEventManager && <GtfsExportForm />}

            {props.activeSection === 'preferences' && serviceLocator.socketEventManager && <PreferencesPanel />}
        </React.Fragment>
    );
};

export default withTranslation()(RightPanel);
