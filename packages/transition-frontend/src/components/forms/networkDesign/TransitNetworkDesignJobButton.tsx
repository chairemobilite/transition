/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import Collapsible from 'react-collapsible';
import { useTranslation } from 'react-i18next';
import moment from 'moment';
import { faStopCircle } from '@fortawesome/free-solid-svg-icons/faStopCircle';
import { faPauseCircle } from '@fortawesome/free-solid-svg-icons/faPauseCircle';
import { faPlayCircle } from '@fortawesome/free-solid-svg-icons/faPlayCircle';
import { faForward } from '@fortawesome/free-solid-svg-icons/faForward';
import { faDownload } from '@fortawesome/free-solid-svg-icons/faDownload';

import Button from '../../parts/Button';
import ButtonCell, { ButtonCellWithConfirm } from '../../parts/ButtonCell';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ExpandableFileWidget from '../../parts/executableJob/ExpandableFileWidget';
import ExpandableMessages from '../../parts/executableJob/ExpandableMessages';
import type { ReturnedJobAttributes } from '../../parts/executableJob/ExecutableJobList';

interface TransitNetworkDesignJobButtonProps {
    job: ReturnedJobAttributes;
    isExpanded: boolean;
    onExpanded: (jobId: number) => void;
    onCollapsed: (jobId: number) => void;
    onEdit: (jobId: number) => void;
    onClone: (jobId: number) => void;
    onDelete: (jobId: number) => void;
    onPause: (jobId: number) => void;
    onResume: (jobId: number) => void;
    onCancel: (jobId: number) => void;
    onContinue: (jobId: number, additionalGenerations: number) => void;
}

function getJobDisplayName(job: ReturnedJobAttributes): string {
    const data = job.data as { description?: string } | undefined;
    const description = data?.description;
    if (typeof description === 'string' && description.trim() !== '') {
        return description.trim();
    }
    return `#${job.id}`;
}

function JobConfigSummary({ job }: { job: ReturnedJobAttributes }): React.ReactElement {
    const { t } = useTranslation('transit');
    const data = job.data as
        | { parameters?: { algorithmConfiguration?: { type?: string }; simulationMethod?: { type?: string } } }
        | undefined;
    const params = data?.parameters;
    if (!params) {
        return <span>--</span>;
    }
    const algoType = params.algorithmConfiguration?.type;
    const simType = params.simulationMethod?.type;
    const algoLabel =
        algoType === 'evolutionaryAlgorithm'
            ? t('transit:networkDesign:evolutionaryAlgorithm:LineAndNumberOfVehiclesGASimulation')
            : (algoType ?? '--');
    const simLabel =
        simType === 'OdTripSimulation' ? t('transit:networkDesign:simulationMethods:odTrips:Title') : (simType ?? '--');
    return (
        <span>
            {algoLabel} / {simLabel}
        </span>
    );
}

function getGenerationProgress(job: ReturnedJobAttributes): {
    current: number | undefined;
    total: number | undefined;
} {
    const internalData = job.internal_data as { checkpoint?: number } | undefined;
    const data = job.data as
        | {
              parameters?: { algorithmConfiguration?: { config?: { numberOfGenerations?: number } } };
          }
        | undefined;
    return {
        current: internalData?.checkpoint,
        total: data?.parameters?.algorithmConfiguration?.config?.numberOfGenerations
    };
}

type GenerationFitness = {
    generation: number;
    bestFitness: number;
    fitnessPerTrip: number;
    numberOfLines: number;
    numberOfVehicles: number;
};

function getGenerationFitnessHistory(job: ReturnedJobAttributes): GenerationFitness[] {
    const data = job.data as
        | {
              results?: {
                  generations?: Array<{
                      numberOfLines?: number;
                      numberOfVehicles?: number;
                      result?: {
                          totalFitness?: number;
                          results?: Record<
                              string,
                              {
                                  fitness?: number;
                                  results?: { totalCount?: number };
                              }
                          >;
                      };
                  }>;
              };
          }
        | undefined;
    const generations = data?.results?.generations;
    if (!Array.isArray(generations) || generations.length === 0) {
        return [];
    }
    return generations.map((gen, idx) => {
        // totalFitness is a rank product (1, 2, 3...), not the actual simulation
        // score. Use the first simulation method's fitness instead.
        const methodResults = gen.result?.results ?? {};
        const methodKeys = Object.keys(methodResults);
        const firstMethod = methodKeys.length > 0 ? methodResults[methodKeys[0]] : undefined;
        const bestFitness = firstMethod?.fitness ?? NaN;
        const totalTrips = firstMethod?.results?.totalCount ?? 0;
        return {
            generation: idx + 1,
            bestFitness,
            fitnessPerTrip: totalTrips > 0 ? bestFitness / totalTrips : NaN,
            numberOfLines: gen.numberOfLines ?? 0,
            numberOfVehicles: gen.numberOfVehicles ?? 0
        };
    });
}

