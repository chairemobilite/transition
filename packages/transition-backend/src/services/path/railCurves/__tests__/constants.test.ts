/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { calculateStraightThreshold } from '../constants';

describe('calculateStraightThreshold', () => {
    test.each([
        { mode: 'rail' as const, speed: 90, expected: 561 },
        { mode: 'metro' as const, speed: 75, expected: 390 },
        { mode: 'tram' as const, speed: 50, expected: 297 },
        { mode: 'tramTrain' as const, speed: 60, expected: 321 },
        { mode: 'highSpeedRail' as const, speed: 250, expected: 3543 },
        // Speeds above the one allowed by the maximum reported radius
        { mode: 'rail' as const, speed: 400, expected: 10000 },
        { mode: 'highSpeedRail' as const, speed: 500, expected: 10000 }
    ])('returns $expected m for $mode at $speed km/h', ({ mode, speed, expected }) => {
        expect(calculateStraightThreshold(speed, mode)).toBe(expected);
    });
});
