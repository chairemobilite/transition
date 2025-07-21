/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _cloneDeep from 'lodash/cloneDeep';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import ConfigureDemandFromCsvForm from './stepForms/ConfigureDemandFromCsvForm';
import { TransitDemandFromCsvFile } from '../../../../services/transitDemand/frontendTypes';
import ConfigureBatchCalculationForm from './stepForms/ConfigureBatchCalculationForm';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import ConfirmCalculationForm from './stepForms/ConfirmCalculationForm';
import TransitBatchRoutingCalculator from 'transition-common/lib/services/transitRouting/TransitBatchRoutingCalculator';
import { TransitBatchRoutingDemandAttributes } from 'transition-common/lib/services/transitDemand/types';
import TransitOdDemandFromCsv from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';

export interface BatchCalculationFormProps {
    initialValues?: {
        parameters: BatchCalculationParameters;
        demand: TransitBatchRoutingDemandAttributes;

        csvFields: string[];
    };
    availableRoutingModes?: string[];
    onEnd: () => void;
}

const stepCount = 4;
/**
 * Scenario Analysis form, to configure what to analyse:
 *
 * step 1: Select a demand and upload file if necessary
 *
 * step 2: Select analysis parameters
 *
 * step 3: Confirm and run analysis
 *
 * @param {(BatchCalculationFormProps & WithTranslation)} props
 * @return {*}
 */
const BatchCalculationForm: React.FunctionComponent<BatchCalculationFormProps & WithTranslation> = (
    props: BatchCalculationFormProps & WithTranslation
) => {
    const [scenarioCollection, setScenarioCollection] = React.useState(
        serviceLocator.collectionManager.get('scenarios')
    );
    const [currentStep, setCurrentStep] = React.useState(0);
    const [nextEnabled, setNextEnabled] = React.useState(false);
    const [demand, setDemand] = React.useState<TransitDemandFromCsvFile | undefined>(
        props.initialValues !== undefined
            ? {
                type: 'csv' as const,
                csvFields: props.initialValues.csvFields,
                demand: new TransitOdDemandFromCsv(props.initialValues.demand.configuration)
            }
            : undefined
    );
    const [routingParameters, setRoutingParameters] = React.useState<BatchCalculationParameters>(
        props.initialValues !== undefined
            ? props.initialValues.parameters
            : _cloneDeep(Preferences.get('transit.routing.transit', { routingModes: [], withAlternatives: false }))
    );

    const onScenarioCollectionUpdate = () => {
        setScenarioCollection(serviceLocator.collectionManager.get('scenarios'));
    };

    const onDemandStepComplete = (demandData: TransitDemandFromCsvFile) => {
        setDemand(demandData);
        if (demandData.demand.validate()) {
            setNextEnabled(true);
        }
    };

    const onParametersUpdate = (routingParameters: BatchCalculationParameters, isValid: boolean) => {
        setRoutingParameters(routingParameters);
        setNextEnabled(isValid);
    };

    const onFileReset = () => {
        setNextEnabled(false);
    };

    const incrementStep = () => {
        if (currentStep === stepCount - 2) {
            if (demand !== undefined) {
                // TODO Don't just return, wait for the return value to make sure the calculation is running
                TransitBatchRoutingCalculator.calculate(demand.demand, routingParameters);
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
        <form id={'tr__form-transit-sc-analysis-new'} className="apptr__form">
            <h3>
                <img
                    src={'/dist/images/icons/interface/od_routing_white.svg'}
                    className="_icon"
                    alt={props.t('transit:batchCalculation:New')}
                />{' '}
                {props.t('transit:batchCalculation:New')}
            </h3>
            {currentStep === 0 && (
                <React.Fragment>
                    <h4>{props.t('transit:batchCalculation:ConfigureDemand')}</h4>
                    <ConfigureDemandFromCsvForm
                        currentDemand={demand}
                        onComplete={onDemandStepComplete}
                        onFileReset={onFileReset}
                    />
                </React.Fragment>
            )}
            {currentStep === 1 && (
                <React.Fragment>
                    <h4>{props.t('transit:batchCalculation:ConfigureParameters')}</h4>
                    <ConfigureBatchCalculationForm
                        availableRoutingModes={props.availableRoutingModes}
                        routingParameters={routingParameters}
                        onUpdate={onParametersUpdate}
                        scenarioCollection={scenarioCollection}
                    />
                </React.Fragment>
            )}
            {currentStep === 2 && (
                <React.Fragment>
                    <h4>{props.t('transit:batchCalculation:AnalysisSummary')}</h4>
                    <ConfirmCalculationForm
                        currentDemand={demand as TransitDemandFromCsvFile}
                        routingParameters={routingParameters}
                        onUpdate={onParametersUpdate}
                        scenarioCollection={scenarioCollection}
                    />
                </React.Fragment>
            )}
            {
                // TODO The below buttons should be handled by the steps themselves, with proper validations on click. It's ackward for the individual form workflow to have them in the parent form.
            }
            <div className="tr__form-buttons-container">
                <span title={props.t('main:Cancel')}>
                    <Button key="back" color="grey" label={props.t('main:Cancel')} onClick={props.onEnd} />
                </span>
                {currentStep > 0 && (
                    <span title={props.t('main:Previous')}>
                        <Button key="next" color="green" label={props.t('main:Previous')} onClick={decrementStep} />
                    </span>
                )}
                {currentStep < stepCount - 1 && (
                    <span title={props.t('main:Next')}>
                        <Button
                            disabled={!nextEnabled}
                            key="next"
                            color="green"
                            label={props.t(`main:${currentStep === stepCount - 2 ? 'Calculate' : 'Next'}`)}
                            onClick={incrementStep}
                        />
                    </span>
                )}
            </div>
        </form>
    );
};

export default withTranslation(['transit', 'main'])(BatchCalculationForm);
