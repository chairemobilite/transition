/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { pathIsRoute, RoutingResult } from './RoutingResult';

export type SortAlternativesBy = 'none' | 'travelTime';

/** Returns the sort key for alternative `index` of `result`. */
export type AlternativeSortKey = (result: RoutingResult, index: number) => number;

/** Get the travel time in seconds for a path, regardless of type */
export const getPathDuration: AlternativeSortKey = (result, index) => {
    const path = result.getPath(index);
    if (!path) return Infinity;
    if (pathIsRoute(path)) {
        return path.duration;
    }
    return path.totalTravelTime;
};

export const sortComparators: Record<SortAlternativesBy, AlternativeSortKey> = {
    none: () => 0,
    travelTime: getPathDuration
};

/**
 * Build an array of alternative indices for `result`, ordered according to `sortBy`.
 *
 * @param result The routing result whose alternatives should be ordered
 * @param sortBy The criterion to sort by
 * @returns The alternative indices in the requested order
 */
export const buildSortedIndices = (result: RoutingResult, sortBy: SortAlternativesBy): number[] => {
    const count = result.getAlternativesCount();
    const indices = Array.from({ length: count }, (_, i) => i);
    const getKey = sortComparators[sortBy];
    indices.sort((a, b) => getKey(result, a) - getKey(result, b));
    return indices;
};
