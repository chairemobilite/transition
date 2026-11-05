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
import { median } from 'chaire-lib-common/lib/utils/MathUtils';
import type { CurvatureType, CurveSegment } from 'transition-common/lib/services/path/railCurves/types';
import { type CurveRadiusOptions, calculateStraightThreshold, MAX_REPORTED_RADIUS_METERS } from './constants';
import { type TurnDirection, calculateRadiiAtVertices, calculateTurnDirections } from './geometry';

/**
 * Determines the segment type for a vertex based on its radius.
 * Only the first and last vertices have a null radius: they take the type of
 * their neighbour. A path of 2 points has no radius: it is straight.
 * straight means no speed restriction from curvature,
 * but could be curved in reality.
 */
function getVertexType(index: number, radii: (number | null)[], straightThreshold: number): CurvatureType {
    const radius = radii[index] ?? radii[index === 0 ? 1 : index - 1] ?? null;
    return radius !== null && radius < straightThreshold ? 'curve' : 'straight';
}

/**
 * Creates a CurveSegment object from segment data
 *
 * @param coordinates Coordinates of the whole path
 * @param segment The segment's first and last vertex indexes in `coordinates`
 * (inclusive), the radii of its vertices and its type
 */
function createCurveSegment(
    coordinates: Position[],
    {
        startIndex,
        endIndex,
        radii,
        type
    }: { startIndex: number; endIndex: number; radii: number[]; type: CurvatureType }
): CurveSegment {
    // A path of 2 points has no radius: its segment gets the maximum radius
    const sortedRadii = radii.length > 0 ? [...radii].sort((a, b) => a - b) : [MAX_REPORTED_RADIUS_METERS];
    return {
        startIndex,
        endIndex,
        medianRadiusMeters: median(sortedRadii),
        minRadiusMeters: sortedRadii[0],
        lengthMeters: turfLength(turfLineString(coordinates.slice(startIndex, endIndex + 1)), { units: 'meters' }),
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
    const straightThresholdMeters = calculateStraightThreshold(options.runningSpeedKmH, options.mode);
    const segments: CurveSegment[] = [];
    const n = coordinates.length;

    if (n < 2) {
        return segments;
    }

    // Assign a type to each vertex
    const vertexTypes: CurvatureType[] = [];
    for (let i = 0; i < n; i++) {
        vertexTypes[i] = getVertexType(i, radii, straightThresholdMeters);
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
        // A vertex of a curve section turns left or right: a collinear vertex has the
        // maximum radius, so it is straight-like. Only the first and last vertices of
        // the path have no direction.
        const typeChanged = newType !== currentType;
        const directionChanged =
            currentType === 'curve' &&
            newType === 'curve' &&
            currentDirection !== null &&
            newDirection !== null &&
            currentDirection !== newDirection;

        if (typeChanged || directionChanged) {
            // Save current segment
            // End this segment at i (inclusive) to ensure overlap with next segment
            const segment = createCurveSegment(coordinates, {
                startIndex: currentSegmentStart,
                endIndex: i, // Include transition point in this segment
                radii: currentRadii,
                type: currentType
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
            // The first vertex of the path has no direction: take the one of the next vertex
            if (newDirection !== null) {
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
            type: currentType
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
    const radii = calculateRadiiAtVertices(geometry.coordinates, options.mode);
    return segmentPathByCurvature(geometry.coordinates, radii, options);
}
