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
 * unknown: used if the value is not set for the line/path/segment.
 */
export const rightOfWayCategories = ['A', 'B', 'B-', 'C+', 'C', 'unknown'] as const;
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

/** Vertical alignments:
 * underground: below grade (subway, tunnel, etc.) (level -1)
 * surface: at-grade (level 0) (solid, not water)
 * aerial: above grade tram, monorail, etc. (level 1)
 * unknown: used if the value is not set for the line/path/segment.
 */
export const verticalAlignments = ['underground', 'surface', 'aerial', 'unknown'] as const;
export type VerticalAlignment = (typeof verticalAlignments)[number];

/** Support
 * rail: steel on steel
 * tires: rubber tires on pavement (car, bus, etc.)
 * water: buoyancy (can induce sickness and or fear to some people)
 * suspended: suspended gondola (can induce fear to some people)
 * magnetic: magnetic levitation (maglev)
 * air: airplane, helicopter, drone, etc. (can induce fear to some people)
 * hover: hovercraft, etc. (can induce fear to some people)
 * hydrostatic: submarine (can induce fear to some people)
 * unknown: used if the value is not set for the line/path/segment.
 */
export const supports = [
    'rail',
    'tires',
    'water',
    'suspended',
    'magnetic',
    'air',
    'hover',
    'hydrostatic',
    'unknown'
] as const;
export type Support = (typeof supports)[number];
