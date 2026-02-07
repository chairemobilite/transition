/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { RailMode } from '../../line/types';
import type { CurveRadiusOptions, SpeedProfileOptions } from './types';

/**
 * Default running speed (km/h) for conventional 'rail' mode.
 * 160 km/h is the upper limit for conventional regional/intercity
 * trains on non-high-speed infrastructure in Europe and North America.
 * See: UIC Code 700 (Classification of lines) and FRA Class 6 track (177 km/h).
 */
export const DEFAULT_RUNNING_SPEED_KMH = 160;

export const DEFAULT_OPTIONS: Required<CurveRadiusOptions> = {
    mode: 'rail',
    runningSpeedKmH: DEFAULT_RUNNING_SPEED_KMH,
    stride: 1,
    /**
     * Fallback radius threshold (m) for "straight-like" classification.
     * Overridden at runtime by calculateStraightThreshold(). The 1800 m
     * fallback corresponds roughly to 160 km/h with the rail coefficient
     * (160/3.8)² ≈ 1773 m.
     */
    straightThresholdMeters: 1800,
    /**
     * Minimum plausible curve radius (m). Radii below this are assumed to
     * be digitization noise and clamped. 50 m is the tightest curve found
     * on mainline rail (e.g. sharp industrial sidings, tram loops).
     * See: Lindahl, "Track geometry for high speed railways" (KTH, 2001).
     */
    minPlausibleRadiusMeters: 50,
    /**
     * Maximum radius to report (m). Above this, the curvature is negligible
     * for speed purposes. 10 000 m corresponds to a speed limit well above
     * any practical running speed (3.8 * sqrt(10000) = 380 km/h for rail).
     */
    maxRadiusMeters: 10000,
    minCurvePoints: 2
};

export const DEFAULT_SPEED_OPTIONS: Required<SpeedProfileOptions> = {
    ...DEFAULT_OPTIONS,
    /**
     * Default acceleration (m/s²). 0.5 m/s² is a comfortable acceleration
     * for seated passengers on regional rail.
     * Ref: EN 13452-1 (railway braking performance), UIC 544-1.
     * Typical range: 0.3–0.8 m/s² for conventional rail.
     */
    accelerationMps2: 0.5,
    /**
     * Default service braking deceleration (m/s²). 0.8 m/s² is the
     * standard service brake rate for regional trains.
     * Ref: EN 14531-1 (calculation of braking performance).
     * Typical range: 0.6–1.2 m/s² for service braking.
     */
    decelerationMps2: 0.8,
    initialSpeedKmH: 0,
    finalSpeedKmH: 0,
    /**
     * Default maximum running speed (km/h) for speed profile calculations.
     * 80 km/h is a conservative default suitable for urban/suburban rail.
     * Callers should override for their specific mode (e.g. 120 for
     * regional, 160 for intercity, 300+ for HSR).
     */
    maxSpeedKmH: 80,
    /**
     * Minimum fallback speed (m/s) when both segment endpoint speeds are zero.
     * 1.0 m/s (~3.6 km/h) is a conservative walking-like speed to avoid
     * unrealistically long travel times from the old 0.1 m/s fallback.
     */
    minFallbackSpeedMps: 1.0
};

/**
 * Minimum local point spacing (meters) above which the per-vertex radius
 * reliability check is activated.
 *
 * Below this distance, coordinate points are close enough that the
 * three-point circumradius formula accurately captures the real curvature,
 * so all computed radii are trusted (even small ones from tight curves).
 *
 * Above this distance, sparse geometry can cause artificially small
 * circumradii: the discrete angle at a vertex overstates the actual
 * curvature of the smooth underlying track.
 *
 * 200 m is chosen as the boundary because:
 *   - At 200 m spacing with a real 300 m radius curve, the chord angle is
 *     ~39°, producing circumradius ≈ 310 m (acceptable 3% error).
 *   - At 200 m spacing with a real 150 m radius curve, the chord subtends
 *     ~84°, producing circumradius ≈ 154 m (acceptable).
 *   - Below 200 m, even moderate curves are well-captured.
 *   - Above 200 m, the circumradius formula becomes unreliable for curves
 *     tighter than ~300 m, which matter for speed calculation.
 * TODO: it works relatively well, but we should find a better way
 * to detect the geometry resolution.
 *
 * This threshold is used for per-vertex radius reliability filtering
 * (discarding radii that are artifacts of coarse spacing).
 */
