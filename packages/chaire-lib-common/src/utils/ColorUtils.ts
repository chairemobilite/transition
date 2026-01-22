/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** Hardcoded fallback color used when both hex and defaultColor are invalid */
const FALLBACK_HEX = '0088ff';

/**
 * Normalize and validate a hex color string.
 * @param hex Hex color string (with or without # prefix)
 * @returns Normalized 6-character hex string (without #) if valid, undefined otherwise
 */
const normalizeHex = (hex: string | undefined | null): string | undefined => {
    if (!hex) return undefined;
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    return /^[0-9a-fA-F]{6}$/.test(cleanHex) ? cleanHex : undefined;
};

/**
 * Parse an rgba() or rgb() color string to an RGBA array.
 * @param color Color string in rgba(r,g,b,a) or rgb(r,g,b) format
 * @returns [r, g, b, a] array if valid, undefined otherwise
 */
const parseRgba = (color: string | undefined | null): [number, number, number, number] | undefined => {
    if (!color) return undefined;
    const rgbaMatch = color.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
    if (!rgbaMatch) return undefined;

    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4] !== undefined ? Math.round(parseFloat(rgbaMatch[4]) * 255) : 255;

    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 || a < 0 || a > 255) {
        return undefined;
    }
    return [r, g, b, a];
};

/**
 * Convert a color string (hex or rgba) to an RGBA array.
 * @param color Color string (e.g., '#0088ff', 'rgba(160,160,160,1.0)')
 * @param defaultColor Fallback hex color if input is invalid (default: '#0088ff')
 * @returns [r, g, b, a] array suitable for deck.gl and similar libraries
 */
export const hexToRgbArray = (
    color: string | undefined | null,
    defaultColor = '#0088ff'
): [number, number, number, number] => {
    // Try rgba/rgb format first
    const rgbaResult = parseRgba(color);
    if (rgbaResult) return rgbaResult;

    // Fall back to hex parsing
    const validDefault = normalizeHex(defaultColor) ?? FALLBACK_HEX;
    const finalHex = normalizeHex(color) ?? validDefault;

    const r = parseInt(finalHex.slice(0, 2), 16);
    const g = parseInt(finalHex.slice(2, 4), 16);
    const b = parseInt(finalHex.slice(4, 6), 16);
    return [r, g, b, 255];
};

/**
 * Convert an RGB/RGBA array to a hex color string.
 * @param rgb Array of [r, g, b] or [r, g, b, a] values (0-255)
 * @returns Hex color string with # prefix (e.g., '#0088ff')
 */
export const rgbToHex = (rgb: [number, number, number] | [number, number, number, number]): string => {
    const [r, g, b] = rgb;
    const toHex = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
            .toString(16)
            .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
