/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type GeoJSON from 'geojson';
import PQueue from 'p-queue';

import { DecayFunctionCalculator } from '../../weighting/DecayFunctionCalculator';
import type { DecayInputValue } from 'transition-common/lib/services/weighting/types';
import { MIN_TRAVEL_TIME_SECONDS } from 'transition-common/lib/services/weighting/types';
import type {
    NodeWeightingParameters,
    NodeFeatureForWeighting,
    NodeAccessibilityWeightCalculatorDependencies
} from './types';
import type { IntrinsicWeightedPoint } from 'chaire-lib-common/lib/services/geodata/types';
import { DEFAULT_WALKING_SPEED_MPS, DEFAULT_INTRINSIC_WEIGHT } from './types';
import TrError from 'chaire-lib-common/lib/utils/TrError';

/**
 * Calculate the bird-distance pre-filter radius in meters.
 * Nodes beyond this radius cannot be reached within maxWalkingTimeSeconds.
 */
export function getBirdDistanceRadiusMeters(maxWalkingTimeSeconds: number, walkingSpeedMps: number): number {
    return maxWalkingTimeSeconds * walkingSpeedMps;
}

/**
 * Extract the intrinsic weight from an IntrinsicWeightedPoint feature.
 * Falls back to DEFAULT_INTRINSIC_WEIGHT when the property is missing or invalid.
 */
export function getIntrinsicWeight(weightedPoint: IntrinsicWeightedPoint): number {
    const raw = weightedPoint.properties?.intrinsicWeight;
    if (raw !== undefined && raw !== null && Number.isFinite(raw) && raw > 0) {
        return raw;
    }
    return DEFAULT_INTRINSIC_WEIGHT;
}

/**
 * Default number of POIs processed per OSRM many-to-many batch.
 *
 * Smaller batches keep the OSRM call within the server's max-table-size
 * limit (sources × destinations ≤ limit²). Larger batches reduce HTTP
 * overhead but increase wasted pairs when POIs in the batch are spread out.
 *
 * Benchmark results (21,390 unique OD points, 4,794 nodes):
 *
 *   Metric                  | POI-by-POI (tableFrom) | Many-to-Many (this)
 *   ------------------------|------------------------|---------------------
 *   Wall time               | 1,366.6s (22.8 min)    | 699.1s (11.7 min)
 *   OSRM HTTP calls         | 18,794                 | 5,801
 *   Total pairs routed      | 2.3M                   | 56.9M
 *   Peak RSS delta          | 69.2 MB                | 87.5 MB
 *   Nodes with weight > 0   | 4,785                  | 4,785
 *   Total accumulated weight| 106.3772               | 106.3772
 *
 *   Speedup: ~2x with default OSRM settings (--max-table-size=100).
 *   Raising max-table-size to 1000 had no measurable effect (711.9s),
 *   confirming the bottleneck is total pairs routed, not HTTP overhead.
 *
 * TODO: Performance optimization -- spatially sort or bucket POIs (e.g. by
 * bounding box or geohash) before batching so that nearby POIs share more
 * candidate nodes, reducing wasted OSRM pairs (56.9M -> closer to 2.3M).
 * With geographic locality, the union of candidate nodes per batch shrinks
 * dramatically, making larger batches viable and increasing throughput.
 *
 * TODO: Build a spatial index (e.g. KDBush or R-tree) over the node
 * features once, then use it for the bird-distance candidate lookup instead
 * of issuing one PostGIS query per POI. This avoids N round-trips to the
 * database during batch processing and enables in-memory filtering when the
 * node set is already loaded.
 */
export const DEFAULT_BATCH_SIZE = 100;

/**
 * OSRM's --max-table-size defaults to 100, meaning at most 100² = 10,000
 * source-destination pairs per call. We use this to auto-chunk large calls.
 */
export const DEFAULT_MAX_TABLE_PAIRS = 10_000;

/**
 * Fallback concurrency when the caller does not specify one.
 * In production, NodeAccessibilityWeightingService overrides this
 * with serverConfig.maxParallelCalculators (defaults to os.cpus().length).
 */
export const DEFAULT_CONCURRENCY = 4;

