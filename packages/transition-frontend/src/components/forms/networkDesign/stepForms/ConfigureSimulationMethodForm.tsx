/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import {
    getAllSimulationMethodTypes,
    getSimulationMethodDescriptor,
    getSimulationMethodDescriptorForNetworkDesign
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import OptionsEditComponent from '../widgets/OptionsDescriptorWidgets';
import { PartialSimulationMethodConfiguration } from '../types';
import NetworkDesignFrontendExecutor from '../../../../services/networkDesign/NetworkDesignFrontendExecutor';

const NODE_WEIGHTS_FILENAME = 'node_weights.csv';

/** Minimal shape for OD trip config when reading node weighting flag; used to narrow before access. */
interface OdTripSimulationConfigShape {
    nodeWeighting?: { weightingEnabled?: boolean };
}

function isOdTripSimulationConfig(config: unknown): config is OdTripSimulationConfigShape {
    if (typeof config !== 'object' || config === null) {
        return false;
    }
    const configRecord = config as Record<string, unknown>;
    const nodeWeighting = configRecord.nodeWeighting;
    return nodeWeighting === undefined || (typeof nodeWeighting === 'object' && nodeWeighting !== null);
}

/**
 * Returns true only when simulationMethod is OdTripSimulation and its config has node weighting enabled.
 * Safely narrows/validates config before reading nodeWeighting.weightingEnabled.
 */
export function getNodeWeightingEnabled(simulationMethod: PartialSimulationMethodConfiguration): boolean {
    if (simulationMethod.type !== 'OdTripSimulation') {
        return false;
    }
    const config = simulationMethod.config;
    if (!isOdTripSimulationConfig(config)) {
        return false;
    }
    return config.nodeWeighting?.weightingEnabled === true;
}

export interface ConfigureSimulationMethodFormProps {
    simulationMethod: PartialSimulationMethodConfiguration;
    onUpdate: (simulationMethod: PartialSimulationMethodConfiguration, isValid: boolean) => void;
    /** When set (e.g. when replaying a job), used by parent for post-submit behavior */
    jobId?: number;
    /** When set (e.g. when replaying a job), existing filenames to show next to file inputs */
    existingFileNames?: Record<string, string>;
}

const ConfigureSimulationMethodForm: React.FunctionComponent<ConfigureSimulationMethodFormProps> = (
    props: ConfigureSimulationMethodFormProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    // FIXME Properly handle errors
    const [errors] = React.useState<string[]>([]);
    const [hasWeightsFile, setHasWeightsFile] = React.useState(false);
    const [uploadError, setUploadError] = React.useState<string | undefined>(undefined);
    const [uploadSuccess, setUploadSuccess] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const nodeWeightsFileInputRef = React.useRef<HTMLInputElement>(null);
    const jobId = props.jobId;
    const nodeWeightingEnabled = getNodeWeightingEnabled(props.simulationMethod);

    React.useEffect(() => {
        if (jobId === undefined || !nodeWeightingEnabled) {
            setHasWeightsFile(false);
            return;
        }
        NetworkDesignFrontendExecutor.getNodeWeightingStatus(jobId).then((status) => {
            setHasWeightsFile(status.hasWeightsFile === true);
        });
    }, [jobId, nodeWeightingEnabled]);

    const [selectedFile, setSelectedFile] = React.useState<File | undefined>(undefined);

    const onFileSelected = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setSelectedFile(file ?? undefined);
        setUploadError(undefined);
        setUploadSuccess(false);
    }, []);

    const onConfirmUpload = React.useCallback(() => {
        if (selectedFile === undefined || jobId === undefined) {
            return;
        }
        setUploadError(undefined);
        setUploadSuccess(false);
        setIsUploading(true);
        const reader = new FileReader();
        reader.onload = () => {
            const content = typeof reader.result === 'string' ? reader.result : '';
            NetworkDesignFrontendExecutor.uploadNodeWeights(jobId, content)
                .then(() => {
                    setHasWeightsFile(true);
                    setUploadSuccess(true);
                    setSelectedFile(undefined);
                    if (nodeWeightsFileInputRef.current) {
                        nodeWeightsFileInputRef.current.value = '';
                    }
                })
                .catch((err: unknown) => {
                    setUploadError(err instanceof Error ? err.message : String(err));
                })
                .finally(() => {
                    setIsUploading(false);
                });
        };
        reader.onerror = () => {
            setUploadError(t('transit:networkDesign.nodeWeighting.errors.UploadReadFailed'));
            setIsUploading(false);
        };
        reader.readAsText(selectedFile, 'utf-8');
    }, [selectedFile, jobId, t]);

    const onValueChange = (path: 'type' | 'config', newValue: { value: unknown; valid?: boolean }): void => {
        let updatedMethod = { ...props.simulationMethod };

        if (path === 'type') {
            updatedMethod = {
                type: newValue.value as PartialSimulationMethodConfiguration['type'],
                config: {}
            } as PartialSimulationMethodConfiguration;
        } else if (path === 'config') {
            updatedMethod = {
                ...updatedMethod,
                config: newValue.value as PartialSimulationMethodConfiguration['config']
            };
        }

        props.onUpdate(updatedMethod, newValue.valid !== false);
    };

    const methodTypes = getAllSimulationMethodTypes();
    const methodChoices = methodTypes.map((methodId) => ({
        value: methodId,
        label: t(getSimulationMethodDescriptor(methodId).getTranslatableName())
    }));

    const methodDescriptor =
        props.simulationMethod.type !== undefined
            ? getSimulationMethodDescriptorForNetworkDesign(props.simulationMethod.type)
            : undefined;

    return (
        <div className="tr__form-section">
            <InputWrapper smallInput={true} label={t('transit:networkDesign:SimulationMethod')}>
                <InputSelect
                    id={'formFieldSimulationMethodType'}
                    disabled={false}
                    value={props.simulationMethod.type}
                    choices={methodChoices}
                    onValueChange={(e) => onValueChange('type', { value: e.target.value })}
                />
            </InputWrapper>

            {methodDescriptor && (
                <OptionsEditComponent
                    key={`methodConfigOptions${props.simulationMethod?.type}`}
                    value={props.simulationMethod.config}
                    optionsDescriptor={methodDescriptor}
                    disabled={false}
                    onUpdate={(parameters, isValid) => onValueChange('config', { value: parameters, valid: isValid })}
                    existingFileNames={props.existingFileNames}
                />
            )}

            {jobId !== undefined && nodeWeightingEnabled && (
                <div className="tr__form-section" style={{ marginTop: '1rem' }}>
                    <InputWrapper
                        smallInput={true}
                        label={t('transit:networkDesign.nodeWeighting.NodeWeightsFileForJob')}
                    >
                        <div>
                            <p className="_small-description" style={{ marginBottom: '0.5rem' }}>
                                {t('transit:networkDesign.nodeWeighting.NodeWeightsFileForJobDescription')}
                            </p>
                            <label className="label" htmlFor="nodeWeightsFileUploadNetworkDesign">
                                {t('transit:networkDesign.nodeWeighting.UploadNodeWeightsFile')}
                            </label>
                            {hasWeightsFile && (
                                <span
                                    className="_flex _align-center"
                                    style={{
                                        marginTop: '0.25rem',
                                        fontSize: '0.9em',
                                        color: 'var(--color-secondary)'
                                    }}
                                >
                                    {t('transit:networkDesign.nodeWeighting.ExistingFile')}: {NODE_WEIGHTS_FILENAME}
                                </span>
                            )}
                            <input
                                ref={nodeWeightsFileInputRef}
                                id="nodeWeightsFileUploadNetworkDesign"
                                type="file"
                                accept=".csv,text/csv"
                                disabled={isUploading}
                                onChange={onFileSelected}
                                style={{ display: 'block', marginTop: '0.25rem' }}
                            />
                            {selectedFile !== undefined && (
                                <div className="tr__form-buttons-container" style={{ marginTop: '0.5rem' }}>
                                    <Button
                                        color="blue"
                                        label={
                                            isUploading
                                                ? t('transit:networkDesign.nodeWeighting.UploadingNodeWeightsFile')
                                                : t('transit:networkDesign.nodeWeighting.UploadFile')
                                        }
                                        onClick={onConfirmUpload}
                                        disabled={isUploading}
                                    />
                                </div>
                            )}
                            {uploadSuccess && !isUploading && (
                                <span
                                    className="_flex _align-center"
                                    style={{ marginTop: '0.25rem', color: 'var(--color-success, green)' }}
                                >
                                    {t('transit:networkDesign.nodeWeighting.UploadNodeWeightsSuccess')}
                                </span>
                            )}
                            {uploadError && (
                                <span
                                    className="_flex _align-center"
                                    style={{ marginTop: '0.25rem', color: 'var(--danger)' }}
                                >
                                    {uploadError}
                                </span>
                            )}
                        </div>
                    </InputWrapper>
                </div>
            )}

            {errors.length > 0 && <FormErrors errors={errors} />}
        </div>
    );
};

export default ConfigureSimulationMethodForm;
