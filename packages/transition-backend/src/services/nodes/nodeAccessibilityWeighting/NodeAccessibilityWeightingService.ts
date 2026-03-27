/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

import proj4 from 'proj4';

import osrmService from 'chaire-lib-backend/lib/utils/osrm/OSRMService';
import serverConfig from 'chaire-lib-backend/lib/config/server.config';
import constants from 'chaire-lib-common/lib/config/constants';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import type { IntrinsicWeightedPoint } from 'chaire-lib-common/lib/services/geodata/types';
import type {
    DecayFunctionParameters,
    WeightingFileMapping,
    WeightingInputType
} from 'transition-common/lib/services/weighting/types';
import transitNodesDbQueries from '../../../models/db/transitNodes.db.queries';
import { calculateBatchAccessibilityWeights } from './BatchAccessibilityWeightCalculator';
import type {
    NodeFeatureForWeighting,
    NodeAccessibilityWeightCalculatorDependencies,
    TableManyToManyService
} from './types';

export const INPUT_FILENAME = 'input.csv';

// Easier for a user to parse/validate than just the uuid with weight.
const ENRICHED_CSV_HEADER = 'uuid,lat,lon,code,name,weight';

/** Enriched weights CSV basename for a job (e.g. `node_weights_enriched_42.csv`). */
export function enrichedWeightsFilenameForJob(jobId: number): string {
    return `node_weights_enriched_${jobId}.csv`;
}

/**
 * Read the raw per-node weights file (`node_uuid,weight`), join with transit
 * node metadata from the database (lat, lon, code, name), and write the
 * enriched CSV to `enrichedOutputPath`.
 */
export async function enrichNodeWeightsCsvOnDisk(rawWeightsPath: string, enrichedOutputPath: string): Promise<void> {
    const rawCsv = fs.readFileSync(rawWeightsPath, 'utf-8');
    const parsed = Papa.parse<Record<string, string>>(rawCsv, { header: true, skipEmptyLines: 'greedy' });
    const rows = parsed.data.filter((r) => {
        const uuid = (r.node_uuid ?? r.uuid ?? '').trim();
        return uuid.length > 0 && (r.weight ?? '').trim().length > 0;
    });

    if (rows.length === 0) {
        fs.writeFileSync(enrichedOutputPath, ENRICHED_CSV_HEADER + '\n', 'utf-8');
        return;
    }

    const nodeIds = [...new Set<string>(rows.map((r) => (r.node_uuid ?? r.uuid ?? '').trim()))];
    const nodeCollection = await transitNodesDbQueries.geojsonCollection({ nodeIds });
    const nodeMap = new Map<string, { lat: number; lon: number; code?: string; name?: string }>();
    for (const f of nodeCollection.features ?? []) {
        const id = f.properties?.id;
        if (!id || !f.geometry?.coordinates) continue;
        const [lon, lat] = f.geometry.coordinates;
        nodeMap.set(String(id), { lat, lon, code: f.properties?.code, name: f.properties?.name });
    }

    const enrichedRows = rows.map((row) => {
        const uuid = (row.node_uuid ?? row.uuid).trim();
        const info = nodeMap.get(uuid);
        return {
            uuid,
            lat: info?.lat ?? '',
            lon: info?.lon ?? '',
            code: info?.code ?? '',
            name: info?.name ?? '',
            weight: row.weight.trim()
        };
    });

    const csv = Papa.unparse(enrichedRows, { newline: '\n' });
    fs.writeFileSync(enrichedOutputPath, csv + '\n', 'utf-8');
}

/** Raised when CSV streaming stops early because the job was paused or cancelled in the DB. */
class AccessibilityWeightingCsvControlStopError extends Error {
    constructor() {
        super('CSV stream aborted (job paused or cancelled)');
        this.name = 'AccessibilityWeightingCsvControlStopError';
    }
}

/** Final weights CSV basename for a job (e.g. `node_weights_42.csv`). */
export function weightsFilenameForJob(jobId: number): string {
    return `node_weights_${jobId}.csv`;
}

