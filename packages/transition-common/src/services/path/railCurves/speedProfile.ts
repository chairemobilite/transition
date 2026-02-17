/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

// TODO: these calculations could be useful for non rail modes too.
// We should consider moving them to a higher level and reuse them.

/**
 * Speed profile calculations for rail paths.
 * Computes achievable speeds along a path considering curve speed limits,
 * acceleration/deceleration constraints, and station stops.
 */

import { LineString } from 'geojson';
import { distance as turfDistance, point as turfPoint } from '@turf/turf';
import type { RailMode } from '../../line/types';
import type {
    SpeedProfileOptions,
    SpeedPoint,
    SpeedProfileResult,
    DistanceSpeedPoint,
    DistanceSpeedProfile,
    DistanceSpeedPointWithStation,
    DistanceSpeedProfileWithStations,
    TimeSpeedPoint,
    TimeSpeedProfile
} from './types';
import { DEFAULT_SPEED_OPTIONS } from './constants';
import { kphToMps, mpsToKph } from 'chaire-lib-common/lib/utils/PhysicsUtils';
import { calculateRadiiAtVertices, estimateMaxSpeedFromRadius, calculateCumulativeDistances } from './geometry';
import { detectGeometryResolution, shouldUseCurveAnalysis } from './segmentTravelTime';

/**
 * Calculates travel time between two points considering acceleration/deceleration limits.
 * Handles three cases:
 * 1. Accelerating: v1 < v2 - check if distance allows reaching v2
 * 2. Decelerating: v1 > v2 - check if distance allows stopping to v2
 * 3. Speed change with cruising: if distance allows, accelerate to vmax, cruise, then decelerate
 */
function calculateSegmentTravelTime(
    distanceM: number,
    v1Ms: number,
    v2Ms: number,
    vMaxMs: number,
    accelMps2: number,
    decelMps2: number
): number {
    if (distanceM < 0.01) return 0;

    if (accelMps2 <= 0 || decelMps2 <= 0) {
        throw new Error(
            `calculateSegmentTravelTime: accelMps2 and decelMps2 must be positive (got accelMps2=${accelMps2}, decelMps2=${decelMps2})`
        );
    }

    // Clamp speeds to vMax
    v1Ms = Math.min(v1Ms, vMaxMs);
    v2Ms = Math.min(v2Ms, vMaxMs);

    // Distance needed to accelerate from v1 to vMax: d = (vMax² - v1²) / (2a)
    const distToVmax = v1Ms < vMaxMs ? (vMaxMs * vMaxMs - v1Ms * v1Ms) / (2 * accelMps2) : 0;

    // Distance needed to decelerate from vMax to v2: d = (vMax² - v2²) / (2d)
    const distFromVmax = v2Ms < vMaxMs ? (vMaxMs * vMaxMs - v2Ms * v2Ms) / (2 * decelMps2) : 0;

    // Case 1: Distance too short to reach vMax - direct transition
    if (distToVmax + distFromVmax >= distanceM) {
        if (v2Ms > v1Ms) {
            // Accelerating: check if we have enough distance
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
            // Decelerating: check if we have enough distance
            const distNeeded = (v1Ms * v1Ms - v2Ms * v2Ms) / (2 * decelMps2);
            if (distNeeded <= distanceM) {
                const decelTime = (v1Ms - v2Ms) / decelMps2;
                const cruiseDist = distanceM - distNeeded;
                const cruiseTime = cruiseDist > 0 ? cruiseDist / v1Ms : 0;
                return cruiseTime + decelTime;
            } else {
                // Not enough distance to reach v2Ms; actual final speed vf from v² = v1² - 2*a*d
                const vf = Math.sqrt(Math.max(0, v1Ms * v1Ms - 2 * decelMps2 * distanceM));
                return (2 * distanceM) / (v1Ms + vf);
            }
        } else {
            // v1 == v2, cruise at constant speed
            if (v1Ms === 0 && v2Ms === 0) {
                if (distanceM === 0) {
                    return 0;
                }
                throw new Error(`Cannot cover distance ${distanceM} m with zero speed (v1 = 0, v2 = 0)`);
            }
            return distanceM / v1Ms;
        }
    }

    // Case 2: Can reach vMax - accelerate, cruise, decelerate
    const cruiseDistance = distanceM - distToVmax - distFromVmax;
    const accelTime = (vMaxMs - v1Ms) / accelMps2;
    const cruiseTime = cruiseDistance / vMaxMs;
    const decelTime = (vMaxMs - v2Ms) / decelMps2;

    return accelTime + cruiseTime + decelTime;
}

/**
 * Calculates the speed achievable after traveling a distance with constant acceleration.
 * v² = v₀² + 2ad
 */
function speedAfterDistance(initialSpeedMs: number, accelerationMps2: number, distanceM: number): number {
    const vSquared = initialSpeedMs * initialSpeedMs + 2 * accelerationMps2 * distanceM;
    return vSquared > 0 ? Math.sqrt(vSquared) : 0;
}

/**
 * Represents a speed constraint point along a segment.
 */
interface SpeedConstraint {
    distanceMeters: number;
    maxSpeedMps: number;
}

/**
 * Kinematic waypoint with time, distance, and speed.
 */
interface KinematicWaypoint {
    timeSeconds: number;
    distanceMeters: number;
    speedMps: number;
    maxSpeedByRadiusMps: number;
}

/**
 * Calculates time-based speed profile for a single segment using proper kinematics,
 * respecting curve speed limits along the way.
 *
 * Uses a forward-backward pass to determine achievable speeds, then converts to time-based profile.
 */
