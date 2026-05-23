/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type Path from './Path';
import type { PeriodSegmentData } from './Path';
import type { TimeAndDistance } from './PathTypes';
import { pathGeographyUtils } from './PathGeographyUtils';

const getBaseSegmentsFromPath = (path: Path): TimeAndDistance[] => path.attributes.data.segments || [];

// === Types ===

export type Checkpoint = {
    fromNodeId: string;
    toNodeId: string;
};

/** Checkpoint with resolved node indices — for use in calculations and rendering */
export type ResolvedCheckpoint = Checkpoint & {
    fromNodeIndex: number;
    toNodeIndex: number;
};

export type EditMode = 'segment' | 'checkpoint';

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

/** Resolve a checkpoint's node IDs to their current indices in the nodes array.
 *  Returns undefined if either node ID is not found. */
export const resolveCheckpoint = (checkpoint: Checkpoint, nodeIds: string[]): ResolvedCheckpoint | undefined => {
    const fromIndex = nodeIds.indexOf(checkpoint.fromNodeId);
    const toIndex = nodeIds.indexOf(checkpoint.toNodeId);
    if (fromIndex === -1 || toIndex === -1 || fromIndex >= toIndex) return undefined;
    return { ...checkpoint, fromNodeIndex: fromIndex, toNodeIndex: toIndex };
};

/** Resolve all checkpoints, filtering out any whose nodes no longer exist in the path */
export const resolveCheckpoints = (checkpoints: Checkpoint[], nodeIds: string[]): ResolvedCheckpoint[] =>
    checkpoints.map((cp) => resolveCheckpoint(cp, nodeIds)).filter((cp): cp is ResolvedCheckpoint => cp !== undefined);

/** Build a unique key for a checkpoint (used for indexing target times) */
export const getCheckpointKey = (checkpoint: Checkpoint): string => `${checkpoint.fromNodeId}-${checkpoint.toNodeId}`;

/** Check whether two checkpoints overlap (requires resolved indices) */
export const checkpointsOverlap = (a: ResolvedCheckpoint, b: ResolvedCheckpoint): boolean =>
    a.fromNodeIndex < b.toNodeIndex && b.fromNodeIndex < a.toNodeIndex;

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
    const { expandedData, path, dwellTimes } = params;
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
