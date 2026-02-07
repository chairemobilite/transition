/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { Position } from 'geojson';
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
 * Options for speed profile and segment travel time calculations.
 * Extends CurveRadiusOptions with acceleration/deceleration and speed parameters.
 * Uses maxSpeedKmH as the running speed.
 */
export type SpeedProfileOptions = CurveRadiusOptions & {
    /** Acceleration rate in m/s² (default: 0.5 - typical train) */
    accelerationMps2?: number;
    /** Deceleration rate in m/s² (default: 0.8 - service braking) */
    decelerationMps2?: number;
    /** Initial speed in km/h (default: 0) */
    initialSpeedKmH?: number;
    /** Final speed in km/h (default: 0 - stop at end) */
    finalSpeedKmH?: number;
    /** Maximum running speed in km/h (default: 160, set higher for HSR e.g. 300-350) */
    maxSpeedKmH?: number;
    /**
     * Minimum fallback speed (m/s) when both segment endpoint speeds are zero.
     * Used to avoid unrealistically long travel times; defaults to 1.0 m/s.
     * Only applied when neither neighbor averaging nor normal kinematic
     * calculation is possible.
     */
    minFallbackSpeedMps?: number;
};

/**
 * Speed at a specific point along the path
 */
export type SpeedPoint = {
    /** Index in coordinates array */
    index: number;
    /** Distance from start in meters */
    distanceMeters: number;
    /** Maximum allowed speed at this point based on curve radius (km/h) */
    maxSpeedByRadiusKmH: number;
    /** Actual achievable speed considering accel/decel (km/h) */
    achievableSpeedKmH: number;
    /** Whether braking is required at this point */
    isBraking: boolean;
    /** Whether accelerating at this point */
    isAccelerating: boolean;
};

/**
 * Result of speed profile calculation
 */
export type SpeedProfileResult = {
    /** Speed profile at each vertex */
    speedPoints: SpeedPoint[];
    /** Total travel time in seconds */
    totalTimeSeconds: number;
    /** Average speed in km/h */
    averageSpeedKmH: number;
    /** Points where braking must begin */
    brakingZones: { startIndex: number; endIndex: number; reason: string }[];
    /** Minimum speed on the path (tightest curve) */
    minSpeedKmH: number;
};

/**
 * A single point in the distance-based speed profile for plotting.
 */
export type DistanceSpeedPoint = {
    /** Distance from start in meters */
    distanceMeters: number;
    /** Speed at this distance in km/h */
    speedKmH: number;
    /** Maximum allowed speed by curve radius at this point (km/h) */
    maxSpeedByRadiusKmH: number;
};

/**
 * Result of distance-based speed profile calculation for plotting.
 */
export type DistanceSpeedProfile = {
    /** Speed points at regular intervals */
    points: DistanceSpeedPoint[];
    /** Interval between points in meters */
    intervalMeters: number;
    /** Total distance in meters */
    totalDistanceMeters: number;
    /** Total travel time in seconds */
    totalTimeSeconds: number;
    /** Maximum speed on the path (km/h) */
    maxSpeedKmH: number;
    /** Minimum speed on the path (km/h) */
    minSpeedKmH: number;
};

/**
 * Extended speed point that includes station information.
 */
export type DistanceSpeedPointWithStation = DistanceSpeedPoint & {
    /** Segment index (0-based, between station i and station i+1) */
    segmentIndex: number;
    /** Whether this point is at a station (speed = 0) */
    isAtStation: boolean;
    /** Station index if at a station (0 = first station, etc.) */
    stationIndex: number | null;
};

/**
 * Speed profile result with station information.
 */
export type DistanceSpeedProfileWithStations = Omit<DistanceSpeedProfile, 'points'> & {
    /** Speed points at regular intervals, with station info */
    points: DistanceSpeedPointWithStation[];
    /** Number of segments (stations - 1) */
    segmentCount: number;
    /** Distances where stations are located */
    stationDistances: number[];
};

/**
 * Time-based speed point that includes station and dwell time information.
 */
