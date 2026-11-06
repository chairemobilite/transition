/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { calculateStraightThreshold, resolveOptions, resolveRadiusOptions } from '../constants';

describe('calculateStraightThreshold', () => {
    test.each([
        { mode: 'rail' as const, speed: 90, expected: 561 },
        { mode: 'metro' as const, speed: 75, expected: 390 },
        { mode: 'tram' as const, speed: 50, expected: 297 },
        { mode: 'tramTrain' as const, speed: 60, expected: 321 },
        { mode: 'highSpeedRail' as const, speed: 250, expected: 3543 }
    ])('returns $expected m for $mode at $speed km/h', ({ mode, speed, expected }) => {
        expect(calculateStraightThreshold(speed, mode)).toBe(expected);
    });
});

describe('resolveRadiusOptions', () => {
    test.each([
        { mode: 'tram' as const, expectedMin: 18 },
        { mode: 'rail' as const, expectedMin: 50 }
    ])('fills the defaults for $mode', ({ mode, expectedMin }) => {
        expect(resolveRadiusOptions({ mode })).toEqual({
            mode,
            stride: 1,
            minPlausibleRadiusMeters: expectedMin,
            maxRadiusMeters: 10000
        });
    });

    test('keeps explicit values', () => {
        const options = { mode: 'rail' as const, stride: 2, minPlausibleRadiusMeters: 100, maxRadiusMeters: 5000 };
        expect(resolveRadiusOptions(options)).toEqual(options);
    });
});

describe('resolveOptions', () => {
    test.each([
        { label: 'calculates the threshold from the speed', straightThresholdMeters: undefined, expected: 561 },
        { label: 'keeps an explicit threshold', straightThresholdMeters: 2000, expected: 2000 }
    ])('$label', ({ straightThresholdMeters, expected }) => {
        expect(
            resolveOptions({ mode: 'rail', runningSpeedKmH: 90, straightThresholdMeters }).straightThresholdMeters
        ).toBe(expected);
    });
});
