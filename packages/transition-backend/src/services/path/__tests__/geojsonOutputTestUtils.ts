/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * GeoJSON conversion utilities for curve analysis results.
 *
 * RATIONALE
 * ---------
 * This file is NOT part of the production build. It was originally used
 * during the development of rail curve analysis to export analysis results
 * as GeoJSON FeatureCollections that can be pasted into geojson.io (or
 * similar map viewers) for visual inspection.
 *
 * It is preserved here because:
 *
 * 1. **Testing** — it provides a quick way to generate GeoJSON from curve
 *    analysis results during manual or automated testing. If a test path
 *    produces unexpected curve segments or radii, dumping the output to
 *    GeoJSON and viewing it on a map is a good way to diagnose the
 *    issue.
 *
 * 2. **Future enhancements** — when improving curve analysis (e.g. better
 *    radius estimation, cant/superelevation support, speed profile tuning),
 *    being able to visualize intermediate results (radius lines, braking
 *    zones, speed points) on a map is useful.
 *
 * 3. **Documentation by example** — the functions illustrate how to
 *    consume the CurveRadiusAnalysis and SpeedProfileResult types, which
 *    serves as a reference for anyone extending the analysis process.
 *
 * WHAT IT GENERATES
 * -----------------
 * - Curve / straight-like segment LineStrings with radius properties
 * - Perpendicular "radius visualization" lines pointing toward the
 *   center of curvature (useful for verifying radius accuracy)
 * - Speed profile points and braking zone LineStrings (optional)
 *
 * EXAMPLE USAGE
 * -------------
 *   import { analyzePathToEnhancedGeoJSON } from './geojsonOutputTestUtils';
 *   const geojson = analyzePathToEnhancedGeoJSON(path, { mode: 'rail' });
 *   console.log(JSON.stringify(geojson));
 *   // Paste the output into https://geojson.io or similar tool to visualize
 */

import { LineString, Position, Feature, FeatureCollection, Geometry } from 'geojson';
import { point as turfPoint, bearing as turfBearing, destination as turfDestination } from '@turf/turf';
import type { CurveRadiusAnalysis, CurveRadiusOptions, SpeedProfileOptions } from 'transition-common/lib/services/path/railCurves/types';
import { analyzeCurveRadius } from '../railCurves/curvatureAnalysis';
import { calculateSpeedProfile } from '../railCurves/speedProfile';

/**
 * Options for GeoJSON output generation (testing/debugging only).
 */
export type GeoJSONOutputOptions = CurveRadiusOptions & {
    /** Include radius visualization lines (default: true) */
    includeRadiusLines?: boolean;
    /** Maximum length of radius visualization lines in meters (default: 500) */
    maxRadiusLineLength?: number;
    /** Include speed profile data (default: false) */
    includeSpeedProfile?: boolean;
    /** Speed profile options (if includeSpeedProfile is true) */
    speedProfileOptions?: SpeedProfileOptions;
    /** Sample rate for radius lines (1 = every curve point, 2 = every other, etc.) */
    radiusLineSampleRate?: number;
};

/**
 * Normalizes an angle to be between -180 and 180 degrees
 */
function normalizeAngle(angle: number): number {
    while (angle > 180) angle -= 360;
    while (angle < -180) angle += 360;
    return angle;
}

/**
 * Calculates the perpendicular direction at a point on the path
 * (pointing towards the center of curvature)
 * Used to create radius visualization lines.
 */
function calculatePerpendicularBearing(prevCoord: Position, currentCoord: Position, nextCoord: Position): number {
    const bearingIn = turfBearing(turfPoint(prevCoord), turfPoint(currentCoord));
    const bearingOut = turfBearing(turfPoint(currentCoord), turfPoint(nextCoord));

    const bearingDiff = normalizeAngle(bearingOut - bearingIn);
    const bisectorBearing = normalizeAngle(bearingIn + bearingDiff / 2);

    // For a right turn, the center is on the left (perpendicular -90)
    // For a left turn, the center is on the right (perpendicular +90)
    const perpendicular = bearingDiff > 0 ? bisectorBearing - 90 : bisectorBearing + 90;

    return normalizeAngle(perpendicular);
}

