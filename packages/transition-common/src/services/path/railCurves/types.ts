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
    /**
     * Points at the vertices where the curve radius is not reliable: the points are too far apart
     * for the turn, see `findCoarseVertices`
     */
    unreliableRadiusVertices: Feature<Point>[];
};
