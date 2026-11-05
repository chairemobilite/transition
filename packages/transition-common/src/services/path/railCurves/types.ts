/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { Feature, Point } from 'geojson';

/**
 * Classification of a path segment or vertex based on its curvature impact on speed:
 * - 'curve': radius is tight enough to impose a speed restriction
 * - 'straight': radius is large enough that the train can maintain max running speed
 *   (doesn't mean geometrically straight, just "straight-like" for speed purposes)
 */
export type CurvatureType = 'curve' | 'straight';

/**
 * Direction of a turn at a vertex along the path:
 * - 'left': the path turns to the left
 * - 'right': the path turns to the right
 * - 'straight': negligible deflection (cross product ≈ 0)
 */
export type TurnDirection = 'left' | 'right' | 'straight';

/**
 * A section of a path classified by its curvature impact on speed.
 * Consecutive segments share their boundary vertex, so they cover the whole path.
 */
export type CurveSegment = {
    /** Start index in the analyzed coordinates array */
    startIndex: number;
    /** End index (inclusive) in the analyzed coordinates array */
    endIndex: number;
    /** Median radius of the segment vertices, in meters */
    medianRadiusMeters: number;
    /** Minimum radius of the segment vertices (tightest point), in meters */
    minRadiusMeters: number;
    /** Length of the segment, in meters */
    lengthMeters: number;
    /** Classification based on speed impact from curvature */
    type: CurvatureType;
};

/**
 * Response of the `transitPaths.curveAnalysis` socket route.
 */
export type CurveAnalysisResponse = {
    /** Curve and straight-like segments, empty when the path has fewer than 3 coordinates */
    segments: CurveSegment[];
    /** Vertices with a direction change too abrupt for a reliable radius (coarse geometry) */
    largeAngleVertices: Feature<Point>[];
};
