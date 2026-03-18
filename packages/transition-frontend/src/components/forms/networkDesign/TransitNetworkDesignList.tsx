/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faSync } from '@fortawesome/free-solid-svg-icons/faSync';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { JobsConstants } from 'transition-common/lib/api/jobs';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { LoadingPage } from 'chaire-lib-frontend/lib/components/pages';

import ButtonList from '../../parts/ButtonList';
import TransitNetworkDesignJobButton from './TransitNetworkDesignJobButton';
import NetworkDesignFrontendExecutor from '../../../services/networkDesign/NetworkDesignFrontendExecutor';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import type { ReturnedJobAttributes } from '../../parts/executableJob/ExecutableJobList';
import { TransitApi } from 'transition-common/lib/api/transit';
import { FormInitialValues } from './types';

const JOB_TYPE = 'evolutionaryTransitNetworkDesign';
const PAGE_SIZE = 50;

const fetchJobs = (): Promise<Status.Status<{ jobs: ReturnedJobAttributes[]; totalCount: number }>> =>
    new Promise((resolve) => {
        serviceLocator.socketEventManager.emit(
            JobsConstants.LIST_JOBS,
            { jobType: JOB_TYPE, pageSize: PAGE_SIZE, pageIndex: 0 },
            (response: Status.Status<{ jobs: ReturnedJobAttributes[]; totalCount: number }>) => {
                resolve(response);
            }
        );
    });

const updateJobStatusOnServer = (id: number, socketRoute: string): Promise<Status.Status<boolean>> =>
    new Promise((resolve) => {
        serviceLocator.socketEventManager.emit(socketRoute, id, (response: Status.Status<boolean>) => {
            resolve(response);
        });
    });

interface TransitNetworkDesignListProps {
    onNewJob: (parameters?: FormInitialValues, jobId?: number) => void;
}

