/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Segment-level travel time calculations comparing traditional (constant speed)
 * and curve-aware methods. Used for PathGeographyGenerator and statistics display.
 */

import { LineString, Position } from 'geojson';
import {
    distance as turfDistance,
    point as turfPoint,
    length as turfLength,
    lineString as turfLineString
} from '@turf/turf';
import type {
    SpeedProfileOptions,
    SegmentTravelTimeResult,
    GeometryResolution,
    PathTravelTimeAnalysis
} from 'transition-common/lib/services/path/railCurves/types';
import { DEFAULT_SPEED_OPTIONS, MIN_DEFLECTION_ANGLE_RAD, MIN_COARSE_VERTEX_SPACING_METERS } from './constants';
import {
    kphToMps,
    durationFromAccelerationDecelerationDistanceAndRunningSpeed
} from 'chaire-lib-common/lib/utils/PhysicsUtils';
import { calculateRadiiAtVertices, estimateMaxSpeedFromRadius, calculateTurningAngle } from './geometry';

/**
 * Determines the geometry resolution of a path for curve analysis purposes.
 *
 * A vertex is considered a "coarse direction change" only if its deflection
 * angle exceeds MIN_DEFLECTION_ANGLE_RAD AND the local spacing (max distance
 * to its neighbors) exceeds MIN_COARSE_VERTEX_SPACING_METERS. This avoids
 * penalizing tight but densely-drawn curves where large angles are expected.
 *
 * @param coordinates All coordinates of the path
 * @param segmentCount Number of segments (stations - 1)
 * @returns The geometry resolution classification
 */
export function detectGeometryResolution(coordinates: Position[], segmentCount: number): GeometryResolution {
    const hasNoWaypoints = coordinates.length <= segmentCount + 1;

    let hasCoarseAngle = false;
    if (coordinates.length >= 3) {
        for (let i = 1; i < coordinates.length - 1; i++) {
            const angle = calculateTurningAngle(coordinates[i - 1], coordinates[i], coordinates[i + 1]);
            if (angle >= MIN_DEFLECTION_ANGLE_RAD) {
                const distPrev = turfDistance(
                    turfPoint(coordinates[i - 1] as number[]),
                    turfPoint(coordinates[i] as number[]),
                    { units: 'meters' }
                );
                const distNext = turfDistance(
                    turfPoint(coordinates[i] as number[]),
                    turfPoint(coordinates[i + 1] as number[]),
                    { units: 'meters' }
                );
                const localSpacing = Math.max(distPrev, distNext);
                if (localSpacing >= MIN_COARSE_VERTEX_SPACING_METERS) {
                    hasCoarseAngle = true;
                    break;
                }
            }
        }
    }

    if (!hasCoarseAngle && !hasNoWaypoints) {
        return 'high';
    } else if (!hasCoarseAngle && hasNoWaypoints) {
        return 'almostStraight';
    } else if (hasCoarseAngle && hasNoWaypoints) {
        return 'none';
    } else {
        return 'low';
    }
}

/**
 * Returns true if curve analysis should be used for this geometry resolution.
 * Only 'high' resolution geometry has reliable enough data for curve analysis.
 * TODO: we could add more precision levels later on after further analysis.
 */
export function shouldUseCurveAnalysis(resolution: GeometryResolution): boolean {
    return resolution === 'high';
}

/**
 * Calculates travel time for a segment assuming constant running speed
 * with acceleration at start and deceleration at end (traditional method).
 * Delegates to durationFromAccelerationDecelerationDistanceAndRunningSpeed
 * from PhysicsUtils.
 *
 * @param distanceMeters Segment distance
 * @param runningSpeedMps Running speed in m/s
 * @param accelerationMps2 Acceleration in m/s²
 * @param decelerationMps2 Deceleration in m/s²
 * @returns Travel time in seconds
 */
export function calculateSimpleSegmentTime(
    distanceMeters: number,
    runningSpeedMps: number,
    accelerationMps2: number,
    decelerationMps2: number
): number {
    return durationFromAccelerationDecelerationDistanceAndRunningSpeed(
        accelerationMps2,
        decelerationMps2,
        distanceMeters,
        runningSpeedMps
    );
}

