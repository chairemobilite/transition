/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    formatSeconds,
    resolveCheckpoint,
    resolveCheckpoints,
    getCheckpointKey,
    checkpointsOverlap
} from '../PathSegmentTimeUtils';
import type { Checkpoint, ResolvedCheckpoint } from '../PathSegmentTimeUtils';

describe('formatSeconds', () => {
    test('formats whole minutes', () => {
        expect(formatSeconds(120)).toBe('2m00s');
        expect(formatSeconds(60)).toBe('1m00s');
        expect(formatSeconds(0)).toBe('0m00s');
    });

    test('formats minutes and seconds', () => {
        expect(formatSeconds(75)).toBe('1m15s');
        expect(formatSeconds(90)).toBe('1m30s');
        expect(formatSeconds(125)).toBe('2m05s');
    });

    test('formats seconds only', () => {
        expect(formatSeconds(45)).toBe('0m45s');
        expect(formatSeconds(5)).toBe('0m05s');
    });

    test('rounds fractional seconds to the nearest integer', () => {
        expect(formatSeconds(75.3)).toBe('1m15s');
        expect(formatSeconds(75.7)).toBe('1m16s');
        expect(formatSeconds(59.6)).toBe('1m00s');
        expect(formatSeconds(0.4)).toBe('0m00s');
    });
});

const nodeIds = ['nodeA', 'nodeB', 'nodeC', 'nodeD', 'nodeE'];

describe('resolveCheckpoint', () => {
    test('resolves valid checkpoint to indices', () => {
        const checkpoint: Checkpoint = { fromNodeId: 'nodeB', toNodeId: 'nodeD' };
        const resolved = resolveCheckpoint(checkpoint, nodeIds);
        expect(resolved).toEqual({
            fromNodeId: 'nodeB',
            toNodeId: 'nodeD',
            fromNodeIndex: 1,
            toNodeIndex: 3
        });
    });

    test('returns undefined when fromNodeId not found', () => {
        const checkpoint: Checkpoint = { fromNodeId: 'unknown', toNodeId: 'nodeD' };
        expect(resolveCheckpoint(checkpoint, nodeIds)).toBeUndefined();
    });

    test('returns undefined when toNodeId not found', () => {
        const checkpoint: Checkpoint = { fromNodeId: 'nodeA', toNodeId: 'unknown' };
        expect(resolveCheckpoint(checkpoint, nodeIds)).toBeUndefined();
    });

    test('returns undefined when fromNodeId equals toNodeId', () => {
        const checkpoint: Checkpoint = { fromNodeId: 'nodeC', toNodeId: 'nodeC' };
        expect(resolveCheckpoint(checkpoint, nodeIds)).toBeUndefined();
    });

    test('returns undefined when fromNodeId is after toNodeId', () => {
        const checkpoint: Checkpoint = { fromNodeId: 'nodeD', toNodeId: 'nodeB' };
        expect(resolveCheckpoint(checkpoint, nodeIds)).toBeUndefined();
    });
});

describe('resolveCheckpoints', () => {
    test('resolves all valid checkpoints and filters out invalid ones', () => {
        const checkpoints: Checkpoint[] = [
            { fromNodeId: 'nodeA', toNodeId: 'nodeC' },
            { fromNodeId: 'unknown', toNodeId: 'nodeD' },
            { fromNodeId: 'nodeC', toNodeId: 'nodeE' }
        ];
        const resolved = resolveCheckpoints(checkpoints, nodeIds);
        expect(resolved).toHaveLength(2);
        expect(resolved[0].fromNodeIndex).toBe(0);
        expect(resolved[0].toNodeIndex).toBe(2);
        expect(resolved[1].fromNodeIndex).toBe(2);
        expect(resolved[1].toNodeIndex).toBe(4);
    });

    test('returns empty array when all checkpoints are invalid', () => {
        const checkpoints: Checkpoint[] = [
            { fromNodeId: 'x', toNodeId: 'y' }
        ];
        expect(resolveCheckpoints(checkpoints, nodeIds)).toEqual([]);
    });

    test('filters out same-node and reversed checkpoints', () => {
        const checkpoints: Checkpoint[] = [
            { fromNodeId: 'nodeA', toNodeId: 'nodeC' },
            { fromNodeId: 'nodeC', toNodeId: 'nodeC' }, // same node
            { fromNodeId: 'nodeD', toNodeId: 'nodeB' }, // reversed
            { fromNodeId: 'nodeC', toNodeId: 'nodeE' }
        ];
        const resolved = resolveCheckpoints(checkpoints, nodeIds);
        expect(resolved).toHaveLength(2);
        expect(resolved[0].fromNodeIndex).toBe(0);
        expect(resolved[0].toNodeIndex).toBe(2);
        expect(resolved[1].fromNodeIndex).toBe(2);
        expect(resolved[1].toNodeIndex).toBe(4);
    });
});

describe('getCheckpointKey', () => {
    test('returns fromNodeId-toNodeId', () => {
        expect(getCheckpointKey({ fromNodeId: 'nodeA', toNodeId: 'nodeC' })).toBe('nodeA-nodeC');
    });
});

describe('checkpointsOverlap', () => {
    const makeResolved = (from: number, to: number): ResolvedCheckpoint => ({
        fromNodeId: nodeIds[from],
        toNodeId: nodeIds[to],
        fromNodeIndex: from,
        toNodeIndex: to
    });

    test('overlapping checkpoints return true', () => {
        const a = makeResolved(0, 3); // nodeA → nodeD
        const b = makeResolved(2, 4); // nodeC → nodeE
        expect(checkpointsOverlap(a, b)).toBe(true);
        expect(checkpointsOverlap(b, a)).toBe(true);
    });

    test('adjacent checkpoints (no overlap) return false', () => {
        const a = makeResolved(0, 2); // nodeA → nodeC
        const b = makeResolved(2, 4); // nodeC → nodeE
        expect(checkpointsOverlap(a, b)).toBe(false);
        expect(checkpointsOverlap(b, a)).toBe(false);
    });

    test('non-overlapping checkpoints with gap return false', () => {
        const a = makeResolved(0, 1); // nodeA → nodeB
        const b = makeResolved(3, 4); // nodeD → nodeE
        expect(checkpointsOverlap(a, b)).toBe(false);
    });

    test('one checkpoint contained within another returns true', () => {
        const a = makeResolved(0, 4); // nodeA → nodeE
        const b = makeResolved(1, 3); // nodeB → nodeD
        expect(checkpointsOverlap(a, b)).toBe(true);
        expect(checkpointsOverlap(b, a)).toBe(true);
    });
});