const TransitNetworkDesignList: React.FunctionComponent<TransitNetworkDesignListProps> = (props) => {
    const { t } = useTranslation('transit');
    const [jobs, setJobs] = React.useState<ReturnedJobAttributes[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [errors, setErrors] = React.useState<TranslatableMessage[]>([]);
    const [expandedJobIds, setExpandedJobIds] = React.useState<number[]>([]);

    const loadJobs = React.useCallback(async () => {
        setLoading(true);
        try {
            const status = await fetchJobs();
            if (Status.isStatusOk(status)) {
                const { jobs: list } = Status.unwrap(status);
                setJobs(list);
                setErrors([]);
            } else {
                setJobs([]);
                setErrors(['transit:networkDesign:errors:ErrorLoadingJobs']);
            }
        } catch (error) {
            setJobs([]);
            setErrors(['transit:networkDesign:errors:ErrorLoadingJobs']);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        loadJobs();
        const onJobUpdated = () => {
            loadJobs();
        };
        serviceLocator.socketEventManager.on('executableJob.updated', onJobUpdated);
        return () => {
            serviceLocator.socketEventManager.off('executableJob.updated', onJobUpdated);
        };
    }, [loadJobs]);

    const onEdit = async (jobId: number) => {
        try {
            setErrors([]);
            const { parameters, existingFileNames } =
                await NetworkDesignFrontendExecutor.getCalculationParametersForJob(jobId);
            props.onNewJob({ ...parameters, jobId, existingFileNames, description: parameters.description }, jobId);
        } catch (error) {
            setErrors([
                TrError.isTrError(error)
                    ? error.export().localizedMessage
                    : 'transit:networkDesign:errors:ErrorGettingReplayParameters'
            ]);
        }
    };

    const onClone = async (jobId: number) => {
        try {
            setErrors([]);
            const { parameters, existingFileNames } =
                await NetworkDesignFrontendExecutor.getCalculationParametersForJob(jobId);
            props.onNewJob({
                ...parameters,
                existingFileNames,
                description: parameters.description ? `${parameters.description} (${t('main:Copy')})` : undefined
            });
        } catch (error) {
            setErrors([
                TrError.isTrError(error)
                    ? error.export().localizedMessage
                    : 'transit:networkDesign:errors:ErrorGettingReplayParameters'
            ]);
        }
    };

    const onDelete = async (jobId: number) => {
        try {
            const status = await updateJobStatusOnServer(jobId, JobsConstants.DELETE_JOB);
            Status.unwrap(status);
            await loadJobs();
        } catch (error) {
            setErrors(['transit:networkDesign:errors:ErrorDeletingJob']);
        }
    };

    const onPause = async (jobId: number) => {
        try {
            const status = await updateJobStatusOnServer(jobId, JobsConstants.PAUSE_JOB);
            Status.unwrap(status);
            await loadJobs();
        } catch (error) {
            setErrors(['transit:networkDesign:errors:ErrorUpdatingJob']);
        }
    };

    const onResume = async (jobId: number) => {
        try {
            const status = await updateJobStatusOnServer(jobId, JobsConstants.RESUME_JOB);
            Status.unwrap(status);
            await loadJobs();
        } catch (error) {
            setErrors(['transit:networkDesign:errors:ErrorUpdatingJob']);
        }
    };

    const onCancel = async (jobId: number) => {
        try {
            const status = await updateJobStatusOnServer(jobId, JobsConstants.CANCEL_JOB);
            Status.unwrap(status);
            await loadJobs();
        } catch (error) {
            setErrors(['transit:networkDesign:errors:ErrorUpdatingJob']);
        }
    };

    const onContinue = async (jobId: number, additionalGenerations: number) => {
        try {
            setErrors([]);
            const status = await new Promise<Status.Status<boolean>>((resolve) => {
                serviceLocator.socketEventManager.emit(
                    TransitApi.TRANSIT_NETWORK_DESIGN_CONTINUE,
                    { jobId, additionalGenerations },
                    (response: Status.Status<boolean>) => resolve(response)
                );
            });
            Status.unwrap(status);
            await loadJobs();
        } catch (error) {
            setErrors(['transit:networkDesign:errors:ErrorUpdatingJob']);
        }
    };

    const onJobExpanded = (jobId: number) => {
        setExpandedJobIds((prev) => (prev.includes(jobId) ? prev : [...prev, jobId]));
    };

    const onJobCollapsed = (jobId: number) => {
        setExpandedJobIds((prev) => prev.filter((id) => id !== jobId));
    };

    if (loading) {
        return (
            <div className="tr__list-simulations-container">
                <h3>
                    <img
                        src={'/dist/images/icons/interface/simulation_white.svg'}
                        className="_icon"
                        alt={t('transit:networkDesign:List')}
                    />{' '}
                    {t('transit:networkDesign:List')}
                </h3>
                <LoadingPage />
            </div>
        );
    }

    return (
        <div className="tr__list-simulations-container">
            <h3>
                <img
                    src={'/dist/images/icons/interface/simulation_white.svg'}
                    className="_icon"
                    alt={t('transit:networkDesign:List')}
                />{' '}
                {t('transit:networkDesign:List')}
            </h3>
            <div className="tr__form-buttons-container">
                <Button
                    color="blue"
                    icon={faPlus}
                    iconClass="_icon"
                    label={t('transit:networkDesign:New')}
                    onClick={() => props.onNewJob()}
                />
                <Button color="grey" icon={faSync} iconClass="_icon" label={t('main:Refresh')} onClick={loadJobs} />
            </div>
            {errors.length > 0 && <FormErrors errors={errors} />}
            <ButtonList>
                {jobs.map((job) => (
                    <TransitNetworkDesignJobButton
                        key={job.id}
                        job={job}
                        isExpanded={expandedJobIds.includes(job.id)}
                        onExpanded={onJobExpanded}
                        onCollapsed={onJobCollapsed}
                        onEdit={onEdit}
                        onClone={onClone}
                        onDelete={onDelete}
                        onPause={onPause}
                        onResume={onResume}
                        onCancel={onCancel}
                        onContinue={onContinue}
                    />
                ))}
            </ButtonList>
        </div>
    );
};

export default TransitNetworkDesignList;
