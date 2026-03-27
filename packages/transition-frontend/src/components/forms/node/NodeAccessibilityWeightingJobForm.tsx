/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { faSpinner } from '@fortawesome/free-solid-svg-icons/faSpinner';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import InputWrapper from 'chaire-lib-frontend/lib/components/input/InputWrapper';
import InputString from 'chaire-lib-frontend/lib/components/input/InputString';
import InputSelect from 'chaire-lib-frontend/lib/components/input/InputSelect';
import FormErrors from 'chaire-lib-frontend/lib/components/pageParts/FormErrors';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import type { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import { JobsConstants } from 'transition-common/lib/api/jobs';
import { CsvFileAndFieldMapper } from 'transition-common/lib/services/csv';
import type { WeightingFileMapping } from 'transition-common/lib/services/weighting/types';
import {
    DECAY_TYPE_VALUES,
    MIN_STRICTLY_POSITIVE_DECAY,
    getWeightingFieldDescriptors
} from 'transition-common/lib/services/weighting/types';
import type {
    DecayFunctionParameters,
    DecayFunctionType,
    DecayStrictlyPositiveParameterKey,
    WeightingInputType
} from 'transition-common/lib/services/weighting/types';
import type { CsvFileAndMapping } from 'transition-common/lib/services/csv/types';
import type { JobStatus } from 'transition-common/lib/services/jobs/Job';
import GenericCsvImportAndMappingForm from '../csv/GenericCsvImportAndMappingForm';
import {
    NodeAccessibilityWeightingExecutor,
    getIntrinsicAccessibilityWeightsDocUrl,
    type NodeAccessibilityWeightingConfig,
    type NodeAccessibilityWeightingJobParameters,
    type WorkerProgressPayload
} from '../../../services/transitNodes/NodeAccessibilityWeightingExecutor';

const TK = 'transit:transitNode.accessibilityWeighting';

/** If the pause-boundary socket event is lost, stop blocking Resume after this (should be rare). */
const PAUSE_BOUNDARY_FALLBACK_MS = 45_000;

const DEFAULT_MAX_WALKING_TIME_SECONDS = 1200;
const DEFAULT_DECAY_PARAMETERS: DecayFunctionParameters = { type: 'power', beta: 1.5 };

/** Name used for the uploaded CSV file (overwrites previous uploads from same context). */
const CSV_UPLOAD_FILENAME = 'nodeWeighting.csv';

export type NodeAccessibilityWeightingJobFormProps = {
    jobId: number;
    initialParameters?: NodeAccessibilityWeightingJobParameters;
    onClose: () => void;
    onJobComplete?: () => void;
};

function getDefaultConfig(): NodeAccessibilityWeightingConfig {
    return {
        weightingInputType: 'poi',
        maxWalkingTimeSeconds: DEFAULT_MAX_WALKING_TIME_SECONDS,
        decayFunctionParameters: { ...DEFAULT_DECAY_PARAMETERS }
    };
}

function buildDecayParams(type: DecayFunctionType, prev: DecayFunctionParameters): DecayFunctionParameters {
    switch (type) {
    case 'power':
        return { type, beta: 'beta' in prev ? prev.beta : 1.5 };
    case 'exponential':
        return { type, beta: 'beta' in prev ? prev.beta : 0.1 };
    case 'gamma':
        return { type, a: 'a' in prev ? prev.a : 1, b: 'b' in prev ? prev.b : 1, c: 'c' in prev ? prev.c : 0.1 };
    case 'combined':
        return { type, beta1: 'beta1' in prev ? prev.beta1 : 1, beta2: 'beta2' in prev ? prev.beta2 : 0.1 };
    case 'logistic':
        return { type, beta: 'beta' in prev ? prev.beta : 0.5, x0: 'x0' in prev ? prev.x0 : 600 };
    }
}

/** Maps DB job status to a user-visible i18n key suffix. */
function statusLabelKey(status: JobStatus): string {
    switch (status) {
    case 'pending':
        return 'Starting';
    case 'inProgress':
        return 'Running';
    case 'paused':
        return 'Paused';
    case 'completed':
        return 'Complete';
    case 'failed':
        return 'Failed';
    case 'cancelled':
        return 'Cancelled';
    }
}

function buildCsvMapper(
    inputType: WeightingInputType,
    existing?: CsvFileAndMapping<WeightingFileMapping>
): CsvFileAndFieldMapper<WeightingFileMapping> {
    return new CsvFileAndFieldMapper<WeightingFileMapping>(getWeightingFieldDescriptors(inputType), existing);
}

const NodeAccessibilityWeightingJobForm: React.FunctionComponent<NodeAccessibilityWeightingJobFormProps> = ({
    jobId,
    initialParameters,
    onClose,
    onJobComplete
}) => {
    const { t, i18n } = useTranslation(['transit', 'main', 'notifications']);

    const [description, setDescription] = React.useState(initialParameters?.description ?? '');
    const [config, setConfig] = React.useState<NodeAccessibilityWeightingConfig>(
        initialParameters?.config ?? getDefaultConfig()
    );

    const [csvMapper, setCsvMapper] = React.useState<CsvFileAndFieldMapper<WeightingFileMapping>>(() =>
        buildCsvMapper(initialParameters?.config?.weightingInputType ?? 'poi', initialParameters?.csvFileAndMapping)
    );
    const [csvValidationErrors, setCsvValidationErrors] = React.useState<TranslatableMessage[]>([]);

    const [jobStatus, setJobStatus] = React.useState<JobStatus | 'idle'>('idle');
    const [progressText, setProgressText] = React.useState<string | undefined>(undefined);
    const [errorMessage, setErrorMessage] = React.useState<string | undefined>(undefined);
    const [statusWarnings, setStatusWarnings] = React.useState<TranslatableMessage[]>([]);
    const [weightsDownloadUrl, setWeightsDownloadUrl] = React.useState<string | undefined>(undefined);
    /** True from Pause click until the job is `paused` in the DB and the worker has gone quiet (chunk finished). */
    const [pauseActionPending, setPauseActionPending] = React.useState(false);
    // Synchronous flag to freeze progress display immediately on Pause/Cancel,
    // before any async progress events from draining in-flight batches arrive.
    const progressFrozen = React.useRef(false);
    const pauseFallbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const jobStatusRef = React.useRef(jobStatus);
    const pauseActionPendingRef = React.useRef(pauseActionPending);

    const clearWeightingNotifications = React.useCallback(() => {
        serviceLocator.eventManager.emit('progressClear', {
            name: NodeAccessibilityWeightingExecutor.PROGRESS_EVENT_NAME
        });
    }, []);

    const clearPauseBoundaryFallbackTimer = React.useCallback(() => {
        if (pauseFallbackTimerRef.current !== null) {
            clearTimeout(pauseFallbackTimerRef.current);
            pauseFallbackTimerRef.current = null;
        }
    }, []);

    const settlePauseAction = React.useCallback(() => {
        clearPauseBoundaryFallbackTimer();
        setPauseActionPending(false);
        setProgressText(undefined);
        progressFrozen.current = false;
        clearWeightingNotifications();
    }, [clearPauseBoundaryFallbackTimer, clearWeightingNotifications]);

    React.useEffect(() => {
        jobStatusRef.current = jobStatus;
    }, [jobStatus]);

    React.useEffect(() => {
        pauseActionPendingRef.current = pauseActionPending;
    }, [pauseActionPending]);

    const refreshJobStatus = React.useCallback(() => {
        NodeAccessibilityWeightingExecutor.getStatus(jobId).then((resp) => {
            setJobStatus((prev) => {
                // A freshly created job has DB status 'pending' but hasn't been
                // started yet. Don't lock the form when we're still in initial
                // 'idle' — only the explicit Start click sets local 'pending'.
                if (prev === 'idle' && resp.status === 'pending') {
                    jobStatusRef.current = prev;
                    return prev;
                }
                jobStatusRef.current = resp.status;
                return resp.status;
            });
            setStatusWarnings(resp.statusMessages?.errors ?? []);
            if (resp.status !== 'inProgress') {
                clearWeightingNotifications();
            }
            if (resp.status === 'completed' && resp.hasWeightsFile) {
                onJobComplete?.();
                serviceLocator.socketEventManager.emit(
                    JobsConstants.GET_FILES,
                    jobId,
                    (fileStatus: Status.Status<Record<string, { url: string; downloadName: string }>>) => {
                        if (Status.isStatusOk(fileStatus)) {
                            const files = Status.unwrap(fileStatus);
                            if (files.output) {
                                setWeightsDownloadUrl(files.output.url);
                            }
                        }
                    }
                );
            }
        });
    }, [jobId, onJobComplete, clearWeightingNotifications]);

    React.useEffect(() => {
        const onProgress = (payload: WorkerProgressPayload) => {
            if (payload.name !== NodeAccessibilityWeightingExecutor.PROGRESS_EVENT_NAME) return;
            if (payload.pauseAtChunkBoundary === true) {
                if (payload.jobId !== undefined && payload.jobId !== jobId) {
                    return;
                }
                settlePauseAction();
                return;
            }
            if (progressFrozen.current) return;
            setJobStatus((prev) => (prev === 'paused' || prev === 'cancelled' ? prev : 'inProgress'));
            setProgressText(payload.customText);
        };

        const onJobUpdated = (data: { id: number; name: string }) => {
            if (data.name !== 'nodeAccessibilityWeighting' || data.id !== jobId) return;
            refreshJobStatus();
        };

        serviceLocator.socketEventManager.on('progress', onProgress);
        serviceLocator.socketEventManager.on('executableJob.updated', onJobUpdated);

        refreshJobStatus();

        return () => {
            serviceLocator.socketEventManager.off('progress', onProgress);
            serviceLocator.socketEventManager.off('executableJob.updated', onJobUpdated);
        };
    }, [jobId, refreshJobStatus, settlePauseAction]);

    React.useEffect(() => {
        if (jobStatus !== 'paused' || !pauseActionPending) {
            clearPauseBoundaryFallbackTimer();
            return;
        }
        if (pauseFallbackTimerRef.current !== null) {
            return;
        }
        pauseFallbackTimerRef.current = setTimeout(() => {
            pauseFallbackTimerRef.current = null;
            if (pauseActionPendingRef.current && jobStatusRef.current === 'paused') {
                console.warn(
                    'NodeAccessibilityWeighting: pause boundary event absent after timeout; clearing pause spinner.'
                );
                settlePauseAction();
            }
        }, PAUSE_BOUNDARY_FALLBACK_MS);
        return () => {
            clearPauseBoundaryFallbackTimer();
        };
    }, [jobStatus, pauseActionPending, clearPauseBoundaryFallbackTimer, settlePauseAction]);

    React.useEffect(() => {
        if (jobStatus !== 'cancelled' && jobStatus !== 'failed') {
            return;
        }
        setPauseActionPending(false);
        clearWeightingNotifications();
    }, [jobStatus, clearWeightingNotifications]);

    React.useEffect(() => {
        if (jobStatus === 'completed') {
            setPauseActionPending(false);
        }
    }, [jobStatus]);

    const updateConfig = React.useCallback((patch: Partial<NodeAccessibilityWeightingConfig>) => {
        setConfig((prev) => {
            const next = { ...prev, ...patch };
            if (patch.weightingInputType !== undefined && patch.weightingInputType !== prev.weightingInputType) {
                setCsvMapper(buildCsvMapper(next.weightingInputType));
                setCsvValidationErrors([]);
            }
            return next;
        });
    }, []);

    const onCsvMappingUpdate = React.useCallback(
        (_mapper: CsvFileAndFieldMapper<WeightingFileMapping>, _isReady: boolean) => {
            setCsvValidationErrors([]);
        },
        []
    );

    const handleStartWeighting = React.useCallback(async () => {
        const errors = csvMapper.getErrors();
        if (errors.length > 0) {
            setCsvValidationErrors(errors);
            return;
        }
        setCsvValidationErrors([]);

        progressFrozen.current = false;
        setPauseActionPending(false);
        if (pauseFallbackTimerRef.current !== null) {
            clearTimeout(pauseFallbackTimerRef.current);
            pauseFallbackTimerRef.current = null;
        }
        setJobStatus('pending');
        setErrorMessage(undefined);
        setStatusWarnings([]);
        setProgressText(undefined);

        try {
            const mappingData = csvMapper.getCurrentFileAndMapping();
            const fileAndMapping = mappingData?.fileAndMapping;
            const weightingFileMapping = fileAndMapping?.fieldMappings;

            const configToSend: NodeAccessibilityWeightingConfig = {
                ...config,
                weightingFileMapping
            };
            const csvFileAndMapping = mappingData ?? undefined;

            await NodeAccessibilityWeightingExecutor.startWeighting(
                jobId,
                { description, config: configToSend, csvFileAndMapping },
                fileAndMapping
            );
        } catch (err: unknown) {
            setJobStatus('failed');
            setErrorMessage(err instanceof Error ? err.message : String(err ?? 'Unknown error'));
        }
    }, [jobId, description, config, csvMapper]);

    const inputTypeChoices = [
        { value: 'poi', label: t(`${TK}.weightingInputType.poi`) },
        { value: 'odOrigins', label: t(`${TK}.weightingInputType.odOrigins`) },
        { value: 'odDestinations', label: t(`${TK}.weightingInputType.odDestinations`) },
        { value: 'odBoth', label: t(`${TK}.weightingInputType.odBoth`) }
    ];

    const decayTypeChoices = DECAY_TYPE_VALUES.map((dt) => ({
        value: dt,
        label: t(`${TK}.decayType.${dt}`)
    }));

    const isTerminal = jobStatus === 'cancelled' || jobStatus === 'failed' || jobStatus === 'completed';
    const isActive = jobStatus === 'pending' || jobStatus === 'inProgress' || jobStatus === 'paused';
    const isRunning = jobStatus === 'inProgress';
    const isPaused = jobStatus === 'paused';
    const showPauseControl = isRunning || (pauseActionPending && jobStatus === 'paused');

    return (
        <div className="tr__form-section" style={{ marginTop: '0.5rem' }}>
            {/* Job name */}
            <InputWrapper smallInput twoColumns={false} label={t(`${TK}.JobName`)}>
                <InputString
                    id="nodeAccessibilityWeightingJobDescription"
                    value={description}
                    disabled={isActive}
                    onValueUpdated={({ value }) => setDescription(typeof value === 'string' ? value : '')}
                />
            </InputWrapper>

            {/* Input type */}
            <InputWrapper smallInput twoColumns={false} label={t(`${TK}.weightingInputTypeLabel`)}>
                <InputSelect
                    id="nodeAccessibilityWeightingInputType"
                    value={config.weightingInputType}
                    choices={inputTypeChoices}
                    noBlank
                    disabled={isActive}
                    onValueChange={(e) => updateConfig({ weightingInputType: e.target.value as WeightingInputType })}
                />
            </InputWrapper>

            {/* Max walking time (display in minutes, store in seconds) */}
            <InputWrapper smallInput twoColumns={false} label={t(`${TK}.maxWalkingTimeSeconds`)}>
                <InputString
                    id="nodeAccessibilityWeightingMaxWalkingTime"
                    type="number"
                    min={1}
                    value={String(config.maxWalkingTimeSeconds / 60)}
                    disabled={isActive}
                    onValueUpdated={({ value }) => {
                        const minutes = parseFloat(value);
                        if (Number.isFinite(minutes) && minutes > 0) {
                            updateConfig({ maxWalkingTimeSeconds: Math.round(minutes * 60) });
                        }
                    }}
                />
            </InputWrapper>

            {/* Decay type */}
            <InputWrapper smallInput twoColumns={false} label={t(`${TK}.decayTypeLabel`)}>
                <InputSelect
                    id="nodeAccessibilityWeightingDecayType"
                    value={config.decayFunctionParameters.type}
                    choices={decayTypeChoices}
                    noBlank
                    disabled={isActive}
                    onValueChange={(e) => {
                        const newType = e.target.value as DecayFunctionType;
                        updateConfig({
                            decayFunctionParameters: buildDecayParams(newType, config.decayFunctionParameters)
                        });
                    }}
                />
            </InputWrapper>

            {/* Decay parameters -- dynamic based on type */}
            {renderDecayParameterInputs(config.decayFunctionParameters, isActive, t, updateConfig)}

            {/* CSV file upload + column mapping (shared component) */}
            {!isActive && (
                <GenericCsvImportAndMappingForm<WeightingFileMapping>
                    key={config.weightingInputType}
                    csvFieldMapper={csvMapper}
                    onUpdate={onCsvMappingUpdate}
                    importFileName={CSV_UPLOAD_FILENAME}
                    hideErrors
                />
            )}

            {csvValidationErrors.length > 0 && <FormErrors errors={csvValidationErrors} />}

            {/* Checkpoint / duplicate note + documentation */}
            <p
                className="apptr__form-input-container"
                style={{ marginTop: '0.5rem', fontStyle: 'italic', opacity: 0.8 }}
            >
                {t(`${TK}.CheckpointNote`)}{' '}
                <a
                    href={getIntrinsicAccessibilityWeightsDocUrl(i18n.language)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={t(`${TK}.DocumentationLinkTitle`)}
                >
                    {t(`${TK}.DocumentationLink`)}
                </a>
            </p>

            {/* Execution controls */}
            <div className="tr__form-buttons-container" style={{ marginTop: '1rem' }}>
                {!isTerminal && (
                    <Button
                        color="blue"
                        label={t(`${TK}.StartWeighting`)}
                        onClick={handleStartWeighting}
                        disabled={isRunning || (isActive && !isPaused)}
                    />
                )}
                {showPauseControl && (
                    <Button
                        color="grey"
                        icon={pauseActionPending ? faSpinner : undefined}
                        iconSpin={pauseActionPending}
                        disabled={pauseActionPending}
                        label={t(`${TK}.${pauseActionPending ? 'Pausing' : 'Pause'}`)}
                        onClick={() => {
                            progressFrozen.current = true;
                            setPauseActionPending(true);
                            setProgressText(undefined);
                            serviceLocator.eventManager.emit('progress', {
                                name: NodeAccessibilityWeightingExecutor.PROGRESS_EVENT_NAME,
                                customText: t('notifications:NodeAccessibilityWeightingPausing'),
                                progress: -1
                            });
                            NodeAccessibilityWeightingExecutor.pauseWeighting(jobId);
                        }}
                    />
                )}
                {isPaused && !pauseActionPending && (
                    <Button
                        color="green"
                        label={t(`${TK}.Resume`)}
                        onClick={() => {
                            progressFrozen.current = false;
                            NodeAccessibilityWeightingExecutor.resumeWeighting(jobId);
                        }}
                    />
                )}
                {isActive && (
                    <Button
                        color="grey"
                        label={t(`${TK}.Cancel`)}
                        onClick={() => {
                            progressFrozen.current = true;
                            setPauseActionPending(false);
                            if (pauseFallbackTimerRef.current !== null) {
                                clearTimeout(pauseFallbackTimerRef.current);
                                pauseFallbackTimerRef.current = null;
                            }
                            clearWeightingNotifications();
                            NodeAccessibilityWeightingExecutor.cancelWeighting(jobId);
                        }}
                    />
                )}
                <Button color="grey" label={t(`${TK}.Close`)} onClick={onClose} />
            </div>

            {/* Progress / status */}
            {isActive && (
                <p style={{ marginTop: '0.5rem' }}>
                    {pauseActionPending
                        ? t(`${TK}.Pausing`)
                        : `${t(`${TK}.${statusLabelKey(jobStatus as JobStatus)}`)}${
                            progressText ? ` (${progressText})` : ''
                        }`}
                </p>
            )}

            {jobStatus === 'paused' && statusWarnings.length > 0 && (
                <FormErrors errors={statusWarnings} errorType="Warning" />
            )}

            {jobStatus === 'completed' && (
                <div style={{ marginTop: '0.5rem' }}>
                    <p>{t(`${TK}.Complete`)}</p>
                    {weightsDownloadUrl && (
                        <div className="tr__form-buttons-container">
                            <a href={weightsDownloadUrl} download>
                                {t(`${TK}.DownloadWeights`)}
                            </a>
                        </div>
                    )}
                </div>
            )}

            {jobStatus === 'failed' && (
                <p style={{ marginTop: '0.5rem', color: 'var(--danger)' }}>
                    {t(`${TK}.Failed`)}
                    {errorMessage && `: ${errorMessage}`}
                </p>
            )}

            {jobStatus === 'cancelled' && <p style={{ marginTop: '0.5rem' }}>{t(`${TK}.Cancelled`)}</p>}
        </div>
    );
};

/**
 * Renders the parameter inputs appropriate for the selected decay function type.
 * Each decay type has different parameters (beta, a/b/c, beta1/beta2, beta+x0).
 */
function renderDecayParameterInputs(
    params: DecayFunctionParameters,
    disabled: boolean,
    t: (key: string) => string,
    updateConfig: (patch: Partial<NodeAccessibilityWeightingConfig>) => void
): React.ReactNode {
    const updateDecay = (patch: Partial<DecayFunctionParameters>) => {
        updateConfig({ decayFunctionParameters: { ...params, ...patch } as DecayFunctionParameters });
    };

    const numInput = (
        id: string,
        labelKey: string,
        value: number,
        onChange: (v: number) => void,
        strictlyPositiveKey?: DecayStrictlyPositiveParameterKey
    ) => {
        const requireStrictlyPositive = strictlyPositiveKey !== undefined;
        return (
            <InputWrapper key={id} smallInput twoColumns={false} label={t(`${TK}.${labelKey}`)}>
                <InputString
                    id={id}
                    type="number"
                    min={requireStrictlyPositive ? MIN_STRICTLY_POSITIVE_DECAY : undefined}
                    value={String(value)}
                    disabled={disabled}
                    onValueUpdated={({ value: v }) => {
                        const n = parseFloat(v);
                        if (!Number.isFinite(n)) return;
                        if (requireStrictlyPositive && n <= 0) return;
                        onChange(n);
                    }}
                />
            </InputWrapper>
        );
    };

    switch (params.type) {
    case 'power':
        return numInput('decayBeta', 'decayBeta', params.beta, (v) => updateDecay({ beta: v }), 'beta');
    case 'exponential':
        return numInput('decayBeta', 'decayBeta', params.beta, (v) => updateDecay({ beta: v }), 'beta');
    case 'gamma':
        return (
            <React.Fragment>
                {numInput('decayA', 'decayA', params.a, (v) => updateDecay({ a: v }), 'a')}
                {numInput('decayB', 'decayB', params.b, (v) => updateDecay({ b: v }), 'b')}
                {numInput('decayC', 'decayC', params.c, (v) => updateDecay({ c: v }), 'c')}
            </React.Fragment>
        );
    case 'combined':
        return (
            <React.Fragment>
                {numInput('decayBeta1', 'decayBeta1', params.beta1, (v) => updateDecay({ beta1: v }), 'beta1')}
                {numInput('decayBeta2', 'decayBeta2', params.beta2, (v) => updateDecay({ beta2: v }), 'beta2')}
            </React.Fragment>
        );
    case 'logistic':
        return (
            <React.Fragment>
                {numInput('decayBeta', 'decayBeta', params.beta, (v) => updateDecay({ beta: v }), 'beta')}
                {numInput('decayX0', 'decayX0', params.x0, (v) => updateDecay({ x0: v }))}
            </React.Fragment>
        );
    }
}

export default NodeAccessibilityWeightingJobForm;
