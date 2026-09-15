/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { TrRoutingBatchJobParameters } from './TrRoutingBatchJobParameters';

import { TrRoutingBatchManager, TrRoutingBatchStartResult } from './TrRoutingBatchManager';

/**
 * Fake the lifecycle of the TrRoutingBatchManager
 * Aim to just pass information from an actual run of TrRoutingBatchManager
 * and do nothing.
 * Mainly used to have a global TrRouting shared between TrRoutingBatch jobs
 */
export class FakeTrRoutingBatchManager extends TrRoutingBatchManager {
    /**
     * Create a new TrRoutingBatchManager.
     *
     * @param progressEmitter - EventEmitter for progress reporting
     */
    constructor(
        progressEmitter: EventEmitter,
        private threadCount,
        private port
    ) {
        super(progressEmitter);
        // Nothing else to do
    }

    /**
     * Return the stored threadCount and port
     */
    async startBatch(workloadSize: number, options?: TrRoutingBatchJobParameters): Promise<TrRoutingBatchStartResult> {
        return {
            threadCount: this.threadCount,
            port: this.port
        };
    }

    /**
     * Do nothing, since we did not start anything
     */
    async stopBatch(): Promise<void> {}
}
