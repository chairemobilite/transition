/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** The array of modes that can be used to compare accessibility maps */
export const comparisonModes = ['scenarios', 'locations'];

/** Enumeration type of the modes */
export type ComparisonMode = (typeof comparisonModes)[number];