/**
 * Computes the speed at a given distance along a segment, given a piecewise
 * kinematic profile defined by constraint points with achievable speeds.
 *
 * Between two constraint points (v1 at d1, v2 at d2), the train follows
 * proper kinematic phases:
 *
 * 1. If the interval is long enough, the train accelerates from v1 toward
 *    vPeak (the max speed it can reach), cruises, then decelerates to v2.
 *    vPeak is capped by the constraint maxSpeed in this interval.
 *
 * 2. If too short, it accelerates then immediately decelerates (triangular
 *    profile) without reaching vPeak.
 *
 * This produces smooth, physically correct speed curves.
 */
function speedAtDistance(
    distance: number,
    constraintDistances: number[],
    achievableSpeeds: number[],
    accelerationMps2: number,
    decelerationMps2: number,
    constraintMaxSpeeds: number[],
    globalMaxSpeedMps: number
): { speedMps: number; maxSpeedByRadiusMps: number } {
    // Find the bracketing constraint interval
    let idx = 0;
    while (idx < constraintDistances.length - 2 && constraintDistances[idx + 1] < distance) {
        idx++;
    }

    const d1 = constraintDistances[idx];
    const d2 = constraintDistances[idx + 1];
    const v1 = achievableSpeeds[idx];
    const v2 = achievableSpeeds[idx + 1];
    const deltaD = distance - d1;
    const segLen = d2 - d1;

    // Interpolate maxSpeedByRadius linearly between constraints
    const ratio = segLen > 0 ? deltaD / segLen : 0;
    const maxSpeedByRadiusMps =
        constraintMaxSpeeds[idx] + ratio * (constraintMaxSpeeds[idx + 1] - constraintMaxSpeeds[idx]);

    if (segLen < 0.01) {
        return { speedMps: v1, maxSpeedByRadiusMps };
    }

    // The peak speed the train can aim for in this interval, capped by
    // the minimum constraint maxSpeed in this interval and global max.
    const vCap = Math.min(constraintMaxSpeeds[idx], constraintMaxSpeeds[idx + 1], globalMaxSpeedMps);

    // Distance to accelerate from v1 to vCap
    const distAccelFull = vCap > v1 ? (vCap * vCap - v1 * v1) / (2 * accelerationMps2) : 0;
    // Distance to decelerate from vCap to v2
    const distDecelFull = vCap > v2 ? (vCap * vCap - v2 * v2) / (2 * decelerationMps2) : 0;

    let speedMps: number;

    if (distAccelFull + distDecelFull <= segLen) {
        // Trapezoid profile: accelerate to vCap, cruise, then decelerate to v2
        const cruiseStart = distAccelFull;
        const cruiseEnd = segLen - distDecelFull;

        if (deltaD <= cruiseStart) {
            // Accelerating from v1 toward vCap
            const vSq = v1 * v1 + 2 * accelerationMps2 * deltaD;
            speedMps = Math.sqrt(Math.max(0, vSq));
        } else if (deltaD <= cruiseEnd) {
            // Cruising at vCap
            speedMps = vCap;
        } else {
            // Decelerating from vCap toward v2
            const distIntoBrake = deltaD - cruiseEnd;
            const vSq = vCap * vCap - 2 * decelerationMps2 * distIntoBrake;
            speedMps = Math.sqrt(Math.max(0, vSq));
        }
    } else {
        // Triangular profile: not enough distance to reach vCap.
        // Find the peak speed vPeak at the accel/decel crossover:
        //   d_accel + d_decel = segLen
        //   (vPeak² - v1²)/(2a) + (vPeak² - v2²)/(2d) = segLen
        //   vPeak² (1/(2a) + 1/(2d)) = segLen + v1²/(2a) + v2²/(2d)
        const invTwoA = 1 / (2 * accelerationMps2);
        const invTwoD = 1 / (2 * decelerationMps2);
        const vPeakSq = (segLen + v1 * v1 * invTwoA + v2 * v2 * invTwoD) / (invTwoA + invTwoD);
        const vPeak = Math.sqrt(Math.max(0, vPeakSq));

        const distAccelToPeak = (vPeak * vPeak - v1 * v1) / (2 * accelerationMps2);

        if (deltaD <= distAccelToPeak) {
            // Accelerating
            const vSq = v1 * v1 + 2 * accelerationMps2 * deltaD;
            speedMps = Math.sqrt(Math.max(0, vSq));
        } else {
            // Decelerating
            const distIntoBrake = deltaD - distAccelToPeak;
            const vSq = vPeak * vPeak - 2 * decelerationMps2 * distIntoBrake;
            speedMps = Math.sqrt(Math.max(0, vSq));
        }
    }

    return { speedMps: Math.min(speedMps, vCap), maxSpeedByRadiusMps };
}

/**
 * Computes the time to travel a kinematic sub-segment where the train transitions
 * from speed v1 to speed v2 over distance d, with constant acceleration or
 * deceleration, possibly with a cruise phase in between.
 */
