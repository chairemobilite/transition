/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { faPlus } from '@fortawesome/free-solid-svg-icons/faPlus';
import { faMinus } from '@fortawesome/free-solid-svg-icons/faMinus';
import { faStopCircle } from '@fortawesome/free-solid-svg-icons/faStopCircle';
import { faPauseCircle } from '@fortawesome/free-solid-svg-icons/faPauseCircle';
import { faPlayCircle } from '@fortawesome/free-solid-svg-icons/faPlayCircle';
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons/faSyncAlt';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from 'chaire-lib-frontend/lib/components/input/Button';
import { ConfirmModal } from 'chaire-lib-frontend/lib/components/modal/ConfirmModal';

import ButtonList from '../../parts/ButtonList';
import ButtonCell, { ButtonCellWithConfirm } from '../../parts/ButtonCell';
import ExpandableFiles from '../../parts/executableJob/ExpandableFileWidget';
import ExpandableMessages from '../../parts/executableJob/ExpandableMessages';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { JobsConstants } from 'transition-common/lib/api/jobs';
import { ReturnedJobAttributes } from '../../parts/executableJob/ExecutableJobList';
import { TransitNetworkDesignParameters } from 'transition-common/lib/services/networkDesign/transit/TransitNetworkDesignParameters';
import { AlgorithmConfiguration } from 'transition-common/lib/services/networkDesign/transit/algorithm';
import { SimulationMethodConfiguration } from 'transition-common/lib/services/networkDesign/transit/simulationMethod';
import NetworkDesignFrontendExecutor from '../../../services/networkDesign/NetworkDesignFrontendExecutor';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';

const JOB_TYPE = 'evolutionaryTransitNetworkDesign';

/** Mirrors backend ResultSerialization shape for the fields we display */
type GenerationRow = {
    lines: {
        [lineId: string]: {
            shortname: string;
            nbVehicles: number;
            timeBetweenPassages: number;
        };
    };
    numberOfLines: number;
    numberOfVehicles: number;
    result: {
        totalFitness: number;
        results: { [method: string]: { fitness: number; results: unknown } };
    };
};

/** Get the first method's raw fitness (e.g. usersHourlyCost) */
const getMethodFitness = (gen: GenerationRow): number | undefined => {
    const methodEntries = Object.values(gen.result.results);
    if (methodEntries.length === 0) return undefined;
    return methodEntries[0].fitness;
};

const getNormalizedFitness = (gen: GenerationRow): number | undefined => {
    const methodEntries = Object.values(gen.result.results);
    if (methodEntries.length === 0) return undefined;
    const stats = methodEntries[0].results as { totalCount?: number } | undefined;
    const totalCount = stats?.totalCount;
    if (typeof totalCount === 'number' && totalCount > 0) {
        return methodEntries[0].fitness / totalCount;
    }
    return undefined;
};

