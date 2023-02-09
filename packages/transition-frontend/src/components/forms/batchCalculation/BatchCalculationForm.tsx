/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import _cloneDeep from 'lodash.clonedeep';

import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import LoadingPage from 'chaire-lib-frontend/lib/components/pages/LoadingPage';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import ConfigureDemandFromCsvForm from './stepForms/ConfigureDemandFromCsvForm';
import { TransitDemandFromCsvFile } from '../../../services/transitDemand/types';
import ConfigureBatchCalculationForm from './stepForms/ConfigureBatchCalculationForm';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { BatchCalculationParameters } from '../../../services/batchCalculation/types';

export interface BatchCalculationFormProps {
    availableRoutingModes?: string[];
    onEnd: () => void;
}

const stepCount = 3;
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
    const [demand, setDemand] = React.useState<TransitDemandFromCsvFile | undefined>(undefined);
    const [routingParameters, setRoutingParameters] = React.useState<BatchCalculationParameters>(
        _cloneDeep(Preferences.get('transit.routing.transit', { routingModes: [], withAlternatives: false }))
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
                <ConfigureDemandFromCsvForm
                    currentDemand={demand}
                    onComplete={onDemandStepComplete}
                    onFileReset={onFileReset}
                />
            )}
            {currentStep === 1 && (
                <ConfigureBatchCalculationForm
                    availableRoutingModes={props.availableRoutingModes}
                    routingParameters={routingParameters}
                    onUpdate={onParametersUpdate}
                    scenarioCollection={scenarioCollection}
                />
            )}
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
                            label={props.t('main:Next')}
                            onClick={incrementStep}
                        />
                    </span>
                )}
            </div>
        </form>
    );
};

export default withTranslation(['transit', 'main'])(BatchCalculationForm);
