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

/** Single-line carriage-return progress bar for interactive TTY. */
export class InteractiveBatchRoutingLogProgress implements BatchRoutingLogProgress {
    private lastProgressPct: number;

    constructor(
        private readonly startIndex: number,
        private readonly totalToRoute: number,
        private readonly benchmarkStart: number
    ) {
        this.lastProgressPct = -1;
    }

    beforeOdTrip(_index: number): void {
        // Bar is updated in afterOdTrip
    }

    afterOdTrip(_odTripIndex: number, completedRoutingsCount: number): void {
        const done = completedRoutingsCount - this.startIndex;
        const pct = Math.floor((done / this.totalToRoute) * 100);
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
export class NonInteractiveBatchRoutingLogProgress implements BatchRoutingLogProgress {
    private lastLogTime = performance.now();
    private lastLogCount: number;

    constructor(
        private readonly odTripsCount: number,
        private readonly startIndex: number,
        private readonly progressStep: number,
        private readonly benchmarkStart: number
    ) {
        this.lastLogCount = startIndex;
    }

    beforeOdTrip(index: number): void {
        if ((index + 1) % this.progressStep === 0) {
            console.log(`Routing odTrip ${index + 1}/${this.odTripsCount}`);
        }
    }

    afterOdTrip(odTripIndex: number, completedRoutingsCount: number): void {
        if (this.benchmarkStart >= 0 && odTripIndex > 0 && odTripIndex % 100 === 0) {
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
