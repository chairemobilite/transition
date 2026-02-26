/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Path curvature segmentation and analysis.
 * Segments a path into curve and straight-like sections and provides statistics.
 */

import { LineString, Position } from 'geojson';
import { length as turfLength, lineString as turfLineString } from '@turf/turf';
import type {
    CurvatureType,
    TurnDirection,
    CurveSegment,
    CurveRadiusAnalysis,
    CurveRadiusOptions
} from 'transition-common/lib/services/path/railCurves/types';
import { resolveOptions } from './constants';
import { calculateRadiiAtVertices, calculateTurnDirections, estimateMaxSpeedFromRadius } from './geometry';

/**
 * Determines the segment type for a vertex based on its radius.
 * Points with null radius inherit type from nearest valid neighbor.
 * straight means no speed restriction from curvature,
 * but could be curved in reality.
 */
function getVertexType(index: number, radii: (number | null)[], straightThreshold: number): CurvatureType {
    const radius = radii[index];

    // If we have a valid radius, use it
    if (radius !== null) {
        return radius < straightThreshold ? 'curve' : 'straight';
    }

    // For null radii (endpoints), look at nearest valid neighbor
    // Search forward first, then backward
    for (let offset = 1; offset < radii.length; offset++) {
        if (index + offset < radii.length && radii[index + offset] !== null) {
            return radii[index + offset]! < straightThreshold ? 'curve' : 'straight';
        }
        if (index - offset >= 0 && radii[index - offset] !== null) {
            return radii[index - offset]! < straightThreshold ? 'curve' : 'straight';
        }
    }

    // Default to straight if no valid radii found
    // TODO: we could trigger an error if no valid radii found, needs more testing.
    return 'straight';
}

/** Creates a CurveSegment object from segment data */
function createCurveSegment(
    coordinates: Position[],
    startIndex: number,
    endIndex: number,
    radii: number[],
    type: CurvatureType,
    opts: Required<CurveRadiusOptions>
): CurveSegment {
    const segmentCoords = coordinates.slice(startIndex, endIndex + 1);
    let lengthMeters = 0;
    if (segmentCoords.length >= 2) {
        lengthMeters = turfLength(turfLineString(segmentCoords), { units: 'meters' });
    }

    const validRadii = radii.filter((r) => r !== null && r > 0);

    // No measurable curvature — treat as straight with max radius
    if (validRadii.length === 0) {
        return {
            startIndex,
            endIndex,
            medianRadiusMeters: opts.maxRadiusMeters,
            minRadiusMeters: opts.maxRadiusMeters,
            maxRadiusMeters: opts.maxRadiusMeters,
            lengthMeters,
            startCoord: coordinates[startIndex],
            endCoord: coordinates[endIndex],
            type
        };
    }

    validRadii.sort((a, b) => a - b);

    return {
        startIndex,
        endIndex,
        medianRadiusMeters: validRadii[Math.floor(validRadii.length / 2)],
        minRadiusMeters: validRadii[0],
        maxRadiusMeters: validRadii[validRadii.length - 1],
        lengthMeters,
        startCoord: coordinates[startIndex],
        endCoord: coordinates[endIndex],
        type
    };
}

/**
 * Segments a path into curve and straight-like sections based on calculated radii.
 * - 'curve' sections have radii small enough to impose speed restrictions
 * - 'straight' sections have radii large enough to allow max running speed
 *   (doesn't mean geometrically straight, just no speed impact from curvature)
 *
 * Ensures continuous coverage with no gaps between segments.
 *
 * @param coordinates Array of [lon, lat] positions
 * @param radii Array of radius values at each vertex
 * @param options Calculation options
 * @returns Array of curve segments
 */
