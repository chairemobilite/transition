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
    if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) return undefined;
    return { ...checkpoint, fromNodeIndex: fromIndex, toNodeIndex: toIndex };
};

/** Resolve all checkpoints, filtering out any whose nodes no longer exist in the path */
export const resolveCheckpoints = (checkpoints: Checkpoint[], nodeIds: string[]): ResolvedCheckpoint[] =>
    checkpoints.map((cp) => resolveCheckpoint(cp, nodeIds)).filter((cp): cp is ResolvedCheckpoint => cp !== undefined);

/** Build a unique key for a checkpoint (used for indexing target times) */
export const getCheckpointKey = (checkpoint: Checkpoint): string => `${checkpoint.fromNodeId}-${checkpoint.toNodeId}`;

/** Check whether two checkpoints overlap (requires resolved indices) */
export const checkpointsOverlap = (a: ResolvedCheckpoint, b: ResolvedCheckpoint): boolean =>
    a.fromNodeIndex < b.toNodeIndex && b.fromNodeIndex < a.toNodeIndex;

/** Format seconds as "XmYYs", e.g. 75 → "1m15s", 120 → "2m00s", 45 → "0m45s" */
export const formatSeconds = (seconds: number): string => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}m${secs < 10 ? '0' : ''}${secs}s`;
};