/** Resolved path to final weights CSV for `jobId`, if it exists on disk. */
export function resolveWeightsFilePath(jobDir: string, jobId: number): string | undefined {
    const jobWeightsPath = path.join(jobDir, weightsFilenameForJob(jobId));
    return fs.existsSync(jobWeightsPath) ? jobWeightsPath : undefined;
}

/** Atomic-checkpoint CSV merged after each full stream chunk (same columns as final weights). */
export const PARTIAL_WEIGHTS_FILENAME = 'node_weights.partial.csv';

export type NodeAccessibilityWeightingExecuteOptions = {
    chunkSize?: number;
    /**
     * Number of intrinsic CSV points already reflected in `resumeWeights`.
     * The stream skips this many emitted points before filling chunks.
     */
    resumePointsProcessed?: number;
    /** Accumulated weights loaded from a checkpoint partial file (or in-memory resume). */
    resumeWeights?: Map<string, number>;
    /**
     * Called after each chunk is fully merged into `accumulatedWeights` and
     * `pointsProcessed` is updated — safe boundary for durable resume.
     */
    onCheckpoint?: (payload: {
        pointsProcessed: number;
        accumulatedWeights: ReadonlyMap<string, number>;
    }) => Promise<void>;
    /**
     * Basename of the final weights file. Omit for unit tests (`weightsFilenameForJob(1)`);
     * production passes `weightsFilenameForJob(jobId)`.
     */
    weightsOutputFilename?: string;
};

export type NodeAccessibilityWeightingResult = {
    pointCount: number;
    nodeCount: number;
    nodesWithWeight: number;
    /** False when processing stopped before the CSV stream ended (e.g. cancel). */
    finishedNormally: boolean;
};

const PARTIAL_CHECKPOINT_MARKER = '\n#NAW_INTRINSIC_POINTS:';

export type PartialWeightsCheckpoint = {
    weights: Map<string, number>;
    /** From the trailing file marker when present; 0 if legacy partial without marker. */
    intrinsicPointsProcessed: number;
};

/**
 * Load partial weights and intrinsic-point progress from one atomically-written file.
 * The CSV body is followed by `#NAW_INTRINSIC_POINTS:<n>` so skip count and weights
 * cannot diverge across a crash between file write and DB update.
 */
export function loadPartialCheckpointBundle(jobDir: string): PartialWeightsCheckpoint {
    const finalPath = path.join(jobDir, PARTIAL_WEIGHTS_FILENAME);
    if (!fs.existsSync(finalPath)) {
        return { weights: new Map(), intrinsicPointsProcessed: 0 };
    }
    const raw = fs.readFileSync(finalPath, 'utf-8');
    const idx = raw.lastIndexOf(PARTIAL_CHECKPOINT_MARKER);
    let csvBody = raw;
    let intrinsicPointsProcessed = 0;
    if (idx !== -1) {
        csvBody = raw.slice(0, idx);
        const tail = raw.slice(idx + PARTIAL_CHECKPOINT_MARKER.length).trim();
        const n = parseInt(tail.split(/\n|\r/)[0] ?? '', 10);
        if (Number.isFinite(n) && n >= 0) {
            intrinsicPointsProcessed = n;
        }
    }
    const parsed = Papa.parse<{ node_uuid?: string; uuid?: string; weight?: string }>(csvBody, {
        header: true,
        skipEmptyLines: 'greedy'
    });
    const m = new Map<string, number>();
    for (const row of parsed.data) {
        const id = (row.node_uuid ?? row.uuid ?? '').trim();
        const w = parseFloat(String(row.weight ?? ''));
        if (id.length > 0 && Number.isFinite(w)) {
            m.set(id, w);
        }
    }
    return { weights: m, intrinsicPointsProcessed };
}

/**
 * Parse a partial or final weights CSV (`node_uuid,weight`) into a map (CSV body only).
 */
export function loadPartialWeightsMap(jobDir: string): Map<string, number> {
    return loadPartialCheckpointBundle(jobDir).weights;
}

/**
 * Atomically replace the partial weights file (write temp + rename).
 * @param intrinsicPointsProcessed  Total intrinsic CSV points merged into `weights` (stored after CSV body).
 */
