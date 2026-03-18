/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from 'chaire-lib-frontend/lib/components/input/Button';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TransitApi } from 'transition-common/lib/api/transit';

type WeightingState = 'idle' | 'running' | 'complete' | 'error';

export interface NodeWeightingExecutor {
    startNodeWeighting: (jobId: number) => Promise<unknown>;
    cancelNodeWeighting: (jobId: number) => void;
    pauseNodeWeighting?: (jobId: number) => void;
    resumeNodeWeighting?: (jobId: number) => void;
    getNodeWeightingStatus: (jobId: number) => Promise<{
        running: boolean;
        paused?: boolean;
        rowsProcessed?: number;
        messageKey?: string;
        hasWeightsFile?: boolean;
    }>;
    getNodeWeightsFile: (jobId: number) => Promise<{ csv: string; filename: string }>;
    getLineSetSummaryCsv?: (jobId: number) => Promise<{ csv: string; filename: string }>;
}

export interface NodeWeightingConfigSectionProps {
    jobId?: number;
    executor: NodeWeightingExecutor;
    /** When provided (e.g. standalone Nodes panel), use these events instead of network design events. */
    progressEventName?: string;
    completeEventName?: string;
    /** Called when user clicks Start/Restart weighting; use to show validation errors (e.g. mapping) after attempt. */
    onStartWeightingAttempt?: () => void;
}

