/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * Right-of-way categories:
 * ROW A: Fully controlled separated track/lanes used exclusively by transit vehicles, priority at all time
 * ROW B: Separated track/lanes with physical barrier 100% of the distance (fence, wall, median or step), priority at every shared intersection
 * ROW B-: Separated track/lanes with physical barrier at least 50% of the distance, no non-transit turning lanes in transit ROW, some priority at shared intersections
 * ROW C+: On-street with mixed traffic, without physical barrier (or less than 50% of the distance), with reserved lanes and/or priority at intersections
 * ROW C: On-street with mixed traffic, without physical barrier (or less than 50% of the distance), without reserved lanes and with limited or no priority at intersections
 */
export const rightOfWayCategories = ['A', 'B', 'B-', 'C+', 'C'] as const;
export type RightOfWayCategory = (typeof rightOfWayCategories)[number];

// Transit modes:
export const transitModes = [
    'bus',
    'trolleybus',
    'rail',
    'highSpeedRail',
    'metro',
    'monorail',
    'tram',
    'tramTrain',
    'water',
    'gondola',
    'funicular',
    'taxi',
    'cableCar',
    'horse',
    'other',
    'transferable'
] as const;

/** An enumeration of transit modes */
export type TransitMode = (typeof transitModes)[number];