function kinematicTime(
    distance: number,
    v1: number,
    v2: number,
    accelerationMps2: number,
    decelerationMps2: number
): number {
    if (distance < 0.01) return 0;

    if (Math.abs(v2 - v1) < 0.01) {
        // Constant speed
        return v1 > 0.01 ? distance / v1 : 0.1;
    }

    if (v2 > v1) {
        // Accelerating from v1 to v2
        const accelDist = (v2 * v2 - v1 * v1) / (2 * accelerationMps2);
        if (accelDist >= distance) {
            // Cannot reach v2 in this distance
            const vReached = Math.sqrt(v1 * v1 + 2 * accelerationMps2 * distance);
            return accelerationMps2 > 0 ? (vReached - v1) / accelerationMps2 : 0.1;
        }
        const accelTime = accelerationMps2 > 0 ? (v2 - v1) / accelerationMps2 : 0;
        const cruiseDist = distance - accelDist;
        const cruiseTime = v2 > 0 ? cruiseDist / v2 : 0;
        return accelTime + cruiseTime;
    } else {
        // Decelerating from v1 to v2 (with possible cruise before brake)
        const brakeDist = (v1 * v1 - v2 * v2) / (2 * decelerationMps2);
        if (brakeDist > distance) {
            // Cannot reach v2 in this distance; compute the actually reachable speed
            const vReachable = Math.sqrt(Math.max(0, v1 * v1 - 2 * decelerationMps2 * distance));
            return decelerationMps2 > 0 ? (v1 - vReachable) / decelerationMps2 : 0.1;
        }
        const cruiseDist = distance - brakeDist;
        const cruiseTime = cruiseDist > 0 && v1 > 0 ? cruiseDist / v1 : 0;
        const brakeTime = decelerationMps2 > 0 ? (v1 - v2) / decelerationMps2 : 0;
        return cruiseTime + brakeTime;
    }
}

function calculateSegmentKinematicsWithCurves(
    speedConstraints: SpeedConstraint[],
    totalDistanceMeters: number,
    maxSpeedMps: number,
    accelerationMps2: number,
    decelerationMps2: number
): KinematicWaypoint[] {
    if (speedConstraints.length === 0 || totalDistanceMeters <= 0) {
        return [
            { timeSeconds: 0, distanceMeters: 0, speedMps: 0, maxSpeedByRadiusMps: maxSpeedMps },
            { timeSeconds: 0.1, distanceMeters: totalDistanceMeters, speedMps: 0, maxSpeedByRadiusMps: maxSpeedMps }
        ];
    }

    // Ensure we have start and end points
    const constraints = [...speedConstraints];
    if (constraints[0].distanceMeters > 0) {
        constraints.unshift({ distanceMeters: 0, maxSpeedMps: maxSpeedMps });
    }
    if (constraints[constraints.length - 1].distanceMeters < totalDistanceMeters) {
        constraints.push({ distanceMeters: totalDistanceMeters, maxSpeedMps: maxSpeedMps });
    }

    const n = constraints.length;

    // Forward pass: calculate max speed considering acceleration from start (starting at 0)
    const forwardSpeed: number[] = new Array(n);
    forwardSpeed[0] = 0; // Start from stop

    for (let i = 1; i < n; i++) {
        const distance = constraints[i].distanceMeters - constraints[i - 1].distanceMeters;
        const maxFromAccel = Math.sqrt(forwardSpeed[i - 1] * forwardSpeed[i - 1] + 2 * accelerationMps2 * distance);
        forwardSpeed[i] = Math.min(maxFromAccel, constraints[i].maxSpeedMps, maxSpeedMps);
    }

    // Backward pass: calculate max speed considering deceleration to stop at end
    const backwardSpeed: number[] = new Array(n);
    backwardSpeed[n - 1] = 0; // End at stop

    for (let i = n - 2; i >= 0; i--) {
        const distance = constraints[i + 1].distanceMeters - constraints[i].distanceMeters;
        const maxFromDecel = Math.sqrt(backwardSpeed[i + 1] * backwardSpeed[i + 1] + 2 * decelerationMps2 * distance);
        backwardSpeed[i] = Math.min(maxFromDecel, constraints[i].maxSpeedMps, maxSpeedMps);
    }

    // Combine passes: achievable speed is minimum of forward and backward
    const achievableSpeeds: number[] = constraints.map((_, i) => Math.min(forwardSpeed[i], backwardSpeed[i]));
    const constraintDistances = constraints.map((c) => c.distanceMeters);
    const constraintMaxSpeeds = constraints.map((c) => c.maxSpeedMps);

    // Resample at fine regular distance intervals for a smooth, continuous profile.
    // Use ~10 m resolution for smooth curves; at least 50 points per segment.
    const RESAMPLE_INTERVAL_METERS = 10;
    const numSamples = Math.max(50, Math.ceil(totalDistanceMeters / RESAMPLE_INTERVAL_METERS) + 1);
    const step = totalDistanceMeters / (numSamples - 1);

    const waypoints: KinematicWaypoint[] = [];
    let cumulativeTime = 0;
    let prevSpeed = 0;
    let prevDistance = 0;

    for (let s = 0; s < numSamples; s++) {
        const d = s * step;
        const { speedMps, maxSpeedByRadiusMps } = speedAtDistance(
            d,
            constraintDistances,
            achievableSpeeds,
            accelerationMps2,
            decelerationMps2,
            constraintMaxSpeeds,
            maxSpeedMps
        );

        if (s > 0) {
            const deltaD = d - prevDistance;
            cumulativeTime += kinematicTime(deltaD, prevSpeed, speedMps, accelerationMps2, decelerationMps2);
        }

        waypoints.push({
            timeSeconds: cumulativeTime,
            distanceMeters: d,
            speedMps,
            maxSpeedByRadiusMps
        });

        prevSpeed = speedMps;
        prevDistance = d;
    }

    return waypoints;
}

