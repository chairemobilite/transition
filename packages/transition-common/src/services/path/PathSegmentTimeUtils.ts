/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// === Types ===

export type Checkpoint = {
    fromNodeId: string;
    toNodeId: string;
};

/** Checkpoint with resolved node indices — for use in calculations and rendering */
export type ResolvedCheckpoint = Checkpoint & {
    fromNodeIndex: number;
    toNodeIndex: number;
};

export type EditMode = 'segment' | 'checkpoint';

// === Pure helpers ===

/** Resolve a checkpoint's node IDs to their current indices in the nodes array.
 *  Returns undefined if either node ID is not found. */
export const resolveCheckpoint = (checkpoint: Checkpoint, nodeIds: string[]): ResolvedCheckpoint | undefined => {
    const fromIndex = nodeIds.indexOf(checkpoint.fromNodeId);
    const toIndex = nodeIds.indexOf(checkpoint.toNodeId);
    if (fromIndex === -1 || toIndex === -1) return undefined;
    return { ...checkpoint, fromNodeIndex: fromIndex, toNodeIndex: toIndex };
};

/** Resolve all checkpoints, filtering out any whose nodes no longer exist in the path */
export const resolveCheckpoints = (checkpoints: Checkpoint[], nodeIds: string[]): ResolvedCheckpoint[] =>
    checkpoints.map((cp) => resolveCheckpoint(cp, nodeIds)).filter((cp): cp is ResolvedCheckpoint => cp !== undefined);

/** Build a unique key for a checkpoint (used for indexing target times) */
export const getCheckpointKey = (checkpoint: Checkpoint): string =>
    `${checkpoint.fromNodeId}-${checkpoint.toNodeId}`;

/** Check whether two checkpoints overlap (requires resolved indices) */
export const checkpointsOverlap = (a: ResolvedCheckpoint, b: ResolvedCheckpoint): boolean =>
    a.fromNodeIndex < b.toNodeIndex && b.fromNodeIndex < a.toNodeIndex;

/** Format seconds as "XmYYs", e.g. 75 → "1m15s", 120 → "2m00s", 45 → "0m45s" */
export const formatSeconds = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m${secs < 10 ? '0' : ''}${secs}s`;
};

/** Snap seconds to the nearest valid choice (0, 5, 10, ..., 55) */
export const snapSeconds = (secs: number): number => {
    const choices = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    let closest = 0;
    let minDiff = Math.abs(secs - 0);
    for (const c of choices) {
        const diff = Math.abs(secs - c);
        if (diff < minDiff) {
            minDiff = diff;
            closest = c;
        }
    }
    return closest;
};

/**
 * Distribute a target total time across segments proportionally to base times.
 * Returns a new array of segment times for the given span.
 */
export const distributeTime = (
    segments: { travelTimeSeconds: number }[],
    fromIndex: number,
    toIndex: number,
    targetTotal: number
): number[] => {
    const span = segments.slice(fromIndex, toIndex);
    const baseTotal = span.reduce((sum, s) => sum + s.travelTimeSeconds, 0);

    if (baseTotal === 0) {
        // Distribute evenly if all base times are zero
        const count = toIndex - fromIndex;
        const each = Math.floor(targetTotal / count);
        const remainder = targetTotal - each * count;
        return span.map((_, i) => each + (i < remainder ? 1 : 0));
    }

    const ratio = targetTotal / baseTotal;
    const result = span.map((s) => Math.round(s.travelTimeSeconds * ratio));

    // Adjust rounding error on the last segment
    const distributed = result.reduce((sum, v) => sum + v, 0);
    if (distributed !== targetTotal && result.length > 0) {
        result[result.length - 1] += targetTotal - distributed;
    }

    return result;
};
