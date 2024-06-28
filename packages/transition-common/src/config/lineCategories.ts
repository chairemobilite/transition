/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export const lineCategoriesArray = ['C', 'C+', 'B', 'A', 'B_C', 'non_applicable'] as const;
export type LineCategory = (typeof lineCategoriesArray)[number];
