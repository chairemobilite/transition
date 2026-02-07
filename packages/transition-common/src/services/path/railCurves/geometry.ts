/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Low-level geometric functions for rail curve analysis.
 * Includes circumradius, turning angle, turn direction, and vertex radius calculations.
 */

import { Position } from 'geojson';
import { distance as turfDistance, point as turfPoint } from '@turf/turf';
import type { RailMode } from '../../line/types';
import type { TurnDirection, CurveRadiusOptions } from './types';
import {
    resolveOptions,
    MIN_SPACING_FOR_RELIABILITY_CHECK_METERS,
    MIN_RELIABLE_RADIUS_SPACING_FACTOR,
    RAIL_CURVE_SPEED_COEFFICIENTS_BY_MODE
} from './constants';

/**
 * Calculates the circumradius (radius of the circle passing through 3 points)
 * using the formula: R = (a * b * c) / (4 * Area)
 *
 * @param p1 First point [lon, lat]
 * @param p2 Second point (vertex where radius is calculated) [lon, lat]
 * @param p3 Third point [lon, lat]
 * @returns Radius in meters, or null if points are collinear
 */
export function calculateCircumradius(p1: Position, p2: Position, p3: Position): number | null {
    // Calculate distances between points in meters using turf
    const a = turfDistance(turfPoint(p1), turfPoint(p2), { units: 'meters' });
    const b = turfDistance(turfPoint(p2), turfPoint(p3), { units: 'meters' });
    const c = turfDistance(turfPoint(p1), turfPoint(p3), { units: 'meters' });

    // Calculate triangle area via Heron's formula using geodesic distances
    const s = (a + b + c) / 2; // semi-perimeter
    const areaSquared = s * (s - a) * (s - b) * (s - c);

    if (areaSquared <= 0) {
        // Points are collinear or nearly collinear
        return null;
    }

    const area = Math.sqrt(areaSquared);

    // Circumradius formula: R = (a * b * c) / (4 * Area)
    const radius = (a * b * c) / (4 * area);

    return radius;
}

/**
 * Calculates the turning angle at a vertex in radians
 *
 * @param p1 Previous point [lon, lat]
 * @param p2 Current vertex [lon, lat]
 * @param p3 Next point [lon, lat]
 * @returns Turning angle in radians (0 = straight, PI = complete reversal)
 */
export function calculateTurningAngle(p1: Position, p2: Position, p3: Position): number {
    // Compute a representative latitude to correct longitude distortion.
    // One degree of longitude is shorter than one degree of latitude by
    // a factor of cos(latitude), so we scale lon differences accordingly.
    const meanLatRad = ((p1[1] + p2[1] + p3[1]) / 3) * (Math.PI / 180);
    const cosLat = Math.cos(meanLatRad);

    // Vector from p1 to p2 in corrected local coordinates
    const v1x = (p2[0] - p1[0]) * cosLat;
    const v1y = p2[1] - p1[1];

    // Vector from p2 to p3 in corrected local coordinates
    const v2x = (p3[0] - p2[0]) * cosLat;
    const v2y = p3[1] - p2[1];

    // Calculate angle using dot product and cross product
    const dot = v1x * v2x + v1y * v2y;
    const cross = v1x * v2y - v1y * v2x;

    // Angle between vectors (exterior angle)
    const angle = Math.atan2(Math.abs(cross), dot);

    return angle;
}

/**
 * Determines the turn direction at a vertex (left, right, or straight).
 * Uses the cross product sign to determine direction.
 *
 * @param p1 Previous point [lon, lat]
 * @param p2 Current vertex [lon, lat]
 * @param p3 Next point [lon, lat]
 * @returns Turn direction (left, right or straight)
 */
export function getTurnDirection(p1: Position, p2: Position, p3: Position): TurnDirection {
    // Correct longitude distortion using cos(latitude) scaling
    const meanLatRad = ((p1[1] + p2[1] + p3[1]) / 3) * (Math.PI / 180);
    const cosLat = Math.cos(meanLatRad);

    // Vector from p1 to p2 in corrected local coordinates
    const v1x = (p2[0] - p1[0]) * cosLat;
    const v1y = p2[1] - p1[1];

    // Vector from p2 to p3 in corrected local coordinates
    const v2x = (p3[0] - p2[0]) * cosLat;
    const v2y = p3[1] - p2[1];

    // Cross product determines turn direction
    const cross = v1x * v2y - v1y * v2x;

    // Use a small threshold to detect nearly straight sections
    const threshold = 1e-10;
    if (Math.abs(cross) < threshold) {
        return 'straight';
    }

    // Positive cross = left turn, negative = right turn (in lon/lat coordinates)
    return cross > 0 ? 'left' : 'right';
}