/**
 * Calculates "no dwell" travel time for a segment considering curve speed limits
 * but WITHOUT acceleration/deceleration for station stops.
 *
 * This represents the time to traverse the segment at running speed (or curve-limited
 * speed, whichever is lower) as if the train doesn't stop at stations.
 * Needed for statistics, comparisons and time tortuosity analysis.
 *
 * @param coordinates Full path coordinates
 * @param startCoordIndex Starting coordinate index for this segment
 * @param endCoordIndex Ending coordinate index for this segment
 * @param options Calculation options
 * @returns Travel time in seconds (no stops, but curve-limited)
 */
export function calculateNoDwellTimeWithCurves(
    coordinates: Position[],
    startCoordIndex: number,
    endCoordIndex: number,
    options: SpeedProfileOptions = {}
): number {
    const opts = { ...DEFAULT_SPEED_OPTIONS, ...options };
    const segmentCoords = coordinates.slice(startCoordIndex, endCoordIndex + 1);
    const n = segmentCoords.length;

    if (n < 2) {
        return 0;
    }

    const runningSpeedKmH = opts.maxSpeedKmH;
    const runningSpeedMps = kphToMps(runningSpeedKmH);

    const radii = calculateRadiiAtVertices(segmentCoords, opts);
    const speedLimits: number[] = radii.map((r) => {
        if (r === null) return runningSpeedKmH;
        return Math.min(estimateMaxSpeedFromRadius(opts.mode, r), runningSpeedKmH);
    });

    let totalTime = 0;
    for (let i = 1; i < n; i++) {
        const dist = turfDistance(turfPoint(segmentCoords[i - 1]), turfPoint(segmentCoords[i]), { units: 'meters' });
        const speedLimitMps = Math.min(kphToMps(speedLimits[i - 1]), kphToMps(speedLimits[i]), runningSpeedMps);
        if (speedLimitMps > 0.01) {
            totalTime += dist / speedLimitMps;
        } else if (dist > 0) {
            totalTime += dist / 0.1; // Crawl speed fallback
        }
    }

    return totalTime;
}

/**
 * Calculates travel time for a segment considering curve speed limits.
 * Uses the same accel/decel model as the simple calculation but with curve-imposed speed limits.
 *
 * The algorithm:
 * 1. Calculate speed limit at each point based on curve radius (capped at running speed)
 * 2. Forward pass: starting at 0, accelerate but respect curve limits
 * 3. Backward pass: must reach 0, decelerate but respect curve limits
 * 4. Take minimum of forward/backward at each point
 * 5. Integrate time using trapezoidal rule
 *
 * @param coordinates Full path coordinates
 * @param startCoordIndex Starting coordinate index for this segment
 * @param endCoordIndex Ending coordinate index for this segment
 * @param options Calculation options
 * @returns Object with travel time and min radius info
 */
