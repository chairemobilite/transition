/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type Path from './Path';
import type { PeriodSegmentData } from './Path';

const getBaseSegmentsFromPath = (path: Path) => path.attributes.data.segments || [];

// === Types ===

/** Flat editing structure used by the segment times modal: serviceId → period → times per segment. */
export type LocalSegmentTimes = Record<string, Record<string, number[]>>;

/** Nested structure mirroring `path.attributes.data.segmentsByServiceAndPeriod`. */
export type SegmentsByServiceAndPeriod = Record<string, Record<string, PeriodSegmentData>>;

/** Average travel times per segment for a single service, keyed by period shortname. */
export type AverageTimesByPeriod = Record<string, number[]>;

/** Stored per-segment travel times for a single service, shown as one row in the modal. */
export type ServiceSegmentTimes = {
    /** ID of the service these times belong to */
    serviceId: string;
    /** Average travel times per segment, keyed by period shortname */
    averageTimesByPeriod: AverageTimesByPeriod;
};

// === Pure helpers ===

/** Format seconds as "XmYYs", e.g. 75 → "1m15s", 120 → "2m00s", 45 → "0m45s" */
export const formatSeconds = (seconds: number): string => {
    const rounded = Math.round(seconds);
    const mins = Math.floor(rounded / 60);
    const secs = rounded % 60;
    return `${mins}m${secs < 10 ? '0' : ''}${secs}s`;
};

/** Build a PeriodSegmentData object from segments, dwell times, and total distance.
 *  Computes travel/operating totals and speed metrics. */
export const buildPeriodSegmentData = (
    segments: { travelTimeSeconds: number; distanceMeters: number | null }[],
    dwellTimeSeconds: number[],
    totalDistanceMeters: number
): PeriodSegmentData => {
    const travelTotal = segments.reduce((sum, s) => sum + s.travelTimeSeconds, 0);
    const dwellTotal = dwellTimeSeconds.reduce((sum, d) => sum + d, 0);
    const operatingTotal = travelTotal + dwellTotal;
    return {
        segments,
        dwellTimeSeconds,
        travelTimeWithoutDwellTimesSeconds: travelTotal,
        operatingTimeWithoutLayoverTimeSeconds: operatingTotal,
        averageSpeedWithoutDwellTimesMetersPerSecond:
            travelTotal > 0 ? Math.round((totalDistanceMeters / travelTotal) * 100) / 100 : 0,
        operatingSpeedMetersPerSecond:
            operatingTotal > 0 ? Math.round((totalDistanceMeters / operatingTotal) * 100) / 100 : 0
    };
};

/**
 * Serialize the flat LocalSegmentTimes structure (one entry per service) to the nested
 * PeriodSegmentData shape that path.data.segmentsByServiceAndPeriod expects. Uses
 * buildPeriodSegmentData to compute totals and speeds per period.
 */
export const buildSegmentsByServiceAndPeriod = (params: {
    expandedData: LocalSegmentTimes;
    path: Path;
    dwellTimes: number[];
}): SegmentsByServiceAndPeriod => {
    const expandedData = params.expandedData;
    const path = params.path;
    const dwellTimes = params.dwellTimes;
    const baseSegments = getBaseSegmentsFromPath(path);
    const totalDistanceMeters = baseSegments.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0);
    const result: SegmentsByServiceAndPeriod = {};
    for (const [serviceId, periodEntries] of Object.entries(expandedData)) {
        for (const [periodShortname, times] of Object.entries(periodEntries)) {
            if (!times || times.length === 0) continue;
            if (!result[serviceId]) result[serviceId] = {};
            const segmentsForPeriod = times.map((t, i) => ({
                travelTimeSeconds: t,
                distanceMeters: baseSegments[i]?.distanceMeters ?? null
            }));
            result[serviceId][periodShortname] = buildPeriodSegmentData(
                segmentsForPeriod,
                dwellTimes,
                totalDistanceMeters
            );
        }
    }
    return result;
};
