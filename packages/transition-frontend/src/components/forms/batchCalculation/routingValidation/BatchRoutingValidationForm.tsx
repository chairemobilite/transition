/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _cloneDeep from 'lodash/cloneDeep';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import ConfigureValidationDemandFromCsvForm from './stepForms/ConfigureValidationDemandFromCsvForm';
import { TransitValidationDemandFromCsvFile } from '../../../../services/transitDemand/frontendTypes';
import ConfigureValidationParametersForm from './stepForms/ConfigureValidationParametersForm';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import ConfirmValidationForm from './stepForms/ConfirmValidationForm';
import TransitBatchRoutingValidator from 'transition-common/lib/services/transitRouting/TransitBatchRoutingValidator';
import { TransitBatchValidationDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import TransitValidationDemandFromCsv from 'transition-common/lib/services/transitDemand/TransitValidationDemandFromCsv';

export interface BatchValidationFormProps {
    initialValues?: {
        parameters: BatchCalculationParameters;
        demand: TransitBatchValidationDemandAttributes;
        csvFields: string[];
    };
    availableRoutingModes?: string[];
    onEnd: () => void;
}

const stepCount = 4;
/**
 * Validation form, to configure what to validate:
 *
 * step 1: Select a demand and upload file if necessary
 *
 * step 2: Select validation parameters
 *
 * step 3: Confirm and run validation
 *
 * @param {(BatchValidationFormProps)} props
 * @return {*}
 */
const BatchRoutingValidationForm: React.FunctionComponent<BatchValidationFormProps> = (
    props: BatchValidationFormProps
) => {
    const [scenarioCollection, setScenarioCollection] = React.useState(
        serviceLocator.collectionManager.get('scenarios')
    );
    const [currentStep, setCurrentStep] = React.useState(0);
    const [nextEnabled, setNextEnabled] = React.useState(false);
    const [demand, setDemand] = React.useState<TransitValidationDemandFromCsvFile | undefined>(
        props.initialValues !== undefined
            ? {
                type: 'csv' as const,
                csvFields: props.initialValues.csvFields,
                demand: new TransitValidationDemandFromCsv(props.initialValues.demand.configuration)
            }
            : undefined
    );
    const [validationParameters, setValidationParameters] = React.useState<BatchCalculationParameters>(
        props.initialValues !== undefined
            ? props.initialValues.parameters
            : _cloneDeep(Preferences.get('transit.routing.transit', { routingModes: [], withAlternatives: false }))
    );
    const { t } = useTranslation(['transit', 'main']);

    const onScenarioCollectionUpdate = () => {
        setScenarioCollection(serviceLocator.collectionManager.get('scenarios'));
    };

    const onDemandStepComplete = (demandData: TransitValidationDemandFromCsvFile) => {
        setDemand(demandData);
        if (demandData.demand.validate()) {
            setNextEnabled(true);
        }
    };

    const onParametersUpdate = (routingParameters: BatchCalculationParameters, isValid: boolean) => {
        setValidationParameters(routingParameters);
        setNextEnabled(isValid);
    };

    const onFileReset = () => {
        setNextEnabled(false);
    };

    const incrementStep = () => {
        if (currentStep === stepCount - 2) {
            if (demand !== undefined) {
                TransitBatchRoutingValidator.validate(demand.demand, validationParameters);
                props.onEnd();
            }
        }
        setCurrentStep(currentStep + 1);
    };

    const decrementStep = () => {
        setCurrentStep(currentStep - 1);
        setNextEnabled(true);
    };

    React.useEffect(() => {
        serviceLocator.eventManager.on('collection.update.scenarios', onScenarioCollectionUpdate);
        return () => {
            serviceLocator.eventManager.off('collection.update.scenarios', onScenarioCollectionUpdate);
        };
    }, []);

    if (!scenarioCollection) {
        return <LoadingPage />;
    }

    return (
        <form id={'tr__form-transit-sc-validation-new'} className="apptr__form">
            <h3>
                <img
                    src={'/dist/images/icons/interface/od_routing_white.svg'}
                    className="_icon"
                    alt={t('transit:batchCalculation:ValidationNew')}
                />{' '}
                {t('transit:batchCalculation:ValidationNew')}
            </h3>
            {currentStep === 0 && (
                <React.Fragment>
                    <h4>{t('transit:batchCalculation:ConfigureDemand')}</h4>
                    <ConfigureValidationDemandFromCsvForm
                        currentDemand={demand}
                        onComplete={onDemandStepComplete}
                        onFileReset={onFileReset}
                    />
                </React.Fragment>
            )}
            {currentStep === 1 && (
                <React.Fragment>
                    <h4>{t('transit:batchCalculation:ConfigureValidationParameters')}</h4>
                    <ConfigureValidationParametersForm
                        availableRoutingModes={props.availableRoutingModes}
                        validationParameters={validationParameters}
                        onUpdate={onParametersUpdate}
                        scenarioCollection={scenarioCollection}
                    />
                </React.Fragment>
            )}
            {currentStep === 2 && (
                <React.Fragment>
                    <h4>{t('transit:batchCalculation:ValidationSummary')}</h4>
                    <ConfirmValidationForm
                        currentDemand={demand as TransitValidationDemandFromCsvFile}
                        validationParameters={validationParameters}
                        onUpdate={onParametersUpdate}
                        scenarioCollection={scenarioCollection}
                    />
                </React.Fragment>
            )}
            <div className="tr__form-buttons-container">
                <span title={t('main:Cancel')}>
                    <Button key="back" color="grey" label={t('main:Cancel')} onClick={props.onEnd} />
                </span>
                {currentStep > 0 && (
                    <span title={t('main:Previous')}>
                        <Button key="next" color="green" label={t('main:Previous')} onClick={decrementStep} />
                    </span>
                )}
                {currentStep < stepCount - 1 && (
                    <span title={t('main:Next')}>
                        <Button
                            disabled={!nextEnabled}
                            key="next"
                            color="green"
                            label={t(`main:${currentStep === stepCount - 2 ? 'Validate' : 'Next'}`)}
                            onClick={incrementStep}
                        />
                    </span>
                )}
            </div>
        </form>
    );
};

export default BatchRoutingValidationForm;
