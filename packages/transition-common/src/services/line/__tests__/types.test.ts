/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { isRailMode } from '../types';

describe('isRailMode', () => {
    test.each([
        { mode: 'rail', expected: true },
        { mode: 'highSpeedRail', expected: true },
        { mode: 'metro', expected: true },
        { mode: 'tram', expected: true },
        { mode: 'tramTrain', expected: true },
        { mode: 'bus', expected: false },
        { mode: 'monorail', expected: false },
        { mode: 'funicular', expected: false },
        { mode: 'notAMode', expected: false },
        { mode: '', expected: false },
        { mode: undefined, expected: false },
        { mode: null, expected: false }
    ])('returns $expected for $mode', ({ mode, expected }) => {
        expect(isRailMode(mode)).toBe(expected);
    });
});
