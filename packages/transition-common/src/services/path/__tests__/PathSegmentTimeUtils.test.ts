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
    checkpointsOverlap,
    buildPeriodSegmentData,
    distributeCheckpointForService,
    applyPendingCheckpointDistributions,
    buildSegmentsByServiceAndPeriod,
    LocalSegmentTimes
} from '../PathSegmentTimeUtils';
import type { Checkpoint, ResolvedCheckpoint } from '../PathSegmentTimeUtils';
import type { ServiceGroup } from '../PathServiceGrouping';
import type { TimeAndDistance } from '../PathTypes';
import { pathGeographyUtils } from '../PathGeographyUtils';

jest.mock('../PathGeographyUtils', () => ({
    pathGeographyUtils: {
        scaleTimesToTarget: jest.fn(),
        calculateSegmentTimesForCheckpoint: jest.fn()
    }
}));

const scaleTimesToTargetMock = pathGeographyUtils.scaleTimesToTarget as jest.Mock;
const calculateSegmentTimesForCheckpointMock = pathGeographyUtils.calculateSegmentTimesForCheckpoint as jest.Mock;

beforeEach(() => {
    scaleTimesToTargetMock.mockReset();
    calculateSegmentTimesForCheckpointMock.mockReset();
});

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

const makeGroup = (overrides: Partial<ServiceGroup> = {}): ServiceGroup => ({
    serviceIds: ['service-1'],
    activeDays: ['monday'],
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

describe('distributeCheckpointForService', () => {
    const baseSegments = makeBaseSegments([30, 60, 90, 120], [300, 600, 900, 1200]);
    const checkpoint = makeResolvedCheckpoint(1, 3); // covers segments index 1..2

    test('initializes missing period with base segment times when no average available', () => {
        const data: LocalSegmentTimes = {};
        distributeCheckpointForService({
            data,
            group: makeGroup(),
            checkpoint,
            osrmTimes: null,
            targetTimesByPeriod: { am: 200 },
            baseSegments
        });
        expect(data['service-1']['am']).toHaveLength(4);
        // Segments outside the checkpoint keep base times (index 0 and 3)
        expect(data['service-1']['am'][0]).toBe(30);
        expect(data['service-1']['am'][3]).toBe(120);
        // Inside the checkpoint: distributed evenly since osrmTimes is null (target 200 / 2 segments = 100 each)
        expect(data['service-1']['am'][1]).toBe(100);
        expect(data['service-1']['am'][2]).toBe(100);
    });

    test('uses average times from group as defaults for missing periods', () => {
        const data: LocalSegmentTimes = {};
        const group = makeGroup({ averageTimesByPeriod: { am: [10, 20, 30, 40] } });
        distributeCheckpointForService({
            data,
            group,
            checkpoint,
            osrmTimes: null,
            targetTimesByPeriod: { am: 100 },
            baseSegments
        });
        // Outside checkpoint: from averages
        expect(data['service-1']['am'][0]).toBe(10);
        expect(data['service-1']['am'][3]).toBe(40);
        // Inside checkpoint: replaced by even distribution
        expect(data['service-1']['am'][1]).toBe(50);
        expect(data['service-1']['am'][2]).toBe(50);
    });

    test('skips periods where the current total already matches the target', () => {
        const data: LocalSegmentTimes = {
            'service-1': { am: [30, 50, 100, 120] }
        };
        distributeCheckpointForService({
            data,
            group: makeGroup(),
            checkpoint,
            osrmTimes: [1, 1], // would trigger scaling if not skipped
            targetTimesByPeriod: { am: 150 }, // 50+100 = 150
            baseSegments
        });
        // scaleTimesToTarget should not be called since current total matches
        expect(scaleTimesToTargetMock).not.toHaveBeenCalled();
        expect(data['service-1']['am']).toEqual([30, 50, 100, 120]);
    });

    test('uses OSRM scaled times when provided', () => {
        scaleTimesToTargetMock.mockReturnValue([60, 140]);
        const data: LocalSegmentTimes = {};
        distributeCheckpointForService({
            data,
            group: makeGroup(),
            checkpoint,
            osrmTimes: [20, 55],
            targetTimesByPeriod: { am: 200 },
            baseSegments
        });
        expect(scaleTimesToTargetMock).toHaveBeenCalledWith([20, 55], 200);
        expect(data['service-1']['am'][1]).toBe(60);
        expect(data['service-1']['am'][2]).toBe(140);
        // Outside the checkpoint must remain untouched
        expect(data['service-1']['am'][0]).toBe(30);
        expect(data['service-1']['am'][3]).toBe(120);
    });

    test('falls back to even distribution when scaleTimesToTarget returns null', () => {
        scaleTimesToTargetMock.mockReturnValue(null);
        const data: LocalSegmentTimes = {};
        distributeCheckpointForService({
            data,
            group: makeGroup(),
            checkpoint,
            osrmTimes: [0, 0],
            targetTimesByPeriod: { am: 201 }, // 201/2 = 100 with remainder 1
            baseSegments
        });
        // Remainder goes to first segment
        expect(data['service-1']['am'][1]).toBe(101);
        expect(data['service-1']['am'][2]).toBe(100);
    });

    test('handles multiple periods in one call', () => {
        scaleTimesToTargetMock.mockReturnValueOnce([30, 70]).mockReturnValueOnce([80, 220]);
        const data: LocalSegmentTimes = {};
        distributeCheckpointForService({
            data,
            group: makeGroup(),
            checkpoint,
            osrmTimes: [20, 55],
            targetTimesByPeriod: { am: 100, pm: 300 },
            baseSegments
        });
        expect(data['service-1']['am'][1]).toBe(30);
        expect(data['service-1']['am'][2]).toBe(70);
        expect(data['service-1']['pm'][1]).toBe(80);
        expect(data['service-1']['pm'][2]).toBe(220);
    });
});

describe('applyPendingCheckpointDistributions', () => {
    const baseSegments = makeBaseSegments([30, 60, 90, 120], [300, 600, 900, 1200]);
    const path = makePathStub(baseSegments);
    const checkpoint = makeResolvedCheckpoint(1, 3);
    const checkpointKey = `${getCheckpointKey(checkpoint)}_service-1`;

    test('fetches OSRM times and distributes across all groups when targets differ', async () => {
        calculateSegmentTimesForCheckpointMock.mockResolvedValue([20, 55]);
        scaleTimesToTargetMock.mockReturnValue([60, 140]);
        const dataToUpdate: LocalSegmentTimes = {};
        await applyPendingCheckpointDistributions({
            dataToUpdate,
            path,
            resolvedCheckpoints: [checkpoint],
            serviceGroups: [makeGroup()],
            checkpointTargets: { [checkpointKey]: { am: 200 } }
        });
        expect(calculateSegmentTimesForCheckpointMock).toHaveBeenCalledWith(path, 1, 3);
        expect(scaleTimesToTargetMock).toHaveBeenCalledWith([20, 55], 200);
        expect(dataToUpdate['service-1']['am'][1]).toBe(60);
        expect(dataToUpdate['service-1']['am'][2]).toBe(140);
    });

    test('skips checkpoint entirely when all group targets already match', async () => {
        const dataToUpdate: LocalSegmentTimes = {
            'service-1': { am: [30, 50, 100, 120] } // 50+100 = 150 matches target
        };
        await applyPendingCheckpointDistributions({
            dataToUpdate,
            path,
            resolvedCheckpoints: [checkpoint],
            serviceGroups: [makeGroup()],
            checkpointTargets: { [checkpointKey]: { am: 150 } }
        });
        expect(calculateSegmentTimesForCheckpointMock).not.toHaveBeenCalled();
        expect(scaleTimesToTargetMock).not.toHaveBeenCalled();
        expect(dataToUpdate['service-1']['am']).toEqual([30, 50, 100, 120]);
    });

    test('fetches OSRM once per checkpoint and reuses for every group', async () => {
        calculateSegmentTimesForCheckpointMock.mockResolvedValue([20, 55]);
        scaleTimesToTargetMock.mockReturnValueOnce([60, 140]).mockReturnValueOnce([90, 110]);
        const groupA = makeGroup({ serviceIds: ['service-A'] });
        const groupB = makeGroup({ serviceIds: ['service-B'] });
        const dataToUpdate: LocalSegmentTimes = {};
        const keyA = `${getCheckpointKey(checkpoint)}_service-A`;
        const keyB = `${getCheckpointKey(checkpoint)}_service-B`;
        await applyPendingCheckpointDistributions({
            dataToUpdate,
            path,
            resolvedCheckpoints: [checkpoint],
            serviceGroups: [groupA, groupB],
            checkpointTargets: {
                [keyA]: { am: 200 },
                [keyB]: { am: 200 }
            }
        });
        expect(calculateSegmentTimesForCheckpointMock).toHaveBeenCalledTimes(1);
        expect(dataToUpdate['service-A']['am'][1]).toBe(60);
        expect(dataToUpdate['service-B']['am'][1]).toBe(90);
    });

    test('skips groups without any matching targets', async () => {
        calculateSegmentTimesForCheckpointMock.mockResolvedValue([20, 55]);
        scaleTimesToTargetMock.mockReturnValue([60, 140]);
        const groupA = makeGroup({ serviceIds: ['service-A'] });
        const groupB = makeGroup({ serviceIds: ['service-B'] });
        const dataToUpdate: LocalSegmentTimes = {};
        const keyA = `${getCheckpointKey(checkpoint)}_service-A`;
        await applyPendingCheckpointDistributions({
            dataToUpdate,
            path,
            resolvedCheckpoints: [checkpoint],
            serviceGroups: [groupA, groupB],
            checkpointTargets: { [keyA]: { am: 200 } }
        });
        expect(dataToUpdate['service-A']).toBeDefined();
        expect(dataToUpdate['service-B']).toBeUndefined();
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
