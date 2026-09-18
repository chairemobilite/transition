/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { pathIsRoute, RoutingResult } from './RoutingResult';

// Get the travel time in seconds for a path, regardless of type
export const getPathDuration = (result: RoutingResult, index: number): number => {
    const path = result.getPath(index);
    if (!path) return Infinity;
    if (pathIsRoute(path)) {
        return path.duration;
    }
    return path.totalTravelTime;
};

// Build an array of alternative indices sorted by ascending travel time
export const buildSortedIndices = (result: RoutingResult): number[] => {
    const count = result.getAlternativesCount();
    const indices = Array.from({ length: count }, (_, i) => i);
    indices.sort((a, b) => getPathDuration(result, a) - getPathDuration(result, b));
    return indices;
};
