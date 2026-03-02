/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { TransitApi } from 'transition-common/lib/api/transit';
import type { NodeWeightingConfig } from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';

/** Parameters for a standalone node weighting job (matches backend NodeWeightingJobParameters). */
export type NodeWeightingJobParameters = {
    description?: string;
    nodeWeighting: NodeWeightingConfig;
};

export type NodeWeightingJobListItem = {
    id: number;
    description?: string;
    hasWeightsFile: boolean;
};

export class NodeWeightingFrontendExecutor {
    static async createJob(parameters: NodeWeightingJobParameters): Promise<{ jobId: number }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_WEIGHTING_CREATE,
                parameters,
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

    static async saveConfig(
        parameters: NodeWeightingJobParameters,
        existingJobId?: number
    ): Promise<{ jobId: number }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_WEIGHTING_SAVE_CONFIG,
                { parameters, existingJobId },
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

    static async listJobs(): Promise<{ jobs: NodeWeightingJobListItem[] }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_WEIGHTING_LIST,
                (
                    status: Status.Status<{
                        jobs: NodeWeightingJobListItem[];
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

    static async getParameters(jobId: number): Promise<{
        parameters: NodeWeightingJobParameters;
        existingFileNames?: Record<string, string>;
    }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_WEIGHTING_GET_PARAMETERS,
                jobId,
                (
                    status: Status.Status<{
                        parameters: NodeWeightingJobParameters;
                        existingFileNames?: Record<string, string>;
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

    static async startNodeWeighting(jobId: number): Promise<{ jobId: number }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_WEIGHTING_START,
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

    static cancelNodeWeighting(jobId: number): void {
        serviceLocator.socketEventManager.emit(TransitApi.NODE_WEIGHTING_CANCEL, jobId);
    }

    static pauseNodeWeighting(jobId: number): void {
        serviceLocator.socketEventManager.emit(TransitApi.NODE_WEIGHTING_PAUSE, jobId);
    }

    static resumeNodeWeighting(jobId: number): void {
        serviceLocator.socketEventManager.emit(TransitApi.NODE_WEIGHTING_RESUME, jobId);
    }

    static getNodeWeightingStatus(jobId: number): Promise<{
        running: boolean;
        paused?: boolean;
        rowsProcessed?: number;
        messageKey?: string;
        hasWeightsFile?: boolean;
    }> {
        return new Promise((resolve) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_WEIGHTING_STATUS,
                jobId,
                (
                    status: Status.Status<{
                        running: boolean;
                        paused?: boolean;
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

    static async getNodeWeightsFile(jobId: number): Promise<{ csv: string; filename: string }> {
        return new Promise((resolve, reject) => {
            serviceLocator.socketEventManager.emit(
                TransitApi.NODE_WEIGHTING_GET_FILE,
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

    static readonly PROGRESS_EVENT = TransitApi.NODE_WEIGHTING_PROGRESS;
    static readonly COMPLETE_EVENT = TransitApi.NODE_WEIGHTING_COMPLETE;
}