export function savePartialWeightsMapAtomic(
    jobDir: string,
    weights: Map<string, number>,
    intrinsicPointsProcessed: number
): void {
    const outLines = ['node_uuid,weight'];
    for (const [nodeId, weight] of weights.entries()) {
        if (weight > 0) {
            outLines.push(`${nodeId},${weight}`);
        }
    }
    if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
    }
    const finalPath = path.join(jobDir, PARTIAL_WEIGHTS_FILENAME);
    const tmpPath = `${finalPath}.tmp.${process.pid}`;
    const payload = `${outLines.join('\n')}\n${PARTIAL_CHECKPOINT_MARKER}${intrinsicPointsProcessed}\n`;
    fs.writeFileSync(tmpPath, payload, 'utf-8');
    fs.renameSync(tmpPath, finalPath);
}

export function removePartialWeightsFile(jobDir: string): void {
    const finalPath = path.join(jobDir, PARTIAL_WEIGHTS_FILENAME);
    if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
    }
}

/**
 * Number of points collected from the CSV stream before handing them
 * to calculateBatchAccessibilityWeights. Larger values reduce per-call
 * overhead (nodeFeatureMap rebuild) while keeping memory bounded.
 */
const DEFAULT_STREAM_CHUNK_SIZE = 1_000;

/** Subset of the job config needed for execution. */
export type WeightingExecutionConfig = {
    weightingInputType: WeightingInputType;
    maxWalkingTimeSeconds: number;
    decayFunctionParameters: DecayFunctionParameters;
    weightingFileMapping?: WeightingFileMapping;
};

export type ExecutionCallbacks = {
    onProgress: (processedCount: number, totalCount: number) => void;
    /**
     * Called between CSV chunks (before reading the next one). Return
     * `true` to stop (e.g. job paused or cancelled in DB). Also passed
     * to the CSV streamer for mid-chunk status checks.
     */
    isCancelled: () => boolean | Promise<boolean>;
    /**
     * Polled inside {@link calculateBatchAccessibilityWeights} before
     * each OSRM sub-batch within a chunk. Return `true` to abort the
     * chunk early (pause or cancel). Partial chunk results are discarded
     * and the checkpoint does not advance, so the chunk is re-done on
     * resume. If omitted, falls back to {@link isCancelled}.
     */
    isCancelledWithinChunk?: () => boolean | Promise<boolean>;
};

// ---------------------------------------------------------------------------
// Streaming CSV → point chunks (memory-bounded)
// ---------------------------------------------------------------------------

/**
 * Streams a CSV file through PapaParse and yields chunks of
 * IntrinsicWeightedPoint[]. Only one chunk is buffered at a time,
 * so memory usage is O(chunkSize) regardless of file size.
 *
 * PapaParse is paused after each chunk and resumed when the consumer
 * calls next(), providing natural backpressure.
 *
 * Optional `isCancelled` is polled after each **complete CSV row** when either
 * (a) a {@link IN_CHUNK_STATUS_CHECK_INTERVAL} intrinsic-point milestone is crossed
 * within that row, or (b) every {@link CSV_ROW_STATUS_CHECK_INTERVAL} physical
 * data rows — so pause/cancel stays visible even when many rows yield no points.
 * In-flight checks use a generation counter so an older async completion cannot
 * call `parser.resume()` after a newer pause (that race would defeat backpressure).
 */
const INTRINSIC_POINTS_PARSE_LOG_INTERVAL = 100;
/** Mid-chunk DB status check while streaming (pause/cancel responsiveness). */
const IN_CHUNK_STATUS_CHECK_INTERVAL = 100;
/**
 * Poll job status every N **physical CSV data rows** (after the header), even when a row
 * yields zero intrinsic points — otherwise pause/cancel is invisible across long runs of
 * skipped/invalid rows.
 */
const CSV_ROW_STATUS_CHECK_INTERVAL = 25;

export type StreamCsvToPointChunksOptions = {
    /** Return true to stop reading the CSV (job paused or cancelled in DB). */
    isCancelled?: () => boolean | Promise<boolean>;
};

