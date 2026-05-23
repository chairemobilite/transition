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

/** Per-period target total travel time (in seconds) for a single service's checkpoint. */
export type PeriodTargetTimes = Record<string, number>;

/** Checkpoint target totals keyed by `${checkpointKey}_${serviceId}` → periods → seconds. */
export type CheckpointTargetsByKey = Record<string, PeriodTargetTimes>;

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

/** Sum the current stored travel times of one service for the segments inside a checkpoint. */
const sumSegmentTimesForCheckpoint = (serviceTimes: number[] | undefined, checkpoint: ResolvedCheckpoint): number => {
    if (!serviceTimes) return 0;
    let total = 0;
    for (let i = checkpoint.fromNodeIndex; i < checkpoint.toNodeIndex; i++) {
        total += serviceTimes[i] ?? 0;
    }
    return total;
};

/**
 * Distribute a per-period target total travel time across the segments of a checkpoint
 * for a single service. Writes the distributed times directly into
 * `data[service.serviceId][periodShortname]`. If OSRM returns usable times, the target
 * is scaled to match those proportions; otherwise the target is distributed evenly across
 * the checkpoint's segments.
 *
 * For periods that don't yet have any entry in `data`, falls back to the service's per-period
 * baseline, or to the path's base segment travel times when missing.
 */
export const distributeCheckpointForService = (params: {
    data: LocalSegmentTimes;
    service: ServiceSegmentTimes;
    checkpoint: ResolvedCheckpoint;
    osrmTimes: number[] | null;
    targetTimesByPeriod: PeriodTargetTimes;
    baseSegments: TimeAndDistance[];
}): void => {
    const serviceId = params.service.serviceId;
    const averageTimesByPeriod = params.service.averageTimesByPeriod;
    const data = params.data;
    const checkpoint = params.checkpoint;
    const osrmTimes = params.osrmTimes;
    const targetTimesByPeriod = params.targetTimesByPeriod;
    const baseSegments = params.baseSegments;
    if (!data[serviceId]) {
        data[serviceId] = {};
    }

    for (const [periodShortname, targetTotalSeconds] of Object.entries(targetTimesByPeriod)) {
        if (!data[serviceId][periodShortname]) {
            data[serviceId][periodShortname] = baseSegments.map((seg, i) => {
                const avg = averageTimesByPeriod?.[periodShortname]?.[i];
                return avg !== undefined ? avg : seg.travelTimeSeconds;
            });
        }

        // Skip periods where the target matches the current total for this service
        const currentTotal = sumSegmentTimesForCheckpoint(data[serviceId][periodShortname], checkpoint);
        if (currentTotal === targetTotalSeconds) continue;

        let scaledSegmentTimesSeconds: number[] | null = null;
        if (osrmTimes) {
            scaledSegmentTimesSeconds = pathGeographyUtils.scaleTimesToTarget(osrmTimes, targetTotalSeconds);
        }

        if (!scaledSegmentTimesSeconds) {
            // Fallback: distribute evenly if OSRM fails
            const segmentCount = checkpoint.toNodeIndex - checkpoint.fromNodeIndex;
            const timePerSegmentSeconds = Math.floor(targetTotalSeconds / segmentCount);
            const remainderSeconds = targetTotalSeconds - timePerSegmentSeconds * segmentCount;
            scaledSegmentTimesSeconds = Array.from(
                { length: segmentCount },
                (_, i) => timePerSegmentSeconds + (i < remainderSeconds ? 1 : 0)
            );
        }

        for (let i = 0; i < scaledSegmentTimesSeconds.length; i++) {
            data[serviceId][periodShortname][checkpoint.fromNodeIndex + i] = scaledSegmentTimesSeconds[i];
        }
    }
};

/**
 * Walk every checkpoint and, for any whose targets differ from current totals in at
 * least one service, fetch OSRM times once and distribute them across each
 * affected service. Mutates `dataToUpdate` in place.
 */
export const applyPendingCheckpointDistributions = async (params: {
    dataToUpdate: LocalSegmentTimes;
    path: Path;
    resolvedCheckpoints: ResolvedCheckpoint[];
    services: ServiceSegmentTimes[];
    checkpointTargets: CheckpointTargetsByKey;
}): Promise<void> => {
    const dataToUpdate = params.dataToUpdate;
    const path = params.path;
    const resolvedCheckpoints = params.resolvedCheckpoints;
    const services = params.services;
    const checkpointTargets = params.checkpointTargets;
    const baseSegments = getBaseSegmentsFromPath(path);
    for (const checkpoint of resolvedCheckpoints) {
        const needsDistribution = services.some((service) => {
            const targets = checkpointTargets[`${getCheckpointKey(checkpoint)}_${service.serviceId}`];
            if (!targets) return false;
            return Object.entries(targets).some(([period, target]) => {
                const serviceTimes = dataToUpdate[service.serviceId]?.[period];
                if (!serviceTimes) return true; // no stored data for this service/period = needs distribution
                return sumSegmentTimesForCheckpoint(serviceTimes, checkpoint) !== target;
            });
        });
        if (!needsDistribution) continue;

        // OSRM times are fetched once per checkpoint and reused across all services
        const osrmTimes = await pathGeographyUtils.calculateSegmentTimesForCheckpoint(
            path,
            checkpoint.fromNodeIndex,
            checkpoint.toNodeIndex
        );

        for (const service of services) {
            const targets = checkpointTargets[`${getCheckpointKey(checkpoint)}_${service.serviceId}`];
            if (!targets) continue;
            distributeCheckpointForService({
                data: dataToUpdate,
                service,
                checkpoint,
                osrmTimes,
                targetTimesByPeriod: targets,
                baseSegments
            });
        }
    }
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