/**
 * Interpolates speed at a given time from kinematic waypoints.
 * Uses linear interpolation between waypoints.
 */
function interpolateKinematicSpeed(
    timeSeconds: number,
    waypoints: KinematicWaypoint[]
): { speedMps: number; distanceMeters: number; maxSpeedByRadiusMps: number } {
    if (waypoints.length === 0) {
        return { speedMps: 0, distanceMeters: 0, maxSpeedByRadiusMps: 0 };
    }

    // Find bracketing waypoints
    let i = 0;
    while (i < waypoints.length - 1 && waypoints[i + 1].timeSeconds < timeSeconds) {
        i++;
    }

    const p1 = waypoints[i];
    const p2 = waypoints[Math.min(i + 1, waypoints.length - 1)];

    if (timeSeconds <= p1.timeSeconds) {
        return {
            speedMps: p1.speedMps,
            distanceMeters: p1.distanceMeters,
            maxSpeedByRadiusMps: p1.maxSpeedByRadiusMps
        };
    }
    if (timeSeconds >= p2.timeSeconds) {
        return {
            speedMps: p2.speedMps,
            distanceMeters: p2.distanceMeters,
            maxSpeedByRadiusMps: p2.maxSpeedByRadiusMps
        };
    }

    // Linear interpolation
    const ratio = (timeSeconds - p1.timeSeconds) / (p2.timeSeconds - p1.timeSeconds);
    return {
        speedMps: p1.speedMps + ratio * (p2.speedMps - p1.speedMps),
        distanceMeters: p1.distanceMeters + ratio * (p2.distanceMeters - p1.distanceMeters),
        maxSpeedByRadiusMps: p1.maxSpeedByRadiusMps + ratio * (p2.maxSpeedByRadiusMps - p1.maxSpeedByRadiusMps)
    };
}

/**
 * Calculates a speed profile along a path using forward-backward pass algorithm.
 * This determines the maximum achievable speed at each point considering:
 * - Curve radius speed limits
 * - Acceleration capability
 * - Deceleration required for upcoming curves
 *
 * @param geometry LineString geometry
 * @param options Speed profile options
 * @returns Speed profile result
 */