export const MIN_SPACING_FOR_RELIABILITY_CHECK_METERS = 200;

/**
 * Factor applied to local point spacing to compute the minimum reliable
 * radius when spacing exceeds MIN_SPACING_FOR_RELIABILITY_CHECK_METERS.
 *
 * If the computed circumradius R is less than (localSpacing * factor),
 * the radius is discarded as unreliable (treated as null → running speed).
 *
 * Geometric justification:
 *   For 3 equally-spaced points on a circle of radius R, chord length d:
 *     d = 2R·sin(θ/2)  →  R/d = 1 / (2·sin(θ/2))
 *   Setting R/d = 1.5 → sin(θ/2) = 1/3 → θ ≈ 39° per chord.
 *
 *   A turn of 39° over a single chord of 200+ m would imply an extremely
 *   sharp curve (R ≈ 300 m over 200 m chord). Such tight curvature over
 *   such long spacing is almost certainly a geometry artifact, not a real
 *   curve — real curves this tight would have denser shape points.
 *
 *   Conversely, gentler curves (R/d > 1.5, i.e. θ < 39°) are kept,
 *   as they are geometrically plausible even at coarse resolution.
 *
 * This check is only applied when localSpacing > MIN_SPACING_FOR_RELIABILITY_CHECK_METERS.
 * For dense geometry, all radii are trusted regardless of this factor.
 */
export const MIN_RELIABLE_RADIUS_SPACING_FACTOR = 1.5;

/**
 * Minimum deflection angle (in radians) at a vertex for it to be considered
 * a "real direction change" when classifying geometry resolution.
 *
 * 10 degrees (~0.175 rad). Rationale:
 * - Angles below ~10° are common on well-drawn dense curves (e.g. a 200 m
 *   radius curve sampled every 30 m produces ~8.6° per vertex).
 * - A 10° threshold avoids false positives on legitimately curved geometry
 *   while still detecting coarse direction changes at stations or poorly
 *   drawn segments.
 * - For reference, a gentle curve with R = 2000 m sampled every 100 m
 *   produces ~2.9° deflection — well below this threshold.
 * - A long HSR straight with slight digitization noise typically shows
 *   < 0.5° deflection — far below this threshold.
 * TODO: it works relatively well, but we could test it with more data to validate it.
 *
 * This threshold is always combined with MIN_COARSE_VERTEX_SPACING_METERS:
 * a vertex is only considered "coarse" if its angle exceeds this value AND
 * its local spacing exceeds MIN_COARSE_VERTEX_SPACING_METERS. This avoids
 * penalizing tight but densely-drawn curves.
 *
 * Used for:
 * 1. Geometry resolution classification (detectGeometryResolution).
 * 2. Large-angle vertex visualization on the map.
 */
const MIN_DEFLECTION_ANGLE_DEGREES = 10; // 10 degrees
export const MIN_DEFLECTION_ANGLE_RAD = (MIN_DEFLECTION_ANGLE_DEGREES * Math.PI) / 180;