export function calculateSegmentTimeWithCurves(
    coordinates: Position[],
    startCoordIndex: number,
    endCoordIndex: number,
    options: SpeedProfileOptions = {}
): { timeSeconds: number; minRadiusMeters: number | null; minSpeedLimitKmH: number } {
    const opts = { ...DEFAULT_SPEED_OPTIONS, ...options };
    const segmentCoords = coordinates.slice(startCoordIndex, endCoordIndex + 1);
    const n = segmentCoords.length;

    if (n < 2) {
        return { timeSeconds: 0, minRadiusMeters: null, minSpeedLimitKmH: opts.maxSpeedKmH };
    }

    const runningSpeedKmH = opts.maxSpeedKmH;
    const runningSpeedMps = kphToMps(runningSpeedKmH);
    const accel = opts.accelerationMps2;
    const decel = opts.decelerationMps2;

    // Calculate cumulative distances
    const distances: number[] = [0];
    for (let i = 1; i < n; i++) {
        const d = turfDistance(turfPoint(segmentCoords[i - 1]), turfPoint(segmentCoords[i]), { units: 'meters' });
        distances.push(distances[i - 1] + d);
    }
    const totalDistance = distances[n - 1];

    if (totalDistance < 0.1) {
        return { timeSeconds: 0, minRadiusMeters: null, minSpeedLimitKmH: runningSpeedKmH };
    }

    // With fewer than 3 points, we cannot compute any radius.
    // Fall back to simple kinematic calculation (accel + cruise + decel).
    if (n < 3) {
        const simpleTime = calculateSimpleSegmentTime(totalDistance, runningSpeedMps, accel, decel);
        return { timeSeconds: simpleTime, minRadiusMeters: null, minSpeedLimitKmH: runningSpeedKmH };
    }

    // Calculate curve radii and speed limits at each point
    const radii = calculateRadiiAtVertices(segmentCoords, opts);
    const speedLimits: number[] = radii.map((r) => {
        if (r === null) return runningSpeedKmH;
        return Math.min(estimateMaxSpeedFromRadius(opts.mode, r), runningSpeedKmH);
    });

    // Find minimum radius and speed limit
    const validRadii = radii.filter((r): r is number => r !== null && r < opts.straightThresholdMeters);
    const minRadiusMeters = validRadii.length > 0 ? Math.min(...validRadii) : null;
    const minSpeedLimitKmH = Math.min(...speedLimits);

    // Forward pass: start at 0, accelerate but respect curve limits
    const forwardSpeedMps: number[] = new Array(n);
    forwardSpeedMps[0] = 0;

    for (let i = 1; i < n; i++) {
        const dist = distances[i] - distances[i - 1];
        const maxFromAccel = Math.sqrt(forwardSpeedMps[i - 1] ** 2 + 2 * accel * dist);
        forwardSpeedMps[i] = Math.min(maxFromAccel, kphToMps(speedLimits[i]), runningSpeedMps);
    }

    // Backward pass: end at 0, decelerate but respect curve limits
    const backwardSpeedMps: number[] = new Array(n);
    backwardSpeedMps[n - 1] = 0;

    for (let i = n - 2; i >= 0; i--) {
        const dist = distances[i + 1] - distances[i];
        const maxFromDecel = Math.sqrt(backwardSpeedMps[i + 1] ** 2 + 2 * decel * dist);
        backwardSpeedMps[i] = Math.min(maxFromDecel, kphToMps(speedLimits[i]), runningSpeedMps);
    }

    // Combine: take minimum at each point
    const finalSpeedMps: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
        finalSpeedMps[i] = Math.min(forwardSpeedMps[i], backwardSpeedMps[i]);
    }

    // Integrate time with proper accel/decel phases
    let totalTime = 0;
    for (let i = 1; i < n; i++) {
        const dist = distances[i] - distances[i - 1];
        const v1 = finalSpeedMps[i - 1];
        const v2 = finalSpeedMps[i];
        const vMax = Math.min(kphToMps(speedLimits[i - 1]), kphToMps(speedLimits[i]), runningSpeedMps);

        if (v1 > 0.01 || v2 > 0.01) {
            totalTime += calculateMicroSegmentTravelTime(dist, v1, v2, vMax, accel, decel);
        } else if (dist > 0) {
            totalTime += dist / 0.1; // Crawl speed for near-zero speeds
        }
    }

    return {
        timeSeconds: totalTime,
        minRadiusMeters,
        minSpeedLimitKmH
    };
}

/**
 * Calculates travel time between two points considering acceleration/deceleration limits.
 * Used internally for integrating time across micro-segments.
 */
