/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    formatSeconds,
    distributeTime
} from '../PathSegmentTimeUtils';

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
});

describe('distributeTime', () => {
    test('distributes proportionally to base times', () => {
        const segs = [
            { travelTimeSeconds: 120 },
            { travelTimeSeconds: 90 },
            { travelTimeSeconds: 85 }
        ];
        // Base total = 295s. Target = 590s (2x). Each should double.
        const result = distributeTime(segs, 0, 3, 590);
        expect(result).toEqual([240, 180, 170]);
    });

    test('distributes a subset of segments', () => {
        const segs = [
            { travelTimeSeconds: 120 },
            { travelTimeSeconds: 90 },
            { travelTimeSeconds: 85 }
        ];
        // Only segments 0-1 (base total = 210). Target = 420 (2x).
        const result = distributeTime(segs, 0, 2, 420);
        expect(result).toEqual([240, 180]);
    });

    test('handles rounding by adjusting last segment', () => {
        const segs = [
            { travelTimeSeconds: 100 },
            { travelTimeSeconds: 100 },
            { travelTimeSeconds: 100 }
        ];
        // Target = 200. Each gets round(100 * 200/300) = round(66.67) = 67. Sum = 201 != 200.
        // Last segment adjusted: 67 + (200 - 201) = 66.
        const result = distributeTime(segs, 0, 3, 200);
        expect(result[0] + result[1] + result[2]).toBe(200);
    });

    test('distributes evenly when all base times are zero', () => {
        const segs = [
            { travelTimeSeconds: 0 },
            { travelTimeSeconds: 0 },
            { travelTimeSeconds: 0 }
        ];
        const result = distributeTime(segs, 0, 3, 90);
        expect(result).toEqual([30, 30, 30]);
    });

    test('distributes evenly with remainder when base times are zero', () => {
        const segs = [
            { travelTimeSeconds: 0 },
            { travelTimeSeconds: 0 },
            { travelTimeSeconds: 0 }
        ];
        // 91 / 3 = 30 remainder 1. First segment gets the extra second.
        const result = distributeTime(segs, 0, 3, 91);
        expect(result[0] + result[1] + result[2]).toBe(91);
        expect(result).toEqual([31, 30, 30]);
    });
});
