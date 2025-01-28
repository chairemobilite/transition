/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import { secondsToMinutes } from 'chaire-lib-common/lib/utils/DateTimeUtils';

import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { TransitDemandFromCsvFile } from '../../../../services/transitDemand/frontendTypes';

export interface ConfirmCalculationFormProps {
    currentDemand: TransitDemandFromCsvFile;
    routingParameters: BatchCalculationParameters;
    scenarioCollection: ScenarioCollection;
    onUpdate: (routingParameters: BatchCalculationParameters, isValid: boolean) => void;
}
/**
 * Confirm the demand and scenario parameters before running the calculations
 *
 * @param {(ConfirmCalculationFormProps  & WithTranslation)} props
 * @return {*}
 */
const ConfirmCalculationForm: React.FunctionComponent<ConfirmCalculationFormProps & WithTranslation> = (
    props: ConfirmCalculationFormProps & WithTranslation
) => {
    const demandAttributes = props.currentDemand.demand.attributes;
    return (
        <div className="tr__form-section">
            <table className="_statistics" key="confirmScenarioAnalysisProperties">
                <tbody>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {props.t('transit:batchCalculation:DemandData')}
                        </th>
                    </tr>
                    <tr>
                        <th>{props.t('main:CsvFile')}</th>
                        <td>
                            {props.t(
                                demandAttributes.csvFile?.location === 'upload'
                                    ? 'transit:batchCalculation:UploadedFile'
                                    : 'transit:batchCalculation:FromPreviousJob'
                            )}
                        </td>
                    </tr>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {props.t('transit:batchCalculation:AnalysisParameters')}
                        </th>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:RoutingModes')}</th>
                        <td>
                            {props.routingParameters.routingModes
                                .map((mode) => props.t(`transit:transitPath:routingModes:${mode}`))
                                .join(',')}
                        </td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:Scenario')}</th>
                        <td>
                            {props.scenarioCollection.getById(props.routingParameters.scenarioId as string)?.toString()}
                        </td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:MaximumTotalTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxTotalTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:MinimumWaitingTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.minWaitingTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:MaximumAccessEgressTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxAccessEgressTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:MaximumTransferTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxTransferTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:MaximumFirstWaitingTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxFirstWaitingTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:WithAlternatives')}</th>
                        <td>{props.t(`transit:transitRouting:${props.routingParameters.withAlternatives}`)}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:Detailed')}</th>
                        <td>{props.t(`transit:transitRouting:${props.routingParameters.detailed || false}`)}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:WithGeometries')}</th>
                        <td>{props.t(`transit:transitRouting:${props.routingParameters.withGeometries || false}`)}</td>
                    </tr>
                    <tr>
                        <th>{props.t('transit:transitRouting:CpuCount')}</th>
                        <td>{`${typeof props.routingParameters.parallelCalculations === 'number' ? props.routingParameters.parallelCalculations : '-'}`}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default withTranslation(['transit', 'main'])(ConfirmCalculationForm);