function calculateMicroSegmentTravelTime(
    distanceM: number,
    v1Ms: number,
    v2Ms: number,
    vMaxMs: number,
    accelMps2: number,
    decelMps2: number
): number {
    if (distanceM < 0.01) return 0;

    v1Ms = Math.min(v1Ms, vMaxMs);
    v2Ms = Math.min(v2Ms, vMaxMs);

    const distToVmax =
        v1Ms >= vMaxMs
            ? 0
            : accelMps2 <= 0
                ? Number.POSITIVE_INFINITY
                : (vMaxMs * vMaxMs - v1Ms * v1Ms) / (2 * accelMps2);
    const distFromVmax =
        v2Ms >= vMaxMs
            ? 0
            : decelMps2 <= 0
                ? Number.POSITIVE_INFINITY
                : (vMaxMs * vMaxMs - v2Ms * v2Ms) / (2 * decelMps2);

    if (distToVmax + distFromVmax >= distanceM) {
        if (v2Ms > v1Ms) {
            if (accelMps2 <= 0) {
                const maxReachableSpeed = v1Ms;
                return (2 * distanceM) / (v1Ms + maxReachableSpeed);
            }
            const maxReachableSpeed = Math.sqrt(v1Ms * v1Ms + 2 * accelMps2 * distanceM);
            if (maxReachableSpeed >= v2Ms) {
                const accelDist = (v2Ms * v2Ms - v1Ms * v1Ms) / (2 * accelMps2);
                const accelTime = (v2Ms - v1Ms) / accelMps2;
                const remainingDist = distanceM - accelDist;
                const cruiseTime = remainingDist > 0 ? remainingDist / v2Ms : 0;
                return accelTime + cruiseTime;
            } else {
                return (2 * distanceM) / (v1Ms + maxReachableSpeed);
            }
        } else if (v2Ms < v1Ms) {
            if (decelMps2 <= 0) {
                return (2 * distanceM) / (v1Ms + v2Ms);
            }
            const distNeeded = (v1Ms * v1Ms - v2Ms * v2Ms) / (2 * decelMps2);
            if (distNeeded <= distanceM) {
                const decelTime = (v1Ms - v2Ms) / decelMps2;
                const cruiseDist = distanceM - distNeeded;
                const cruiseTime = cruiseDist > 0 ? cruiseDist / v1Ms : 0;
                return cruiseTime + decelTime;
            } else {
                return (2 * distanceM) / (v1Ms + v2Ms);
            }
        } else {
            return distanceM / v1Ms;
        }
    }

    const cruiseDistance = distanceM - distToVmax - distFromVmax;
    const accelTime = accelMps2 <= 0 ? (v1Ms < vMaxMs ? Number.POSITIVE_INFINITY : 0) : (vMaxMs - v1Ms) / accelMps2;
    const cruiseTime = cruiseDistance / vMaxMs;
    const decelTime = decelMps2 <= 0 ? (v2Ms < vMaxMs ? Number.POSITIVE_INFINITY : 0) : (vMaxMs - v2Ms) / decelMps2;

    return accelTime + cruiseTime + decelTime;
}

/**
 * Calculates travel times for all segments between stops, comparing
 * the traditional method (constant speed) with the curve-aware method.
 *
 * @param geography Full path LineString geometry
 * @param segmentIndices Array of coordinate indices where each segment starts
 * @param options Calculation options
 * @returns Complete travel time analysis
 */
