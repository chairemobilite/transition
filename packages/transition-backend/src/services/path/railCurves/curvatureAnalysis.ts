/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Path curvature segmentation and analysis.
 * Segments a path into curve and straight-like sections and provides statistics.
 */

import type { LineString, Position } from 'geojson';
import { length as turfLength, lineString as turfLineString } from '@turf/turf';
import type { CurvatureType, TurnDirection, CurveSegment } from 'transition-common/lib/services/path/railCurves/types';
import { type CurveRadiusOptions, resolveOptions } from './constants';
import { calculateRadiiAtVertices, calculateTurnDirections } from './geometry';

/**
 * Determines the segment type for a vertex based on its radius.
 * Only the first and last `stride` vertices have a null radius: they take
 * the type of the nearest vertex with a radius.
 * straight means no speed restriction from curvature,
 * but could be curved in reality.
 */
function getVertexType(index: number, radii: (number | null)[], straightThreshold: number): CurvatureType {
    const radius = radii[index];

    // If we have a valid radius, use it
    if (radius !== null) {
        return radius < straightThreshold ? 'curve' : 'straight';
    }

    // For null radii (path ends), look at the nearest vertex with a radius
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

/**
 * Creates a CurveSegment object from segment data
 *
 * @param coordinates Coordinates of the whole path
 * @param segment The segment's first and last vertex indexes in `coordinates`
 * (inclusive), the radii of its vertices, its type, and the radius to use
 * when no radius is measurable
 */
function createCurveSegment(
    coordinates: Position[],
    {
        startIndex,
        endIndex,
        radii,
        type,
        maxRadiusMeters
    }: { startIndex: number; endIndex: number; radii: number[]; type: CurvatureType; maxRadiusMeters: number }
): CurveSegment {
    const segmentCoords = coordinates.slice(startIndex, endIndex + 1);
    let lengthMeters = 0;
    if (segmentCoords.length >= 2) {
        lengthMeters = turfLength(turfLineString(segmentCoords), { units: 'meters' });
    }

    const validRadii = radii.filter((r) => r > 0);

    // No measurable curvature — treat as straight with max radius
    if (validRadii.length === 0) {
        return {
            startIndex,
            endIndex,
            medianRadiusMeters: maxRadiusMeters,
            minRadiusMeters: maxRadiusMeters,
            lengthMeters,
            type
        };
    }

    validRadii.sort((a, b) => a - b);

    return {
        startIndex,
        endIndex,
        medianRadiusMeters: validRadii[Math.floor(validRadii.length / 2)],
        minRadiusMeters: validRadii[0],
        lengthMeters,
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
 * @param {Position[]} coordinates Array of [lon, lat] positions
 * @param {(number | null)[]} radii Array of radius values at each vertex
 * @param {CurveRadiusOptions} options Calculation options
 * @returns {CurveSegment[]} Array of curve segments
 */
export function segmentPathByCurvature(
    coordinates: Position[],
    radii: (number | null)[],
    options: CurveRadiusOptions
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
        // 2. Direction reverses within a curve section (left <-> right), as in an S-curve.
        // A 'straight' direction is a collinear vertex: it does not end the curve, which
        // continues in the same direction after it. With the default stride of 1, a vertex
        // of a curve section cannot be collinear (its radius would be the maximum radius),
        // but it can be with a larger stride, as the radius then uses farther points.
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
            const segment = createCurveSegment(coordinates, {
                startIndex: currentSegmentStart,
                endIndex: i, // Include transition point in this segment
                radii: currentRadii,
                type: currentType,
                maxRadiusMeters: opts.maxRadiusMeters
            });
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
        const segment = createCurveSegment(coordinates, {
            startIndex: currentSegmentStart,
            endIndex: n - 1,
            radii: currentRadii,
            type: currentType,
            maxRadiusMeters: opts.maxRadiusMeters
        });
        segments.push(segment);
    }

    return segments;
}

/**
 * Segments a GeoJSON LineString into curve and straight-like sections.
 *
 * @param {LineString} geometry GeoJSON LineString geometry
 * @param {CurveRadiusOptions} options Calculation options
 * @returns {CurveSegment[]} Curve and straight-like segments, empty for fewer than 2 coordinates
 */
export function analyzeCurveRadius(geometry: LineString, options: CurveRadiusOptions): CurveSegment[] {
    const radii = calculateRadiiAtVertices(geometry.coordinates, options);
    return segmentPathByCurvature(geometry.coordinates, radii, options);
}
