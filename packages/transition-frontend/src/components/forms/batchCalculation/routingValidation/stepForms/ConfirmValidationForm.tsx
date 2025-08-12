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
import { TransitValidationDemandFromCsvFile } from '../../../../../services/transitDemand/frontendTypes';

export interface ConfirmValidationFormProps {
    currentDemand: TransitValidationDemandFromCsvFile;
    validationParameters: BatchCalculationParameters;
    scenarioCollection: ScenarioCollection;
    onUpdate: (validationParameters: BatchCalculationParameters, isValid: boolean) => void;
}
/**
 * Confirm the demand and scenario parameters before running the validation
 *
 * @param {(ConfirmValidationFormProps  & WithTranslation)} props
 * @return {*}
 */
const ConfirmValidationForm: React.FunctionComponent<ConfirmValidationFormProps> = (
    props: ConfirmValidationFormProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    const demandAttributes = props.currentDemand.demand.attributes;
    return (
        <div className="tr__form-section">
            <table className="_statistics" key="confirmScenarioValidationProperties">
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
                                demandAttributes.csvFile?.location === 'upload'
                                    ? 'transit:batchCalculation:UploadedFile'
                                    : 'transit:batchCalculation:FromPreviousJob'
                            )}
                        </td>
                    </tr>
                    <tr>
                        <th className="_header" colSpan={2}>
                            {t('transit:batchCalculation:ValidationParameters')}
                        </th>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:Scenario')}</th>
                        <td>
                            {props.scenarioCollection
                                .getById(props.validationParameters.scenarioId as string)
                                ?.toString()}
                        </td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumTotalTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.validationParameters.maxTotalTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MinimumWaitingTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.validationParameters.minWaitingTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumAccessEgressTravelTimeMinutes')}</th>
                        <td>
                            {_toString(secondsToMinutes(props.validationParameters.maxAccessEgressTravelTimeSeconds))}
                        </td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumTransferTravelTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.validationParameters.maxTransferTravelTimeSeconds))}</td>
                    </tr>
                    <tr>
                        <th>{t('transit:transitRouting:MaximumFirstWaitingTimeMinutes')}</th>
                        <td>{_toString(secondsToMinutes(props.validationParameters.maxFirstWaitingTimeSeconds))}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
};

export default ConfirmValidationForm;
