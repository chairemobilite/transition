/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { performance } from 'perf_hooks';

/** Console progress reporting during batch OD routing. */
export interface BatchRoutingLogProgress {
    beforeOdTrip(index: number): void;
    /** Called after each OD trip completes; `completedRoutingsCount` includes this trip. */
    afterOdTrip(odTripIndex: number, completedRoutingsCount: number): void;
    end(): void;
}

/**
 * Input data shared by all BatchRoutingLogProgress implementations. Each
 * implementation captures its own benchmark start and derives its own logging
 * cadence from `odTripsCount`, so the caller does not need to know about
 * those policies.
 */
export type BatchRoutingLogProgressParams = {
    /** Total number of OD trips in the batch (not only those left to route). */
    odTripsCount: number;
    /** Index at which routing (re)starts (>0 when resuming from checkpoint). */
    startIndex: number;
};

/** Upper bound on trips between two non-interactive log lines (avoids spam on huge batches). */
const NON_INTERACTIVE_MAX_PROGRESS_STEP = 500;

/** Single-line carriage-return progress bar for interactive TTY. */
class InteractiveBatchRoutingLogProgress implements BatchRoutingLogProgress {
    private readonly startIndex: number;
    private readonly totalToRoute: number;
    private readonly benchmarkStart: number;
    private lastProgressPct: number;

    constructor(params: BatchRoutingLogProgressParams) {
        this.startIndex = params.startIndex;
        this.totalToRoute = params.odTripsCount - params.startIndex;
        this.benchmarkStart = performance.now();
        this.lastProgressPct = -1;
    }

    beforeOdTrip(_index: number): void {
        // Bar is updated in afterOdTrip
    }

    afterOdTrip(_odTripIndex: number, completedRoutingsCount: number): void {
        if (this.totalToRoute <= 0) {
            return;
        }
        const done = completedRoutingsCount - this.startIndex;
        const pct = Math.min(100, Math.floor((done / this.totalToRoute) * 100));
        if (pct <= this.lastProgressPct) {
            return;
        }
        this.lastProgressPct = pct;
        const elapsed = (performance.now() - this.benchmarkStart) / 1000;
        const calcPerSec = elapsed > 0 ? (done / elapsed).toFixed(1) : '0';
        const barLen = 30;
        const filled = Math.round((pct / 100) * barLen);
        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLen - filled);
        process.stdout.write(`\r  [${bar}] ${pct}% (${done}/${this.totalToRoute}) ${calcPerSec} calc/s`);
    }

    end(): void {
        process.stdout.write('\n');
    }
}

/** Per-trip console lines (Routing odTrip, calc/sec) for pipes / CI / logs. */
class NonInteractiveBatchRoutingLogProgress implements BatchRoutingLogProgress {
    private readonly odTripsCount: number;
    private readonly startIndex: number;
    private readonly progressStep: number;
    private readonly benchmarkStart: number;
    private lastLogTime: number;
    private lastLogCount: number;

    constructor(params: BatchRoutingLogProgressParams) {
        this.odTripsCount = params.odTripsCount;
        this.startIndex = params.startIndex;
        // 1% of the batch, but no more than NON_INTERACTIVE_MAX_PROGRESS_STEP
        // trips between two log lines (avoids spam on huge batches).
        this.progressStep = Math.max(
            1,
            Math.min(NON_INTERACTIVE_MAX_PROGRESS_STEP, Math.ceil(params.odTripsCount / 100))
        );
        this.benchmarkStart = performance.now();
        this.lastLogTime = this.benchmarkStart;
        this.lastLogCount = params.startIndex;
    }

    beforeOdTrip(index: number): void {
        if ((index + 1) % this.progressStep === 0) {
            console.log(`Routing odTrip ${index + 1}/${this.odTripsCount}`);
        }
    }

    afterOdTrip(odTripIndex: number, completedRoutingsCount: number): void {
        if (odTripIndex > 0 && odTripIndex % 100 === 0) {
            const now = performance.now();
            const currentRate =
                Math.round((100 * (completedRoutingsCount - this.lastLogCount)) / ((now - this.lastLogTime) / 1000)) /
                100;
            this.lastLogTime = now;
            this.lastLogCount = completedRoutingsCount;

            const globalRate =
                Math.round((100 * (completedRoutingsCount - this.startIndex)) / ((now - this.benchmarkStart) / 1000)) /
                100;
            console.log(`calc/sec: ${globalRate} (current: ${currentRate})`);
        }
    }

    end(): void {
        // Progress is line-based; nothing to flush
    }
}

/**
 * Build the appropriate BatchRoutingLogProgress for the current stdout. This
 * keeps the TTY detection out of the batch routing orchestration code.
 *
 * @param params Shared parameters for progress reporting.
 * @returns An interactive bar for TTY stdout, line-based logs otherwise.
 */
export const createBatchRoutingLogProgress = (params: BatchRoutingLogProgressParams): BatchRoutingLogProgress =>
    process.stdout.isTTY === true
        ? new InteractiveBatchRoutingLogProgress(params)
        : new NonInteractiveBatchRoutingLogProgress(params);
