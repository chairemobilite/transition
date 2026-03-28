/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import {
    transitNetworkDesignDescriptor,
    TransitNetworkDesignParameters
} from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import ConfigureNetworkDesignParametersForm from './stepForms/ConfigureNetworkDesignParametersForm';
import ConfigureAlgorithmParametersForm from './stepForms/ConfigureAlgorithmParametersForm';
import ConfigureSimulationMethodForm from './stepForms/ConfigureSimulationMethodForm';
import ConfirmNetworkDesignForm from './stepForms/ConfirmNetworkDesignForm';
import NetworkDesignFrontendExecutor from '../../../services/networkDesign/NetworkDesignFrontendExecutor';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';
import { FormInitialValues, PartialAlgorithmConfiguration, PartialSimulationMethodConfiguration } from './types';
import { getDefaultOptionsFromDescriptor } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignAlgorithm';

export interface TransitNetworkDesignFormProps {
    initialValues?: FormInitialValues;
    /** If set, the job already exists and the form is read-only. */
    jobId?: number;
    onJobConfigurationCompleted: () => void;
}

const stepCount = 4;

/**
 * Transit network design form, to configure what the transit network design
 * operation:
 *
 * step 1: Configure the transit network design parameters
 *
 * step 2: Configure the algorithm parameters
 *
 * step 3: Configure the simulation method
 *
 * step 4: Confirm and run network design operation
 *
 * @param {(TransitNetworkDesignFormProps)} props
 * @return {*}
 */
const TransitNetworkDesignForm: React.FunctionComponent<TransitNetworkDesignFormProps> = (
    props: TransitNetworkDesignFormProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    const hasId = props.jobId !== undefined;
    const [currentStep, setCurrentStep] = React.useState(0);
    const [nextEnabled, setNextEnabled] = React.useState(hasId);
    const [jobParameters, setJobParameters] = React.useState<FormInitialValues>({
        transitNetworkDesignParameters: getDefaultOptionsFromDescriptor(
            props.initialValues?.transitNetworkDesignParameters || {},
            transitNetworkDesignDescriptor
        ),
        algorithmConfiguration: props.initialValues?.algorithmConfiguration || {
            type: 'evolutionaryAlgorithm',
            config: {}
        },
        simulationMethod: props.initialValues?.simulationMethod || { type: 'OdTripSimulation', config: {} }
    });

    const onNetworkParametersUpdate = (parameters: Partial<TransitNetworkDesignParameters>, isValid: boolean) => {
        setJobParameters((prev) => ({ ...prev, transitNetworkDesignParameters: parameters }));
        setNextEnabled(isValid);
    };

    const onAlgorithmParametersUpdate = (algorithmConfig: PartialAlgorithmConfiguration, isValid: boolean) => {
        setJobParameters((prev) => ({ ...prev, algorithmConfiguration: algorithmConfig }));
        setNextEnabled(isValid);
    };

    const onSimulationMethodUpdate = (simulationMethod: PartialSimulationMethodConfiguration, isValid: boolean) => {
        setJobParameters((prev) => ({ ...prev, simulationMethod }));
        setNextEnabled(isValid);
    };

    const incrementStep = () => {
        if (currentStep === stepCount - 1) {
            if (!hasId) {
                NetworkDesignFrontendExecutor.execute(jobParameters as TransitNetworkJobConfigurationType);
            }
            return props.onJobConfigurationCompleted();
        }
        setCurrentStep(currentStep + 1);
        if (hasId) {
            setNextEnabled(true);
        }
    };

    const decrementStep = () => {
        setCurrentStep(currentStep - 1);
        setNextEnabled(true);
    };

    return (
        <form id={'tr__form-transit-network-design-new'} className="apptr__form">
            <h3>
                <img
                    src={'/dist/images/icons/interface/simulation_white.svg'}
                    className="_icon"
                    alt={t(hasId ? 'transit:networkDesign:ViewJob' : 'transit:networkDesign:New')}
                />{' '}
                {t(hasId ? 'transit:networkDesign:ViewJob' : 'transit:networkDesign:New')}
            </h3>

            {currentStep === 0 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfigureNetworkParameters')}</h4>
                    <ConfigureNetworkDesignParametersForm
                        parameters={jobParameters.transitNetworkDesignParameters}
                        onUpdate={onNetworkParametersUpdate}
                        disabled={hasId}
                    />
                </React.Fragment>
            )}

            {currentStep === 1 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfigureAlgorithm')}</h4>
                    <ConfigureAlgorithmParametersForm
                        algorithmConfig={jobParameters.algorithmConfiguration}
                        onUpdate={onAlgorithmParametersUpdate}
                        disabled={hasId}
                    />
                </React.Fragment>
            )}

            {currentStep === 2 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfigureSimulationMethod')}</h4>
                    <ConfigureSimulationMethodForm
                        simulationMethod={jobParameters.simulationMethod}
                        onUpdate={onSimulationMethodUpdate}
                        disabled={hasId}
                    />
                </React.Fragment>
            )}

            {currentStep === 3 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfirmJob')}</h4>
                    <ConfirmNetworkDesignForm parameters={jobParameters as TransitNetworkJobConfigurationType} />
                </React.Fragment>
            )}

            <div className="tr__form-buttons-container">
                <span title={t(hasId ? 'main:Close' : 'main:Cancel')}>
                    <Button
                        key="cancel"
                        color="grey"
                        label={t(hasId ? 'main:Close' : 'main:Cancel')}
                        onClick={props.onJobConfigurationCompleted}
                    />
                </span>
                {currentStep > 0 && (
                    <span title={t('main:Previous')}>
                        <Button key="previous" color="green" label={t('main:Previous')} onClick={decrementStep} />
                    </span>
                )}
                {currentStep < stepCount && !(hasId && currentStep === stepCount - 1) && (
                    <span title={t(currentStep === stepCount - 1 ? 'main:Submit' : 'main:Next')}>
                        <Button
                            disabled={!nextEnabled}
                            key="next"
                            color="green"
                            label={t(currentStep === stepCount - 1 ? 'main:Submit' : 'main:Next')}
                            onClick={incrementStep}
                        />
                    </span>
                )}
            </div>
        </form>
    );
};

export default TransitNetworkDesignForm;
