/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';

import { GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import InputColor from 'chaire-lib-frontend/lib/components/input/InputColor';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

export interface GtfsImportNodesComponentProps extends WithTranslation {
    id: string;
    updateSelectedValue: (path: keyof GtfsImportData, value: string | boolean | number | undefined) => void;
    gtfsImportData: GtfsImportData;
}

const GtfsImportNodesComponent: React.FunctionComponent<GtfsImportNodesComponentProps> = (
    props: GtfsImportNodesComponentProps
) => {
    const stopAggregationWalkingTime = props.gtfsImportData.stopAggregationWalkingRadiusSeconds;

    return (
        <React.Fragment>
            <InputWrapper
                twoColumns={true}
                label={props.t('transit:gtfs:StopAggregationWalkingRadiusSeconds')}
                help={props.t('transit:gtfs:StopAggregationWalkingRadiusSecondsHelp')}
            >
                <InputString
                    id={`formFieldTransitGtfsImporterFileDefaultNodeColor${props.id}`}
                    value={stopAggregationWalkingTime === undefined ? '' : String(stopAggregationWalkingTime)}
                    pattern="[0-9]+"
                    onValueUpdated={({ value }) =>
                        props.updateSelectedValue(
                            'stopAggregationWalkingRadiusSeconds',
                            !_isBlank(value) ? parseInt(value) : undefined
                        )
                    }
                />
            </InputWrapper>
            <InputWrapper twoColumns={true} label={props.t('transit:gtfs:DefaultNodeColor')}>
                <InputColor
                    id={`formFieldTransitGtfsImporterFileDefaultNodeColor${props.id}`}
                    value={props.gtfsImportData.nodes_color}
                    defaultColor={Preferences.get('transit.nodes.defaultColor', '#0086FF')}
                    onValueChange={(e) => props.updateSelectedValue('nodes_color', e.target.value)}
                />
            </InputWrapper>
        </React.Fragment>
    );
};

export default withTranslation('transit')(GtfsImportNodesComponent);
