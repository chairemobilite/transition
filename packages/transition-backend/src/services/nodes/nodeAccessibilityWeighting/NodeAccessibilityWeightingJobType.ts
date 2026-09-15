/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { WeightingExecutionConfig } from './NodeAccessibilityWeightingService';

/**
 * Job data type for node accessibility weighting, following the
 * BatchRouteJobType / BatchAccessMapJobType pattern.
 *
 * **Pause/resume:** pause sets DB status to `paused`. The worker detects
 * this via {@link getTaskCancelledFct} (background polling) and between-chunk
 * DB reads. The current OSRM sub-batch completes but partial chunk results
 * are discarded — the checkpoint stays at the last full chunk. RESUME uses
 * `ExecutableJob.resume` (re-enqueue) like other jobs; the worker reloads
 * the partial file and skips already-processed points.
 *
 * **Checkpointing:** `internal_data.checkpoint` (persisted by the
 * `newProgressEmitter` `'checkpoint'` handler) plus `node_weights.partial.csv`
 * in the job directory allow resuming without double-counting. The partial
 * file embeds the intrinsic-point count as a trailer marker, making it the
 * authoritative source. `CheckpointTracker` is not used here because chunks
 * are processed sequentially (it is designed for parallel out-of-order steps).
 * A new run from **pending** clears checkpoint state.
 *
 * Final weights are written as `node_weights_<jobId>.csv` and registered
 * in `resources.files.output`. Finished jobs are not re-run in place
 * (duplicate job to copy parameters and input CSV).
 */
export type NodeAccessibilityWeightingJobType = {
    name: 'nodeAccessibilityWeighting';
    data: {
        parameters: {
            description?: string;
            config: WeightingExecutionConfig;
        };
        results?: { pointCount: number; nodeCount: number; nodesWithWeight: number };
    };
    files: { input: true; output: true };
};
