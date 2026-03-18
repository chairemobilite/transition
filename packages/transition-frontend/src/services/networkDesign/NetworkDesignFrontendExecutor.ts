/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { TransitApi } from 'transition-common/lib/api/transit';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';

export class NetworkDesignFrontendExecutor {
    private static async _calculate(
        transitNetworkDesignJobParameters: TransitNetworkJobConfigurationType,
        existingJobId?: number
    ): Promise<any> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_CREATE,
                { jobParameters: transitNetworkDesignJobParameters, existingJobId },
                (routingStatus: Status.Status<unknown>) => {
                    if (Status.isStatusOk(routingStatus)) {
                        resolve(Status.unwrap(routingStatus));
                    } else if (routingStatus.error === 'UserDiskQuotaReached') {
                        reject(
                            new TrError(
                                'Maximum allowed disk space reached',
                                'TRJOB0001',
                                'transit:transitRouting:errors:UserDiskQuotaReached'
                            )
                        );
                    } else {
                        reject(routingStatus.error);
                    }
                }
            );
        });
    }

    // TODO Properly type the return value
    static async execute(
        transitNetworkDesignJobParameters: TransitNetworkJobConfigurationType,
        existingJobId?: number
    ): Promise<unknown> {
        try {
            const jobStatus = await NetworkDesignFrontendExecutor._calculate(
                transitNetworkDesignJobParameters,
                existingJobId
            );
            return jobStatus;
        } catch (error) {
            // TODO Better handle erroneous and success return statuses
            if (TrError.isTrError(error)) {
                throw error;
            }
            const trError = new TrError(
                `cannot calculate transit batch route with trRouting: ${error}`,
                'TRBROUTING0001',
                'transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError'
            );
            console.error(trError.export());
            throw trError;
        }
    }

    static async getCalculationParametersForJob(jobId: number): Promise<{
        parameters: TransitNetworkJobConfigurationType;
        existingFileNames?: Record<string, string>;
    }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_REPLAY,
                jobId,
                (
                    routingStatus: Status.Status<{
                        parameters: TransitNetworkJobConfigurationType;
                        existingFileNames?: Record<string, string>;
                    }>
                ) => {
                    if (Status.isStatusOk(routingStatus)) {
                        resolve(Status.unwrap(routingStatus));
                    } else if (routingStatus.error === 'InputFileUnavailable') {
                        reject(
                            new TrError(
                                'Input file has not been found',
                                'TRJOB0002',
                                'transit:batchCalculation:errors:InputFileUnavailable'
                            )
                        );
                    } else {
                        reject(routingStatus.error);
                    }
                }
            );
        });
    }

    /**
     * Save config without running the job. Creates a new pending job or updates the existing one.
     * @param jobParameters Current form parameters
     * @param existingJobId If set, updates this job (must be pending); otherwise creates a new job
     * @returns The job id (existing or newly created)
     */
    static async saveConfig(
        jobParameters: TransitNetworkJobConfigurationType,
        existingJobId?: number
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_SAVE_CONFIG,
                { jobParameters, existingJobId },
                (status: Status.Status<{ jobId: number }>) => {
                    if (Status.isStatusOk(status)) {
                        resolve(Status.unwrap(status).jobId);
                    } else {
                        reject(status.error);
                    }
                }
            );
        });
    }

    /**
     * Start node weighting for an existing evolutionary transit network design job.
     * Listens for progress and complete events on the socket; caller should subscribe
     * to TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_PROGRESS and
     * TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_COMPLETE for UI updates.
     */
    static async startNodeWeighting(jobId: number): Promise<{ jobId: number }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_START_NODE_WEIGHTING,
                jobId,
                (status: Status.Status<{ jobId: number }>) => {
                    if (Status.isStatusOk(status)) {
                        resolve(Status.unwrap(status));
                    } else {
                        reject(status.error);
                    }
                }
            );
        });
    }

    /**
     * Cancel running node weighting for the given job. No-op if no weighting is running
     * for that job. The complete event will be emitted with cancelled: true.
     */
    static cancelNodeWeighting(jobId: number): void {
        serviceLocator.socketEventManager.emit(TransitApi.TRANSIT_NETWORK_DESIGN_CANCEL_NODE_WEIGHTING, jobId);
    }

    /**
     * Get current node weighting status for a job (e.g. when (re)opening the form).
     * Returns whether weighting is currently running, hasWeightsFile if not running, and last progress if running.
     */
    static getNodeWeightingStatus(
        jobId: number
    ): Promise<{ running: boolean; rowsProcessed?: number; messageKey?: string; hasWeightsFile?: boolean }> {
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_STATUS,
                jobId,
                (
                    status: Status.Status<{
                        running: boolean;
                        rowsProcessed?: number;
                        messageKey?: string;
                        hasWeightsFile?: boolean;
                    }>
                ) => {
                    if (Status.isStatusOk(status)) {
                        resolve(Status.unwrap(status));
                    } else {
                        resolve({ running: false });
                    }
                }
            );
        });
    }

    /**
     * Get node weights file as enriched CSV (uuid, lat, lon, code, name, weight) and trigger download.
     */
    static async getNodeWeightsFile(jobId: number): Promise<{ csv: string; filename: string }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_GET_NODE_WEIGHTS_FILE,
                jobId,
                (status: Status.Status<{ csv: string; filename: string }>) => {
                    if (Status.isStatusOk(status)) {
                        resolve(Status.unwrap(status));
                    } else {
                        reject(status.error);
                    }
                }
            );
        });
    }

    /**
     * Upload a node weights CSV file for the job (alternative to running weighting).
     * CSV must have columns uuid (or node_uuid) and weight.
     */
    static async uploadNodeWeights(jobId: number, csvContent: string): Promise<void> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_UPLOAD_NODE_WEIGHTS,
                { jobId, csvContent },
                (status: Status.Status<unknown>) => {
                    if (Status.isStatusOk(status)) {
                        resolve();
                    } else {
                        reject(status.error);
                    }
                }
            );
        });
    }

    /**
     * Get total node weight per line for the job's line set (with node weights applied).
     * Used in the network design panel to show line weights before running the simulation.
     */
    static async getLineWeights(jobId: number): Promise<{
        lineWeights: { lineId: string; shortname: string; totalWeight: number | null }[];
        hasNodeWeightsFile: boolean;
    }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_GET_LINE_WEIGHTS,
                jobId,
                (
                    status: Status.Status<{
                        lineWeights: { lineId: string; shortname: string; totalWeight: number | null }[];
                        hasNodeWeightsFile: boolean;
                    }>
                ) => {
                    if (Status.isStatusOk(status)) {
                        resolve(Status.unwrap(status));
                    } else {
                        reject(status.error);
                    }
                }
            );
        });
    }

    /**
     * Get line set summary CSV (line_id, shortname, total_weight, total_length_meters, total_cycle_time_seconds)
     * for simple bidirectional lines. Triggers download on success; use for saving the CSV file.
     */
    static async getLineSetSummaryCsv(jobId: number): Promise<{ csv: string; filename: string }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.TRANSIT_NETWORK_DESIGN_GET_LINE_SET_SUMMARY_CSV,
                jobId,
                (status: Status.Status<{ csv: string; filename: string }>) => {
                    if (Status.isStatusOk(status)) {
                        resolve(Status.unwrap(status));
                    } else {
                        reject(status.error);
                    }
                }
            );
        });
    }
}

export default NetworkDesignFrontendExecutor;
