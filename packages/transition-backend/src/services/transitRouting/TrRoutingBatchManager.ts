/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { TrRoutingBatchJobParameters } from './TrRoutingBatchJobParameters';
import serverConfig from 'chaire-lib-backend/lib/config/server.config';

/**
 * Result of starting TrRouting batch instance
 */
export type TrRoutingBatchStartResult = {
    /**
     * Number of TrRouting threads started
     */
    threadCount: number;
    /**
     * Port number where TrRouting instance is listening
     */
    port: number;
};

/**
 * Common manager for TrRouting batch processing lifecycle.
 * Handles starting and stopping TrRouting instance with proper
 * progress reporting and configuration.
 *
 * TODO: Class name is a bit confusing, we should find something better, but it works for now.
 *       We should return an instance which represent the TrRouting instance, like the OSRMMode for OSRM,
 *       Instead of just returning a port number
 */
export class TrRoutingBatchManager {
    constructor(private progressEmitter: EventEmitter) {
        // Nothing else to do
    }

    /**
     * Start TrRouting batch instance with the specified configuration.
     * Calculates the optimal number of threads based on the workload size.
     * Port, debug settings, and max parallel threads are determined by
     * TrRoutingProcessManager from server configuration.
     *
     * @param workloadSize - Number of items to process (OD trips or locations)
     * @param options - Optional TrRouting configuration (e.g., cache directory)
     * @returns Promise with thread count and port information
     * @throws Error if TrRouting instance fail to start
     */
    async startBatch(workloadSize: number, options?: TrRoutingBatchJobParameters): Promise<TrRoutingBatchStartResult> {
        const threadCount = this.calculateThreadCount(workloadSize);

        try {
            this.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServer', progress: 0.0 });

            // Make sure processes are stopped before restarting
            await TrRoutingProcessManager.stopBatch();

            // Start the TrRouting instance
            // Port, debug, and thread count are determined by TrRoutingProcessManager from config
            const startStatus = await TrRoutingProcessManager.startBatch(threadCount, {
                cacheDirectoryPath: options?.cacheDirectoryPath
            });

            if (startStatus.status !== 'started') {
                throw new Error(`Failed to start TrRouting instance: ${startStatus.status}`);
            }

            console.log('trRouting multiple startStatus', startStatus);

            return {
                threadCount,
                port: startStatus.port
            };
        } finally {
            this.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServer', progress: 1.0 });
        }
    }

    /**
     * Stop TrRouting batch instance.
     * Port is determined by TrRoutingProcessManager from server configuration.
     */
    async stopBatch(): Promise<void> {
        try {
            this.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServer', progress: 0.0 });
            const stopStatus = await TrRoutingProcessManager.stopBatch();
            console.log('trRouting multiple stopStatus', stopStatus);
        } finally {
            this.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServer', progress: 1.0 });
        }
    }

    /**
     * Calculate the optimal number of TrRouting thread to start.
     * Divides workload by 3 for minimum calculation count to avoid creating
     * too many processes if workload is small.
     * Max parallel thread is based on server configuration.
     *
     * @param workloadSize - Number of items to process
     * @returns Optimal number of threads to start (at least 1)
     */
    private calculateThreadCount(workloadSize: number): number {
        // TODO Investigate if it still make sense to divide by 3, since we manage thread and
        // not processes nowaday.
        return Math.min(Math.max(1, Math.ceil(workloadSize / 3)), serverConfig.maxParallelCalculators);
    }
}