async function* streamCsvToPointChunks(
    csvPath: string,
    config: WeightingExecutionConfig,
    chunkSize: number,
    skipIntrinsicPoints = 0,
    streamOptions?: StreamCsvToPointChunksOptions
): AsyncGenerator<IntrinsicWeightedPoint[]> {
    const fileStream = fs.createReadStream(csvPath, { encoding: 'utf-8' });
    const mapping = config.weightingFileMapping ?? {};
    const projection = resolveProjection(mapping.projection);
    let skipRemaining = skipIntrinsicPoints;
    let intrinsicPointsParsed = 0;
    let csvDataRowsProcessed = 0;

    // Producer-consumer channel bridging PapaParse's push-based callbacks
    // to the generator's pull-based iteration. `enqueue` (producer) pushes
    // completed chunks or a null sentinel (end-of-stream). `waitForChunk`
    // (consumer) resolves immediately if data is queued, or parks until the
    // producer pushes. This keeps at most one chunk buffered at a time,
    // providing natural backpressure: PapaParse pauses after filling a
    // chunk and only resumes after the consumer yields it.
    const readyChunks: (IntrinsicWeightedPoint[] | null)[] = [];
    let waiter: (() => void) | null = null;
    let parseError: Error | null = null;

    const enqueue = (item: IntrinsicWeightedPoint[] | null) => {
        readyChunks.push(item);
        if (waiter) {
            const w = waiter;
            waiter = null;
            w();
        }
    };

    const waitForChunk = (): Promise<void> => {
        if (readyChunks.length > 0) return Promise.resolve();
        return new Promise<void>((r) => {
            waiter = r;
        });
    };

    let chunk: IntrinsicWeightedPoint[] = [];
    let parserRef: Papa.Parser | null = null;
    let parseAborted = false;
    /**
     * True after `parser.pause()` at a chunk boundary (chunk full → enqueued).
     * Prevents `runMidChunkStatusCheck` from calling `parser.resume()` before
     * the consumer pulls the chunk; cleared when the consumer resumes.
     */
    let chunkBoundaryPaused = false;
    /** Invalidates in-flight async status checks so only the latest may call `parser.resume()`. */
    let midChunkStatusCheckGeneration = 0;

    const runMidChunkStatusCheck = (parser: Papa.Parser): void => {
        const isCancelledFn = streamOptions?.isCancelled;
        if (!isCancelledFn) {
            return;
        }
        midChunkStatusCheckGeneration += 1;
        const generation = midChunkStatusCheckGeneration;
        parser.pause();
        void (async () => {
            try {
                if (parseAborted || generation !== midChunkStatusCheckGeneration) {
                    return;
                }
                if (await isCancelledFn()) {
                    parseAborted = true;
                    chunk = [];
                    parseError = new AccessibilityWeightingCsvControlStopError();
                    enqueue(null);
                    parser.abort();
                    return;
                }
                if (parseAborted || generation !== midChunkStatusCheckGeneration) {
                    return;
                }
                parser.resume();
            } catch (err) {
                parseAborted = true;
                parseError = err instanceof Error ? err : new Error(String(err));
                enqueue(null);
                try {
                    parser.abort();
                } catch {
                    /* ignore */
                }
            }
        })();
    };

    Papa.parse(fileStream as NodeJS.ReadableStream, {
        header: true,
        skipEmptyLines: 'greedy',
        step: (result: Papa.ParseStepResult<Record<string, string>>, parser: Papa.Parser) => {
            parserRef = parser;
            if (parseAborted) {
                return;
            }
            csvDataRowsProcessed += 1;
            const row = result.data;
            const weightStr = mapping.weight ? row[mapping.weight] : undefined;
            const rawWeight = weightStr ? parseFloat(weightStr) : undefined;
            const intrinsicWeight =
                rawWeight !== undefined && Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : undefined;

            const intrinsicPointsParsedAtRowStart = intrinsicPointsParsed;
            const points = extractPointsFromRow(row, config.weightingInputType, mapping, intrinsicWeight, projection);
            for (const pt of points) {
                if (skipRemaining > 0) {
                    skipRemaining--;
                    continue;
                }
                chunk.push(pt);
                intrinsicPointsParsed += 1;
                if (intrinsicPointsParsed % INTRINSIC_POINTS_PARSE_LOG_INTERVAL === 0) {
                    console.log(
                        `[NodeAccessibilityWeighting] ${intrinsicPointsParsed} intrinsic points parsed from CSV (stream chunk size ${chunkSize})`
                    );
                }
                if (chunk.length >= chunkSize) {
                    chunkBoundaryPaused = true;
                    parser.pause();
                    enqueue(chunk);
                    chunk = [];
                }
            }
            if (chunkBoundaryPaused) {
                return;
            }
            const intrinsicMilestoneCrossed =
                streamOptions?.isCancelled &&
                intrinsicPointsParsed > intrinsicPointsParsedAtRowStart &&
                Math.floor(intrinsicPointsParsed / IN_CHUNK_STATUS_CHECK_INTERVAL) >
                    Math.floor(intrinsicPointsParsedAtRowStart / IN_CHUNK_STATUS_CHECK_INTERVAL);

            const rowMilestoneReached =
                streamOptions?.isCancelled &&
                csvDataRowsProcessed > 0 &&
                csvDataRowsProcessed % CSV_ROW_STATUS_CHECK_INTERVAL === 0;

            if (intrinsicMilestoneCrossed || rowMilestoneReached) {
                runMidChunkStatusCheck(parser);
                return;
            }
        },
        complete: () => {
            if (parseAborted) {
                return;
            }
            if (chunk.length > 0) {
                enqueue(chunk);
                chunk = [];
            }
            enqueue(null);
        },
        error: (err: Error) => {
            parseError = err;
            enqueue(null);
        }
    });

    try {
        let parseLoopContinue = true;
        while (parseLoopContinue) {
            await waitForChunk();
            const c = readyChunks.shift()!;
            if (c === null) {
                parseLoopContinue = false;
            } else {
                yield c;
                if (parserRef) {
                    chunkBoundaryPaused = false;
                    parserRef.resume();
                }
            }
        }

        if (parseError) throw parseError;
    } finally {
        if (parserRef) parserRef.abort();
        fileStream.destroy();
    }
}