const GenerationsTable: React.FC<{
    generations: GenerationRow[] | undefined;
    t: (key: string) => string;
}> = ({ generations, t }) => {
    const [selectedGenIndex, setSelectedGenIndex] = React.useState<number | null>(null);

    if (!generations || generations.length === 0) return null;

    const selectedGen = selectedGenIndex !== null ? generations[selectedGenIndex] : null;
    const linesArray = selectedGen
        ? Object.entries(selectedGen.lines)
            .map(([lineId, line]) => ({
                lineId,
                shortname: line.shortname,
                nbVehicles: line.nbVehicles,
                cycleTimeMinutes: (line.nbVehicles * line.timeBetweenPassages) / 60,
                headwayMinutes: line.timeBetweenPassages / 60
            }))
            .sort((a, b) => a.shortname.localeCompare(b.shortname, undefined, { numeric: true }))
        : [];

    return (
        <div style={{ marginTop: '0.5rem' }}>
            <strong>{t('transit:networkDesign:Generations')}</strong>
            <table className="apptr__table" style={{ width: '100%', marginTop: '0.25rem' }}>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>{t('transit:networkDesign:TotalFitness')}</th>
                        <th>{t('transit:networkDesign:NormalizedFitness')}</th>
                        <th>{t('transit:networkDesign:NumberOfLines')}</th>
                        <th>{t('transit:networkDesign:NumberOfVehicles')}</th>
                    </tr>
                </thead>
                <tbody>
                    {generations.map((gen, index) => {
                        const methodFitness = getMethodFitness(gen);
                        const normalizedFitness = getNormalizedFitness(gen);
                        return (
                            <tr
                                key={index}
                                onClick={() => setSelectedGenIndex(index)}
                                style={{ cursor: 'pointer' }}
                                className="_hoverable"
                            >
                                <td>{index + 1}</td>
                                <td>{methodFitness !== undefined ? methodFitness.toFixed(2) : '-'}</td>
                                <td>{normalizedFitness !== undefined ? normalizedFitness.toFixed(4) : '-'}</td>
                                <td>{gen.numberOfLines}</td>
                                <td>{gen.numberOfVehicles}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <ConfirmModal
                isOpen={selectedGenIndex !== null}
                closeModal={() => setSelectedGenIndex(null)}
                title={`${t('transit:networkDesign:GenerationDetails')} ${selectedGenIndex !== null ? selectedGenIndex + 1 : ''}`}
                showConfirmButton={false}
                cancelButtonLabel={t('main:Close')}
            >
                {selectedGen && (
                    <table className="apptr__table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>{t('transit:networkDesign:LineShortname')}</th>
                                <th>{t('transit:networkDesign:VehiclesAssigned')}</th>
                                <th>{t('transit:networkDesign:CycleTimeMinutes')}</th>
                                <th>{t('transit:networkDesign:HeadwayMinutes')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {linesArray.map((line) => (
                                <tr key={line.lineId}>
                                    <td>{line.shortname}</td>
                                    <td>{line.nbVehicles}</td>
                                    <td>{line.cycleTimeMinutes.toFixed(1)}</td>
                                    <td>{line.headwayMinutes.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </ConfirmModal>
        </div>
    );
};

interface TransitNetworkDesignListProps {
    onNewJob: (parameters?: {
        transitNetworkDesignParameters: TransitNetworkDesignParameters;
        algorithmConfiguration: AlgorithmConfiguration;
        simulationMethod: SimulationMethodConfiguration;
    }) => void;
    onViewJob: (
        jobId: number,
        parameters: {
            transitNetworkDesignParameters: TransitNetworkDesignParameters;
            algorithmConfiguration: AlgorithmConfiguration;
            simulationMethod: SimulationMethodConfiguration;
        }
    ) => void;
}

const TransitNetworkDesignList: React.FunctionComponent<TransitNetworkDesignListProps> = (
    props: TransitNetworkDesignListProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    const [errors, setErrors] = React.useState<TranslatableMessage[]>([]);
    const [jobs, setJobs] = React.useState<ReturnedJobAttributes[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [expandedJobs, setExpandedJobs] = React.useState<Set<number>>(new Set());

    // Same fetch pattern as ExecutableJobComponent / ExecutableJobList
    const fetchJobs = React.useCallback(async () => {
        setLoading(true);
        try {
            const status = await new Promise<Status.Status<{ jobs: ReturnedJobAttributes[]; totalCount: number }>>(
                (resolve) => {
                    serviceLocator.socketEventManager.emit(
                        JobsConstants.LIST_JOBS,
                        { jobType: JOB_TYPE, pageSize: 1000, pageIndex: 0 },
                        resolve
                    );
                }
            );
            setJobs(Status.unwrap(status).jobs);
        } catch (error) {
            console.error(`Error fetching executable jobs from server: ${error}`);
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Same live-refresh pattern as ExecutableJobList
    React.useEffect(() => {
        const onJobUpdated = (data: { id: number; name: string }) => {
            if (data.name === JOB_TYPE) {
                fetchJobs();
            }
        };
        serviceLocator.socketEventManager.on('executableJob.updated', onJobUpdated);
        fetchJobs();
        return () => {
            serviceLocator.socketEventManager.off('executableJob.updated', onJobUpdated);
        };
    }, [fetchJobs]);

    // Same action pattern as ExecutableJobComponent (updateJobStatusOnServer)
    const sendJobAction = React.useCallback(async (id: number, socketRoute: string) => {
        try {
            const status = await new Promise<Status.Status<boolean>>((resolve) => {
                serviceLocator.socketEventManager.emit(socketRoute, id, resolve);
            });
            Status.unwrap(status);
        } catch (error) {
            console.error(`Error executing job action ${socketRoute}: ${error}`);
        }
    }, []);

    const viewJob = async (jobId: number) => {
        try {
            const parameters = await NetworkDesignFrontendExecutor.getCalculationParametersForJob(jobId);
            props.onViewJob(jobId, parameters);
        } catch (error) {
            setErrors([
                TrError.isTrError(error)
                    ? error.export().localizedMessage
                    : 'transit:networkDesign:errors:ErrorGettingReplayParameters'
            ]);
        }
    };

    const replayJob = async (jobId: number) => {
        try {
            // This would be similar to TransitBatchRoutingCalculator.getCalculationParametersForJob
            // but for network design jobs
            console.log('Replay job', jobId);
            const parameters = await NetworkDesignFrontendExecutor.getCalculationParametersForJob(jobId);
            props.onNewJob(parameters);
            // const parameters = await TransitNetworkDesignCalculator.getJobParametersForReplay(jobId);
            // props.onNewJob(parameters);
        } catch (error) {
            setErrors([
                TrError.isTrError(error)
                    ? error.export().localizedMessage
                    : 'transit:networkDesign:errors:ErrorGettingReplayParameters'
            ]);
        }
    };

    const toggleExpand = React.useCallback((jobId: number, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setExpandedJobs((prev) => {
            const next = new Set(prev);
            if (next.has(jobId)) {
                next.delete(jobId);
            } else {
                next.add(jobId);
            }
            return next;
        });
    }, []);

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
                <Button
                    color="grey"
                    icon={faSyncAlt}
                    iconClass="_icon"
                    label={t('main:Refresh')}
                    onClick={() => fetchJobs()}
                />
            </div>
            {errors.length > 0 && <FormErrors errors={errors} />}
            {loading && <p>{t('main:Loading')}...</p>}
            {!loading && jobs.length === 0 && (
                <p style={{ marginBottom: '0.5rem' }}>{t('transit:networkDesign:NoJobsYet')}</p>
            )}
            {!loading &&
                jobs.length > 0 &&
                jobs.map((job) => {
                    const isActive = job.status === 'pending' || job.status === 'inProgress';
                    const isPaused = job.status === 'paused';
                    const isExpanded = expandedJobs.has(job.id);
                    const dateStr = job.created_at
                        ? moment(job.created_at).format(Preferences.get('dateTimeFormat'))
                        : '';

                    return (
                        <React.Fragment key={`nd-job-${job.id}`}>
                            <ButtonList>
                                <li className="_list" onClick={() => toggleExpand(job.id)}>
                                    <ButtonCell alignment="left">
                                        <span>#{job.id}</span>
                                        <span className="_pale _small" style={{ marginLeft: '0.5em' }}>
                                            {dateStr}
                                        </span>
                                    </ButtonCell>
                                    <ButtonCell alignment="flush">
                                        <span className={`status_${job.status}`}>
                                            {t(`transit:jobs:Status_${job.status}`)}
                                        </span>
                                    </ButtonCell>
                                    {/* Cancel — same as ExecutableJobComponent Actions column */}
                                    {isActive && (
                                        <ButtonCellWithConfirm
                                            alignment="right"
                                            onClick={() => sendJobAction(job.id, JobsConstants.CANCEL_JOB)}
                                            title={t('transit:jobs:Cancel')}
                                            message={t('transit:jobs:ConfirmCancel')}
                                            confirmButtonText={t('transit:jobs:Cancel')}
                                        >
                                            <FontAwesomeIcon icon={faStopCircle} />
                                        </ButtonCellWithConfirm>
                                    )}
                                    {/* Pause — same as ExecutableJobComponent Actions column */}
                                    {isActive && (
                                        <ButtonCellWithConfirm
                                            alignment="right"
                                            onClick={() => sendJobAction(job.id, JobsConstants.PAUSE_JOB)}
                                            title={t('transit:jobs:Pause')}
                                            message={t('transit:jobs:ConfirmPause')}
                                            confirmButtonText={t('transit:jobs:Pause')}
                                        >
                                            <FontAwesomeIcon icon={faPauseCircle} />
                                        </ButtonCellWithConfirm>
                                    )}
                                    {/* Resume — same as ExecutableJobComponent Actions column */}
                                    {isPaused && (
                                        <ButtonCell
                                            alignment="right"
                                            onClick={() => sendJobAction(job.id, JobsConstants.RESUME_JOB)}
                                            title={t('transit:jobs:Resume')}
                                        >
                                            <FontAwesomeIcon icon={faPlayCircle} />
                                        </ButtonCell>
                                    )}
                                    {/* View — opens the form in read-only mode */}
                                    <ButtonCell
                                        alignment="right"
                                        onClick={(e) => {
                                            e?.stopPropagation();
                                            viewJob(job.id);
                                        }}
                                        title={t('transit:networkDesign:ViewJob')}
                                    >
                                        <img
                                            className="_icon-alone"
                                            src={'/dist/images/icons/interface/edit_white.svg'}
                                            alt={t('transit:networkDesign:ViewJob')}
                                        />
                                    </ButtonCell>
                                    {/* Duplicate — replaces the old faRedoAlt "ReplayJob" custom action */}
                                    <ButtonCell
                                        alignment="right"
                                        onClick={(e) => {
                                            e?.stopPropagation();
                                            replayJob(job.id);
                                        }}
                                        title={t('transit:networkDesign:DuplicateJob')}
                                    >
                                        <img
                                            className="_icon-alone"
                                            src={'/dist/images/icons/interface/copy_white.svg'}
                                            alt={t('transit:networkDesign:DuplicateJob')}
                                        />
                                    </ButtonCell>
                                    {/* Delete — same as ExecutableJobComponent Actions column */}
                                    <ButtonCellWithConfirm
                                        alignment="right"
                                        onClick={() => sendJobAction(job.id, JobsConstants.DELETE_JOB)}
                                        title={t('transit:jobs:Delete')}
                                        confirmButtonColor="red"
                                        confirmButtonText={t('transit:jobs:Delete')}
                                        message={t('transit:jobs:ConfirmDelete')}
                                    >
                                        <img
                                            className="_icon-alone"
                                            src={'/dist/images/icons/interface/delete_white.svg'}
                                            alt={t('transit:jobs:Delete')}
                                        />
                                    </ButtonCellWithConfirm>
                                    {/* Expand/collapse job details */}
                                    <ButtonCell
                                        alignment="right"
                                        onClick={(e) => toggleExpand(job.id, e)}
                                        title={t(
                                            isExpanded
                                                ? 'transit:networkDesign:CollapseDetails'
                                                : 'transit:networkDesign:ExpandDetails'
                                        )}
                                    >
                                        <FontAwesomeIcon icon={isExpanded ? faMinus : faPlus} />
                                    </ButtonCell>
                                </li>
                                <li className="_clear"></li>
                            </ButtonList>
                            {isExpanded && (
                                <div className="tr__form-section" style={{ padding: '0.5rem 1rem', fontSize: '0.9em' }}>
                                    <p>
                                        <strong>{t('transit:jobs:Date')}:</strong> {dateStr}
                                    </p>
                                    {(job.status === 'completed' || job.status === 'failed') && job.updated_at && (
                                        <p>
                                            <strong>{t('transit:jobs:EndTime')}:</strong>{' '}
                                            {moment(job.updated_at).format(Preferences.get('dateTimeFormat'))}
                                        </p>
                                    )}
                                    <p>
                                        <strong>{t('transit:jobs:Status')}:</strong>{' '}
                                        <span className={`status_${job.status}`}>
                                            {t(`transit:jobs:Status_${job.status}`)}
                                        </span>
                                    </p>
                                    {job.statusMessages && (
                                        <p>
                                            <ExpandableMessages messages={job.statusMessages} />
                                        </p>
                                    )}
                                    <GenerationsTable
                                        generations={
                                            (job.data as { results?: { generations?: GenerationRow[] } })?.results
                                                ?.generations
                                        }
                                        t={t}
                                    />
                                    {job.hasFiles && (
                                        <p>
                                            <strong>{t('transit:jobs:Resources')}:</strong>{' '}
                                            <ExpandableFiles
                                                showFileText={t('transit:jobs:ShowFiles')}
                                                jobId={job.id}
                                            />
                                        </p>
                                    )}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
        </div>
    );
};

export default TransitNetworkDesignList;
