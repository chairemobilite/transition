/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    buildPeriodSegmentData,
    buildSegmentsByServiceAndPeriod,
    LocalSegmentTimes
} from '../PathSegmentTimeUtils';
import type { TimeAndDistance } from '../PathTypes';

const makeBaseSegments = (travelTimes: number[], distances: (number | null)[]): TimeAndDistance[] =>
    travelTimes.map((travelTimeSeconds, i) => ({
        travelTimeSeconds,
        distanceMeters: distances[i] ?? null
    }));

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
