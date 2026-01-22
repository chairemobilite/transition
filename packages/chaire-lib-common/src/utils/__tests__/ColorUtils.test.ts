/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { hexToRgbArray, rgbToHex } from '../ColorUtils';

describe('ColorUtils', () => {
    describe('hexToRgbArray', () => {
        test.each([
            // Valid hex with #
            ['#ff0000', '#000000', [255, 0, 0, 255]],
            ['#00ff00', '#000000', [0, 255, 0, 255]],
            ['#0000ff', '#000000', [0, 0, 255, 255]],
            ['#0088ff', '#000000', [0, 136, 255, 255]],
            ['#ffffff', '#000000', [255, 255, 255, 255]],
            ['#000000', '#ffffff', [0, 0, 0, 255]],
            // Valid hex without #
            ['ff0000', '#000000', [255, 0, 0, 255]],
            ['0088ff', '#000000', [0, 136, 255, 255]],
            // Mixed case
            ['#FF0000', '#000000', [255, 0, 0, 255]],
            ['#aAbBcC', '#000000', [170, 187, 204, 255]]
        ])('converts valid hex "%s" to RGB array', (hex, defaultColor, expected) => {
            expect(hexToRgbArray(hex, defaultColor)).toEqual(expected);
        });

        test.each([
            // Undefined/null use default
            [undefined, '#ff0000', [255, 0, 0, 255]],
            [null, '#00ff00', [0, 255, 0, 255]],
            // Empty string uses default
            ['', '#0000ff', [0, 0, 255, 255]],
            // Invalid hex uses default
            ['#xyz', '#ff0000', [255, 0, 0, 255]],
            ['#fff', '#00ff00', [0, 255, 0, 255]], // 3-char hex not supported
            ['#gggggg', '#0000ff', [0, 0, 255, 255]],
            ['invalid', '#ffffff', [255, 255, 255, 255]],
            ['#12345', '#ff0000', [255, 0, 0, 255]], // 5 chars invalid
            ['#1234567', '#ff0000', [255, 0, 0, 255]] // 7 chars invalid
        ])('falls back to default for invalid hex "%s"', (hex, defaultColor, expected) => {
            expect(hexToRgbArray(hex, defaultColor)).toEqual(expected);
        });

        test.each([
            [undefined, [0, 136, 255, 255]],
            [null, [0, 136, 255, 255]],
            ['', [0, 136, 255, 255]]
        ] as const)('uses #0088ff as default when hex=%s', (hex, expected) => {
            expect(hexToRgbArray(hex as string | undefined | null)).toEqual(expected);
        });

        test.each([
            // Invalid defaultColor falls back to hardcoded #0088ff
            [undefined, 'invalid', [0, 136, 255, 255]],
            [undefined, '#xyz', [0, 136, 255, 255]],
            [undefined, '#fff', [0, 136, 255, 255]], // 3-char hex not supported
            [undefined, '', [0, 136, 255, 255]],
            // Valid hex with invalid defaultColor still uses the valid hex
            ['#ff0000', 'invalid', [255, 0, 0, 255]],
            ['#00ff00', '#xyz', [0, 255, 0, 255]]
        ] as const)('handles invalid defaultColor: hex=%s, default=%s', (hex, defaultColor, expected) => {
            expect(hexToRgbArray(hex as string | undefined, defaultColor)).toEqual(expected);
        });

        test.each([
            ['rgba(255, 0, 0, 1.0)', [255, 0, 0, 255]],
            ['rgba(0, 255, 0, 0.5)', [0, 255, 0, 128]],
            ['rgba(160, 160, 160, 1.0)', [160, 160, 160, 255]],
            ['rgba(255,0,0,1)', [255, 0, 0, 255]],
            ['rgb(255, 0, 0)', [255, 0, 0, 255]],
            ['rgb(160, 160, 160)', [160, 160, 160, 255]],
            ['RGBA(255, 0, 0, 1.0)', [255, 0, 0, 255]]
        ])('parses rgba/rgb string "%s"', (color, expected) => {
            expect(hexToRgbArray(color)).toEqual(expected);
        });
    });

    describe('rgbToHex', () => {
        test.each([
            [[255, 0, 0], '#ff0000'],
            [[0, 255, 0], '#00ff00'],
            [[0, 0, 255], '#0000ff'],
            [[0, 136, 255], '#0088ff'],
            [[255, 255, 255], '#ffffff'],
            [[0, 0, 0], '#000000'],
            [[170, 187, 204], '#aabbcc']
        ])('converts RGB %s to hex "%s"', (rgb, expected) => {
            expect(rgbToHex(rgb as [number, number, number])).toBe(expected);
        });

        test.each([
            [[255, 0, 0, 255], '#ff0000'],
            [[0, 255, 0, 128], '#00ff00'],
            [[0, 0, 255, 0], '#0000ff']
        ])('ignores alpha channel in RGBA input %s', (rgba, expected) => {
            expect(rgbToHex(rgba as [number, number, number, number])).toBe(expected);
        });

        test.each([
            [[-10, 0, 0], '#000000'],
            [[300, 0, 0], '#ff0000'],
            [[0, -50, 0], '#000000'],
            [[0, 300, 0], '#00ff00'],
            [[0, 0, 999], '#0000ff']
        ])('clamps out-of-range values %s to valid range', (rgb, expected) => {
            expect(rgbToHex(rgb as [number, number, number])).toBe(expected);
        });

        test.each([
            [[255.4, 128.6, 0.1], '#ff8100'],
            [[127.5, 127.5, 127.5], '#808080']
        ])('rounds floating point values %s to %s', (rgb, expected) => {
            expect(rgbToHex(rgb as [number, number, number])).toBe(expected);
        });
    });
});
