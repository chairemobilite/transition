/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React, { useState } from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { ResultsByMode } from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import RoutingResultComponent from './RoutingResultComponent';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';

export interface TransitRoutingResultsProps extends WithTranslation {
    results: ResultsByMode;
    request: TransitRoutingAttributes;
    selectedMode?: RoutingOrTransitMode;
    setSelectedMode: (mode: RoutingOrTransitMode) => void;
}

const RoutingResults: React.FunctionComponent<TransitRoutingResultsProps> = (props: TransitRoutingResultsProps) => {
    const selectedRoutingModes: RoutingOrTransitMode[] = (Object.keys(props.results) as RoutingOrTransitMode[]) || [];
    const selectedRoutingModesCount = selectedRoutingModes.length;

    // prepare routing mode results tabs:
    const routingModesResultsTabs: Tab[] = [];
    const routingModesResultsTabPanels: TabPanel[] = [];
    for (let i = 0; i < selectedRoutingModesCount; i++) {
        const result = props.results[selectedRoutingModes[i]];
        if (!result) {
            continue;
        }
        routingModesResultsTabs.push(
            <Tab key={selectedRoutingModes[i]}>
                {props.t(`transit:transitPath:routingModes:${selectedRoutingModes[i]}`)}
            </Tab>
        );
        routingModesResultsTabPanels.push(
            <TabPanel key={selectedRoutingModes[i]}>
                <RoutingResultComponent result={result} request={props.request} />
            </TabPanel>
        );
    }

    return (
        <React.Fragment>
            <Tabs
                selectedIndex={props.selectedMode !== undefined ? selectedRoutingModes.indexOf(props.selectedMode) : 0}
                onSelect={function (index, lastIndex, e) {
                    if (index !== lastIndex) {
                        // check if selection changed
                        props.setSelectedMode(selectedRoutingModes[index]);
                    }
                }}
            >
                <TabList>{routingModesResultsTabs}</TabList>
                <React.Fragment>{routingModesResultsTabPanels}</React.Fragment>
            </Tabs>
        </React.Fragment>
    );
};

export default withTranslation(['transit', 'main'])(RoutingResults);
