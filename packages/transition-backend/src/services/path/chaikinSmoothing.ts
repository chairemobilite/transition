/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Position } from 'geojson';
import { distance as turfDistance, point as turfPoint } from '@turf/turf';

import { calculateTurningAngle } from './railCurves/geometry';
import { MIN_DEFLECTION_ANGLE_RAD, MIN_COARSE_VERTEX_SPACING_METERS } from './railCurves/constants';

/**
 * Checks whether a polyline still has "coarse" interior vertices that
 * would benefit from further smoothing.
 *
 * Uses the same criteria as the curve-analysis geometry resolution
 * detector: a vertex is coarse when its deflection angle is at least
 * MIN_DEFLECTION_ANGLE_RAD **and** the distance to at least one
 * neighbour is at least MIN_COARSE_VERTEX_SPACING_METERS.
 *
 * Dense geometry (close spacing) with large angles is considered
 * legitimate and is not flagged.
 */
export function hasCoarseVertices(coords: Position[]): boolean {
    if (coords.length < 3) return false;

    for (let i = 1; i < coords.length - 1; i++) {
        const angle = calculateTurningAngle(coords[i - 1], coords[i], coords[i + 1]);
        if (angle >= MIN_DEFLECTION_ANGLE_RAD) {
            const distPrev = turfDistance(turfPoint(coords[i - 1] as number[]), turfPoint(coords[i] as number[]), {
                units: 'meters'
            });
            const distNext = turfDistance(turfPoint(coords[i] as number[]), turfPoint(coords[i + 1] as number[]), {
                units: 'meters'
            });
            if (Math.max(distPrev, distNext) >= MIN_COARSE_VERTEX_SPACING_METERS) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Apply one iteration of Chaikin's corner-cutting algorithm to a polyline.
 * The first and last points are kept fixed (transit node positions).
 *
 * For each edge (Pi, Pi+1), generates:
 *   Q_i = 3/4 * Pi + 1/4 * Pi+1  (closer to Pi)
 *   R_i = 1/4 * Pi + 3/4 * Pi+1  (closer to Pi+1)
 *
 * Endpoints are preserved by skipping Q for the first edge
 * and R for the last edge.
 */
function chaikinIteration(coords: Position[]): Position[] {
    if (coords.length < 3) return coords.slice();

    const result: Position[] = [coords[0]];

    for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i];
        const p1 = coords[i + 1];

        if (i > 0) {
            result.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
        }

        if (i < coords.length - 2) {
            result.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
        }
    }

    result.push(coords[coords.length - 1]);
    return result;
}

/**
 * Smooth a polyline segment using Chaikin's corner-cutting algorithm.
 * The first and last points are preserved (transit node positions).
 *
 * Before each iteration the segment is checked for coarse vertices
 * (same criteria as the curve-analysis geometry resolution detector).
 * If all vertices already have sufficient precision, further iterations
 * are skipped to avoid unnecessary point proliferation.
 *
 * @param coords Coordinate array (including fixed node endpoints)
 * @param iterations Maximum number of smoothing iterations (default 2)
 */
export function chaikinSmoothSegment(coords: Position[], iterations = 2): Position[] {
    if (coords.length < 3) return coords.slice();

    let current = coords;
    for (let i = 0; i < iterations; i++) {
        if (!hasCoarseVertices(current)) break;
        current = chaikinIteration(current);
    }
    return current;
}

/**
 * Smooth an entire transit path using Chaikin's algorithm.
 * Each segment between consecutive transit nodes is smoothed independently.
 * Node positions (endpoints of each segment) are preserved.
 *
 * Segments that already have high geometric resolution (no coarse
 * vertices) are left untouched so that repeated calls do not keep
 * adding waypoints to already-smooth sections.
 *
 * @param coordinates Full path coordinate array
 * @param nodeIndices Indices of transit nodes in the coordinate array (from path.attributes.segments)
 * @param iterations Maximum number of Chaikin iterations per segment (default 2)
 * @returns Per-segment waypoints: intermediate coordinates excluding node endpoints.
 *          Result[i] contains the smoothed waypoints between node i and node i+1.
 */
export function chaikinSmoothPath(coordinates: Position[], nodeIndices: number[], iterations = 2): Position[][] {
    const result: Position[][] = [];

    for (let i = 0; i < nodeIndices.length; i++) {
        const startIdx = nodeIndices[i];
        const endIdx = i < nodeIndices.length - 1 ? nodeIndices[i + 1] : coordinates.length - 1;

        const segmentCoords = coordinates.slice(startIdx, endIdx + 1);
        if (segmentCoords.length < 3) {
            result.push([]);
            continue;
        }

        const smoothed = chaikinSmoothSegment(segmentCoords, iterations);
        result.push(smoothed.slice(1, -1));
    }

    return result;
}
