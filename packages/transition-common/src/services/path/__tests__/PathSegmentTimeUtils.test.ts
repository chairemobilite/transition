/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { formatSeconds } from '../PathSegmentTimeUtils';

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
