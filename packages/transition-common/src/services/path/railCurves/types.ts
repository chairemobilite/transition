/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { Feature, Point, Position } from 'geojson';
import type { RailMode } from '../../line/types';

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
 * Represents a segment along a path classified by its curvature impact on speed.
 * Used for visualization and reporting. Actual travel time calculations
 * use point-by-point radius analysis, not these segment-level values.
 */
export type CurveSegment = {
    /** Start index in the original coordinates array */
    startIndex: number;
    /** End index in the original coordinates array */
    endIndex: number;
    /** Median radius of the curve in meters */
    medianRadiusMeters: number;
    /** Minimum radius found in this segment (tightest point) */
    minRadiusMeters: number;
    /** Maximum radius found in this segment */
    maxRadiusMeters: number;
    /** Length of this curve segment in meters */
    lengthMeters: number;
    /** Start coordinate [lon, lat] */
    startCoord: Position;
    /** End coordinate [lon, lat] */
    endCoord: Position;
    /** Classification based on speed impact from curvature */
    type: CurvatureType;
};

/**
 * Result of curve radius analysis for a path
 */
export type CurveRadiusAnalysis = {
    /** Array of radius values at each vertex (null for endpoints) */
    radiiAtVertices: (number | null)[];
    /** Identified curve and straight-like segments (straight-like = no speed restriction) */
    segments: CurveSegment[];
    /** Overall statistics */
    statistics: {
        /** Minimum radius found on the entire path */
        minRadiusMeters: number | null;
        /** Average radius of curved sections (sections with speed restrictions) */
        avgCurveRadiusMeters: number | null;
        /** Total length of curved sections (with speed restrictions) */
        totalCurveLengthMeters: number;
        /** Total length of straight-like sections (no speed restriction from curvature) */
        totalStraightLengthMeters: number;
        /** Suggested maximum speed for the entire path based on tightest curve */
        suggestedMaxSpeedKmH: number | null;
    };
};

/**
 * Configuration options for curve radius calculation
 */
export type CurveRadiusOptions = {
    /** Rail mode for speed coefficient selection. Default: 'rail' */
    mode?: RailMode;
    /** Running speed in km/h. Used to calculate the straight threshold dynamically. Default: 160 */
    runningSpeedKmH?: number;
    /** Stride for three-point radius calculation (k). Uses points at i-k, i, i+k. Default: 1 */
    stride?: number;
    /**
     * Radius threshold (m) above which section is classified as "straight-like".
     * "Straight-like" means the curve radius is large enough that it doesn't impose
     * a speed restriction - the train can travel at its maximum running speed.
     * Calculated from runningSpeedKmH using R = (V / coefficient)² if not provided.
     */
    straightThresholdMeters?: number;
    /** Minimum plausible radius (m). Values below are filtered. Default: 50 */
    minPlausibleRadiusMeters?: number;
    /**
     * Maximum radius to report (m). Above this is considered straight-like
     * (no speed restriction). Default: 10000
     */
    maxRadiusMeters?: number;
    /** Minimum consecutive curve points to form a curve segment. Default: 2 */
    minCurvePoints?: number;
};

/**
 * Response of the `transitPaths.curveAnalysis` socket route.
 */
export type CurveAnalysisResponse = {
    /** Curve segments and radii, null when the path has fewer than 3 coordinates */
    curveRadius: CurveRadiusAnalysis | null;
    /** Vertices with a direction change too abrupt for a reliable radius (coarse geometry) */
    largeAngleVertices: Feature<Point>[];
};