function downloadJobResultsAsJson(job: ReturnedJobAttributes): void {
    const data = job.data as { results?: unknown } | undefined;
    if (!data?.results) return;
    const blob = new Blob([JSON.stringify(data.results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job_${job.id}_results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const TransitNetworkDesignJobButton: React.FunctionComponent<TransitNetworkDesignJobButtonProps> = (props) => {
    const { t } = useTranslation(['transit', 'main']);
    const {
        job,
        isExpanded,
        onExpanded,
        onCollapsed,
        onEdit,
        onClone,
        onDelete,
        onPause,
        onResume,
        onCancel,
        onContinue
    } = props;
    const jobId = job.id;
    const displayName = getJobDisplayName(job);
    const isRunning = job.status === 'inProgress';
    const isPaused = job.status === 'paused';
    const isCompleted = job.status === 'completed';
    const canControl = job.status === 'pending' || job.status === 'inProgress' || job.status === 'paused';
    const generation = getGenerationProgress(job);
    const fitnessHistory = getGenerationFitnessHistory(job);
    const [showContinueInput, setShowContinueInput] = React.useState(false);
    const [additionalGenerations, setAdditionalGenerations] = React.useState(50);

    return (
        <React.Fragment>
            <Button
                key={`job-${jobId}`}
                isSelected={false}
                flushActionButtons={false}
                onSelect={{ handler: () => onEdit(jobId), altText: t('transit:networkDesign:EditJob') }}
                onDuplicate={{
                    handler: (e) => {
                        e?.stopPropagation();
                        onClone(jobId);
                    },
                    altText: t('transit:networkDesign:CloneJob')
                }}
                onDelete={{
                    handler: (e) => {
                        e?.stopPropagation();
                        onDelete(jobId);
                    },
                    message: t('transit:jobs:ConfirmDelete'),
                    altText: t('transit:jobs:Delete')
                }}
            >
                <ButtonCell alignment="left">
                    {displayName}
                    {generation.current !== undefined && (
                        <span className="_pale _oblique" style={{ marginLeft: '0.5em', fontSize: '0.85em' }}>
                            ({t('transit:networkDesign:Generation')} {generation.current}
                            {generation.total !== undefined ? ` / ${generation.total}` : ''})
                        </span>
                    )}
                </ButtonCell>
                {canControl && (isRunning || job.status === 'pending') && (
                    <ButtonCellWithConfirm
                        alignment="right"
                        onClick={(e) => {
                            e?.stopPropagation();
                            onCancel(jobId);
                        }}
                        title={t('transit:jobs:Cancel')}
                        message={t('transit:jobs:ConfirmCancel')}
                        confirmButtonText={t('transit:jobs:Cancel')}
                    >
                        <FontAwesomeIcon icon={faStopCircle} />
                    </ButtonCellWithConfirm>
                )}
                {canControl && isRunning && (
                    <ButtonCellWithConfirm
                        alignment="right"
                        onClick={(e) => {
                            e?.stopPropagation();
                            onPause(jobId);
                        }}
                        title={t('transit:jobs:Pause')}
                        message={t('transit:jobs:ConfirmPause')}
                        confirmButtonText={t('transit:jobs:Pause')}
                    >
                        <FontAwesomeIcon icon={faPauseCircle} />
                    </ButtonCellWithConfirm>
                )}
                {isPaused && (
                    <ButtonCell
                        alignment="right"
                        onClick={(e) => {
                            e?.stopPropagation();
                            onResume(jobId);
                        }}
                        title={t('transit:jobs:Resume')}
                    >
                        <FontAwesomeIcon icon={faPlayCircle} />
                    </ButtonCell>
                )}
                {isCompleted && (
                    <ButtonCell
                        alignment="right"
                        onClick={(e) => {
                            e?.stopPropagation();
                            setShowContinueInput((prev) => !prev);
                        }}
                        title={t('transit:networkDesign:ContinueJob')}
                    >
                        <FontAwesomeIcon icon={faForward} />
                    </ButtonCell>
                )}
            </Button>
            {showContinueInput && isCompleted && (
                <div
                    style={{
                        padding: '0.5em 1em',
                        background: '#f0f4f8',
                        borderBottom: '1px solid #ccc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5em',
                        flexWrap: 'wrap'
                    }}
                >
                    <label>{t('transit:networkDesign:AdditionalGenerations')}:</label>
                    <input
                        type="number"
                        min={1}
                        value={additionalGenerations}
                        onChange={(e) => setAdditionalGenerations(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        style={{ width: '80px' }}
                    />
                    <button
                        className="_button _green"
                        onClick={() => {
                            onContinue(jobId, additionalGenerations);
                            setShowContinueInput(false);
                        }}
                    >
                        {t('transit:networkDesign:ContinueJobConfirm')}
                    </button>
                    <button className="_button" onClick={() => setShowContinueInput(false)}>
                        {t('main:Cancel')}
                    </button>
                </div>
            )}
            <div className="tr__form-network-design-job-details">
                <Collapsible
                    lazyRender={true}
                    trigger={t('transit:networkDesign:JobDetails')}
                    open={isExpanded}
                    transitionTime={100}
                    overflowWhenOpen="visible"
                    onOpening={() => onExpanded(jobId)}
                    onClosing={() => onCollapsed(jobId)}
                >
                    <div className="tr__form-network-design-job-details-content">
                        <p>
                            <strong>{t('transit:jobs:Date')}:</strong>{' '}
                            {job.created_at ? moment(job.created_at).format(Preferences.get('dateTimeFormat')) : '--'}
                        </p>
                        {(job.status === 'completed' || job.status === 'failed') && job.updated_at && (
                            <p>
                                <strong>{t('transit:jobs:EndTime')}:</strong>{' '}
                                {moment(job.updated_at).format(Preferences.get('dateTimeFormat'))}
                            </p>
                        )}
                        <p>
                            <strong>{t('transit:jobs:Status')}:</strong>{' '}
                            <span className={`status_${job.status}`}>{t(`transit:jobs:Status_${job.status}`)}</span>
                        </p>
                        {job.statusMessages && <ExpandableMessages messages={job.statusMessages} />}
                        <p>
                            <strong>{t('transit:networkDesign:ConfigSummary')}:</strong> <JobConfigSummary job={job} />
                        </p>
                        {generation.current !== undefined && (
                            <p>
                                <strong>{t('transit:networkDesign:Generation')}:</strong> {generation.current}
                                {generation.total !== undefined ? ` / ${generation.total}` : ''}
                            </p>
                        )}
                        {fitnessHistory.length > 0 && (
                            <div>
                                <strong>{t('transit:networkDesign:FitnessProgress')}:</strong>
                                <table
                                    className="tr__fitness-history-table"
                                    style={{
                                        width: '100%',
                                        marginTop: '0.3em',
                                        fontSize: '0.85em',
                                        borderCollapse: 'collapse'
                                    }}
                                >
                                    <thead>
                                        <tr>
                                            <th
                                                style={{
                                                    textAlign: 'left',
                                                    borderBottom: '1px solid #ccc',
                                                    padding: '2px 6px'
                                                }}
                                            >
                                                #
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'right',
                                                    borderBottom: '1px solid #ccc',
                                                    padding: '2px 6px'
                                                }}
                                            >
                                                {t('transit:networkDesign:BestFitness')}
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'right',
                                                    borderBottom: '1px solid #ccc',
                                                    padding: '2px 6px'
                                                }}
                                            >
                                                {t('transit:networkDesign:FitnessPerTrip')}
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'right',
                                                    borderBottom: '1px solid #ccc',
                                                    padding: '2px 6px'
                                                }}
                                            >
                                                {t('transit:networkDesign:Lines')}
                                            </th>
                                            <th
                                                style={{
                                                    textAlign: 'right',
                                                    borderBottom: '1px solid #ccc',
                                                    padding: '2px 6px'
                                                }}
                                            >
                                                {t('transit:networkDesign:Vehicles')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fitnessHistory.map((gen) => (
                                            <tr key={gen.generation}>
                                                <td style={{ padding: '2px 6px' }}>{gen.generation}</td>
                                                <td style={{ textAlign: 'right', padding: '2px 6px' }}>
                                                    {Number.isNaN(gen.bestFitness) ? '--' : gen.bestFitness.toFixed(2)}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '2px 6px' }}>
                                                    {Number.isNaN(gen.fitnessPerTrip)
                                                        ? '--'
                                                        : gen.fitnessPerTrip.toFixed(4)}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '2px 6px' }}>
                                                    {gen.numberOfLines}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '2px 6px' }}>
                                                    {gen.numberOfVehicles}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p>
                            <strong>{t('transit:networkDesign:DownloadResults')}:</strong>{' '}
                            {job.hasFiles ? (
                                <ExpandableFileWidget showFileText={t('transit:jobs:ShowFiles')} jobId={jobId} />
                            ) : (
                                '--'
                            )}
                        </p>
                        {Boolean((job.data as { results?: unknown } | undefined)?.results) && (
                            <p>
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        downloadJobResultsAsJson(job);
                                    }}
                                >
                                    <FontAwesomeIcon icon={faDownload} style={{ marginRight: '0.4em' }} />
                                    {t('transit:networkDesign:DownloadResultsJson')}
                                </a>
                            </p>
                        )}
                    </div>
                </Collapsible>
            </div>
        </React.Fragment>
    );
};

export default TransitNetworkDesignJobButton;
