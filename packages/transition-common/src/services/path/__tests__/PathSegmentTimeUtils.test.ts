/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    resolveCheckpoint,
    resolveCheckpoints,
    getCheckpointKey,
    checkpointsOverlap,
    buildPeriodSegmentData,
    buildSegmentsByServiceAndPeriod,
    LocalSegmentTimes
} from '../PathSegmentTimeUtils';
import type { Checkpoint, ResolvedCheckpoint, ServiceSegmentTimes } from '../PathSegmentTimeUtils';
import type { TimeAndDistance } from '../PathTypes';

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

const makeBaseSegments = (travelTimes: number[], distances: (number | null)[]): TimeAndDistance[] =>
    travelTimes.map((travelTimeSeconds, i) => ({
        travelTimeSeconds,
        distanceMeters: distances[i] ?? null
    }));

const makeResolvedCheckpoint = (from: number, to: number): ResolvedCheckpoint => ({
    fromNodeId: nodeIds[from],
    toNodeId: nodeIds[to],
    fromNodeIndex: from,
    toNodeIndex: to
});

const makeService = (overrides: Partial<ServiceSegmentTimes> = {}): ServiceSegmentTimes => ({
    serviceId: 'service-1',
    averageTimesByPeriod: {},
    ...overrides
});

const makePathStub = (segments: TimeAndDistance[]): any => ({
    attributes: { data: { segments } }
});

describe('buildPeriodSegmentData', () => {
    test('computes travel, operating totals and speeds', () => {
        const segments = [
            { travelTimeSeconds: 100, distanceMeters: 1000 },
            { travelTimeSeconds: 200, distanceMeters: 2000 }
        ];
        const result = buildPeriodSegmentData(segments, [0, 10], 3000);
        expect(result.segments).toBe(segments);
        expect(result.dwellTimeSeconds).toEqual([0, 10]);
        expect(result.travelTimeWithoutDwellTimesSeconds).toBe(300);
        expect(result.operatingTimeWithoutLayoverTimeSeconds).toBe(310);
        expect(result.averageSpeedWithoutDwellTimesMetersPerSecond).toBe(10); // 3000/300
        expect(result.operatingSpeedMetersPerSecond).toBe(9.68); // round(3000/310 * 100)/100
    });

    test('returns 0 speeds when travel time is 0', () => {
        const result = buildPeriodSegmentData(
            [{ travelTimeSeconds: 0, distanceMeters: 100 }],
            [0],
            100
        );
        expect(result.averageSpeedWithoutDwellTimesMetersPerSecond).toBe(0);
        expect(result.operatingSpeedMetersPerSecond).toBe(0);
    });
});

describe('buildSegmentsByServiceAndPeriod', () => {
    const baseSegments = makeBaseSegments([30, 60, 90], [300, 600, 900]);
    const path = makePathStub(baseSegments);

    test('builds nested PeriodSegmentData for each serviceId/period', () => {
        const expandedData: LocalSegmentTimes = {
            'service-1': {
                am: [40, 80, 120],
                pm: [50, 100, 150]
            }
        };
        const result = buildSegmentsByServiceAndPeriod({
            expandedData,
            path,
            dwellTimes: [0, 10, 20]
        });
        expect(result['service-1']).toBeDefined();
        expect(result['service-1'].am.segments).toEqual([
            { travelTimeSeconds: 40, distanceMeters: 300 },
            { travelTimeSeconds: 80, distanceMeters: 600 },
            { travelTimeSeconds: 120, distanceMeters: 900 }
        ]);
        expect(result['service-1'].am.travelTimeWithoutDwellTimesSeconds).toBe(240);
        expect(result['service-1'].am.operatingTimeWithoutLayoverTimeSeconds).toBe(270); // 240 + 30 dwell
        expect(result['service-1'].pm.travelTimeWithoutDwellTimesSeconds).toBe(300);
    });

    test('skips empty period arrays', () => {
        const expandedData: LocalSegmentTimes = {
            'service-1': {
                am: [40, 80, 120],
                pm: []
            }
        };
        const result = buildSegmentsByServiceAndPeriod({
            expandedData,
            path,
            dwellTimes: [0, 0, 0]
        });
        expect(result['service-1'].am).toBeDefined();
        expect(result['service-1'].pm).toBeUndefined();
    });

    test('returns empty object when expandedData is empty', () => {
        const result = buildSegmentsByServiceAndPeriod({
            expandedData: {},
            path,
            dwellTimes: []
        });
        expect(result).toEqual({});
    });

    test('handles segments with null distances', () => {
        const pathWithNulls = makePathStub(makeBaseSegments([30, 60], [null, 500]));
        const expandedData: LocalSegmentTimes = {
            'service-1': { am: [30, 60] }
        };
        const result = buildSegmentsByServiceAndPeriod({
            expandedData,
            path: pathWithNulls,
            dwellTimes: [0, 0]
        });
        expect(result['service-1'].am.segments[0].distanceMeters).toBeNull();
        expect(result['service-1'].am.segments[1].distanceMeters).toBe(500);
    });
});