export type BatchWeightingParams = {
    /**
     * Locations whose accessibility influence is being measured (e.g. POIs,
     * OD origins/destinations). Each point may carry an intrinsic weight
     * (survey expansion factor, job count, etc.) that scales its contribution.
     * These are the *sources* in the OSRM many-to-many table call.
     */
    points: IntrinsicWeightedPoint[];
    /**
     * Transit stop nodes that receive the accumulated accessibility weight.
     * These are the *destinations* in the OSRM many-to-many table call.
     * Only nodes within bird-distance of each point are included per batch
     * (see {@link getBirdDistanceRadiusMeters}).
     */
    nodeFeatures: NodeFeatureForWeighting[];
    parameters: NodeWeightingParameters;
    dependencies: NodeAccessibilityWeightCalculatorDependencies;
    batchSize?: number;
    maxOsrmTablePairs?: number;
    /** Number of POI batches to process concurrently (default 4). */
    concurrency?: number;
    /**
     * Called after each batch with the cumulative count of points processed.
     * Values are always monotonically increasing, but with concurrency > 1
     * batches may complete out of order, so increments between calls can vary.
     */
    onProgress?: (processedCount: number, totalCount: number) => void;
    /**
     * Polled before each batch. Return true to stop processing early
     * (e.g. on cancellation or pause). When true, the loop exits and
     * partial results accumulated so far are returned.
     */
    isCancelled?: () => boolean | Promise<boolean>;
};

/**
 * Compute the total accessibility weight for every transit node, given a
 * stream of weighted points (POIs or OD origins/destinations).
 *
 * Uses the many-to-many OSRM table API to process POIs in batches,
 * amortising HTTP overhead across multiple POI-to-node pairs per call.
 *
 * @returns Map from nodeId to its accumulated accessibility weight.
 */
export async function calculateBatchAccessibilityWeights(params: BatchWeightingParams): Promise<Map<string, number>> {
    const { points, nodeFeatures, parameters, dependencies } = params;
    validateParameters(parameters);

    const batchSize = params.batchSize ?? DEFAULT_BATCH_SIZE;
    const maxPairs = params.maxOsrmTablePairs ?? DEFAULT_MAX_TABLE_PAIRS;
    const concurrency = params.concurrency ?? DEFAULT_CONCURRENCY;

    const walkingSpeedMps = parameters.walkingSpeedMps ?? DEFAULT_WALKING_SPEED_MPS;
    const maxRadiusMeters = getBirdDistanceRadiusMeters(parameters.maxWalkingTimeSeconds, walkingSpeedMps);

    const nodeFeatureMap = new Map<string, NodeFeatureForWeighting>();
    for (const nf of nodeFeatures) {
        nodeFeatureMap.set(nf.properties.id, nf);
    }

    const nodeAccessibilityWeights = new Map<string, number>();

    const queue = new PQueue({ concurrency });
    let processedPoints = 0;
    let cancelled = false;
    let firstError: unknown = null;

    for (let batchStart = 0; batchStart < points.length && !cancelled; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, points.length);
        const batch = points.slice(batchStart, batchEnd);

        queue.add(async () => {
            if (cancelled) return;
            if (params.isCancelled && (await params.isCancelled())) {
                cancelled = true;
                queue.clear();
                return;
            }
            try {
                await processBatch({
                    batch,
                    nodeFeatureMap,
                    maxRadiusMeters,
                    maxPairs,
                    parameters,
                    dependencies,
                    weights: nodeAccessibilityWeights
                });
                processedPoints += batch.length;
                params.onProgress?.(processedPoints, points.length);
            } catch (error) {
                if (!firstError) firstError = error;
                cancelled = true;
                queue.clear();
            }
        });
    }

    await queue.onIdle();
    if (firstError) throw firstError;

    return nodeAccessibilityWeights;
}

type ProcessBatchParams = {
    batch: IntrinsicWeightedPoint[];
    nodeFeatureMap: Map<string, NodeFeatureForWeighting>;
    maxRadiusMeters: number;
    maxPairs: number;
    parameters: NodeWeightingParameters;
    dependencies: NodeAccessibilityWeightCalculatorDependencies;
    weights: Map<string, number>;
};

async function processBatch(params: ProcessBatchParams): Promise<void> {
    const { batch, nodeFeatureMap, maxRadiusMeters, maxPairs, parameters, dependencies, weights } = params;

    const candidateNodeIds = new Set<string>();
    const perPoiCandidates: string[][] = [];

    for (const point of batch) {
        const candidates = await dependencies.getNodesInBirdDistanceFromPoint(point.geometry, maxRadiusMeters);
        const ids = candidates.map((c) => c.id).filter((id) => nodeFeatureMap.has(id));
        perPoiCandidates.push(ids);
        for (const id of ids) {
            candidateNodeIds.add(id);
        }
    }

    if (candidateNodeIds.size === 0) {
        return;
    }

    const destNodeIds = [...candidateNodeIds];
    const destNodeIdToIndex = new Map<string, number>();
    const destFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (let j = 0; j < destNodeIds.length; j++) {
        destNodeIdToIndex.set(destNodeIds[j], j);
        destFeatures.push({
            type: 'Feature',
            geometry: nodeFeatureMap.get(destNodeIds[j])!.geometry,
            properties: {}
        });
    }

    const sourceFeatures: GeoJSON.Feature<GeoJSON.Point>[] = batch.map((p) => ({
        type: 'Feature',
        geometry: p.geometry,
        properties: {}
    }));

    const { durations, distances } = await callTableWithAutoChunking({
        sources: sourceFeatures,
        destinations: destFeatures,
        maxPairs,
        dependencies
    });

    for (let i = 0; i < batch.length; i++) {
        const intrinsicWeight = getIntrinsicWeight(batch[i]);
        const poiCandidateIds = perPoiCandidates[i];

        for (const nodeId of poiCandidateIds) {
            const j = destNodeIdToIndex.get(nodeId);
            if (j === undefined) continue;

            const duration = durations[i]?.[j] ?? null;
            const distance = distances[i]?.[j] ?? null;

            const increment = computeAccessibilityWeightIncrement(
                duration,
                parameters.maxWalkingTimeSeconds,
                intrinsicWeight,
                parameters
            );

            if (increment > 0 && duration !== null && distance !== null) {
                weights.set(nodeId, (weights.get(nodeId) ?? 0) + increment);
            }
        }
    }
}