export function calculateSpeedProfile(geometry: LineString, options: SpeedProfileOptions = {}): SpeedProfileResult {
    const opts = { ...DEFAULT_SPEED_OPTIONS, ...options };
    const coordinates = geometry.coordinates;
    const n = coordinates.length;

    if (n < 2) {
        return {
            speedPoints: [],
            totalTimeSeconds: 0,
            averageSpeedKmH: 0,
            brakingZones: [],
            minSpeedKmH: 0
        };
    }

    // Calculate radii and max speeds at each vertex
    const radii = calculateRadiiAtVertices(coordinates, opts);
    const cumulativeDistances = calculateCumulativeDistances(coordinates);
    const totalDistance = cumulativeDistances[n - 1];

    // Maximum speed at each point based on curve radius (capped at running speed)
    const maxSpeedByRadius: number[] = radii.map((r) => {
        if (r === null) return opts.maxSpeedKmH;
        return Math.min(estimateMaxSpeedFromRadius(opts.mode, r), opts.maxSpeedKmH);
    });

    // Forward pass: calculate max speed considering acceleration from start
    const forwardSpeed: number[] = new Array(n);
    forwardSpeed[0] = Math.min(opts.initialSpeedKmH, maxSpeedByRadius[0]);

    for (let i = 1; i < n; i++) {
        const distance = cumulativeDistances[i] - cumulativeDistances[i - 1];
        const maxFromAccel = mpsToKph(
            speedAfterDistance(kphToMps(forwardSpeed[i - 1]), opts.accelerationMps2, distance)
        );
        forwardSpeed[i] = Math.min(maxFromAccel, maxSpeedByRadius[i], opts.maxSpeedKmH);
    }

    // Backward pass: calculate max speed considering deceleration for upcoming curves
    const backwardSpeed: number[] = new Array(n);
    backwardSpeed[n - 1] = Math.min(opts.finalSpeedKmH, maxSpeedByRadius[n - 1]);

    for (let i = n - 2; i >= 0; i--) {
        const distance = cumulativeDistances[i + 1] - cumulativeDistances[i];
        const maxFromDecel = mpsToKph(
            speedAfterDistance(kphToMps(backwardSpeed[i + 1]), opts.decelerationMps2, distance)
        );
        backwardSpeed[i] = Math.min(maxFromDecel, maxSpeedByRadius[i], opts.maxSpeedKmH);
    }

    // Combine passes: take minimum at each point
    const speedPoints: SpeedPoint[] = [];
    let minSpeedKmH = opts.maxSpeedKmH;

    for (let i = 0; i < n; i++) {
        const achievableSpeedKmH = Math.min(forwardSpeed[i], backwardSpeed[i]);
        minSpeedKmH = Math.min(minSpeedKmH, achievableSpeedKmH);

        const isBraking = i > 0 && achievableSpeedKmH < speedPoints[i - 1]?.achievableSpeedKmH;
        const isAccelerating = i > 0 && achievableSpeedKmH > speedPoints[i - 1]?.achievableSpeedKmH;

        speedPoints.push({
            index: i,
            distanceMeters: cumulativeDistances[i],
            maxSpeedByRadiusKmH: maxSpeedByRadius[i],
            achievableSpeedKmH,
            isBraking,
            isAccelerating
        });
    }

    // Identify braking zones
    const brakingZones: { startIndex: number; endIndex: number; reason: string }[] = [];
    let inBrakingZone = false;
    let brakingStart = 0;

    for (let i = 1; i < n; i++) {
        if (speedPoints[i].isBraking && !inBrakingZone) {
            inBrakingZone = true;
            brakingStart = i - 1;
        } else if (!speedPoints[i].isBraking && inBrakingZone) {
            inBrakingZone = false;
            brakingZones.push({
                startIndex: brakingStart,
                endIndex: i,
                reason: `Slow for curve (R=${radii[i] !== null ? Math.round(radii[i]!) : '?'}m)`
            });
        }
    }
    if (inBrakingZone) {
        brakingZones.push({
            startIndex: brakingStart,
            endIndex: n - 1,
            reason: 'Slow to stop'
        });
    }

    // Calculate total travel time with proper accel/decel phases
    let totalTimeSeconds = 0;
    for (let i = 1; i < n; i++) {
        const distance = cumulativeDistances[i] - cumulativeDistances[i - 1];
        const v1Ms = kphToMps(speedPoints[i - 1].achievableSpeedKmH);
        const v2Ms = kphToMps(speedPoints[i].achievableSpeedKmH);
        const vMaxMs = kphToMps(Math.min(maxSpeedByRadius[i - 1], maxSpeedByRadius[i], opts.maxSpeedKmH));

        if (v1Ms > 0.01 || v2Ms > 0.01) {
            totalTimeSeconds += calculateSegmentTravelTime(
                distance,
                v1Ms,
                v2Ms,
                vMaxMs,
                opts.accelerationMps2,
                opts.decelerationMps2
            );
        } else if (distance > 0) {
            // Both endpoint speeds are zero; fallback to avoid unrealistic travel times.
            // Try averaging neighboring non-zero segment speeds; otherwise use configurable minimum.
            const minFallbackMps = opts.minFallbackSpeedMps ?? 1.0;
            const neighborSpeeds: number[] = [];
            if (i >= 2) {
                const vPrev = kphToMps(speedPoints[i - 2].achievableSpeedKmH);
                if (vPrev > 0.01) neighborSpeeds.push(vPrev);
            }
            if (i + 1 < speedPoints.length) {
                const vNext = kphToMps(speedPoints[i + 1].achievableSpeedKmH);
                if (vNext > 0.01) neighborSpeeds.push(vNext);
            }
            const fallbackSpeedMps =
                neighborSpeeds.length > 0
                    ? neighborSpeeds.reduce((a, b) => a + b, 0) / neighborSpeeds.length
                    : minFallbackMps;
            const segmentTime = distance / fallbackSpeedMps;
            totalTimeSeconds += segmentTime;
            console.warn(
                '[speedProfile] Zero-speed fallback: both endpoints zero for segment ' +
                    `${i - 1}→${i}. distance=${distance.toFixed(1)} m, fallbackSpeed=${fallbackSpeedMps.toFixed(2)} m/s ` +
                    `(from ${neighborSpeeds.length > 0 ? 'neighbor avg' : 'minFallbackSpeedMps'}), ` +
                    `segmentTime=${segmentTime.toFixed(1)} s, totalTimeSeconds=${totalTimeSeconds.toFixed(1)} s. ` +
                    'Trace upstream forward/backward pass failures.'
            );
        }
    }

    const averageSpeedKmH = totalDistance > 0 ? totalDistance / 1000 / (totalTimeSeconds / 3600) : 0;

    return {
        speedPoints,
        totalTimeSeconds,
        averageSpeedKmH,
        brakingZones,
        minSpeedKmH
    };
}

/**
 * Generates a speed profile at regular distance intervals for plotting.
 * Interpolates the speed between vertices to provide smooth speed-by-distance data.
 *
 * @param geometry LineString geometry
 * @param options Speed profile options
 * @param intervalMeters Distance interval between points (default: 10 meters)
 * @returns Distance-based speed profile for plotting
 */
export function getSpeedByDistance(
    geometry: LineString,
    options: SpeedProfileOptions = {},
    intervalMeters: number = 10
): DistanceSpeedProfile {
    const speedProfile = calculateSpeedProfile(geometry, options);
    const { speedPoints, totalTimeSeconds } = speedProfile;

    if (speedPoints.length < 2) {
        return {
            points: [],
            intervalMeters,
            totalDistanceMeters: 0,
            totalTimeSeconds: 0,
            maxSpeedKmH: 0,
            minSpeedKmH: 0
        };
    }

    const totalDistance = speedPoints[speedPoints.length - 1].distanceMeters;
    const points: DistanceSpeedPoint[] = [];

    let currentVertexIndex = 0;
    for (let distance = 0; distance <= totalDistance; distance += intervalMeters) {
        while (
            currentVertexIndex < speedPoints.length - 1 &&
            speedPoints[currentVertexIndex + 1].distanceMeters < distance
        ) {
            currentVertexIndex++;
        }

        const p1 = speedPoints[currentVertexIndex];
        const p2 = speedPoints[Math.min(currentVertexIndex + 1, speedPoints.length - 1)];

        let speedKmH: number;
        let maxSpeedByRadiusKmH: number;

        if (p1.distanceMeters === p2.distanceMeters || distance <= p1.distanceMeters) {
            speedKmH = p1.achievableSpeedKmH;
            maxSpeedByRadiusKmH = p1.maxSpeedByRadiusKmH;
        } else if (distance >= p2.distanceMeters) {
            speedKmH = p2.achievableSpeedKmH;
            maxSpeedByRadiusKmH = p2.maxSpeedByRadiusKmH;
        } else {
            const t = (distance - p1.distanceMeters) / (p2.distanceMeters - p1.distanceMeters);
            speedKmH = p1.achievableSpeedKmH + t * (p2.achievableSpeedKmH - p1.achievableSpeedKmH);
            maxSpeedByRadiusKmH = p1.maxSpeedByRadiusKmH + t * (p2.maxSpeedByRadiusKmH - p1.maxSpeedByRadiusKmH);
        }

        points.push({
            distanceMeters: Math.round(distance * 100) / 100,
            speedKmH: Math.round(speedKmH * 10) / 10,
            maxSpeedByRadiusKmH: Math.round(maxSpeedByRadiusKmH * 10) / 10
        });
    }

    const speeds = points.map((p) => p.speedKmH);
    // using Math.max/min could cause performance issues for large arrays
    let maxSpeedKmH = -Infinity;
    let minSpeedKmH = Infinity;
    for (let i = 0; i < speeds.length; i++) {
        const s = speeds[i];
        if (s > maxSpeedKmH) maxSpeedKmH = s;
        if (s < minSpeedKmH) minSpeedKmH = s;
    }
    if (speeds.length === 0) {
        maxSpeedKmH = 0;
        minSpeedKmH = 0;
    }

    return {
        points,
        intervalMeters,
        totalDistanceMeters: totalDistance,
        totalTimeSeconds,
        maxSpeedKmH,
        minSpeedKmH
    };
}

