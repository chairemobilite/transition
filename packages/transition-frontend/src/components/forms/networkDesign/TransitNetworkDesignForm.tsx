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
    onJobConfigurationCompleted: () => void;
    /** When config is saved (without running), called with (jobId, parameters) so the panel can update initialValues and keep the form in edit mode. */
    onConfigSaved?: (jobId: number, parameters: FormInitialValues) => void;
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
    const [currentStep, setCurrentStep] = React.useState(0);
    const [nextEnabled, setNextEnabled] = React.useState(false);
    const [saveConfigMessage, setSaveConfigMessage] = React.useState<string | undefined>(undefined);
    const [saveConfigError, setSaveConfigError] = React.useState<string | undefined>(undefined);
    const [isSavingConfig, setIsSavingConfig] = React.useState(false);
    const [jobParameters, setJobParameters] = React.useState<FormInitialValues>({
        transitNetworkDesignParameters: getDefaultOptionsFromDescriptor(
            props.initialValues?.transitNetworkDesignParameters || {},
            transitNetworkDesignDescriptor
        ),
        algorithmConfiguration: props.initialValues?.algorithmConfiguration || {
            type: 'evolutionaryAlgorithm',
            config: {}
        },
        simulationMethod: props.initialValues?.simulationMethod || { type: 'OdTripSimulation', config: {} },
        jobId: props.initialValues?.jobId,
        existingFileNames: props.initialValues?.existingFileNames,
        description: props.initialValues?.description
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

    const incrementStep = async () => {
        if (currentStep === stepCount - 1) {
            try {
                const existingJobId = jobParameters.jobId ?? props.initialValues?.jobId;
                await NetworkDesignFrontendExecutor.execute(
                    jobParameters as TransitNetworkJobConfigurationType,
                    typeof existingJobId === 'number' && existingJobId > 0 ? existingJobId : undefined
                );
            } catch (error) {
                console.error('Error executing job', error);
            }
            props.onJobConfigurationCompleted();
            return;
        }
        setCurrentStep(currentStep + 1);
    };

    const decrementStep = () => {
        setCurrentStep(currentStep - 1);
        setNextEnabled(true);
    };

    const onSaveConfig = async () => {
        setSaveConfigError(undefined);
        setSaveConfigMessage(undefined);
        setIsSavingConfig(true);
        try {
            const existingJobId = jobParameters.jobId ?? props.initialValues?.jobId;
            const savedJobId = await NetworkDesignFrontendExecutor.saveConfig(
                jobParameters as TransitNetworkJobConfigurationType,
                typeof existingJobId === 'number' && existingJobId > 0 ? existingJobId : undefined
            );
            setSaveConfigMessage(t('transit:networkDesign:ConfigSaved'));

            // Reload parameters from the server so file references point to the
            // job (location:'job') instead of the transient upload. This ensures
            // the demand CSV and mapping survive step navigation / remounts.
            try {
                const { parameters: reloaded, existingFileNames } =
                    await NetworkDesignFrontendExecutor.getCalculationParametersForJob(savedJobId);
                const updatedParams: FormInitialValues = {
                    ...reloaded,
                    jobId: savedJobId,
                    existingFileNames
                };
                setJobParameters(updatedParams);
                props.onConfigSaved?.(savedJobId, updatedParams);
            } catch {
                // Fallback: just update jobId without reloading
                const fallback = { ...jobParameters, jobId: savedJobId };
                setJobParameters(fallback);
                props.onConfigSaved?.(savedJobId, fallback);
            }
        } catch (err: unknown) {
            setSaveConfigError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsSavingConfig(false);
        }
    };

    return (
        <form id={'tr__form-transit-network-design-new'} className="apptr__form">
            <h3>
                <img
                    src={'/dist/images/icons/interface/simulation_white.svg'}
                    className="_icon"
                    alt={t('transit:networkDesign:New')}
                />{' '}
                {t('transit:networkDesign:New')}
            </h3>

            <div className="tr__form-input-container" style={{ marginBottom: '1rem' }}>
                <label className="label" htmlFor="tr__form-network-design-job-name">
                    {t('transit:networkDesign:JobName')}
                </label>
                <input
                    id="tr__form-network-design-job-name"
                    type="text"
                    className="apptr__input _input"
                    value={jobParameters.description ?? ''}
                    onChange={(e) =>
                        setJobParameters((prev) => ({ ...prev, description: e.target.value.trim() || undefined }))
                    }
                    placeholder={t('transit:networkDesign:JobNamePlaceholder')}
                />
            </div>

            {currentStep === 0 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfigureNetworkParameters')}</h4>
                    <ConfigureNetworkDesignParametersForm
                        parameters={jobParameters.transitNetworkDesignParameters}
                        onUpdate={onNetworkParametersUpdate}
                    />
                </React.Fragment>
            )}

            {currentStep === 1 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfigureAlgorithm')}</h4>
                    <ConfigureAlgorithmParametersForm
                        algorithmConfig={jobParameters.algorithmConfiguration}
                        onUpdate={onAlgorithmParametersUpdate}
                    />
                </React.Fragment>
            )}

            {currentStep === 2 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfigureSimulationMethod')}</h4>
                    <ConfigureSimulationMethodForm
                        simulationMethod={jobParameters.simulationMethod}
                        onUpdate={onSimulationMethodUpdate}
                        jobId={props.initialValues?.jobId ?? jobParameters.jobId}
                        existingFileNames={jobParameters.existingFileNames}
                    />
                </React.Fragment>
            )}

            {currentStep === 3 && (
                <React.Fragment>
                    <h4>{t('transit:networkDesign:ConfirmJob')}</h4>
                    <ConfirmNetworkDesignForm parameters={jobParameters as TransitNetworkJobConfigurationType} />
                </React.Fragment>
            )}

            {(saveConfigMessage ?? saveConfigError) && (
                <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    {saveConfigMessage && <span style={{ color: 'var(--success)' }}>{saveConfigMessage}</span>}
                    {saveConfigError && <span style={{ color: 'var(--danger)' }}>{saveConfigError}</span>}
                </div>
            )}
            <div className="tr__form-buttons-container">
                <span title={t('transit:networkDesign:SaveConfig')}>
                    <Button
                        key="saveConfig"
                        color="blue"
                        label={t('transit:networkDesign:SaveConfig')}
                        onClick={onSaveConfig}
                        disabled={isSavingConfig}
                    />
                </span>
                <span title={t('main:Close')}>
                    <Button
                        key="close"
                        color="grey"
                        label={t('main:Close')}
                        onClick={props.onJobConfigurationCompleted}
                    />
                </span>
                {currentStep > 0 && (
                    <span title={t('main:Previous')}>
                        <Button key="previous" color="green" label={t('main:Previous')} onClick={decrementStep} />
                    </span>
                )}
                {currentStep < stepCount && (
                    <span title={t('main:Next')}>
                        <Button
                            disabled={!nextEnabled}
                            key="next"
                            color="green"
                            label={t(`main:${currentStep === stepCount - 1 ? 'Submit' : 'Next'}`)}
                            onClick={incrementStep}
                        />
                    </span>
                )}
            </div>
        </form>
    );
};

export default TransitNetworkDesignForm;