// ---------------------------------------------------------------------------
// Point extraction from a single CSV row
// ---------------------------------------------------------------------------

type Proj4Projection = { srid: number; value: string };

/** Resolve the projection string (SRID) from Preferences, defaulting to WGS84. */
function resolveProjection(projectionSrid: string | undefined): Proj4Projection {
    if (projectionSrid === undefined) {
        return constants.geographicCoordinateSystem;
    }
    const projections = Preferences.get('proj4Projections') as Record<string, Proj4Projection> | undefined;
    if (projections && projections[projectionSrid] !== undefined) {
        return projections[projectionSrid];
    }
    return constants.geographicCoordinateSystem;
}

function extractPointsFromRow(
    row: Record<string, string>,
    inputType: WeightingInputType,
    mapping: WeightingFileMapping,
    intrinsicWeight: number | undefined,
    projection: Proj4Projection
): IntrinsicWeightedPoint[] {
    const results: IntrinsicWeightedPoint[] = [];
    const isWgs84 = projection.srid === constants.geographicCoordinateSystem.srid;

    const makePoint = (latCol: string | undefined, lonCol: string | undefined): IntrinsicWeightedPoint | null => {
        const lat = parseFloat(row[latCol ?? ''] ?? '');
        const lon = parseFloat(row[lonCol ?? ''] ?? '');
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const coords: [number, number] = isWgs84
            ? [lon, lat]
            : (proj4(projection.value, constants.geographicCoordinateSystem.value, [lon, lat]) as [number, number]);
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coords },
            properties: { intrinsicWeight }
        };
    };

    switch (inputType) {
    case 'poi': {
        const pt = makePoint(mapping.pointLat, mapping.pointLon);
        if (pt) results.push(pt);
        break;
    }
    case 'odOrigins': {
        const pt = makePoint(mapping.originLat, mapping.originLon);
        if (pt) results.push(pt);
        break;
    }
    case 'odDestinations': {
        const pt = makePoint(mapping.destinationLat, mapping.destinationLon);
        if (pt) results.push(pt);
        break;
    }
    case 'odBoth': {
        const origin = makePoint(mapping.originLat, mapping.originLon);
        if (origin) results.push(origin);
        const dest = makePoint(mapping.destinationLat, mapping.destinationLon);
        if (dest) results.push(dest);
        break;
    }
    }

    return results;
}

