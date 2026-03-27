/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import Collapsible from 'react-collapsible';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import ListRowButton from '../../parts/Button';
import ButtonList from '../../parts/ButtonList';
import ButtonCell from '../../parts/ButtonCell';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import {
    NodeAccessibilityWeightingExecutor,
    getIntrinsicAccessibilityWeightsDocUrl,
    type NodeAccessibilityWeightingJobListItem,
    type NodeAccessibilityWeightingJobParameters
} from '../../../services/transitNodes/NodeAccessibilityWeightingExecutor';
import { JobsConstants } from 'transition-common/lib/api/jobs';
import NodeAccessibilityWeightingJobForm from './NodeAccessibilityWeightingJobForm';

const TK = 'transit:transitNode.accessibilityWeighting';

const DEFAULT_MAX_WALKING_TIME_SECONDS = 1200;

function getDefaultParameters(): NodeAccessibilityWeightingJobParameters {
    return {
        description: undefined,
        config: {
            weightingInputType: 'poi',
            maxWalkingTimeSeconds: DEFAULT_MAX_WALKING_TIME_SECONDS,
            decayFunctionParameters: { type: 'power', beta: 1.5 }
        }
    };
}

const NodeAccessibilityWeightingSection: React.FunctionComponent = () => {
    const { t, i18n } = useTranslation(['transit', 'main']);

    const [jobs, setJobs] = React.useState<NodeAccessibilityWeightingJobListItem[]>([]);
    const [selectedJobId, setSelectedJobId] = React.useState<number | undefined>(undefined);
    const [jobParameters, setJobParameters] = React.useState<NodeAccessibilityWeightingJobParameters | undefined>(
        undefined
    );
    const [loading, setLoading] = React.useState(false);
    const [listError, setListError] = React.useState<string | undefined>(undefined);
    const [loadingParameters, setLoadingParameters] = React.useState(false);
    const [loadParametersError, setLoadParametersError] = React.useState<string | undefined>(undefined);
    const [deleteJobError, setDeleteJobError] = React.useState<string | undefined>(undefined);
    const [downloadWeightsError, setDownloadWeightsError] = React.useState<string | undefined>(undefined);
    const [duplicateJobError, setDuplicateJobError] = React.useState<string | undefined>(undefined);

    const justCreatedJobIdRef = React.useRef<number | null>(null);

    const refreshList = React.useCallback(async () => {
        setLoading(true);
        setListError(undefined);
        try {
            const { jobs: list } = await NodeAccessibilityWeightingExecutor.listJobs();
            setJobs(list);
            setDeleteJobError(undefined);
            setDownloadWeightsError(undefined);
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
            setJobParameters(undefined);
            setLoadParametersError(undefined);
            setLoadingParameters(false);
            justCreatedJobIdRef.current = null;
            return;
        }
        if (justCreatedJobIdRef.current === selectedJobId) {
            justCreatedJobIdRef.current = null;
            return;
        }
        setLoadingParameters(true);
        setLoadParametersError(undefined);
        NodeAccessibilityWeightingExecutor.getParameters(selectedJobId)
            .then(({ parameters }) => {
                setJobParameters(parameters);
                setLoadParametersError(undefined);
            })
            .catch((err) => {
                console.error('Failed to load node accessibility weighting job parameters', err);
                setJobParameters(undefined);
                setLoadParametersError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                setLoadingParameters(false);
            });
    }, [selectedJobId]);

    const handleCreateNew = React.useCallback(async () => {
        try {
            const defaultParams = getDefaultParameters();
            const { jobId } = await NodeAccessibilityWeightingExecutor.createJob(defaultParams);
            justCreatedJobIdRef.current = jobId;
            setSelectedJobId(jobId);
            setJobParameters(defaultParams);
            await refreshList();
        } catch (err) {
            console.error('Failed to create node accessibility weighting job', err);
        }
    }, [refreshList]);

    const handleCloseForm = React.useCallback(() => {
        setSelectedJobId(undefined);
        setJobParameters(undefined);
        setLoadParametersError(undefined);
    }, []);

    const handleDeleteJob = React.useCallback(
        async (jobId: number) => {
            setDeleteJobError(undefined);
            try {
                await new Promise<void>((resolve, reject) => {
                    serviceLocator.socketEventManager.emit(
                        JobsConstants.DELETE_JOB,
                        jobId,
                        (response: Status.Status<boolean>) => {
                            if (Status.isStatusOk(response)) {
                                resolve();
                            } else {
                                reject(response.error);
                            }
                        }
                    );
                });
                if (selectedJobId === jobId) {
                    setSelectedJobId(undefined);
                    setJobParameters(undefined);
                }
                await refreshList();
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                console.error('Failed to delete node accessibility weighting job', { jobId, err });
                setDeleteJobError(`${t(`${TK}.errors.deleteJobFailed`)}: ${detail}`);
            }
        },
        [selectedJobId, refreshList, t]
    );

    const handleDuplicateJob = React.useCallback(
        async (sourceJobId: number, e?: React.MouseEvent) => {
            e?.stopPropagation();
            setDuplicateJobError(undefined);
            try {
                const { jobId: newId } = await NodeAccessibilityWeightingExecutor.duplicateJob(sourceJobId);
                await refreshList();
                setSelectedJobId(newId);
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                console.error('Failed to duplicate node accessibility weighting job', { sourceJobId, err });
                setDuplicateJobError(`${t(`${TK}.errors.duplicateJobFailed`)}: ${detail}`);
            }
        },
        [refreshList, t]
    );

    const handleDownloadWeights = React.useCallback(
        (jobId: number) => {
            setDownloadWeightsError(undefined);
            serviceLocator.socketEventManager.emit(
                JobsConstants.GET_FILES,
                jobId,
                (status: Status.Status<Record<string, { url: string; downloadName: string }>>) => {
                    if (Status.isStatusOk(status)) {
                        const files = Status.unwrap(status);
                        if (files.output) {
                            const a = document.createElement('a');
                            a.href = files.output.url;
                            a.download = files.output.downloadName;
                            a.click();
                        } else {
                            setDownloadWeightsError(t(`${TK}.errors.downloadWeightsFailed`));
                        }
                    } else {
                        console.error('Download node weights failed', { jobId, status });
                        setDownloadWeightsError(t(`${TK}.errors.downloadWeightsFailed`));
                    }
                }
            );
        },
        [t]
    );

    const trigger = <span className="tr__form-collapsible-trigger">{t(`${TK}.SectionTitle`)}</span>;

    const isFormView = selectedJobId !== undefined;

    const docUrl = getIntrinsicAccessibilityWeightsDocUrl(i18n.language);

    return (
        <Collapsible trigger={trigger} overflowWhenOpen="visible">
            <p className="apptr__form-input-container" style={{ marginBottom: '0.5rem', fontSize: '0.9em' }}>
                <a href={docUrl} target="_blank" rel="noopener noreferrer" title={t(`${TK}.DocumentationLinkTitle`)}>
                    {t(`${TK}.DocumentationLink`)}
                </a>
            </p>
            {listError && (
                <p style={{ color: 'var(--danger)' }}>
                    {t('main:errors:Error')}: {listError}
                </p>
            )}

            {deleteJobError && (
                <p style={{ color: 'var(--danger)' }}>
                    {t('main:errors:Error')}: {deleteJobError}
                </p>
            )}

            {downloadWeightsError && (
                <p style={{ color: 'var(--danger)' }}>
                    {t('main:errors:Error')}: {downloadWeightsError}
                </p>
            )}

            {duplicateJobError && (
                <p style={{ color: 'var(--danger)' }}>
                    {t('main:errors:Error')}: {duplicateJobError}
                </p>
            )}

            {loading && <p>{t('main:Loading')}...</p>}

            {/* Empty state */}
            {!loading && jobs.length === 0 && !isFormView && (
                <p style={{ marginBottom: '0.5rem' }}>{t(`${TK}.NoWeightingsYet`)}</p>
            )}

            {/* Job list */}
            {!loading && jobs.length > 0 && !isFormView && (
                <ButtonList key="accessibility-weighting-jobs">
                    {jobs.map((job) => {
                        const displayName =
                            job.description && job.description.trim() !== '' ? job.description.trim() : `#${job.id}`;
                        return (
                            <ListRowButton
                                key={`accessibility-weighting-job-${job.id}`}
                                isSelected={false}
                                flushActionButtons={false}
                                onSelect={{
                                    handler: () => setSelectedJobId(job.id),
                                    altText: t('main:Edit')
                                }}
                                onDuplicate={{
                                    handler: (e) => {
                                        handleDuplicateJob(job.id, e);
                                    },
                                    altText: t(`${TK}.DuplicateJob`)
                                }}
                                onDelete={{
                                    handler: (e) => {
                                        e?.stopPropagation();
                                        handleDeleteJob(job.id);
                                    },
                                    message: t('transit:jobs:ConfirmDelete'),
                                    altText: t('transit:jobs:Delete')
                                }}
                            >
                                <ButtonCell alignment="left">{displayName}</ButtonCell>
                                {job.hasWeightsFile && (
                                    <ButtonCell
                                        alignment="right"
                                        title={t(`${TK}.DownloadWeights`)}
                                        onClick={(e) => {
                                            e?.stopPropagation();
                                            handleDownloadWeights(job.id);
                                        }}
                                    >
                                        <img
                                            className="_icon-alone"
                                            src="/dist/images/icons/interface/download_cloud_white.svg"
                                            alt={t(`${TK}.DownloadWeights`)}
                                        />
                                    </ButtonCell>
                                )}
                            </ListRowButton>
                        );
                    })}
                </ButtonList>
            )}

            {/* Create new button */}
            {!isFormView && (
                <div className="tr__form-buttons-container">
                    <Button
                        color="blue"
                        icon={faPlus}
                        iconClass="_icon"
                        label={t(`${TK}.CreateNew`)}
                        onClick={handleCreateNew}
                    />
                </div>
            )}

            {/* Loading parameters */}
            {isFormView && loadingParameters && <p style={{ marginTop: '1rem' }}>{t('main:Loading')}...</p>}

            {/* Error loading parameters */}
            {isFormView && !loadingParameters && loadParametersError && (
                <div className="tr__form-section" style={{ marginTop: '1rem' }}>
                    <p style={{ color: 'var(--danger)' }}>
                        {t('main:errors:Error')}: {loadParametersError}
                    </p>
                    <Button color="grey" label={t(`${TK}.Close`)} onClick={handleCloseForm} />
                </div>
            )}

            {/* Job form */}
            {isFormView && !loadingParameters && !loadParametersError && jobParameters !== undefined && (
                <NodeAccessibilityWeightingJobForm
                    key={`job-form-${selectedJobId}`}
                    jobId={selectedJobId}
                    initialParameters={jobParameters}
                    onClose={handleCloseForm}
                    onJobComplete={refreshList}
                />
            )}
        </Collapsible>
    );
};

export default NodeAccessibilityWeightingSection;
