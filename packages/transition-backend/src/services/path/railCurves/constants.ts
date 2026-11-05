/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { RailMode } from 'transition-common/lib/services/line/types';

/** Options for the radius calculation at each vertex */
export type RadiusOptions = {
    /** Rail mode, selects the minimum plausible radius */
    mode: RailMode;
    /** Stride for three-point radius calculation (k). Uses points at i-k, i, i+k. Default: 1 */
    stride?: number;
    /** Radii below this value (m) are raised to it. Default: `MIN_PLAUSIBLE_RADIUS_METERS_BY_MODE[mode]` */
    minPlausibleRadiusMeters?: number;
    /** Radii above this value (m) are lowered to it. Default: `MAX_REPORTED_RADIUS_METERS` */
    maxRadiusMeters?: number;
};

/** Options for the curve analysis of a path */
export type CurveRadiusOptions = RadiusOptions & {
    /** Running speed of the path, in km/h. Used to calculate the straight threshold. */
    runningSpeedKmH: number;
    /**
     * Radius threshold (m) at or above which a vertex is "straight-like": its radius
     * does not limit the speed below the running speed.
     * Default: calculated from `runningSpeedKmH` with `calculateStraightThreshold`.
     */
    straightThresholdMeters?: number;
};

/**
 * Minimum plausible curve radius (m) by rail mode. Smaller computed radii are
 * considered digitization noise and raised to this value, so that a noisy
 * vertex does not produce an unrealistically low speed.
 *
 * - tram, tramTrain: 18 m, the tightest radius some light rail vehicles can
 *   negotiate (Portland and Tacoma cars). Source: Graebner, Jackson, Lovejoy,
 *   "Trackway Infrastructure Guidelines for Light Rail Circulator Systems"
 *   (2007), supplement to TCRP Report 57 "Track Design Handbook for Light Rail Transit".
 * - rail, metro, highSpeedRail: 50 m. Assumption, not taken from a standard.
 *   Minimum radii on the main track of these modes are usually above 100 m,
 *   but some real curves are tighter (old metro lines, junctions and
 *   connecting tracks). This value is a floor against noise, not a typical
 *   minimum: it must stay below the tightest real curves, otherwise their
 *   radius would be raised and their speed overestimated.
 */
export const MIN_PLAUSIBLE_RADIUS_METERS_BY_MODE: Record<RailMode, number> = {
    tram: 18,
    tramTrain: 18,
    rail: 50,
    metro: 50,
    highSpeedRail: 50
};

/**
 * Maximum radius to report (m). Above this, the curvature is negligible
 * for speed purposes: with the highest coefficient of
 * `RAIL_CURVE_SPEED_COEFFICIENTS_BY_MODE`, it allows 4.2 * sqrt(10000) = 420 km/h.
 */
export const MAX_REPORTED_RADIUS_METERS = 10000;

/**
 * Local point spacing (m) above which a computed radius is checked against
 * `MIN_RELIABLE_RADIUS_SPACING_FACTOR`.
 *
 * The three-point circumradius is exact for points on the real track
 * centerline. With sparse points, the path is usually drawn as straight
 * lines between distant points that are not on the real curve, and the
 * angle at a vertex is sharper than the real track curvature. Below this
 * spacing, the drawn shape is assumed to follow the track closely enough
 * and all radii are trusted, even small ones from tight curves.
 *
 * Above this spacing, a radius smaller than the spacing times
 * `MIN_RELIABLE_RADIUS_SPACING_FACTOR` is replaced by the maximum radius in
 * `calculateRadiiAtVertices`: the vertex is treated as straight-like and does
 * not limit the speed, as its radius cannot be measured from such sparse
 * points. Such vertices are usually also flagged as coarse vertices by
 * `computeLargeAngleVertices`, so the user can add points to the curve.
 *
 * 200 m is an assumption calibrated on test paths, not a standard value.
 * TODO: find a better way to detect the geometry resolution.
 */
export const MIN_SPACING_FOR_RELIABILITY_CHECK_METERS = 200;

