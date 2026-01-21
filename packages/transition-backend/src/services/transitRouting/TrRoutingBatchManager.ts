/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import MemcachedProcessManager, {
    MemcachedInstance
} from 'chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager';
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
 * Memcached handling:
 * - If a memcachedServer is provided (via startBatch options),
 *   uses that external server and does not manage its lifecycle.
 * - If no memcachedServer is provided, starts a new memcached instance and
 *   stops it when stopBatch is called.
 *
 * TODO: Class name is a bit confusing, we should find something better, but it works for now.
 *       We should return an instance which represent the TrRouting instance, like the OSRMMode for OSRM,
 *       Instead of just returning a port number
 */
export class TrRoutingBatchManager {
    private memcachedInstance?: MemcachedInstance;
    private started: boolean = false; //Track if we are in the started or stopped state
    /**
     * Create a new TrRoutingBatchManager.
     *
     * @param progressEmitter - EventEmitter for progress reporting
     */
    constructor(private progressEmitter: EventEmitter) {
        // Nothing else to do
    }

    /**
     * Start TrRouting batch instance with the specified configuration.
     * Calculates the optimal number of threads based on the workload size.
     * Port, debug settings, and max parallel threads are determined by
     * TrRoutingProcessManager from server configuration.
     *
     * Memcached is handled as follows:
     * 1. If options.memcachedServer is provided, use it
     * 2. Else start a new memcached instance (will be stopped in stopBatch)
     *
     * @param workloadSize - Number of items to process (OD trips or locations)
     * @param options - Optional TrRouting configuration (e.g., cache directory, memcached server)
     * @returns Promise with thread count and port information
     * @throws Error if TrRouting instance fail to start
     */
    async startBatch(workloadSize: number, options?: TrRoutingBatchJobParameters): Promise<TrRoutingBatchStartResult> {
        if (this.started) {
            throw new Error('startBatch was already called');
        }

        const threadCount = this.calculateThreadCount(workloadSize);

        try {
            this.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServer', progress: 0.0 });

            // Make sure TrRouting is stopped before restarting
            await TrRoutingProcessManager.stopBatch();

            // Determine memcached server: options > start new one
            let memcachedServer = options?.memcachedServer;

            if (!memcachedServer) {
                // Start our own memcached instance
                const instance = await MemcachedProcessManager.start();
                if (instance) {
                    this.memcachedInstance = instance;
                    memcachedServer = instance.getServer();
                } else {
                    // Only print an error message on failure. Calculation will still
                    // be able to complete, but could be slower
                    console.warn('Failed to start memcached, calculation could be slower');
                }
            }

            // Start the TrRouting instance
            // Port, debug, and thread count are determined by TrRoutingProcessManager from config
            const startStatus = await TrRoutingProcessManager.startBatch(threadCount, {
                cacheDirectoryPath: options?.cacheDirectoryPath,
                memcachedServer
            });

            if (startStatus.status !== 'started') {
                // We failed at starting TrRouting, stop memcached if we started it
                if (this.memcachedInstance) {
                    console.info('Stopping memcached since we failed to start TrRouting');
                    // We on purpose do not do the await on this call, it will eventually finish
                    // and get cleaned up.
                    this.memcachedInstance.stop();
                    this.memcachedInstance = undefined;
                }
                throw new Error(`Failed to start TrRouting instance: ${startStatus.status}`);
            }

            console.log('trRouting multiple startStatus', startStatus);

            this.started = true;

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
     * Also stops the memcached instance if it was started by this manager.
     * Port is determined by TrRoutingProcessManager from server configuration.
     */
    async stopBatch(): Promise<void> {
        try {
            this.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServer', progress: 0.0 });

            if (!this.started) {
                console.warn('Batch Manager was not started, attempting to stop anyway');
            }

            const stopStatus = await TrRoutingProcessManager.stopBatch();
            console.log('trRouting multiple stopStatus', stopStatus);

            // Stop memcached if we started it
            if (this.memcachedInstance) {
                await this.memcachedInstance.stop();
                this.memcachedInstance = undefined;
            }

            this.started = false;
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
        // not processes nowadays.
        return Math.min(Math.max(1, Math.ceil(workloadSize / 3)), serverConfig.maxParallelCalculators);
    }
}
