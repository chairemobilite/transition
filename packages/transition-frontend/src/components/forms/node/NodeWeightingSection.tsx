/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import Collapsible from 'react-collapsible';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import ListRowButton from '../../parts/Button';
import ButtonList from '../../parts/ButtonList';
import ButtonCell from '../../parts/ButtonCell';
import OptionsEditComponent from '../networkDesign/widgets/OptionsDescriptorWidgets';
import { standaloneNodeWeightingOptionsDescriptor } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import {
    NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS,
    NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';
import {
    weightingInputTypeFromConfig,
    applyWeightingInputTypeToConfig
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';
import type {
    NodeWeightingConfig,
    NodeWeightingPoiFileAttributes
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';
import NodeWeightingConfigSection from '../networkDesign/stepForms/NodeWeightingConfigSection';
import {
    NodeWeightingFrontendExecutor,
    type NodeWeightingJobParameters,
    type NodeWeightingJobListItem
} from '../../../services/networkDesign/NodeWeightingFrontendExecutor';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { JobsConstants } from 'transition-common/lib/api/jobs';

/** Default config for a new node weighting job (no file yet). */
function getDefaultNodeWeightingConfig(): NodeWeightingConfig {
    return {
        weightingEnabled: true,
        odWeightingPoints: 'both',
        maxWalkingTimeSeconds: NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS,
        decayFunctionParameters: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS,
        weightingFileAttributes: undefined
    };
}

function getDefaultParameters(): NodeWeightingJobParameters {
    return {
        description: undefined,
        nodeWeighting: getDefaultNodeWeightingConfig()
    };
}

const NodeWeightingSection: React.FunctionComponent = () => {
    const { t } = useTranslation(['transit', 'main']);
    const [jobs, setJobs] = React.useState<NodeWeightingJobListItem[]>([]);
    const [selectedJobId, setSelectedJobId] = React.useState<number | undefined>(undefined);
    const [parameters, setParameters] = React.useState<NodeWeightingJobParameters | undefined>(undefined);
    const [existingFileNames, setExistingFileNames] = React.useState<Record<string, string> | undefined>(undefined);
    const [loading, setLoading] = React.useState(false);
    const [listError, setListError] = React.useState<string | undefined>(undefined);
    const [loadingParameters, setLoadingParameters] = React.useState(false);
    const [loadParametersError, setLoadParametersError] = React.useState<string | undefined>(undefined);
    const [showMappingErrors, setShowMappingErrors] = React.useState(false);
    const justCreatedJobIdRef = React.useRef<number | null>(null);

    const refreshList = React.useCallback(async () => {
        setLoading(true);
        setListError(undefined);
        try {
            const { jobs: list } = await NodeWeightingFrontendExecutor.listJobs();
            setJobs(list);
        } catch (err) {
            setListError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        refreshList();
    }, [refreshList]);

    React.useEffect(() => {
        if (selectedJobId === undefined) {
            setParameters(undefined);
            setExistingFileNames(undefined);
            setLoadParametersError(undefined);
            setLoadingParameters(false);
            setShowMappingErrors(false);
            justCreatedJobIdRef.current = null;
            return;
        }
        setShowMappingErrors(false);
        if (justCreatedJobIdRef.current === selectedJobId) {
            justCreatedJobIdRef.current = null;
            return;
        }
        setLoadingParameters(true);
        setLoadParametersError(undefined);
        NodeWeightingFrontendExecutor.getParameters(selectedJobId)
            .then(({ parameters: params, existingFileNames: files }) => {
                setParameters(params);
                setExistingFileNames(files);
                setLoadParametersError(undefined);
            })
            .catch((err) => {
                console.error('Failed to load node weighting job parameters', err);
                setParameters(undefined);
                setExistingFileNames(undefined);
                setLoadParametersError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                setLoadingParameters(false);
            });
    }, [selectedJobId]);

    const onCreateNew = React.useCallback(async () => {
        try {
            const defaultParams = getDefaultParameters();
            const { jobId } = await NodeWeightingFrontendExecutor.createJob(defaultParams);
            justCreatedJobIdRef.current = jobId;
            setSelectedJobId(jobId);
            setParameters(defaultParams);
            setExistingFileNames(undefined);
            await refreshList();
        } catch (err) {
            console.error('Failed to create node weighting job', err);
        }
    }, [refreshList]);

    const onSaveConfig = React.useCallback(async () => {
        if (parameters === undefined || selectedJobId === undefined) {
            return;
        }
        setShowMappingErrors(true);
        try {
            const toSave = {
                ...parameters,
                description:
                    typeof parameters.description === 'string' && parameters.description.trim() !== ''
                        ? parameters.description.trim()
                        : undefined
            };
            await NodeWeightingFrontendExecutor.saveConfig(toSave, selectedJobId);
            setParameters(toSave);
            await refreshList();
        } catch (err) {
            console.error('Failed to save node weighting config', err);
        }
    }, [parameters, selectedJobId, refreshList]);

    const onCloseForm = React.useCallback(() => {
        setSelectedJobId(undefined);
        setParameters(undefined);
        setExistingFileNames(undefined);
        setLoadParametersError(undefined);
    }, []);

    const onNodeWeightingUpdate = React.useCallback((nodeWeighting: NodeWeightingConfig, _isValid: boolean) => {
        setParameters((prev) => (prev ? { ...prev, nodeWeighting } : { description: undefined, nodeWeighting }));
    }, []);

    const onDescriptionUpdated = React.useCallback((payload: { value: unknown; valid: boolean }) => {
        const value = typeof payload.value === 'string' ? payload.value : undefined;
        setParameters((prev) => (prev ? { ...prev, description: value === '' ? undefined : value } : undefined));
    }, []);

    const deleteJobOnServer = React.useCallback((jobId: number): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                JobsConstants.DELETE_JOB,
                jobId,
                (response: Status.Status<boolean>) => {
                    if (Status.isStatusOk(response)) {
                        resolve(Status.unwrap(response));
                    } else {
                        reject(response.error);
                    }
                }
            );
        });
    }, []);

    const onDeleteJob = React.useCallback(
        async (jobId: number) => {
            try {
                await deleteJobOnServer(jobId);
                if (selectedJobId === jobId) {
                    setSelectedJobId(undefined);
                    setParameters(undefined);
                    setExistingFileNames(undefined);
                }
                await refreshList();
            } catch (err) {
                console.error('Failed to delete node weighting job', err);
            }
        },
        [deleteJobOnServer, selectedJobId, refreshList]
    );

    const trigger = (
        <span className="tr__form-collapsible-trigger">
            {t('transit:networkDesign.nodeWeighting.NodeWeightingSectionTitle')}
        </span>
    );

    return (
        <Collapsible trigger={trigger} overflowWhenOpen="visible">
            {listError && (
                <p style={{ color: 'var(--danger)' }}>
                    {t('transit:main:errors:Error')}: {listError}
                </p>
            )}
            {loading && <p>{t('main:Loading')}...</p>}
            {!loading && jobs.length === 0 && selectedJobId === undefined && (
                <p style={{ marginBottom: '0.5rem' }}>{t('transit:networkDesign.nodeWeighting.NoNodeWeightingsYet')}</p>
            )}
            {!loading && jobs.length > 0 && selectedJobId === undefined && (
                <ButtonList key="node-weighting-jobs">
                    {jobs.map((job) => {
                        const displayName =
                            job.description && job.description.trim() !== '' ? job.description.trim() : `#${job.id}`;
                        return (
                            <ListRowButton
                                key={`node-weighting-job-${job.id}`}
                                isSelected={selectedJobId === job.id}
                                flushActionButtons={false}
                                onSelect={{
                                    handler: () => setSelectedJobId(job.id),
                                    altText: t('main:Edit')
                                }}
                                onDelete={{
                                    handler: (e) => {
                                        e?.stopPropagation();
                                        onDeleteJob(job.id);
                                    },
                                    message: t('transit:jobs:ConfirmDelete'),
                                    altText: t('transit:jobs:Delete')
                                }}
                            >
                                <ButtonCell alignment="left">{displayName}</ButtonCell>
                                {job.hasWeightsFile && (
                                    <ButtonCell
                                        alignment="right"
                                        title={t('transit:networkDesign.nodeWeighting.DownloadNodeWeights')}
                                        onClick={(e) => {
                                            e?.stopPropagation();
                                            NodeWeightingFrontendExecutor.getNodeWeightsFile(job.id)
                                                .then(({ csv, filename }) => {
                                                    const blob = new Blob([csv], {
                                                        type: 'text/csv;charset=utf-8'
                                                    });
                                                    const url = URL.createObjectURL(blob);
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = filename;
                                                    link.click();
                                                    URL.revokeObjectURL(url);
                                                })
                                                .catch((err) => console.error('Download node weights failed', err));
                                        }}
                                    >
                                        <img
                                            className="_icon-alone"
                                            src="/dist/images/icons/interface/download_cloud_white.svg"
                                            alt={t('transit:networkDesign.nodeWeighting.DownloadNodeWeights')}
                                        />
                                    </ButtonCell>
                                )}
                            </ListRowButton>
                        );
                    })}
                </ButtonList>
            )}
            {selectedJobId === undefined && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faPlus}
                        iconClass="_icon"
                        label={t('transit:networkDesign.nodeWeighting.CreateNewNodeWeighting')}
                        onClick={onCreateNew}
                    />
                </div>
            )}
            {selectedJobId !== undefined && loadingParameters && (
                <p style={{ marginTop: '1rem' }}>{t('main:Loading')}…</p>
            )}
            {selectedJobId !== undefined && !loadingParameters && loadParametersError && (
                <div className="tr__form-section" style={{ marginTop: '1rem' }}>
                    <p style={{ color: 'var(--danger)' }}>
                        {t('transit:main:errors:Error')}: {loadParametersError}
                    </p>
                    <Button color="grey" label={t('transit:networkDesign.nodeWeighting.Close')} onClick={onCloseForm} />
                </div>
            )}
            {selectedJobId !== undefined && !loadingParameters && !loadParametersError && parameters !== undefined && (
                <>
                    <InputWrapper
                        smallInput={true}
                        twoColumns={false}
                        label={t('transit:networkDesign.nodeWeighting.JobName')}
                    >
                        <InputString
                            id="nodeWeightingJobDescription"
                            value={parameters.description ?? ''}
                            onValueUpdated={onDescriptionUpdated}
                        />
                    </InputWrapper>
                    <OptionsEditComponent
                        key={`nodeWeightingOptions-${selectedJobId}`}
                        optionsDescriptor={standaloneNodeWeightingOptionsDescriptor}
                        value={{
                            weightingInputType: weightingInputTypeFromConfig(parameters.nodeWeighting),
                            maxWalkingTimeSeconds: parameters.nodeWeighting.maxWalkingTimeSeconds,
                            decayFunctionParameters: parameters.nodeWeighting.decayFunctionParameters,
                            weightingFileAttributes:
                                parameters.nodeWeighting.weightingFileAttributes ??
                                ({} as NodeWeightingPoiFileAttributes)
                        }}
                        disabled={false}
                        onUpdate={(formValue, isValid) => {
                            const base = applyWeightingInputTypeToConfig(
                                parameters.nodeWeighting,
                                formValue.weightingInputType
                            );
                            const newConfig: NodeWeightingConfig = {
                                ...base,
                                weightingEnabled: true,
                                odWeightingPoints: base.odWeightingPoints,
                                maxWalkingTimeSeconds: formValue.maxWalkingTimeSeconds,
                                decayFunctionParameters: formValue.decayFunctionParameters,
                                weightingFileAttributes: formValue.weightingFileAttributes
                            };
                            onNodeWeightingUpdate(newConfig, isValid);
                        }}
                        existingFileNames={existingFileNames}
                        singleColumnLayout={true}
                        showValidationErrors={showMappingErrors}
                    />
                    <div className="tr__form-buttons-container">
                        <Button
                            color="green"
                            label={t('transit:networkDesign.nodeWeighting.SaveConfig')}
                            onClick={onSaveConfig}
                        />
                        <Button
                            color="grey"
                            label={t('transit:networkDesign.nodeWeighting.Close')}
                            onClick={onCloseForm}
                        />
                    </div>
                    <NodeWeightingConfigSection
                        jobId={selectedJobId}
                        onStartWeightingAttempt={() => setShowMappingErrors(true)}
                        executor={{
                            startNodeWeighting: async (jobId: number) => {
                                if (parameters !== undefined && jobId === selectedJobId) {
                                    await NodeWeightingFrontendExecutor.saveConfig(parameters, jobId);
                                }
                                return NodeWeightingFrontendExecutor.startNodeWeighting(jobId);
                            },
                            cancelNodeWeighting: NodeWeightingFrontendExecutor.cancelNodeWeighting,
                            pauseNodeWeighting: NodeWeightingFrontendExecutor.pauseNodeWeighting,
                            resumeNodeWeighting: NodeWeightingFrontendExecutor.resumeNodeWeighting,
                            getNodeWeightingStatus: NodeWeightingFrontendExecutor.getNodeWeightingStatus,
                            getNodeWeightsFile: NodeWeightingFrontendExecutor.getNodeWeightsFile
                        }}
                        progressEventName={NodeWeightingFrontendExecutor.PROGRESS_EVENT}
                        completeEventName={NodeWeightingFrontendExecutor.COMPLETE_EVENT}
                    />
                </>
            )}
        </Collapsible>
    );
};

export default NodeWeightingSection;
