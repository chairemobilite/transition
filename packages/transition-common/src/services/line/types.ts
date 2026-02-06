/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Right-of-way categories:
 * ROW A:  Fully controlled separated track/lanes used exclusively
 *         by transit vehicles, priority at all time
 * ROW B:  Separated track/lanes with physical barrier 100% of the distance
 *         (fence, wall, median or step), priority at every shared intersection
 * ROW B-: Separated track/lanes with physical barrier at least 50% of the
 *         distance, no non-transit turning lanes in transit ROW, some
 *         priority at shared intersections
 * ROW C+: On-street with mixed traffic, without physical barrier
 *         (or less than 50% of the distance), with reserved lanes and/or
 *         priority at intersections
 * ROW C:  On-street with mixed traffic, without physical barrier
 *         (or less than 50% of the distance), without reserved lanes and
 *         with limited or no priority at intersections
 * unknown: used if the value is not set for the line/path/segment.
 */
export const rightOfWayCategories = ['A', 'B', 'B-', 'C+', 'C', 'unknown'] as const;
export type RightOfWayCategory = (typeof rightOfWayCategories)[number];

// Rail modes:
export const railModes = ['rail', 'highSpeedRail', 'metro', 'tram', 'tramTrain'] as const;
export type RailMode = (typeof railModes)[number];

// Transit modes:
export const transitModes = [
    ...railModes,
    ...[
        'bus',
        'trolleybus',
        'monorail',
        'water',
        'gondola',
        'funicular',
        'taxi',
        'cableCar',
        'horse',
        'other',
        'transferable'
    ]
] as const;

/** An enumeration of transit modes */
export type TransitMode = (typeof transitModes)[number];

/**
 * Rail-based transit modes sometimes need distinct analysis and calculations.
 * These modes run on fixed tracks where curves, gradients and cant affect speed.
 * Cant: https://en.wikipedia.org/wiki/Cant_(road_and_rail)
 * Cant deficiency: https://en.wikipedia.org/wiki/Cant_deficiency
 * Curves: https://en.wikipedia.org/wiki/Minimum_railway_curve_radius
 * Curves max speed: https://www.youtube.com/watch?v=veGEOSEDSlE
 * Curves geometry: https://www.thepwayengineer.com/blog/categories/track-geometry
 * Track geometry: https://en.wikipedia.org/wiki/Track_geometry
 * Gardient/Slope: https://en.wikipedia.org/wiki/Grade_(slope)#Railways
 *
 * @param {TransitMode | undefined | null} mode The transit mode to check
 * @returns true if the mode is a rail-based mode
 */
export function isRailMode(mode: TransitMode | undefined | null): mode is RailMode {
    if (!mode) return false;
    return (railModes as readonly string[]).includes(mode);
}

/** Vertical alignments:
 * underground: below grade (subway, tunnel, etc.) (level -1)
 * surface: at-grade (level 0) (solid, not water)
 * aerial: above grade tram, monorail, etc. (level 1)
 * unknown: used if the value is not set for the line/path/segment.
 */
export const verticalAlignments = ['underground', 'surface', 'aerial', 'unknown'] as const;
export type VerticalAlignment = (typeof verticalAlignments)[number];

/** LoadFactor / Comfort coefficients:
 * 0.0: empty (all seats available, no users)
 * 0.5: good comfort (most users should be seated)
 * 1.0: low comfort (all seats occupied, all standees areas occupied)
 * > 1.0: very low comfort (all seats and standees areas occupied with
 * too many people, hard to move, board or alight)
 * undefined: used if the value is not set/unknown for the line/path/segment.
 */
export type LoadFactor = number | undefined;

/** Reliability ratio:
 * Ratio of on-time arrivals/departures compared to planned schedules.
 * On-time = between 0 and 3 minutes late.
 * Value is between 0.0 and 1.0 (100%).
 * undefined: used if the value is not set/unknown for the line/path.
 */
export type ReliabilityRatio = number | undefined;

/** Support
 * rail: steel on steel
 * tires: rubber tires on pavement (car, bus, etc.)
 * hybridRailTires: ex: Montreal metro: both tires and rail wheels on tracks
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
    'hybridRailTires',
    'water',
    'suspended',
    'magnetic',
    'air',
    'hover',
    'hydrostatic',
    'unknown'
] as const;
export type Support = (typeof supports)[number];