export type TimeSpeedPoint = {
    /** Cumulative time from start in seconds */
    timeSeconds: number;
    /** Cumulative distance from start in meters */
    distanceMeters: number;
    /** Speed at this point in km/h */
    speedKmH: number;
    /** Maximum speed allowed by curve radius at this point */
    maxSpeedByRadiusKmH: number;
    /** Segment index (0-based, between station i and station i+1) */
    segmentIndex: number;
    /** Whether this point is during a dwell (stopped at station) */
    isDwelling: boolean;
    /** Station index if at/near a station */
    stationIndex: number | null;
};

/**
 * Time-based speed profile result with dwell times.
 */
export type TimeSpeedProfile = {
    /** Speed points at regular time intervals */
    points: TimeSpeedPoint[];
    /** Time interval between points in seconds */
    intervalSeconds: number;
    /** Total distance of the path in meters */
    totalDistanceMeters: number;
    /** Total time including dwell times in seconds */
    totalTimeSeconds: number;
    /** Total running time (excluding dwell times) in seconds */
    totalRunningTimeSeconds: number;
    /** Total dwell time at all stations in seconds */
    totalDwellTimeSeconds: number;
    /** Maximum speed reached in km/h */
    maxSpeedKmH: number;
    /** Number of segments (stations - 1) */
    segmentCount: number;
    /** Times where stations are located (arrival times) */
    stationTimes: number[];
    /** Dwell times at each station in seconds */
    dwellTimesSeconds: number[];
};

/**
 * Travel time result for a single segment (between two stops)
 */
export type SegmentTravelTimeResult = {
    /** Segment index (0 = first segment between node 0 and node 1) */
    segmentIndex: number;
    /** Distance of the segment in meters */
    distanceMeters: number;
    /** Travel time WITHOUT considering curves (constant speed + accel/decel) */
    travelTimeWithoutCurvesSeconds: number;
    /** Travel time WITH curve speed limits considered */
    travelTimeWithCurvesSeconds: number;
    /** Difference in seconds (positive = curves make it slower) */
    differenceSeconds: number;
    /** Percentage difference */
    differencePercent: number;
    /** Minimum curve radius in this segment (null if no curves) */
    minRadiusInSegmentMeters: number | null;
    /** Maximum speed limited by curves in km/h */
    curveSpeedLimitKmH: number | null;
    /** Entry speed into this segment in km/h (considering previous segment) */
    entrySpeedKmH: number;
    /** Exit speed from this segment in km/h */
    exitSpeedKmH: number;
};

/**
 * Describes the resolution quality of the path geometry for curve analysis.
 *
 * - 'high': no vertex on the whole path deflects more than
 *           MIN_DEFLECTION_ANGLE_RAD (~2°). The geometry is smooth
 *           enough for reliable curve analysis.
 * - 'almostStraight': no angle > threshold AND no intermediate waypoints.
 *           The path appears almost straight, but this should be validated:
 *           if there are real curves between stations, the geometry should
 *           be drawn more precisely.
 * - 'low':  waypoints exist but at least one vertex deflects more
 *           than the threshold. The geometry has abrupt direction
 *           changes rather than smooth curves; curve analysis is
 *           unreliable.
 * - 'none': no intermediate waypoints AND at least one angle > threshold
 *           at a station — pure straight lines between stations with
 *           direction changes at stops. Curve analysis is bypassed.
 */
export type GeometryResolution = 'high' | 'almostStraight' | 'low' | 'none';

/**
 * Complete travel time analysis for all segments
 */
export type PathTravelTimeAnalysis = {
    /** Travel time results for each segment */
    segments: SegmentTravelTimeResult[];
    /** Total travel time without curves (seconds) - WITH accel/decel at stops */
    totalTimeWithoutCurvesSeconds: number;
    /** Total travel time with curves (seconds) - WITH accel/decel at stops */
    totalTimeWithCurvesSeconds: number;
    /** Total "no dwell" curve time (seconds) - WITHOUT accel/decel, just running at curve-limited speed */
    totalNoDwellCurveTimeSeconds: number;
    /** Total difference (seconds) */
    totalDifferenceSeconds: number;
    /** Total difference (percent) */
    totalDifferencePercent: number;
    /** Total distance (meters) */
    totalDistanceMeters: number;
    /** Average speed without curves (km/h) */
    avgSpeedWithoutCurvesKmH: number;
    /** Average speed with curves (km/h) */
    avgSpeedWithCurvesKmH: number;
    /** Quality of the geometry for curve analysis purposes */
    geometryResolution: GeometryResolution;
};
