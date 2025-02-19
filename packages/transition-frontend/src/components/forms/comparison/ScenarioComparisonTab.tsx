/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tab, Tabs, TabList } from 'react-tabs';

import AlternativesSelect from './ScenarioComparisonAlternativesSelect';
import { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';
import { resultToObject } from 'chaire-lib-common/lib/services/routing/RoutingResultUtils';
import { TransitRoutingResultData } from 'chaire-lib-common/lib/services/routing/TransitRoutingResult';

export interface ScenarioComparisonTabProps {
    result1: RoutingResultsByMode;
    result2: RoutingResultsByMode;
    request: TransitRoutingAttributes;
    scenarioNames: {
        name1: string;
        name2: string;
    };
}

const ScenarioComparisonTab: React.FunctionComponent<ScenarioComparisonTabProps> = (
    props: ScenarioComparisonTabProps
) => {
    const { t } = useTranslation(['transit']);

    let hasAlternativeWalkPath1 = false;
    let hasAlternativeWalkPath2 = false;

    const result1 = props.result1?.['transit'] as TransitRoutingResultData;
    if (result1.walkOnlyPath !== undefined) {
        result1.walkOnlyPath = undefined;
        hasAlternativeWalkPath1 = true;
    }

    const result2 = props.result2?.['transit'] as TransitRoutingResultData;
    if (result2.walkOnlyPath !== undefined) {
        result2.walkOnlyPath = undefined;
        hasAlternativeWalkPath2 = true;
    }

    const routingModesResultsTabs: Tab[] = [];
    routingModesResultsTabs.push(<Tab key={'transit'}>{t('transit:transitPath:routingModes:transit')}</Tab>);

    return (
        <React.Fragment>
            <Tabs selectedIndex={0}>
                <TabList>{routingModesResultsTabs}</TabList>
                <React.Fragment>
                    <AlternativesSelect
                        result1={resultToObject(result1)}
                        result2={resultToObject(result2)}
                        request={props.request}
                        scenarioNames={props.scenarioNames}
                        hasAlternativeWalkPath={{
                            result1: hasAlternativeWalkPath1,
                            result2: hasAlternativeWalkPath2
                        }}
                    />
                </React.Fragment>
            </Tabs>
        </React.Fragment>
    );
};

export default ScenarioComparisonTab;