export function segmentPathByCurvature(
    coordinates: Position[],
    radii: (number | null)[],
    options: CurveRadiusOptions = {}
): CurveSegment[] {
    const opts = resolveOptions(options);
    const segments: CurveSegment[] = [];
    const n = coordinates.length;

    if (n < 2) {
        return segments;
    }

    // Assign a type to each vertex
    const vertexTypes: CurvatureType[] = [];
    for (let i = 0; i < n; i++) {
        vertexTypes[i] = getVertexType(i, radii, opts.straightThresholdMeters);
    }

    // Calculate turn directions to split curves when direction changes
    const turnDirections = calculateTurnDirections(coordinates);

    let currentSegmentStart = 0;
    let currentType = vertexTypes[0];
    let currentDirection: TurnDirection | null = turnDirections[0];
    let currentRadii: number[] = radii[0] !== null ? [radii[0]] : [];

    for (let i = 1; i < n; i++) {
        const newType = vertexTypes[i];
        const newDirection = turnDirections[i];
        const radius = radii[i];

        // Split segment if:
        // 1. Type changes (curve <-> straight), OR
        // 2. Direction changes within a curve section (left <-> right)
        const typeChanged = newType !== currentType;
        const directionChanged =
            currentType === 'curve' &&
            newType === 'curve' &&
            currentDirection !== null &&
            newDirection !== null &&
            currentDirection !== 'straight' &&
            newDirection !== 'straight' &&
            currentDirection !== newDirection;

        if (typeChanged || directionChanged) {
            // Save current segment
            // End this segment at i (inclusive) to ensure overlap with next segment
            const segment = createCurveSegment(
                coordinates,
                currentSegmentStart,
                i, // Include transition point in this segment
                currentRadii,
                currentType,
                opts
            );
            segments.push(segment);

            // Start new segment at i (overlap by 1 point for continuity)
            currentType = newType;
            currentDirection = newDirection;
            currentSegmentStart = i;
            currentRadii = radius !== null ? [radius] : [];
        } else {
            // Same type and direction - continue segment
            if (radius !== null) {
                currentRadii.push(radius);
            }
            // Update direction if we have a valid one (skip 'straight' micro-sections)
            if (newDirection !== null && newDirection !== 'straight') {
                currentDirection = newDirection;
            }
        }
    }

    // Save final segment (only if it has at least 2 points)
    if (n - 1 > currentSegmentStart) {
        const segment = createCurveSegment(coordinates, currentSegmentStart, n - 1, currentRadii, currentType, opts);
        segments.push(segment);
    }

    return segments;
}

/**
 * Performs a complete curve radius analysis on a GeoJSON LineString
 *
 * @param geometry GeoJSON LineString geometry
 * @param options Calculation options
 * @returns Complete curve radius analysis
 */
export function analyzeCurveRadius(geometry: LineString, options: CurveRadiusOptions = {}): CurveRadiusAnalysis {
    const opts = resolveOptions(options);
    const coordinates = geometry.coordinates;

    // Calculate radii at each vertex
    const radiiAtVertices = calculateRadiiAtVertices(coordinates, opts);

    // Segment the path
    const segments = segmentPathByCurvature(coordinates, radiiAtVertices, opts);

    // Calculate statistics
    const curveSegments = segments.filter((s) => s.type === 'curve');
    const straightSegments = segments.filter((s) => s.type === 'straight');

    const allCurveRadii = curveSegments.map((s) => s.minRadiusMeters);
    const minRadiusMeters = allCurveRadii.length > 0 ? Math.min(...allCurveRadii) : null;

    const avgCurveRadiusMeters =
        allCurveRadii.length > 0 ? allCurveRadii.reduce((a, b) => a + b, 0) / allCurveRadii.length : null;

    const totalCurveLengthMeters = curveSegments.reduce((sum, s) => sum + s.lengthMeters, 0);
    const totalStraightLengthMeters = straightSegments.reduce((sum, s) => sum + s.lengthMeters, 0);

    const suggestedMaxSpeedKmH =
        minRadiusMeters !== null ? estimateMaxSpeedFromRadius(opts.mode, minRadiusMeters) : null;

    return {
        radiiAtVertices,
        segments,
        statistics: {
            minRadiusMeters,
            avgCurveRadiusMeters,
            totalCurveLengthMeters,
            totalStraightLengthMeters,
            suggestedMaxSpeedKmH
        }
    };
}

/**
 * Analyzes curve radius for a transit path object
 *
 * @param path Transit path object with geography property
 * @param options Calculation options
 * @returns Complete curve radius analysis or null if path has no geography
 */
export function analyzePathRailCurveRadius(
    path: { attributes: { geography?: LineString } },
    options: CurveRadiusOptions = {}
): CurveRadiusAnalysis | null {
    const geography = path.attributes?.geography;

    if (!geography || !geography.coordinates || geography.coordinates.length < 3) {
        return null;
    }

    return analyzeCurveRadius(geography, options);
}