/**
 * Generates a speed profile for an entire path including station stops.
 * Calculates acceleration from 0 at each station and deceleration to 0 at the next station.
 *
 * @param geography LineString geometry of the entire path
 * @param segmentIndices Array of coordinate indices where each segment starts
 * @param options Speed profile options
 * @param intervalMeters Distance interval between points (default: 10 meters)
 * @returns Speed profile with station information
 */
export function getSpeedByDistanceWithStations(
    geography: LineString,
    segmentIndices: number[],
    options: SpeedProfileOptions = {},
    intervalMeters: number = 10
): DistanceSpeedProfileWithStations {
    const coordinates = geography.coordinates;
    const segmentCount = segmentIndices.length;

    if (coordinates.length < 2 || segmentCount < 1) {
        return {
            points: [],
            intervalMeters,
            totalDistanceMeters: 0,
            totalTimeSeconds: 0,
            maxSpeedKmH: 0,
            minSpeedKmH: 0,
            segmentCount: 0,
            stationDistances: []
        };
    }

    const allPoints: DistanceSpeedPointWithStation[] = [];
    let cumulativeDistance = 0;
    let totalTimeSeconds = 0;
    const stationDistances: number[] = [0];

    for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
        const startCoordIndex = segmentIndices[segIdx];
        const endCoordIndex = segIdx < segmentCount - 1 ? segmentIndices[segIdx + 1] : coordinates.length - 1;

        const segmentCoords = coordinates.slice(startCoordIndex, endCoordIndex + 1);
        if (segmentCoords.length < 2) continue;

        const segmentGeometry: LineString = {
            type: 'LineString',
            coordinates: segmentCoords
        };

        const segmentProfile = getSpeedByDistance(
            segmentGeometry,
            { ...options, initialSpeedKmH: 0, finalSpeedKmH: 0 },
            intervalMeters
        );

        totalTimeSeconds += segmentProfile.totalTimeSeconds;

        if (segIdx === 0) {
            allPoints.push({
                distanceMeters: 0,
                speedKmH: 0,
                maxSpeedByRadiusKmH: segmentProfile.points[0]?.maxSpeedByRadiusKmH ?? options.maxSpeedKmH ?? 80,
                segmentIndex: 0,
                isAtStation: true,
                stationIndex: 0
            });
        }

        for (let i = 1; i < segmentProfile.points.length; i++) {
            const pt = segmentProfile.points[i];
            const isLastPoint = i === segmentProfile.points.length - 1;

            allPoints.push({
                distanceMeters: Math.round((cumulativeDistance + pt.distanceMeters) * 100) / 100,
                speedKmH: pt.speedKmH,
                maxSpeedByRadiusKmH: pt.maxSpeedByRadiusKmH,
                segmentIndex: segIdx,
                isAtStation: isLastPoint,
                stationIndex: isLastPoint ? segIdx + 1 : null
            });
        }

        cumulativeDistance += segmentProfile.totalDistanceMeters;
        stationDistances.push(Math.round(cumulativeDistance * 100) / 100);
    }

    const speeds = allPoints.map((p) => p.speedKmH);
    // using Math.max/min could cause performance issues for large arrays
    let maxSpeedKmH = -Infinity;
    let minSpeedKmH = Infinity;
    for (let i = 0; i < speeds.length; i++) {
        const s = speeds[i];
        if (s > maxSpeedKmH) maxSpeedKmH = s;
        if (s < minSpeedKmH) minSpeedKmH = s;
    }
    if (speeds.length === 0) {
        maxSpeedKmH = 0;
        minSpeedKmH = 0;
    }

    return {
        points: allPoints,
        intervalMeters,
        totalDistanceMeters: cumulativeDistance,
        totalTimeSeconds,
        maxSpeedKmH,
        minSpeedKmH,
        segmentCount,
        stationDistances
    };
}

/**
 * Generates a time-based speed profile for an entire path including station dwell times.
 * Uses proper kinematic equations for linear acceleration/deceleration phases.
 *
 * @param geography LineString geometry of the entire path
 * @param segmentIndices Array of coordinate indices where each segment starts
 * @param dwellTimesSeconds Array of dwell times at each station
 * @param options Speed profile options
 * @param intervalSeconds Time interval between points (default: 1 second)
 * @returns Time-based speed profile with dwell times
 */