const NodeWeightingConfigSection: React.FunctionComponent<NodeWeightingConfigSectionProps> = (
    props: NodeWeightingConfigSectionProps
) => {
    const { t } = useTranslation(['transit', 'main']);
    const { jobId, executor, progressEventName, completeEventName, onStartWeightingAttempt } = props;
    const progressEvent = progressEventName ?? TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_PROGRESS;
    const completeEvent = completeEventName ?? TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_COMPLETE;

    const [weightingState, setWeightingState] = React.useState<WeightingState>('idle');
    const [paused, setPaused] = React.useState(false);
    const [weightingMessage, setWeightingMessage] = React.useState<string | undefined>(undefined);
    const [weightingProgress, setWeightingProgress] = React.useState<
        { messageKey: string; rowsProcessed?: number; bytesProcessed?: number; totalBytes?: number } | undefined
    >(undefined);
    const [hasExistingWeightsFile, setHasExistingWeightsFile] = React.useState(false);
    const [lineSetCsvDownloading, setLineSetCsvDownloading] = React.useState(false);
    const [lineSetCsvError, setLineSetCsvError] = React.useState<string | undefined>(undefined);
    const [lineWeightsProgressMessage, setLineWeightsProgressMessage] = React.useState<string | undefined>(undefined);

    React.useEffect(() => {
        if (jobId === undefined) {
            return undefined;
        }
        const onProgress = (payload: {
            jobId: number;
            rowsProcessed?: number;
            bytesProcessed?: number;
            totalBytes?: number;
            message?: string;
            messageKey?: string;
        }) => {
            if (payload.jobId !== jobId) {
                return;
            }
            setWeightingState('running');
            setPaused(payload.messageKey === 'Paused');
            if (payload.messageKey) {
                setWeightingProgress({
                    messageKey: payload.messageKey,
                    rowsProcessed: payload.rowsProcessed,
                    bytesProcessed: payload.bytesProcessed,
                    totalBytes: payload.totalBytes
                });
                setWeightingMessage(undefined);
            } else {
                setWeightingProgress(undefined);
                setWeightingMessage(
                    payload.message ??
                        (payload.rowsProcessed !== null && payload.rowsProcessed !== undefined
                            ? `${payload.rowsProcessed} rows`
                            : undefined)
                );
            }
        };
        const onComplete = (payload: { jobId: number; cancelled?: boolean }) => {
            if (payload.jobId !== jobId) {
                return;
            }
            if (payload.cancelled) {
                setWeightingState('idle');
            } else {
                setWeightingState('complete');
                setHasExistingWeightsFile(true);
            }
            setWeightingMessage(undefined);
            setWeightingProgress(undefined);
        };
        serviceLocator.socketEventManager.on(progressEvent, onProgress);
        serviceLocator.socketEventManager.on(completeEvent, onComplete);

        executor.getNodeWeightingStatus(jobId).then((status) => {
            if (status.running) {
                setWeightingState('running');
                setPaused(status.paused === true);
                if (status.messageKey) {
                    setWeightingProgress({
                        messageKey: status.messageKey,
                        rowsProcessed: status.rowsProcessed
                    });
                }
            } else if (status.hasWeightsFile) {
                setWeightingState('complete');
                setHasExistingWeightsFile(true);
            }
        });

        return () => {
            serviceLocator.socketEventManager.off(progressEvent, onProgress);
            serviceLocator.socketEventManager.off(completeEvent, onComplete);
        };
    }, [jobId, executor, progressEvent, completeEvent]);

    const onStartWeighting = React.useCallback(() => {
        if (jobId === undefined) {
            return;
        }
        onStartWeightingAttempt?.();
        setWeightingState('running');
        setPaused(false);
        setWeightingMessage(undefined);
        executor.startNodeWeighting(jobId).catch((err: unknown) => {
            setWeightingState('error');
            const message =
                err instanceof Error ? err.message : typeof err === 'string' ? err : String(err ?? 'Unknown error');
            setWeightingMessage(message);
        });
    }, [executor, jobId, onStartWeightingAttempt]);

    const onCancelWeighting = React.useCallback(() => {
        if (jobId !== undefined) {
            executor.cancelNodeWeighting(jobId);
        }
    }, [executor, jobId]);

    const onPauseWeighting = React.useCallback(() => {
        if (jobId !== undefined && executor.pauseNodeWeighting !== undefined) {
            executor.pauseNodeWeighting(jobId);
            setPaused(true);
        }
    }, [executor, jobId]);

    const onResumeWeighting = React.useCallback(() => {
        if (jobId !== undefined && executor.resumeNodeWeighting !== undefined) {
            executor.resumeNodeWeighting(jobId);
            setPaused(false);
        }
    }, [executor, jobId]);

    const onDownloadWeights = React.useCallback(() => {
        if (jobId === undefined) {
            return;
        }
        executor
            .getNodeWeightsFile(jobId)
            .then(({ csv, filename }) => {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
            })
            .catch((err: unknown) => {
                setWeightingState('error');
                setWeightingMessage(err instanceof Error ? err.message : String(err));
            });
    }, [executor, jobId]);

    const onDownloadLineSetCsv = React.useCallback(() => {
        if (jobId === undefined || executor.getLineSetSummaryCsv === undefined) {
            return;
        }
        setLineSetCsvError(undefined);
        setLineWeightsProgressMessage(undefined);
        setLineSetCsvDownloading(true);
        const onProgress = (payload: { jobId: number; messageKey: string }) => {
            if (payload.jobId === jobId && payload.messageKey) {
                setLineWeightsProgressMessage(
                    t('transit:networkDesign.nodeWeighting.lineWeightsProgress.' + payload.messageKey)
                );
            }
        };
        serviceLocator.socketEventManager.on(TransitApi.TRANSIT_NETWORK_DESIGN_LINE_WEIGHTS_PROGRESS, onProgress);
        executor
            .getLineSetSummaryCsv(jobId)
            .then(({ csv, filename }) => {
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                URL.revokeObjectURL(url);
            })
            .catch((err: unknown) => {
                setLineSetCsvError(err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                serviceLocator.socketEventManager.off(
                    TransitApi.TRANSIT_NETWORK_DESIGN_LINE_WEIGHTS_PROGRESS,
                    onProgress
                );
                setLineSetCsvDownloading(false);
                setLineWeightsProgressMessage(undefined);
            });
    }, [executor, jobId, t]);

    if (jobId === undefined) {
        return null;
    }

    return (
        <div style={{ marginTop: '1rem' }}>
            <div className="tr__form-buttons-container">
                <Button
                    color="blue"
                    label={t(
                        weightingState === 'complete' || hasExistingWeightsFile
                            ? 'transit:networkDesign.nodeWeighting.RestartNodeWeighting'
                            : 'transit:networkDesign.nodeWeighting.StartWeighting'
                    )}
                    onClick={onStartWeighting}
                    disabled={weightingState === 'running'}
                />
                {weightingState === 'running' && executor.pauseNodeWeighting !== undefined && !paused && (
                    <Button
                        color="grey"
                        label={t('transit:networkDesign.nodeWeighting.Pause')}
                        onClick={onPauseWeighting}
                    />
                )}
                {weightingState === 'running' && executor.resumeNodeWeighting !== undefined && paused && (
                    <Button
                        color="green"
                        label={t('transit:networkDesign.nodeWeighting.Resume')}
                        onClick={onResumeWeighting}
                    />
                )}
                {weightingState === 'running' && (
                    <Button
                        color="grey"
                        label={t('transit:networkDesign.nodeWeighting.Cancel')}
                        onClick={onCancelWeighting}
                    />
                )}
            </div>
            {weightingState === 'running' && (
                <p style={{ marginTop: '0.5rem' }}>
                    {t(
                        paused
                            ? 'transit:networkDesign.nodeWeighting.NodeWeightingPaused'
                            : 'transit:networkDesign.nodeWeighting.NodeWeightingRunning'
                    )}
                    {(weightingProgress ?? weightingMessage) &&
                        (() => {
                            if (!weightingProgress) return ` (${weightingMessage})`;
                            const hasByteData =
                                weightingProgress.totalBytes !== undefined && weightingProgress.totalBytes > 0;
                            const percent = hasByteData
                                ? Math.round(
                                    ((weightingProgress.bytesProcessed ?? 0) / weightingProgress.totalBytes!) * 100
                                )
                                : undefined;
                            const baseKey =
                                'transit:networkDesign.nodeWeighting.progress.' + weightingProgress.messageKey;
                            const noPercentKey = baseKey + 'NoPercent';
                            const useNoPercent = percent === undefined && t(noPercentKey) !== noPercentKey;
                            const key = useNoPercent ? noPercentKey : baseKey;
                            return ` (${t(key, { count: weightingProgress.rowsProcessed ?? 0, percent: percent ?? 0 })})`;
                        })()}
                </p>
            )}
            {weightingState === 'complete' && (
                <div style={{ marginTop: '0.5rem' }}>
                    <p>{t('transit:networkDesign.nodeWeighting.NodeWeightingComplete')}</p>
                    <div className="tr__form-buttons-container">
                        <Button
                            color="blue"
                            label={t('transit:networkDesign.nodeWeighting.DownloadNodeWeights')}
                            onClick={onDownloadWeights}
                        />
                    </div>
                </div>
            )}
            {weightingState === 'error' && (
                <p style={{ marginTop: '0.5rem', color: 'var(--danger)' }}>
                    {t('main:errors:Error')}
                    {weightingMessage && `: ${weightingMessage}`}
                </p>
            )}
            {executor.getLineSetSummaryCsv !== undefined && (
                <div style={{ marginTop: '1rem' }}>
                    <Button
                        color="blue"
                        label={t('transit:networkDesign.nodeWeighting.DownloadLineSetSummaryCsv')}
                        onClick={onDownloadLineSetCsv}
                        disabled={lineSetCsvDownloading}
                    />
                    {lineSetCsvDownloading && (
                        <span style={{ marginLeft: '0.5rem' }}>
                            {t('transit:networkDesign.nodeWeighting.DownloadingCsv')}
                            {lineWeightsProgressMessage && (
                                <span style={{ marginLeft: '0.5rem', color: 'var(--color-secondary)' }}>
                                    — {lineWeightsProgressMessage}
                                </span>
                            )}
                        </span>
                    )}
                    {lineSetCsvError && (
                        <p style={{ marginTop: '0.5rem', color: 'var(--danger)' }}>{lineSetCsvError}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default NodeWeightingConfigSection;
