/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { pathIsRoute, RoutingResult } from './RoutingResult';

export type SortAlternativesBy = 'none' | 'travelTime';

/** Returns the sort key for alternative `index` of `result`. */
type AlternativeSortKey = (result: RoutingResult, index: number) => number;

/** Get the travel time in seconds of an alternative, regardless of type */
const getAlternativeDuration = (result: RoutingResult, index: number): number => {
    const path = result.getPath(index);
    if (!path) return Infinity;
    if (pathIsRoute(path)) {
        return path.duration;
    }
    return path.totalTravelTime;
};

const sortComparators: Record<SortAlternativesBy, AlternativeSortKey> = {
    none: () => 0,
    travelTime: getAlternativeDuration
};

/**
 * Build an array of alternative indices for `result`, ordered according to `sortBy`.
 *
 * @param result The routing result whose alternatives should be ordered
 * @param sortBy The criterion to sort by
 * @returns The alternative indices in the requested order
 */
const buildSortedIndices = (result: RoutingResult, sortBy: SortAlternativesBy): number[] => {
    const count = result.getAlternativesCount();
    const indices = Array.from({ length: count }, (_, i) => i);
    const getKey = sortComparators[sortBy];
    indices.sort((a, b) => getKey(result, a) - getKey(result, b));
    return indices;
};

/** A routing result with its alternatives in sorted order */
export class SortedRoutingResult {
    private readonly _sortedIndices: number[];

    constructor(
        readonly result: RoutingResult,
        readonly sortBy: SortAlternativesBy
    ) {
        this._sortedIndices = buildSortedIndices(result, sortBy);
    }

    getAlternativesCount(): number {
        return this._sortedIndices.length;
    }

    getPath(position: number): ReturnType<RoutingResult['getPath']> {
        const alternativeIndex = this._sortedIndices.at(position);
        if (alternativeIndex === undefined) {
            return undefined;
        }
        return this.result.getPath(alternativeIndex);
    }

    getPathGeojson(
        position: number,
        options: Parameters<RoutingResult['getPathGeojson']>[1]
    ): ReturnType<RoutingResult['getPathGeojson']> | undefined {
        const alternativeIndex = this._sortedIndices.at(position);
        if (alternativeIndex === undefined) {
            return undefined;
        }
        return this.result.getPathGeojson(alternativeIndex, options);
    }
}
