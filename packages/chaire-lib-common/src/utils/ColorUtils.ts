/*
 * Copyright 2025, Polytechnique Montreal and contributors
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
 * Convert a hex color string to an RGBA array.
 * @param hex Hex color string (e.g., '#0088ff' or '0088ff')
 * @param defaultColor Fallback hex color if input is invalid (default: '#0088ff')
 * @returns [r, g, b, 255] array suitable for deck.gl and similar libraries
 */
export const hexToRgbArray = (
    hex: string | undefined | null,
    defaultColor = '#0088ff'
): [number, number, number, number] => {
    // Validate defaultColor first, fall back to hardcoded value if invalid
    const validDefault = normalizeHex(defaultColor) ?? FALLBACK_HEX;
    // Validate input hex, fall back to validated default if invalid
    const finalHex = normalizeHex(hex) ?? validDefault;

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
