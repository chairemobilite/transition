/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { Position } from 'geojson';
import { destination as turfDestination } from '@turf/turf';

/**
 * Coordinates on a circle arc, turning left, starting south of the circle center.
 *
 * @param {Position} center Center of the circle [lon, lat]
 * @param {number} radiusMeters Radius of the circle, in meters
 * @param {number} spacingMeters Chord length between consecutive points, in meters
 * @param {number} count Number of points
 * @returns {Position[]} The arc coordinates
 */
export const arcCoordinates = (
    center: Position,
    radiusMeters: number,
    spacingMeters: number,
    count: number
): Position[] => {
    const stepDegrees = (2 * Math.asin(spacingMeters / (2 * radiusMeters)) * 180) / Math.PI;
    return Array.from(
        { length: count },
        (_, i) =>
            turfDestination(center, radiusMeters / 1000, 180 - i * stepDegrees, { units: 'kilometers' }).geometry
                .coordinates
    );
};

/**
 * Coordinates on a straight line heading east.
 *
 * @param {Position} start First point [lon, lat]
 * @param {number} spacingMeters Distance between consecutive points, in meters
 * @param {number} count Number of points
 * @returns {Position[]} The line coordinates
 */
export const straightCoordinates = (start: Position, spacingMeters: number, count: number): Position[] =>
    Array.from(
        { length: count },
        (_, i) => turfDestination(start, (i * spacingMeters) / 1000, 90, { units: 'kilometers' }).geometry.coordinates
    );