/**
 * Minimum ratio between the radius and the local point spacing for the
 * radius to be trusted, when spacing exceeds MIN_SPACING_FOR_RELIABILITY_CHECK_METERS.
 * A smaller radius is discarded (treated as straight-like).
 *
 * For 3 equally-spaced points on a circle of radius R with chord length d:
 *   d = 2R·sin(θ/2), so R/d = 1.5 gives sin(θ/2) = 1/3 and θ ≈ 39° per chord.
 * A turn of more than 39° over a chord of more than 200 m is assumed to be
 * a drawing artifact: a real curve that tight would be drawn with more points.
 */
export const MIN_RELIABLE_RADIUS_SPACING_FACTOR = 1.5;

/**
 * Speed coefficients by rail mode for curve speed calculation.
 * Formula: Vmax (km/h) = coefficient * sqrt(R in meters)
 *
 * Derived from the railway curve speed equation for standard gauge (1435 mm):
 *   V² = (Ca + Cd) * R / 11.8
 * where Ca is the actual cant and Cd the cant deficiency, in mm, R the radius
 * in meters and V the speed in km/h. Rearranging: coefficient = sqrt((Ca + Cd) / 11.8).
 *
 * Each coefficient implies a total of cant and cant deficiency (Ca + Cd = 11.8 * coefficient²),
 * chosen as a typical value for the mode:
 * - tram: 2.9, Ca + Cd ≈ 99 mm (low cant on street track, standing passengers)
 * - tramTrain: 3.35, Ca + Cd ≈ 132 mm (between tram and rail)
 * - rail, metro: 3.8, Ca + Cd ≈ 170 mm
 * - highSpeedRail: 4.2, Ca + Cd ≈ 208 mm
 *
 * References:
 * - Esveld, C. "Modern Railway Track" (2nd ed., MRT-Productions, 2001), Ch. 3
 * - UIC Code 703 "Layout characteristics for lines used by fast passenger trains"
 * - https://en.wikipedia.org/wiki/Cant_(road_and_rail)
 */
export const RAIL_CURVE_SPEED_COEFFICIENTS_BY_MODE: Record<RailMode, number> = {
    tram: 2.9,
    tramTrain: 3.35,
    rail: 3.8,
    metro: 3.8,
    highSpeedRail: 4.2
};

/**
 * Calculates the radius threshold for "straight-like" sections based on running speed.
 * Uses the formula: R = (V / coefficient)² where V is the running speed.
 *
 * "Straight-like" doesn't mean geometrically straight - it means the curve radius
 * is large enough that the train can maintain its maximum running speed without
 * any speed restriction due to the curve.
 *
 * @param {number} runningSpeedKmH Maximum running speed in km/h
 * @param {RailMode} mode Rail mode (selects the speed coefficient)
 * @returns {number} Radius threshold in meters
 */
export function calculateStraightThreshold(runningSpeedKmH: number, mode: RailMode): number {
    return Math.round((runningSpeedKmH / RAIL_CURVE_SPEED_COEFFICIENTS_BY_MODE[mode]) ** 2);
}

/**
 * Fills the radius options with their default values.
 *
 * @param {RadiusOptions} options Radius options
 * @returns {Required<RadiusOptions>} Options with all values set
 */
export function resolveRadiusOptions(options: RadiusOptions): Required<RadiusOptions> {
    return {
        stride: options.stride ?? 1,
        minPlausibleRadiusMeters: options.minPlausibleRadiusMeters ?? MIN_PLAUSIBLE_RADIUS_METERS_BY_MODE[options.mode],
        maxRadiusMeters: options.maxRadiusMeters ?? MAX_REPORTED_RADIUS_METERS,
        mode: options.mode
    };
}

/**
 * Fills the curve analysis options with their default values. An explicit
 * `straightThresholdMeters` takes precedence over the one calculated from the speed.
 *
 * @param {CurveRadiusOptions} options Curve analysis options
 * @returns {Required<CurveRadiusOptions>} Options with all values set
 */
export function resolveOptions(options: CurveRadiusOptions): Required<CurveRadiusOptions> {
    return {
        ...resolveRadiusOptions(options),
        runningSpeedKmH: options.runningSpeedKmH,
        straightThresholdMeters:
            options.straightThresholdMeters ?? calculateStraightThreshold(options.runningSpeedKmH, options.mode)
    };
}
