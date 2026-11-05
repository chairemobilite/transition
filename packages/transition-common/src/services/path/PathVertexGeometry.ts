/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Position } from 'geojson';
import { distance as turfDistance, point as turfPoint } from '@turf/turf';

/**
 * Detection of coarse vertices in a path drawn by hand: vertices where the path
 * changes direction abruptly between distant points, instead of following a
 * smooth curve drawn with dense points.
 *
 * The 10° and 50 m thresholds were configured after testing them for some time
 * in a fork of the OpenStreetMap iD editor (tested by @kaligrafy):
 * - A 200 m radius curve sampled every 30 m deflects by 30 / 200 rad ≈ 8.6° per
 *   vertex, and a 2000 m radius curve sampled every 100 m by ≈ 2.9°, so dense
 *   curves stay below the angle threshold.
 * - A 150 m radius curve sampled every 50 m deflects by 50 / 150 rad ≈ 19° per
 *   vertex, above the angle threshold: its radius is small, but it is densely
 *   sampled. Points closer than the spacing threshold are an already-drawn
 *   curve, not a coarse corner.
 * TODO: validate the thresholds with more paths.
 */

const MIN_DEFLECTION_ANGLE_DEGREES = 10;
/** Below this turning angle, in radians, a vertex is part of a dense curve, not a coarse corner. */
const MIN_DEFLECTION_ANGLE_RAD = (MIN_DEFLECTION_ANGLE_DEGREES * Math.PI) / 180;
/** A vertex of small radius with both neighbours closer than this, in meters, is an already-drawn curve. */
const MIN_COARSE_VERTEX_SPACING_METERS = 50;

/**
 * Cross and dot products of the edges p1 -> p2 and p2 -> p3, in a local plane
 * where the longitude is scaled by cos(latitude): one degree of longitude is
 * cos(latitude) times one degree of latitude.
 *
 * @param {Position} p1 Previous vertex [lon, lat]
 * @param {Position} p2 Vertex where the turn is measured [lon, lat]
 * @param {Position} p3 Next vertex [lon, lat]
 * @returns {{ cross: number; dot: number }} The cross product (positive for a left turn) and the dot product
 */
export const vertexProducts = (p1: Position, p2: Position, p3: Position): { cross: number; dot: number } => {
    const cosLat = Math.cos(((p1[1] + p2[1] + p3[1]) / 3) * (Math.PI / 180));
    const v1x = (p2[0] - p1[0]) * cosLat;
    const v1y = p2[1] - p1[1];
    const v2x = (p3[0] - p2[0]) * cosLat;
    const v2y = p3[1] - p2[1];
    return { cross: v1x * v2y - v1y * v2x, dot: v1x * v2x + v1y * v2y };
};

/**
 * Unsigned turning angle at p2, in radians (0 = straight, PI = reversal).
 *
 * @param {Position} p1 Previous vertex [lon, lat]
 * @param {Position} p2 Vertex where the turn is measured [lon, lat]
 * @param {Position} p3 Next vertex [lon, lat]
 * @returns {number} The turning angle, in radians
 */
const calculateTurningAngle = (p1: Position, p2: Position, p3: Position): number => {
    const { cross, dot } = vertexProducts(p1, p2, p3);
    return Math.atan2(Math.abs(cross), dot);
};

/** A coarse vertex of a path, see {@link findCoarseVertices} */
export type CoarseVertex = {
    /** Index of the vertex in the coordinates */
    index: number;
    /** Turning angle at the vertex, in radians */
    angleRad: number;
    /** Distance to the farthest of the two neighbours, in meters */
    spacingMeters: number;
};

/**
 * Find the interior vertices with a turning angle of at least
 * {@link MIN_DEFLECTION_ANGLE_RAD} and a distance to at least one neighbour of
 * at least {@link MIN_COARSE_VERTEX_SPACING_METERS}.
 *
 * @param {Position[]} coordinates Polyline coordinates [lon, lat]
 * @returns {CoarseVertex[]} The coarse vertices, in path order
 */
export const findCoarseVertices = (coordinates: Position[]): CoarseVertex[] => {
    const vertices: CoarseVertex[] = [];
    for (let i = 1; i < coordinates.length - 1; i++) {
        const angleRad = calculateTurningAngle(coordinates[i - 1], coordinates[i], coordinates[i + 1]);
        if (angleRad < MIN_DEFLECTION_ANGLE_RAD) {
            continue;
        }
        const spacingMeters = Math.max(
            turfDistance(turfPoint(coordinates[i - 1]), turfPoint(coordinates[i]), { units: 'meters' }),
            turfDistance(turfPoint(coordinates[i]), turfPoint(coordinates[i + 1]), { units: 'meters' })
        );
        if (spacingMeters >= MIN_COARSE_VERTEX_SPACING_METERS) {
            vertices.push({ index: i, angleRad, spacingMeters });
        }
    }
    return vertices;
};