/**
 * Calculates turn directions at each vertex of a path.
 * First and last vertices have null direction (no turn possible).
 *
 * @param coordinates Array of [lon, lat] positions
 * @returns Array of turn directions (null for endpoints)
 */
export function calculateTurnDirections(coordinates: Position[]): (TurnDirection | null)[] {
    const n = coordinates.length;
    const directions: (TurnDirection | null)[] = new Array(n).fill(null);

    if (n < 3) {
        return directions;
    }

    for (let i = 1; i < n - 1; i++) {
        directions[i] = getTurnDirection(coordinates[i - 1], coordinates[i], coordinates[i + 1]);
    }

    return directions;
}

/**
 * Estimates maximum rail speed based on curve radius.
 * Uses mode-specific coefficients for accurate speed limits.
 *
 * @param mode Rail mode (determines speed coefficient)
 * @param radiusMeters Curve radius in meters
 * @returns Estimated maximum speed in km/h, or 0 for invalid radius
 */
export function estimateMaxSpeedFromRadius(mode: RailMode, radiusMeters: number): number {
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return 0;
    const coefficient = RAIL_CURVE_SPEED_COEFFICIENTS_BY_MODE[mode] ?? 3.8;
    return Math.round(coefficient * Math.sqrt(radiusMeters));
}

/**
 * Calculates curve radius at each vertex of a LineString
 *
 * @param coordinates Array of [lon, lat] positions
 * @param options Calculation options
 * @returns Array of radius values (null for endpoints and invalid calculations)
 */
export function calculateRadiiAtVertices(coordinates: Position[], options: CurveRadiusOptions = {}): (number | null)[] {
    const opts = resolveOptions(options);
    const n = coordinates.length;
    const radii: (number | null)[] = new Array(n).fill(null);

    if (n < 3) {
        return radii;
    }

    const stride = opts.stride;

    for (let i = stride; i < n - stride; i++) {
        const p1 = coordinates[i - stride];
        const p2 = coordinates[i];
        const p3 = coordinates[i + stride];

        let radius = calculateCircumradius(p1, p2, p3);

        // Filter out implausible values
        if (radius !== null) {
            // When points are far apart, the circumradius of 3 sparse points
            // can produce artificially small radii: the digitized angle at a
            // vertex is sharper than the real smooth curve. Only apply this
            // check when local spacing is large enough that artifacts matter.
            const d1 = turfDistance(turfPoint(p1), turfPoint(p2), { units: 'meters' });
            const d2 = turfDistance(turfPoint(p2), turfPoint(p3), { units: 'meters' });
            const localSpacing = Math.max(d1, d2);
            if (localSpacing > MIN_SPACING_FOR_RELIABILITY_CHECK_METERS) {
                const minReliableRadius = localSpacing * MIN_RELIABLE_RADIUS_SPACING_FACTOR;
                if (radius < minReliableRadius) {
                    // Radius is below what this point spacing can reliably
                    // measure. Treat as unreliable (null = running speed).
                    radius = null;
                }
            }
            if (radius !== null && radius < opts.minPlausibleRadiusMeters) {
                // Likely noise - could be a digitization artifact
                // Keep it but mark it as the minimum plausible
                radius = opts.minPlausibleRadiusMeters;
            } else if (radius !== null && radius > opts.maxRadiusMeters) {
                // Essentially straight
                radius = opts.maxRadiusMeters;
            }
        }

        radii[i] = radius;
    }

    return radii;
}

/**
 * Calculates cumulative distances along a path
 */
export function calculateCumulativeDistances(coordinates: Position[]): number[] {
    if (coordinates.length === 0) {
        return [];
    }
    const distances: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) {
        const d = turfDistance(turfPoint(coordinates[i - 1]), turfPoint(coordinates[i]), { units: 'meters' });
        distances.push(distances[i - 1] + d);
    }
    return distances;
}
