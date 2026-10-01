/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Position } from 'geojson';
import { distance as turfDistance, point as turfPoint } from '@turf/turf';

/**
 * Corner cutting for a polyline drawn by hand.
 *
 * Chaikin, G.M. (1974). An algorithm for high-speed curve generation.
 * Computer Graphics and Image Processing, 3(4), 346–349.
 * https://doi.org/10.1016/0146-664X(74)90028-8
 *
 * "High-speed" in the paper means the algorithm is cheap to compute, not
 * high-speed rail. It applies to any manual path (bus, tram, rail, …).
 * Each span between two transit nodes is smoothed on its own. The node
 * coordinates stay fixed, so a sharp turn at a stop stays sharp. Only
 * corners between the stops are cut.
 *
 * The 1/4 and 3/4 weights are Chaikin's. The 10° and 50 m thresholds below
 * are not in the paper: they stop a second click from adding points to a
 * curve that is already dense. They were configured after testing the same
 * algorithm for some time in a fork of the osm id editor (tested by @kaligrafy).
 */

/** Below this turning angle, a vertex is part of a dense curve, not a corner to cut. */
const MIN_DEFLECTION_ANGLE_RAD = (10 * Math.PI) / 180;
/** A large angle this close to its neighbours is an already-drawn curve, not a coarse corner. */
const MIN_COARSE_VERTEX_SPACING_METERS = 50;

/**
 * Unsigned turning angle at p2, in radians (0 = straight, PI = reversal).
 * Longitude is scaled by cos(latitude) so the angle is measured on the ground.
 * @param p1 Previous vertex [lon, lat]
 * @param p2 Vertex where the turn is measured [lon, lat]
 * @param p3 Next vertex [lon, lat]
 */
const calculateTurningAngle = (p1: Position, p2: Position, p3: Position): number => {
    // Mean latitude of the three vertices, in radians.
    const meanLatRad = ((p1[1] + p2[1] + p3[1]) / 3) * (Math.PI / 180);
    // One degree of longitude is cos(latitude) times one degree of latitude.
    const cosLat = Math.cos(meanLatRad);
    // Incoming edge p1 -> p2, in a local equirectangular plane. Not a velocity.
    const v1x = (p2[0] - p1[0]) * cosLat;
    const v1y = p2[1] - p1[1];
    // Outgoing edge p2 -> p3, same plane.
    const v2x = (p3[0] - p2[0]) * cosLat;
    const v2y = p3[1] - p2[1];
    // atan2(|v1 × v2|, v1 · v2) is the unsigned angle between the two edges.
    return Math.atan2(Math.abs(v1x * v2y - v1y * v2x), v1x * v2x + v1y * v2y);
};

/**
 * True when an interior vertex still has a corner worth cutting:
 * turning angle at least {@link MIN_DEFLECTION_ANGLE_RAD}, and distance
 * to at least one neighbour at least {@link MIN_COARSE_VERTEX_SPACING_METERS}.
 * @param coords Polyline including its fixed endpoints
 */
function hasCoarseVertices(coords: Position[]): boolean {
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
 * One Chaikin pass. Endpoints stay put.
 *
 * For each edge (Pi, Pi+1):
 *   Q = 3/4 * Pi + 1/4 * Pi+1
 *   R = 1/4 * Pi + 3/4 * Pi+1
 *
 * Q of the first edge and R of the last edge are skipped so the
 * endpoints are not duplicated.
 * @param coords Polyline including its fixed endpoints
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
 * Smooth one node-to-node polyline. Stops when no coarse vertex remains,
 * so further calls do not add points.
 * @param coords Coordinate array, including the two fixed node endpoints
 * @param iterations Maximum Chaikin passes (default 2)
 */
function chaikinSmoothSegment(coords: Position[], iterations = 2): Position[] {
    if (coords.length < 3) return coords.slice();

    let current = coords;
    for (let i = 0; i < iterations; i++) {
        if (!hasCoarseVertices(current)) break;
        current = chaikinIteration(current);
    }
    return current;
}

/**
 * Smooth the spans of a polyline between the given node indices.
 *
 * `nodeIndices` are positions in `coordinates` (the path's segment index
 * list). Span i runs from nodeIndices[i] to nodeIndices[i + 1], or to the
 * last coordinate when i is the last index. One index smooths the whole
 * coordinate array as a single span. Spans are independent: the shared
 * node is not cut, so the angle at a stop can stay sharp.
 *
 * @param coordinates Full path coordinate array [lon, lat]
 * @param nodeIndices Indices of transit nodes in `coordinates`
 * @param iterations Maximum Chaikin passes per span (default 2)
 * @returns Waypoints between nodes, endpoints excluded.
 *          Result[i] is the smoothed waypoints between node i and node i+1.
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
