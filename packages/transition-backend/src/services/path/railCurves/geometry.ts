/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Low-level geometric functions for rail curve analysis.
 * Includes circumradius, turn direction, and vertex radius calculations.
 */

import type { Feature, Point, Position } from 'geojson';
import { distance as turfDistance, point as turfPoint } from '@turf/turf';
import type { TurnDirection } from 'transition-common/lib/services/path/railCurves/types';
import { findCoarseVertices, vertexProducts } from 'transition-common/lib/services/path/PathVertexGeometry';
import {
    type RadiusOptions,
    resolveRadiusOptions,
    MIN_SPACING_FOR_RELIABILITY_CHECK_METERS,
    MIN_RELIABLE_RADIUS_SPACING_FACTOR
} from './constants';

/**
 * Calculates the circumradius of the triangle p1-p2-p3 (radius of the circle
 * passing through its 3 vertices) using the formula: R = (a * b * c) / (4 * Area),
 * where a, b and c are the lengths of the sides of the triangle and Area its area.
 *
 * The area uses the numerically stable form of Heron's formula, with the sides
 * sorted so that a >= b >= c, because nearly collinear points (long straight
 * sections) are the most common case. See W. Kahan, "Miscalculating Area and
 * Angles of a Needle-like Triangle" (revised 2014).
 *
 * @param {Position} p1 First point [lon, lat]
 * @param {Position} p2 Second point (vertex where radius is calculated) [lon, lat]
 * @param {Position} p3 Third point [lon, lat]
 * @returns {number | null} Radius in meters, or null if points are collinear
 */
function calculateCircumradius(p1: Position, p2: Position, p3: Position): number | null {
    // Calculate distances between points in meters using turf
    const [a, b, c] = [
        turfDistance(turfPoint(p1), turfPoint(p2), { units: 'meters' }),
        turfDistance(turfPoint(p2), turfPoint(p3), { units: 'meters' }),
        turfDistance(turfPoint(p1), turfPoint(p3), { units: 'meters' })
    ].sort((x, y) => y - x);

    // Squared area. The parentheses must be kept as is for the formula to stay stable
    const areaSquared = ((a + (b + c)) * (c - (a - b)) * (c + (a - b)) * (a + (b - c))) / 16;

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
 * Turning angles below this value, in radians, are numerical noise: the turn is
 * 'straight'. A curve with the largest reported radius (10 000 m) sampled every
 * meter still turns by 1 / 10000 = 1e-4 rad per vertex, far above this value.
 */
const STRAIGHT_TURN_ANGLE_RAD = 1e-9;

/**
 * Determines the turn direction at a vertex (left, right, or straight).
 * Uses the sign of the cross product. The turn is straight when the turning
 * angle is below STRAIGHT_TURN_ANGLE_RAD, which does not depend on the point spacing.
 *
 * @param {Position} p1 Previous point [lon, lat]
 * @param {Position} p2 Current vertex [lon, lat]
 * @param {Position} p3 Next point [lon, lat]
 * @returns {TurnDirection} Turn direction (left, right or straight)
 */
function getTurnDirection(p1: Position, p2: Position, p3: Position): TurnDirection {
    const { cross, dot } = vertexProducts(p1, p2, p3);

    if (Math.atan2(Math.abs(cross), dot) < STRAIGHT_TURN_ANGLE_RAD) {
        return 'straight';
    }

    // Positive cross = left turn, negative = right turn (in lon/lat coordinates)
    return cross > 0 ? 'left' : 'right';
}

/**
 * Calculates turn directions at each vertex of a path.
 * First and last vertices have null direction (no turn possible).
 *
 * @param {Position[]} coordinates Array of [lon, lat] positions
 * @returns {(TurnDirection | null)[]} Array of turn directions (null for endpoints)
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
 * Calculates curve radius at each vertex of a LineString
 *
 * @param {Position[]} coordinates Array of [lon, lat] positions
 * @param {RadiusOptions} options Radius calculation options
 * @returns {(number | null)[]} Array of radius values, null for the first and last `stride` vertices
 */
export function calculateRadiiAtVertices(coordinates: Position[], options: RadiusOptions): (number | null)[] {
    const opts = resolveRadiusOptions(options);
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

        // Collinear or coincident points have no curvature
        let radius = calculateCircumradius(p1, p2, p3) ?? opts.maxRadiusMeters;

        // When points are far apart, the circumradius of 3 sparse points
        // can produce artificially small radii: the digitized angle at a
        // vertex is sharper than the real smooth curve. Only apply this
        // check when local spacing is large enough that artifacts matter.
        const d1 = turfDistance(turfPoint(p1), turfPoint(p2), { units: 'meters' });
        const d2 = turfDistance(turfPoint(p2), turfPoint(p3), { units: 'meters' });
        const localSpacing = Math.max(d1, d2);
        if (
            localSpacing > MIN_SPACING_FOR_RELIABILITY_CHECK_METERS &&
            radius < localSpacing * MIN_RELIABLE_RADIUS_SPACING_FACTOR
        ) {
            // Radius is below what this point spacing can reliably measure:
            // treated as straight-like, so the running speed applies
            radius = opts.maxRadiusMeters;
        }

        // Tighter than the mode allows: digitization noise, raised to the minimum plausible radius.
        // Above the maximum: curvature negligible for speed purposes.
        radii[i] = Math.min(Math.max(radius, opts.minPlausibleRadiusMeters), opts.maxRadiusMeters);
    }

    return radii;
}

/**
 * Identifies vertices where the geometry is too coarse for a reliable curve
 * radius, see `findCoarseVertices`.
 *
 * @param {Position[]} coordinates Array of [lon, lat] positions
 * @returns {Feature<Point>[]} GeoJSON Point features for each flagged vertex,
 * with the angle in degrees (rounded to 0.1) and the spacing in meters (rounded)
 */
export function computeLargeAngleVertices(coordinates: Position[]): Feature<Point>[] {
    return findCoarseVertices(coordinates).map(({ index, angleRad, spacingMeters }) =>
        turfPoint(coordinates[index], {
            angle: Math.round(((angleRad * 180) / Math.PI) * 10) / 10,
            spacingMeters: Math.round(spacingMeters),
            index
        })
    );
}