export function getSpeedByTimeWithDwellTimes(
    geography: LineString,
    segmentIndices: number[],
    dwellTimesSeconds: number[],
    options: SpeedProfileOptions = {},
    intervalSeconds: number = 1
): TimeSpeedProfile {
    const opts = { ...DEFAULT_SPEED_OPTIONS, ...options };
    const coordinates = geography.coordinates;
    const segmentCount = segmentIndices.length;

    if (coordinates.length < 2 || segmentCount < 1) {
        return {
            points: [],
            intervalSeconds,
            totalDistanceMeters: 0,
            totalTimeSeconds: 0,
            totalRunningTimeSeconds: 0,
            totalDwellTimeSeconds: 0,
            maxSpeedKmH: 0,
            segmentCount: 0,
            stationTimes: [],
            dwellTimesSeconds: []
        };
    }

    const maxSpeedMps = kphToMps(opts.maxSpeedKmH);
    const allPoints: TimeSpeedPoint[] = [];
    let cumulativeTime = 0;
    let cumulativeDistance = 0;
    let totalRunningTime = 0;
    let totalDwellTime = 0;
    const stationTimes: number[] = [0];

    // Only use curve speed constraints for high-resolution geometry
    const geometryResolution = detectGeometryResolution(coordinates, segmentCount);
    const useCurves = shouldUseCurveAnalysis(geometryResolution);

    for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
        const startCoordIndex = segmentIndices[segIdx];
        const endCoordIndex = segIdx < segmentCount - 1 ? segmentIndices[segIdx + 1] : coordinates.length - 1;

        const dwellTimeAtStart = segIdx === 0 ? 0 : dwellTimesSeconds[segIdx] || 0;

        if (segIdx > 0 && dwellTimeAtStart > 0) {
            for (let t = 0; t < dwellTimeAtStart; t += intervalSeconds) {
                allPoints.push({
                    timeSeconds: Math.round((cumulativeTime + t) * 10) / 10,
                    distanceMeters: cumulativeDistance,
                    speedKmH: 0,
                    maxSpeedByRadiusKmH: opts.maxSpeedKmH,
                    segmentIndex: segIdx - 1,
                    isDwelling: true,
                    stationIndex: segIdx
                });
            }
            cumulativeTime += dwellTimeAtStart;
            totalDwellTime += dwellTimeAtStart;
        }

        const segmentCoords = coordinates.slice(startCoordIndex, endCoordIndex + 1);
        if (segmentCoords.length < 2) continue;

        const segmentDistances: number[] = [0];
        for (let i = 1; i < segmentCoords.length; i++) {
            const d = turfDistance(turfPoint(segmentCoords[i - 1]), turfPoint(segmentCoords[i]), { units: 'meters' });
            segmentDistances.push(segmentDistances[i - 1] + d);
        }
        const segmentDistance = segmentDistances[segmentDistances.length - 1];

        const speedConstraints: SpeedConstraint[] = [];

        if (useCurves && segmentCoords.length >= 3) {
            const radii = calculateRadiiAtVertices(segmentCoords, opts);

            for (let i = 0; i < segmentCoords.length; i++) {
                const radius = radii[i];
                let maxSpeedAtPoint = maxSpeedMps;

                if (radius !== null) {
                    const curveSpeedKmH = Math.min(estimateMaxSpeedFromRadius(opts.mode, radius), opts.maxSpeedKmH);
                    maxSpeedAtPoint = kphToMps(curveSpeedKmH);
                }

                speedConstraints.push({
                    distanceMeters: segmentDistances[i],
                    maxSpeedMps: maxSpeedAtPoint
                });
            }
        } else {
            // Without curve analysis, create evenly-spaced constraints at max speed.
            // We need at least 3 points so the forward-backward pass can reach
            // a non-zero speed between the start (0) and end (0) of the segment.
            const numPoints = Math.max(3, Math.ceil(segmentDistance / 50) + 1);
            for (let p = 0; p < numPoints; p++) {
                const d = (p / (numPoints - 1)) * segmentDistance;
                speedConstraints.push({ distanceMeters: d, maxSpeedMps: maxSpeedMps });
            }
        }

        const kinematicProfile = calculateSegmentKinematicsWithCurves(
            speedConstraints,
            segmentDistance,
            maxSpeedMps,
            opts.accelerationMps2,
            opts.decelerationMps2
        );

        const segmentRunningTime =
            kinematicProfile.length > 0 ? kinematicProfile[kinematicProfile.length - 1].timeSeconds : 0;
        totalRunningTime += segmentRunningTime;

        if (segIdx === 0) {
            allPoints.push({
                timeSeconds: 0,
                distanceMeters: 0,
                speedKmH: 0,
                maxSpeedByRadiusKmH: opts.maxSpeedKmH,
                segmentIndex: 0,
                isDwelling: false,
                stationIndex: 0
            });
        }

        for (let t = intervalSeconds; t <= segmentRunningTime; t += intervalSeconds) {
            const { speedMps, distanceMeters, maxSpeedByRadiusMps } = interpolateKinematicSpeed(t, kinematicProfile);
            const isLastPoint = t >= segmentRunningTime - intervalSeconds / 2;

            allPoints.push({
                timeSeconds: Math.round((cumulativeTime + t) * 10) / 10,
                distanceMeters: Math.round((cumulativeDistance + distanceMeters) * 10) / 10,
                speedKmH: Math.round(mpsToKph(speedMps) * 10) / 10,
                maxSpeedByRadiusKmH: Math.round(mpsToKph(maxSpeedByRadiusMps) * 10) / 10,
                segmentIndex: segIdx,
                isDwelling: false,
                stationIndex: isLastPoint ? segIdx + 1 : null
            });
        }

        cumulativeTime += segmentRunningTime;
        cumulativeDistance += segmentDistance;
        stationTimes.push(Math.round(cumulativeTime * 10) / 10);
    }

    const finalDwellTime = dwellTimesSeconds[segmentCount] || 0;
    if (finalDwellTime > 0) {
        for (let t = 0; t < finalDwellTime; t += intervalSeconds) {
            allPoints.push({
                timeSeconds: Math.round((cumulativeTime + t) * 10) / 10,
                distanceMeters: cumulativeDistance,
                speedKmH: 0,
                maxSpeedByRadiusKmH: opts.maxSpeedKmH,
                segmentIndex: segmentCount - 1,
                isDwelling: true,
                stationIndex: segmentCount
            });
        }
        cumulativeTime += finalDwellTime;
        totalDwellTime += finalDwellTime;
    }

    const speeds = allPoints.map((p) => p.speedKmH);
    const maxSpeedKmH = speeds.length > 0 ? Math.max(...speeds) : 0;

    return {
        points: allPoints,
        intervalSeconds,
        totalDistanceMeters: cumulativeDistance,
        totalTimeSeconds: cumulativeTime,
        totalRunningTimeSeconds: totalRunningTime,
        totalDwellTimeSeconds: totalDwellTime,
        maxSpeedKmH,
        segmentCount,
        stationTimes,
        dwellTimesSeconds: dwellTimesSeconds.slice(0, segmentCount + 1)
    };
}