/**
 * Creates a radius visualization line from a point on the curve
 * towards the center of curvature
 */
function createRadiusLine(
    coord: Position,
    radiusMeters: number,
    bearing: number,
    maxVisualizationLength: number = 500
): Feature<LineString> {
    const visualLength = Math.min(radiusMeters, maxVisualizationLength);

    const endPoint = turfDestination(turfPoint(coord), visualLength / 1000, bearing, { units: 'kilometers' });

    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: [coord, endPoint.geometry.coordinates]
        },
        properties: {
            type: 'radius_line',
            radiusMeters: Math.round(radiusMeters),
            visualLengthMeters: Math.round(visualLength)
        }
    };
}

/**
 * Converts curve analysis segments to a GeoJSON FeatureCollection.
 * Each feature is a LineString representing a curve or straight-like segment
 * with radius properties.
 *
 * @param coordinates Original path coordinates
 * @param analysis Curve radius analysis result
 * @returns GeoJSON FeatureCollection with curve segments
 */
export function curveAnalysisToGeoJSON(
    coordinates: Position[],
    analysis: CurveRadiusAnalysis
): FeatureCollection<LineString> {
    const features: Feature<LineString>[] = [];

    for (let index = 0; index < analysis.segments.length; index++) {
        const segment = analysis.segments[index];
        const segmentCoords = coordinates.slice(segment.startIndex, segment.endIndex + 1);

        if (segmentCoords.length < 2) {
            continue;
        }

        features.push({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: segmentCoords
            },
            properties: {
                segmentIndex: index,
                type: segment.type,
                medianRadiusMeters: Math.round(segment.medianRadiusMeters),
                minRadiusMeters: Math.round(segment.minRadiusMeters),
                maxRadiusMeters: Math.round(segment.maxRadiusMeters),
                lengthMeters: Math.round(segment.lengthMeters),
                startIndex: segment.startIndex,
                endIndex: segment.endIndex
            }
        });
    }

    return {
        type: 'FeatureCollection',
        features
    };
}

/**
 * Analyzes a path and returns the curve segments as GeoJSON.
 * Convenience function that combines analysis and GeoJSON conversion.
 *
 * @param path Transit path object with geography property
 * @param options Calculation options
 * @returns GeoJSON FeatureCollection with curve segments, or null if path has no geography
 */
export function analyzePathCurvesToGeoJSON(
    path: { attributes: { geography?: LineString } },
    options: CurveRadiusOptions = {}
): FeatureCollection<LineString> | null {
    const geography = path.attributes?.geography;

    if (!geography || !geography.coordinates || geography.coordinates.length < 3) {
        return null;
    }

    const analysis = analyzeCurveRadius(geography, options);
    return curveAnalysisToGeoJSON(geography.coordinates, analysis);
}

/**
 * Creates an enhanced GeoJSON FeatureCollection with:
 * - Curve and straight-like segments as LineStrings
 * - Radius visualization lines at curve points
 * - Optional speed profile data
 *
 * @param coordinates Path coordinates
 * @param analysis Curve radius analysis
 * @param options Output options
 * @returns Enhanced GeoJSON FeatureCollection
 */