/**
 * Calls tableManyToMany, splitting destinations into chunks when the total
 * pair count (sources x destinations) exceeds maxPairs.
 */
type AutoChunkingParams = {
    sources: GeoJSON.Feature<GeoJSON.Point>[];
    destinations: GeoJSON.Feature<GeoJSON.Point>[];
    maxPairs: number;
    dependencies: NodeAccessibilityWeightCalculatorDependencies;
};

async function callTableWithAutoChunking(
    params: AutoChunkingParams
): Promise<{ durations: (number | null)[][]; distances: (number | null)[][] }> {
    const { sources, destinations, maxPairs, dependencies } = params;
    if (sources.length > maxPairs) {
        throw new TrError(
            `Source count (${sources.length}) exceeds maxPairs (${maxPairs}). Reduce batch size or increase maxPairs.`,
            'BAWC003',
            'BatchWeightingError'
        );
    }

    if (sources.length * destinations.length <= maxPairs) {
        const result = await dependencies.routingService.tableManyToMany({
            mode: 'walking',
            origins: sources,
            destinations
        });
        return { durations: result.durations, distances: result.distances };
    }

    const maxDestsPerChunk = Math.max(1, Math.floor(maxPairs / sources.length));
    const fullDurations: (number | null)[][] = sources.map(() => []);
    const fullDistances: (number | null)[][] = sources.map(() => []);

    for (let dStart = 0; dStart < destinations.length; dStart += maxDestsPerChunk) {
        const dEnd = Math.min(dStart + maxDestsPerChunk, destinations.length);
        const destChunk = destinations.slice(dStart, dEnd);

        const chunk = await dependencies.routingService.tableManyToMany({
            mode: 'walking',
            origins: sources,
            destinations: destChunk
        });

        for (let i = 0; i < sources.length; i++) {
            const chunkRow = chunk.durations[i] ?? [];
            const distRow = chunk.distances[i] ?? [];
            for (let j = 0; j < destChunk.length; j++) {
                fullDurations[i].push(chunkRow[j] ?? null);
                fullDistances[i].push(distRow[j] ?? null);
            }
        }
    }

    return { durations: fullDurations, distances: fullDistances };
}

function computeAccessibilityWeightIncrement(
    travelTimeSeconds: number | null,
    maxWalkingTimeSeconds: number,
    intrinsicWeight: number,
    parameters: NodeWeightingParameters
): number {
    if (
        travelTimeSeconds === null ||
        !Number.isFinite(travelTimeSeconds) ||
        travelTimeSeconds > maxWalkingTimeSeconds
    ) {
        return 0;
    }
    const adjustedTime = Math.max(travelTimeSeconds, MIN_TRAVEL_TIME_SECONDS);
    const inputValue: DecayInputValue = { travelTimeSeconds: adjustedTime };
    const decay = DecayFunctionCalculator.calculateDecay(inputValue, 'time', parameters.decayFunctionParameters);
    return intrinsicWeight * decay;
}

function validateParameters(parameters: NodeWeightingParameters): void {
    if (
        parameters.maxWalkingTimeSeconds === undefined ||
        parameters.maxWalkingTimeSeconds <= 0 ||
        !Number.isFinite(parameters.maxWalkingTimeSeconds)
    ) {
        throw new TrError('maxWalkingTimeSeconds must be a positive finite number', 'BAWC001', 'BatchWeightingError');
    }
    if (
        parameters.walkingSpeedMps !== undefined &&
        (parameters.walkingSpeedMps <= 0 || !Number.isFinite(parameters.walkingSpeedMps))
    ) {
        throw new TrError(
            'walkingSpeedMps must be a positive finite number when provided',
            'BAWC002',
            'BatchWeightingError'
        );
    }
}