/**
 * Convenience function to get time-based speed profile with dwell times for a path object.
 */
export function getPathSpeedByTimeWithDwellTimes(
    path: {
        attributes: {
            geography?: LineString;
            segments?: number[];
            data?: { dwellTimeSeconds?: number[] };
        };
        getData?: (key: string) => unknown;
        getMode?: () => string | undefined;
    },
    options: SpeedProfileOptions = {},
    intervalSeconds: number = 1
): TimeSpeedProfile | null {
    const geography = path.attributes?.geography;
    const segments = path.attributes?.segments;
    const dwellTimes = path.attributes?.data?.dwellTimeSeconds || [];

    if (!geography || !geography.coordinates || geography.coordinates.length < 2) {
        return null;
    }
    if (!segments || segments.length < 1) {
        return null;
    }

    const pathOptions = extractPathOptions(path, options);
    return getSpeedByTimeWithDwellTimes(geography, segments, dwellTimes, pathOptions, intervalSeconds);
}

/**
 * Convenience function to get speed profile with stations for a path object.
 */
export function getPathSpeedProfileWithStations(
    path: {
        attributes: {
            geography?: LineString;
            segments?: number[];
        };
        getData?: (key: string) => unknown;
        getMode?: () => string | undefined;
    },
    options: SpeedProfileOptions = {},
    intervalMeters: number = 10
): DistanceSpeedProfileWithStations | null {
    const geography = path.attributes?.geography;
    const segments = path.attributes?.segments;

    if (!geography || !geography.coordinates || geography.coordinates.length < 2) {
        return null;
    }
    if (!segments || segments.length < 1) {
        return null;
    }

    const pathOptions = extractPathOptions(path, options);
    return getSpeedByDistanceWithStations(geography, segments, pathOptions, intervalMeters);
}

/**
 * Convenience function to get speed profile for a path object (without station stops).
 */
export function getPathSpeedByDistance(
    path: {
        attributes: { geography?: LineString };
        getData?: (key: string) => unknown;
    },
    options: SpeedProfileOptions = {},
    intervalMeters: number = 10
): DistanceSpeedProfile | null {
    const geography = path.attributes?.geography;

    if (!geography || !geography.coordinates || geography.coordinates.length < 2) {
        return null;
    }

    const pathOptions = extractPathOptions(path, options);
    return getSpeedByDistance(geography, pathOptions, intervalMeters);
}

/**
 * Extracts speed profile options from a path object, merging with provided defaults.
 */
function extractPathOptions(
    path: {
        getData?: (key: string) => unknown;
        getMode?: () => string | undefined;
    },
    options: SpeedProfileOptions
): SpeedProfileOptions {
    const pathOptions: SpeedProfileOptions = { ...options };

    if (path.getData) {
        const acceleration = path.getData('defaultAcceleration');
        const deceleration = path.getData('defaultDeceleration');
        const runningSpeed = path.getData('defaultRunningSpeedKmH');

        if (typeof acceleration === 'number') {
            pathOptions.accelerationMps2 = acceleration;
        }
        if (typeof deceleration === 'number') {
            pathOptions.decelerationMps2 = deceleration;
        }
        if (typeof runningSpeed === 'number') {
            pathOptions.maxSpeedKmH = runningSpeed;
            pathOptions.runningSpeedKmH = runningSpeed;
        }
    }

    if (path.getMode && !pathOptions.mode) {
        const mode = path.getMode();
        if (mode && ['rail', 'highSpeedRail', 'metro', 'tram', 'tramTrain'].includes(mode)) {
            pathOptions.mode = mode as RailMode;
        }
    }

    return pathOptions;
}
