/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import _cloneDeep from 'lodash/cloneDeep';
import _isEqual from 'lodash/isEqual';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { ConfirmModal } from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';
import {
    transitNetworkDesignDescriptor,
    TransitNetworkDesignParameters
} from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { getSimulationMethodDescriptor } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
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

const PREF_KEY = 'transit.networkDesign.savedConfig';

const stepCount = 4;

/** Remove csvFile options from simulation method config before saving to preferences */
const stripCsvFields = (params: FormInitialValues): FormInitialValues => {
    const result = _cloneDeep(params);
    if (result.simulationMethod?.type && result.simulationMethod?.config) {
        try {
            const descriptor = getSimulationMethodDescriptor(result.simulationMethod.type);
            const options = descriptor.getOptions();
            const config = result.simulationMethod.config as Record<string, unknown>;
            for (const key of Object.keys(options)) {
                if (options[key].type === 'csvFile') {
                    delete config[key];
                }
            }
        } catch {
            // Unknown simulation method type
        }
    }
    return result;
};

/** Extract csvFile fields from current simulation method config so they survive a config load */
const extractCsvFields = (simMethod: PartialSimulationMethodConfiguration): Record<string, unknown> => {
    const csvFields: Record<string, unknown> = {};
    if (simMethod?.type && simMethod?.config) {
        try {
            const descriptor = getSimulationMethodDescriptor(simMethod.type);
            const options = descriptor.getOptions();
            const config = simMethod.config as Record<string, unknown>;
            for (const key of Object.keys(options)) {
                if (options[key].type === 'csvFile' && config[key] !== undefined) {
                    csvFields[key] = config[key];
                }
            }
        } catch {
            // Unknown simulation method type
        }
    }
    return csvFields;
};

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

    // Incremented when loading saved config to force step form remount (re-initializes internal widget state)
    const [configVersion, setConfigVersion] = React.useState(0);

    const [savedConfig, setSavedConfig] = React.useState<FormInitialValues | undefined>(
        () => Preferences.get(PREF_KEY) as FormInitialValues | undefined
    );
    const [showConflictModal, setShowConflictModal] = React.useState(false);

    // Capture the initial form values (after OptionsEditComponent useEffects settle) for conflict detection
    const initialFormValues = React.useRef<FormInitialValues | null>(null);
    React.useEffect(() => {
        if (initialFormValues.current === null) {
            initialFormValues.current = stripCsvFields(_cloneDeep(jobParameters));
        }
    }, [jobParameters]);

    const saveConfig = async () => {
        try {
            const cleaned = stripCsvFields(jobParameters);
            await Preferences.update({ [PREF_KEY]: cleaned }, serviceLocator.socketEventManager);
            setSavedConfig(cleaned);
            serviceLocator.eventManager.emit('progress', {
                name: 'SaveNetworkDesignConfig',
                progress: 1.0,
                customText: t('notifications:SaveNetworkDesignConfigSuccess')
            });
        } catch (error) {
            console.error('Error saving network design config', error);
            serviceLocator.eventManager.emit('error', {
                name: 'SaveNetworkDesignConfig',
                error: 'SaveNetworkDesignConfigError'
            });
        }
    };

    const loadConfig = () => {
        if (!savedConfig) return;
        const currentStripped = stripCsvFields(jobParameters);

        if (_isEqual(currentStripped, savedConfig)) return;

        if (!initialFormValues.current || _isEqual(currentStripped, initialFormValues.current)) {
            applyConfig('replaceAll');
            return;
        }

        setShowConflictModal(true);
    };

    const applyConfig = (mode: 'replaceAll' | 'fillNonConflicting') => {
        if (!savedConfig) return;

        setJobParameters((prev) => {
            const csvFields = extractCsvFields(prev.simulationMethod);

            if (mode === 'replaceAll') {
                return {
                    transitNetworkDesignParameters: _cloneDeep(savedConfig.transitNetworkDesignParameters),
                    algorithmConfiguration: _cloneDeep(savedConfig.algorithmConfiguration),
                    simulationMethod: {
                        ..._cloneDeep(savedConfig.simulationMethod),
                        config: { ..._cloneDeep(savedConfig.simulationMethod.config), ...csvFields }
                    }
                };
            }

            // fillNonConflicting: only overwrite sections the user hasn't touched
            const prevStripped = stripCsvFields(prev);
            const initial = initialFormValues.current!;
            return {
                transitNetworkDesignParameters: _isEqual(
                    prevStripped.transitNetworkDesignParameters,
                    initial.transitNetworkDesignParameters
                )
                    ? _cloneDeep(savedConfig.transitNetworkDesignParameters)
                    : prev.transitNetworkDesignParameters,
                algorithmConfiguration: _isEqual(prevStripped.algorithmConfiguration, initial.algorithmConfiguration)
                    ? _cloneDeep(savedConfig.algorithmConfiguration)
                    : prev.algorithmConfiguration,
                simulationMethod: _isEqual(prevStripped.simulationMethod, initial.simulationMethod)
                    ? {
                        ..._cloneDeep(savedConfig.simulationMethod),
                        config: { ..._cloneDeep(savedConfig.simulationMethod.config), ...csvFields }
                    }
                    : prev.simulationMethod
            };
        });

        setConfigVersion((v) => v + 1);
        serviceLocator.eventManager.emit('progress', {
            name: 'LoadNetworkDesignConfig',
            progress: 1.0,
            customText: t('notifications:LoadNetworkDesignConfigSuccess')
        });
        setShowConflictModal(false);
    };

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
                <React.Fragment key={`step0-v${configVersion}`}>
                    <h4>{t('transit:networkDesign:ConfigureNetworkParameters')}</h4>
                    <ConfigureNetworkDesignParametersForm
                        parameters={jobParameters.transitNetworkDesignParameters}
                        onUpdate={onNetworkParametersUpdate}
                        disabled={hasId}
                    />
                </React.Fragment>
            )}

            {currentStep === 1 && (
                <React.Fragment key={`step1-v${configVersion}`}>
                    <h4>{t('transit:networkDesign:ConfigureAlgorithm')}</h4>
                    <ConfigureAlgorithmParametersForm
                        algorithmConfig={jobParameters.algorithmConfiguration}
                        onUpdate={onAlgorithmParametersUpdate}
                        disabled={hasId}
                    />
                </React.Fragment>
            )}

            {currentStep === 2 && (
                <React.Fragment key={`step2-v${configVersion}`}>
                    <h4>{t('transit:networkDesign:ConfigureSimulationMethod')}</h4>
                    <ConfigureSimulationMethodForm
                        simulationMethod={jobParameters.simulationMethod}
                        onUpdate={onSimulationMethodUpdate}
                        disabled={hasId}
                    />
                </React.Fragment>
            )}

            {currentStep === 3 && (
                <React.Fragment key={`step3-v${configVersion}`}>
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
                <span title={t('transit:networkDesign:SaveConfig')}>
                    <Button
                        key="saveConfig"
                        color="grey"
                        label={t('transit:networkDesign:SaveConfig')}
                        onClick={saveConfig}
                    />
                </span>
                {!hasId && savedConfig && (
                    <span title={t('transit:networkDesign:LoadConfig')}>
                        <Button
                            key="loadConfig"
                            color="grey"
                            label={t('transit:networkDesign:LoadConfig')}
                            onClick={loadConfig}
                        />
                    </span>
                )}
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

            <ConfirmModal
                isOpen={showConflictModal}
                title={t('transit:networkDesign:LoadConfigConflictTitle')}
                text={t('transit:networkDesign:LoadConfigConflictMessage')}
                closeModal={() => setShowConflictModal(false)}
                buttons={{
                    replaceAll: {
                        label: t('transit:networkDesign:LoadConfigReplaceAll'),
                        color: 'blue',
                        action: () => applyConfig('replaceAll')
                    },
                    fillNonConflicting: {
                        label: t('transit:networkDesign:LoadConfigFillNonConflicting'),
                        color: 'green',
                        action: () => applyConfig('fillNonConflicting')
                    },
                    cancel: {
                        label: t('main:Cancel'),
                        color: 'grey',
                        action: () => setShowConflictModal(false)
                    }
                }}
            />
        </form>
    );
};

export default TransitNetworkDesignForm;