// ---------------------------------------------------------------------------
// OSRM adapter
// ---------------------------------------------------------------------------

/**
 * Wraps the backend OSRM singleton into the TableManyToManyService interface
 * expected by BatchAccessibilityWeightCalculator. The OSRM service
 * returns Status-wrapped results; this adapter unwraps them.
 */
function createOsrmRoutingAdapter(): TableManyToManyService {
    return {
        tableManyToMany: async (params) => {
            const result = await osrmService.tableManyToMany(params);
            if (Status.isStatusOk(result)) {
                return Status.unwrap(result);
            }
            throw new Error(`OSRM tableManyToMany failed: ${JSON.stringify(result.error)}`);
        }
    };
}

// ---------------------------------------------------------------------------
// Main execution pipeline
// ---------------------------------------------------------------------------

/**
 * Execute the full node accessibility weighting pipeline:
 * 1. Stream input CSV into bounded point chunks
 * 2. Load all transit nodes from DB
 * 3. For each chunk, run BatchAccessibilityWeightCalculator and merge weights
 * 4. Write results to the configured weights CSV in the job directory
 *
 * Memory is bounded to O(chunkSize + nodeCount) regardless of
 * input CSV size. The calculator processes each chunk with PQueue-based
 * parallelism using serverConfig.maxParallelCalculators concurrent
 * OSRM calls.
 *
 * @param options.chunkSize  Override the streaming chunk size (for testing).
 * @param options.resumePointsProcessed  Skip this many intrinsic points when streaming (checkpoint resume).
 * @param options.resumeWeights  Starting accumulated weights (must align with `resumePointsProcessed`).
 * @param options.onCheckpoint  Persist progress after each full chunk is merged.
 * @param options.weightsOutputFilename  Final file basename (default {@link weightsFilenameForJob}(1) for tests).
 */