export function calculateSegmentTravelTimes(
    geography: LineString,
    segmentIndices: number[],
    options: SpeedProfileOptions = {}
): PathTravelTimeAnalysis {
    const opts = { ...DEFAULT_SPEED_OPTIONS, ...options };
    const coordinates = geography.coordinates;
    const segmentCount = segmentIndices.length;

    const results: SegmentTravelTimeResult[] = [];
    let totalTimeWithoutCurves = 0;
    let totalTimeWithCurves = 0;
    let totalNoDwellCurveTime = 0;
    let totalDistance = 0;

    // Detect geometry resolution FIRST so we can skip curve analysis
    // for low/none/almostStraight resolution.
    const geometryResolution = detectGeometryResolution(coordinates, segmentCount);
    const useCurves = shouldUseCurveAnalysis(geometryResolution);

    const runningSpeedMps = kphToMps(opts.maxSpeedKmH);

    for (let i = 0; i < segmentCount; i++) {
        const startCoordIndex = segmentIndices[i];
        const endCoordIndex = i < segmentCount - 1 ? segmentIndices[i + 1] : coordinates.length - 1;
        const segmentCoords = coordinates.slice(startCoordIndex, endCoordIndex + 1);
        let segmentDistance = 0;
        if (segmentCoords.length >= 2) {
            const line = turfLineString(segmentCoords);
            segmentDistance = turfLength(line, { units: 'meters' });
        }

        // 1. Calculate time WITHOUT curves (traditional method)
        const timeWithoutCurves = calculateSimpleSegmentTime(
            segmentDistance,
            runningSpeedMps,
            opts.accelerationMps2,
            opts.decelerationMps2
        );

        let curveTimeSeconds = timeWithoutCurves;
        let noDwellCurveTime = segmentDistance > 0 ? segmentDistance / runningSpeedMps : 0;
        let minRadiusMeters: number | null = null;

        if (useCurves) {
            // 2. Calculate time WITH curves
            const curveResult = calculateSegmentTimeWithCurves(coordinates, startCoordIndex, endCoordIndex, opts);
            curveTimeSeconds = curveResult.timeSeconds;
            minRadiusMeters = curveResult.minRadiusMeters;

            // 3. Calculate "no dwell" curve time
            noDwellCurveTime = calculateNoDwellTimeWithCurves(coordinates, startCoordIndex, endCoordIndex, opts);
        }

        const curveSpeedLimitKmH =
            minRadiusMeters !== null
                ? Math.min(estimateMaxSpeedFromRadius(opts.mode, minRadiusMeters), opts.maxSpeedKmH)
                : null;

        const differenceSeconds = Math.max(0, curveTimeSeconds - timeWithoutCurves);
        const differencePercent = timeWithoutCurves > 0 ? (differenceSeconds / timeWithoutCurves) * 100 : 0;

        results.push({
            segmentIndex: i,
            distanceMeters: Math.round(segmentDistance),
            travelTimeWithoutCurvesSeconds: Math.round(timeWithoutCurves),
            travelTimeWithCurvesSeconds: Math.round(curveTimeSeconds),
            differenceSeconds: Math.round(differenceSeconds),
            differencePercent: Math.round(differencePercent * 10) / 10,
            minRadiusInSegmentMeters: minRadiusMeters !== null ? Math.round(minRadiusMeters) : null,
            curveSpeedLimitKmH: curveSpeedLimitKmH !== null ? Math.round(curveSpeedLimitKmH) : null,
            entrySpeedKmH: 0,
            exitSpeedKmH: 0
        });

        totalTimeWithoutCurves += timeWithoutCurves;
        totalTimeWithCurves += curveTimeSeconds;
        totalNoDwellCurveTime += noDwellCurveTime;
        totalDistance += segmentDistance;
    }

    // When curve analysis is not used, force the "with curves" total to
    // exactly match "without curves" so rounding artefacts don't produce
    // a misleading tiny difference (e.g. 12.85 vs 12.84 min).
    // Note: totalNoDwellCurveTime is NOT overwritten here — it represents
    // the accumulated cruising-only time (distance / runningSpeed per segment),
    // which is semantically different from totalTimeWithoutCurves that includes
    // acceleration/deceleration at station stops.
    if (!useCurves) {
        totalTimeWithCurves = totalTimeWithoutCurves;
    }

    const totalDifferenceSeconds = totalTimeWithCurves - totalTimeWithoutCurves;
    const totalDifferencePercent =
        totalTimeWithoutCurves > 0 ? (totalDifferenceSeconds / totalTimeWithoutCurves) * 100 : 0;

    return {
        segments: results,
        totalTimeWithoutCurvesSeconds: Math.round(totalTimeWithoutCurves),
        totalTimeWithCurvesSeconds: Math.round(totalTimeWithCurves),
        totalNoDwellCurveTimeSeconds: Math.round(totalNoDwellCurveTime),
        totalDifferenceSeconds: Math.round(totalDifferenceSeconds),
        totalDifferencePercent: Math.round(totalDifferencePercent * 10) / 10,
        totalDistanceMeters: Math.round(totalDistance),
        avgSpeedWithoutCurvesKmH:
            totalTimeWithoutCurves > 0 ? Math.round(totalDistance / 1000 / (totalTimeWithoutCurves / 3600)) : 0,
        avgSpeedWithCurvesKmH:
            totalTimeWithCurves > 0 ? Math.round(totalDistance / 1000 / (totalTimeWithCurves / 3600)) : 0,
        geometryResolution
    };
}

/**
 * Analyzes segment travel times for a transit path object.
 *
 * @param path Transit path object with geography and segments properties
 * @param options Calculation options
 * @returns Travel time analysis or null if path has insufficient data
 */
export function analyzePathSegmentTravelTimes(
    path: {
        attributes: {
            geography?: LineString;
            segments?: number[];
        };
    },
    options: SpeedProfileOptions = {}
): PathTravelTimeAnalysis | null {
    const geography = path.attributes?.geography;
    const segments = path.attributes?.segments;

    if (!geography || !geography.coordinates || geography.coordinates.length < 3) {
        return null;
    }

    if (!segments || segments.length < 2) {
        return null;
    }

    return calculateSegmentTravelTimes(geography, segments, options);
}