/**
 * Minimum local spacing (meters) for a vertex with a large deflection angle
 * to be considered a "coarse geometry" problem rather than a legitimate
 * tight curve that is already well-drawn with dense waypoints.
 *
 * Used in both geometry resolution detection and the orange-circle
 * visualization layer. A vertex is flagged only when:
 *   angle >= MIN_DEFLECTION_ANGLE_RAD  AND  localSpacing >= this value
 *
 * Geometric justification:
 *   A 150 m radius curve sampled every 50 m produces ~19° per vertex —
 *   a large angle, but densely sampled and perfectly acceptable.
 *   Points closer than 50 m with large angles are genuinely tight,
 *   well-drawn curves. Points farther apart need more waypoints.
 */
export const MIN_COARSE_VERTEX_SPACING_METERS = 50;

/**
 * Speed coefficients by rail mode for curve speed calculation.
 * Formula: Vmax (km/h) = coefficient * sqrt(R in meters)
 *
 * Derived from the standard railway curve speed equation:
 *   V² = (Ca + Cd) * R / C
 * where:
 *   Ca = Actual cant (superelevation), typically 100–160 mm for rail
 *   Cd = Cant deficiency (uncompensated lateral acceleration), ~100–150 mm
 *   C  = Gauge-dependent constant ≈ 11.82 for standard gauge (1435 mm)
 *   R  = Curve radius in meters
 *   V  = Speed in km/h
 *
 * Rearranging: V = sqrt((Ca + Cd) / C) * sqrt(R) = coefficient * sqrt(R)
 *
 * For rail with Ca=150mm, Cd=100mm: coefficient = sqrt(250/11.82) ≈ 4.6
 * In practice, safety margins reduce the coefficient to ~3.5–4.2 depending
 * on passenger comfort standards and standing vs seated passengers.
 *
 * References:
 * - Esveld, C. "Modern Railway Track" (2nd ed., MRT-Productions, 2001), Ch. 3
 * - UIC Code 703 "Layout characteristics for lines used by fast passenger trains"
 * - Mundrey, J.S. "Railway Track Engineering" (4th ed., Tata McGraw-Hill, 2009)
 * - Practical explanation: https://www.youtube.com/watch?v=veGEOSEDSlE
 */
export const RAIL_CURVE_SPEED_COEFFICIENTS_BY_MODE: Record<RailMode, number> = {
    /** Tram: lower coefficient for standing passengers (Cd ~60–80 mm) */
    tram: 2.9,
    /** Tram-train: intermediate between tram (2.9) and rail (3.8) */
    tramTrain: 3.35,
    /** Regional/conventional rail: typical European standard (Cd ~100 mm) */
    rail: 3.8,
    /** Metro: similar to rail; mostly dedicated right-of-way */
    metro: 3.8,
    /** High-speed rail: higher cant allowance on dedicated tilting/HSR track (Cd ~150 mm) */
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
 * @param runningSpeedKmH Maximum running speed in km/h
 * @param mode Rail mode (affects the speed coefficient)
 * @returns Radius threshold in meters
 */
export function calculateStraightThreshold(runningSpeedKmH: number, mode: RailMode): number {
    const coefficient = RAIL_CURVE_SPEED_COEFFICIENTS_BY_MODE[mode] ?? 3.8;
    return Math.round((runningSpeedKmH / coefficient) ** 2);
}

/**
 * Resolves curve radius options, calculating straightThresholdMeters from running speed.
 * If straightThresholdMeters is explicitly provided, it takes precedence.
 * Otherwise, calculates from runningSpeedKmH using the mode's speed coefficient.
 */
export function resolveOptions(options: CurveRadiusOptions = {}): Required<CurveRadiusOptions> {
    const mode = options.mode ?? DEFAULT_OPTIONS.mode;
    const runningSpeedKmH = options.runningSpeedKmH ?? DEFAULT_OPTIONS.runningSpeedKmH;
    const straightThreshold = options.straightThresholdMeters ?? calculateStraightThreshold(runningSpeedKmH, mode);
    return {
        ...DEFAULT_OPTIONS,
        ...options,
        mode,
        runningSpeedKmH,
        straightThresholdMeters: straightThreshold
    };
}