export async function executeNodeAccessibilityWeighting(
    jobDir: string,
    config: WeightingExecutionConfig,
    callbacks: ExecutionCallbacks,
    options?: NodeAccessibilityWeightingExecuteOptions
): Promise<NodeAccessibilityWeightingResult> {
    const inputPath = path.join(jobDir, INPUT_FILENAME);
    if (!fs.existsSync(inputPath)) {
        throw new Error('Input file not found. Please upload a CSV file first.');
    }

    const nodeCollection = await transitNodesDbQueries.geojsonCollection();
    const nodeFeatures: NodeFeatureForWeighting[] = (nodeCollection.features ?? [])
        .filter((f) => f.geometry?.type === 'Point' && f.properties?.id)
        .map((f) => ({
            type: 'Feature' as const,
            geometry: f.geometry,
            properties: { id: String(f.properties.id) }
        }));

    if (nodeFeatures.length === 0) {
        throw new Error('No transit nodes found in the database.');
    }

    const dependencies: NodeAccessibilityWeightCalculatorDependencies = {
        routingService: createOsrmRoutingAdapter(),
        getNodesInBirdDistanceFromPoint: transitNodesDbQueries.getNodesInBirdDistanceFromPoint
    };

    const outputWeightsBasename = options?.weightsOutputFilename ?? weightsFilenameForJob(1);
    const chunkSize = options?.chunkSize ?? DEFAULT_STREAM_CHUNK_SIZE;
    const resumePts = options?.resumePointsProcessed ?? 0;
    if (resumePts > 0 && (!options?.resumeWeights || options.resumeWeights.size === 0)) {
        throw new Error('Invalid resume state: resumePointsProcessed is set but resumeWeights is missing or empty.');
    }

    const accumulatedWeights = new Map<string, number>();
    if (options?.resumeWeights) {
        for (const [k, v] of options.resumeWeights) {
            accumulatedWeights.set(k, v);
        }
    }

    let totalProcessed = resumePts;
    let hasAnyPoints = totalProcessed > 0;
    let stoppedEarly = false;

    const skipStreamPoints = resumePts;
    const csvStreamIterator = streamCsvToPointChunks(inputPath, config, chunkSize, skipStreamPoints, {
        isCancelled: callbacks.isCancelled
    })[Symbol.asyncIterator]();
    let streamAbortNeeded = false;
    try {
        let streamHasMore = true;
        while (streamHasMore) {
            if (await callbacks.isCancelled()) {
                stoppedEarly = true;
                streamAbortNeeded = true;
                break;
            }
            let step: IteratorResult<IntrinsicWeightedPoint[]>;
            try {
                step = await csvStreamIterator.next();
            } catch (err) {
                if (err instanceof AccessibilityWeightingCsvControlStopError) {
                    stoppedEarly = true;
                    streamAbortNeeded = true;
                    break;
                }
                throw err;
            }
            if (step.done) {
                streamHasMore = false;
            } else {
                const chunk = step.value;
                hasAnyPoints = true;

                if (process.env.NODE_ENV !== 'test') {
                    console.log(
                        `[NodeAccessibilityWeighting] Computing accessibility weights for CSV chunk (${chunk.length} intrinsic points; target stream chunk size ${chunkSize})`
                    );
                }

                const withinChunkIsCancelled = callbacks.isCancelledWithinChunk ?? callbacks.isCancelled;
                const chunkWeights = await calculateBatchAccessibilityWeights({
                    points: chunk,
                    nodeFeatures,
                    parameters: {
                        maxWalkingTimeSeconds: config.maxWalkingTimeSeconds,
                        decayFunctionParameters: config.decayFunctionParameters
                    },
                    dependencies,
                    concurrency: serverConfig.maxParallelCalculators,
                    onProgress: (processed, _total) => {
                        callbacks.onProgress(totalProcessed + processed, -1);
                    },
                    isCancelled: withinChunkIsCancelled
                });

                if (callbacks.isCancelledWithinChunk && (await callbacks.isCancelledWithinChunk())) {
                    stoppedEarly = true;
                    streamAbortNeeded = true;
                    break;
                }

                for (const [nodeId, weight] of chunkWeights) {
                    accumulatedWeights.set(nodeId, (accumulatedWeights.get(nodeId) ?? 0) + weight);
                }
                totalProcessed += chunk.length;

                if (options?.onCheckpoint) {
                    await options.onCheckpoint({
                        pointsProcessed: totalProcessed,
                        accumulatedWeights: new Map(accumulatedWeights)
                    });
                }
            }
        }
    } finally {
        if (streamAbortNeeded && typeof csvStreamIterator.return === 'function') {
            try {
                await csvStreamIterator.return(undefined);
            } catch {
                /* ignore close errors */
            }
        }
    }

    if (!stoppedEarly && (await callbacks.isCancelled())) {
        stoppedEarly = true;
    }

    if (!hasAnyPoints && !stoppedEarly) {
        throw new Error('No valid points found in the input CSV. Check the column mapping.');
    }

    const finishedNormally = !stoppedEarly;
    const outLines = ['node_uuid,weight'];
    let nodesWithWeight = 0;
    for (const [nodeId, weight] of accumulatedWeights.entries()) {
        if (weight > 0) {
            outLines.push(`${nodeId},${weight}`);
            nodesWithWeight++;
        }
    }

    if (finishedNormally) {
        if (!fs.existsSync(jobDir)) {
            fs.mkdirSync(jobDir, { recursive: true });
        }
        fs.writeFileSync(path.join(jobDir, outputWeightsBasename), outLines.join('\n') + '\n', 'utf-8');
    }

    return {
        pointCount: totalProcessed,
        nodeCount: nodeFeatures.length,
        nodesWithWeight,
        finishedNormally
    };
}