export function curveAnalysisToEnhancedGeoJSON(
    coordinates: Position[],
    analysis: CurveRadiusAnalysis,
    options: GeoJSONOutputOptions = {}
): FeatureCollection<Geometry> {
    const {
        includeRadiusLines = true,
        maxRadiusLineLength = 500,
        includeSpeedProfile = false,
        speedProfileOptions = {},
        radiusLineSampleRate: rawRadiusLineSampleRate = 2
    } = options;

    // Guard against zero/negative sample rate which would cause a modulo-by-zero error
    const radiusLineSampleRate = rawRadiusLineSampleRate > 0 ? rawRadiusLineSampleRate : 1;

    const features: Feature<Geometry>[] = [];

    // Add segment LineStrings
    for (let index = 0; index < analysis.segments.length; index++) {
        const segment = analysis.segments[index];
        const segmentCoords = coordinates.slice(segment.startIndex, segment.endIndex + 1);

        if (segmentCoords.length < 2) {
            continue;
        }

        features.push({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: segmentCoords
            },
            properties: {
                featureType: 'segment',
                segmentIndex: index,
                type: segment.type,
                medianRadiusMeters: Math.round(segment.medianRadiusMeters),
                minRadiusMeters: Math.round(segment.minRadiusMeters),
                maxRadiusMeters: Math.round(segment.maxRadiusMeters),
                lengthMeters: Math.round(segment.lengthMeters),
                startIndex: segment.startIndex,
                endIndex: segment.endIndex
            }
        });
    }

    // Add radius visualization lines for curve segments
    if (includeRadiusLines) {
        for (let i = 1; i < coordinates.length - 1; i++) {
            if (i % radiusLineSampleRate !== 0) continue;

            const radius = analysis.radiiAtVertices[i];
            if (radius === null || radius >= (options.straightThresholdMeters || 2000)) {
                continue;
            }

            const bearing = calculatePerpendicularBearing(coordinates[i - 1], coordinates[i], coordinates[i + 1]);
            const radiusLine = createRadiusLine(coordinates[i], radius, bearing, maxRadiusLineLength);

            radiusLine.properties = {
                ...radiusLine.properties,
                featureType: 'radius_line',
                vertexIndex: i
            };

            features.push(radiusLine);
        }
    }

    // Add speed profile points if requested
    if (includeSpeedProfile) {
        const geometry: LineString = { type: 'LineString', coordinates };
        const speedProfile = calculateSpeedProfile(geometry, speedProfileOptions);

        for (const zone of speedProfile.brakingZones) {
            const zoneCoords = coordinates.slice(zone.startIndex, zone.endIndex + 1);
            if (zoneCoords.length >= 2) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: zoneCoords
                    },
                    properties: {
                        featureType: 'braking_zone',
                        startIndex: zone.startIndex,
                        endIndex: zone.endIndex,
                        reason: zone.reason
                    }
                });
            }
        }

        for (const point of speedProfile.speedPoints) {
            if (point.index % radiusLineSampleRate === 0 || point.isBraking || point.isAccelerating) {
                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: coordinates[point.index]
                    },
                    properties: {
                        featureType: 'speed_point',
                        index: point.index,
                        distanceMeters: Math.round(point.distanceMeters),
                        maxSpeedByRadiusKmH: Math.round(point.maxSpeedByRadiusKmH),
                        achievableSpeedKmH: Math.round(point.achievableSpeedKmH),
                        isBraking: point.isBraking,
                        isAccelerating: point.isAccelerating
                    }
                });
            }
        }
    }

    return {
        type: 'FeatureCollection',
        features
    };
}

/**
 * Analyzes a path and returns enhanced GeoJSON with radius visualization.
 *
 * @param path Transit path object
 * @param options Output options
 * @returns Enhanced GeoJSON FeatureCollection
 */
export function analyzePathToEnhancedGeoJSON(
    path: { attributes: { geography?: LineString } },
    options: GeoJSONOutputOptions = {}
): FeatureCollection<Geometry> | null {
    const geography = path.attributes?.geography;

    if (!geography || !geography.coordinates || geography.coordinates.length < 3) {
        return null;
    }

    const analysis = analyzeCurveRadius(geography, options);
    return curveAnalysisToEnhancedGeoJSON(geography.coordinates, analysis, options);
}
