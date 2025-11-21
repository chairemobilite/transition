/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _toString from 'lodash/toString';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import { secondsToMinutes } from 'chaire-lib-common/lib/utils/DateTimeUtils';

import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import TransitOdDemandFromCsv from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';

export interface ConfirmCalculationFormProps {
    currentDemand: TransitOdDemandFromCsv;
    routingParameters: BatchCalculationParameters;
    scenarioCollection: ScenarioCollection;
    onUpdate: (routingParameters: BatchCalculationParameters, isValid: boolean) => void;
}
/**
 * Confirm the demand and scenario parameters before running the calculations
 *
 * @param {(ConfirmCalculationFormProps)} props
 * @return {*}
 */
const ConfirmCalculationForm: React.FunctionComponent<ConfirmCalculationFormProps> = (
    props: ConfirmCalculationFormProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    const demandAttributes = props.currentDemand.getCurrentFileAndMapping()!;
    return (
        <div className="tr__form-section">
            <table className="_statistics" key="confirmScenarioAnalysisProperties">
                <tbody>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {t('transit:batchCalculation:DemandData')}
                        </th>
                    </tr>
                    <tr>
                        <th>{t('main:CsvFile')}</th>
                        <td>
                            {t(
                                demandAttributes.fileAndMapping.csvFile.location === 'upload'
                                    ? 'transit:batchCalculation:UploadedFile'
                                    : 'transit:batchCalculation:FromPreviousJob'
                            )}
                        </td>
                    </tr>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {t('transit:batchCalculation:AnalysisParameters')}
                        </th>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:RoutingModes')}</th>
                        <td>
                            {props.routingParameters.routingModes
                                .map((mode) => t(`transit:transitPath:routingModes:${mode}`))
                                .join(',')}
                        </td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:Scenario')}</th>
                        <td>
                            {props.scenarioCollection.getById(props.routingParameters.scenarioId as string)?.toString()}
                        </td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumTotalTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxTotalTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MinimumWaitingTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.minWaitingTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumAccessEgressTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxAccessEgressTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumTransferTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxTransferTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumFirstWaitingTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.routingParameters.maxFirstWaitingTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:WithAlternatives')}</th>
                        <td>{t(`transit:transitRouting:${props.routingParameters.withAlternatives}`)}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:Detailed')}</th>
                        <td>{t(`transit:transitRouting:${props.routingParameters.detailed || false}`)}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:WithGeometries')}</th>
                        <td>{t(`transit:transitRouting:${props.routingParameters.withGeometries || false}`)}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:CpuCount')}</th>
                        <td>{`${typeof props.routingParameters.parallelCalculations === 'number' ? props.routingParameters.parallelCalculations : '-'}`}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default ConfirmCalculationForm;
