/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import fs from 'fs';
import path from 'path';

import GeoJSON from 'geojson';
import Papa from 'papaparse';
import routingServiceManager from 'chaire-lib-common/lib/services/routing/RoutingServiceManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

import transitNodesDbQueries from '../../../models/db/transitNodes.db.queries';
import { DecayFunctionCalculator } from '../../weighting/DecayFunctionCalculator';
import type { DecayFunctionParameters, DecayInputValue } from 'transition-common/lib/services/weighting/types';
import {
    MIN_TRAVEL_TIME_SECONDS,
    DECAY_TYPE_VALUES,
    DECAY_TYPES_WITH_BETA
} from 'transition-common/lib/services/weighting/types';
import type { NodeWeightingConfig } from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';
import { NODE_WEIGHTING_DEFAULT_POI_WEIGHT } from 'transition-common/lib/services/networkDesign/transit/simulationMethod/nodeWeightingTypes';
import { NODE_WEIGHTS_OUTPUT_FILENAME } from './evolutionary/types';
import type { EvolutionaryTransitNetworkDesignJob } from './evolutionary/types';
import type { NodeWeightingJob } from './nodeWeighting/types';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

/** Default walking speed in m/s for bird-distance radius (~5 km/h). */
const DEFAULT_WALKING_SPEED_MPS = 1.39;

const BATCH_SIZE = 16;

/** Thrown when node weighting is cancelled via AbortSignal. */
export class NodeWeightingCancelledError extends Error {
    readonly name = 'NodeWeightingCancelledError';
    constructor() {
        super('Node weighting was cancelled');
    }
}

/**
 * Allows pausing and resuming a running node weighting job.
 * The streaming loop calls waitIfPaused() between batches.
 */
export class NodeWeightingPauseController {
    private _paused = false;
    private _resumeResolve: (() => void) | undefined;

    get paused(): boolean {
        return this._paused;
    }

    pause(): void {
        this._paused = true;
    }

    resume(): void {
        this._paused = false;
        if (this._resumeResolve !== undefined) {
            this._resumeResolve();
            this._resumeResolve = undefined;
        }
    }

    /** Resolves immediately if not paused; otherwise waits until resume() is called. */
    waitIfPaused(): Promise<void> {
        if (!this._paused) {
            return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
            this._resumeResolve = resolve;
        });
    }
}

/** Progress message keys for i18n on the frontend (transit:networkDesign.nodeWeighting.progress.*). */
export type NodeWeightingProgressMessageKey = 'LoadingTransitNodes' | 'RowsProcessed' | 'WritingNodeWeights' | 'Paused';

export type NodeWeightingProgress = {
    progress?: number;
    rowsProcessed?: number;
    bytesProcessed?: number;
    totalBytes?: number;
    /** Optional: if set, frontend should translate via transit:networkDesign.nodeWeighting.progress[messageKey] */
    messageKey?: NodeWeightingProgressMessageKey;
    /** @deprecated Prefer messageKey for translated UI; kept for backward compatibility */
    message?: string;
};

type NodeMapEntry = {
    feature: GeoJSON.Feature<GeoJSON.Point>;
    weight: number;
};

type WorkItem = { point: GeoJSON.Point; weight: number };

/**
 * Streaming node weighting: stream CSV row by row, for each POI/OD point query
 * OSRM walking to transit nodes within max walking time, accumulate weight with
 * decay into a node map, then write node_weights.csv.
 *
 * Memory-efficient: only BATCH_SIZE work items are held in memory at a time.
 * Progress uses byte-based percentage from fs.statSync.
 */
export class StreamingNodeWeightingService {
    /**
     * Run streaming node weighting for an evolutionary transit network design job.
     *
     * @param job Evolutionary transit network design job with weighting config
     * @param onProgress Optional callback for progress
     * @param signal Optional AbortSignal to cancel the run
     */
    static async run(
        job: EvolutionaryTransitNetworkDesignJob,
        onProgress?: (p: NodeWeightingProgress) => void,
        signal?: AbortSignal,
        pauseController?: NodeWeightingPauseController
    ): Promise<void> {
        const params = job.attributes.data.parameters;
        if (params.simulationMethod.type !== 'OdTripSimulation') {
            throw new TrError(
                'Node weighting is only supported for OdTripSimulation',
                'SNWS001',
                'NodeWeightingOnlyForOdTripSimulation'
            );
        }

        const config = params.simulationMethod.config.nodeWeighting;
        if (!config?.weightingEnabled) {
            throw new TrError('Node weighting is not enabled for this job', 'SNWS002', 'NodeWeightingNotEnabled');
        }

        const stream = job.getReadStream('nodeWeight');
        const totalBytes = fs.statSync(String(stream.path)).size;

        await processWeightingFromConfig({
            config,
            stream,
            totalBytes,
            outputDir: job.getJobFileDirectory(),
            onProgress,
            signal,
            pauseController
        });
    }

    /**
     * Run streaming node weighting for a standalone node weighting job (Nodes section).
     *
     * @param job Node weighting job
     * @param onProgress Optional callback for progress
     * @param signal Optional AbortSignal to cancel
     * @param pauseController Optional controller to pause/resume the run
     */
    static async runForNodeWeightingJob(
        job: NodeWeightingJob,
        onProgress?: (p: NodeWeightingProgress) => void,
        signal?: AbortSignal,
        pauseController?: NodeWeightingPauseController
    ): Promise<void> {
        const config = job.attributes.data.parameters?.nodeWeighting as NodeWeightingConfig | undefined;
        if (!config?.weightingEnabled) {
            throw new TrError('Node weighting is not enabled for this job', 'SNWS002', 'NodeWeightingNotEnabled');
        }

        const stream = job.getReadStream('nodeWeight');
        const totalBytes = fs.statSync(String(stream.path)).size;

        await processWeightingFromConfig({
            config,
            stream,
            totalBytes,
            outputDir: job.getJobFileDirectory(),
            onProgress,
            signal,
            pauseController
        });
    }
}

// ---------------------------------------------------------------------------
// Shared processing pipeline
// ---------------------------------------------------------------------------

interface ProcessWeightingParams {
    config: NodeWeightingConfig;
    stream: fs.ReadStream;
    totalBytes: number;
    outputDir: string;
    onProgress?: (p: NodeWeightingProgress) => void;
    signal?: AbortSignal;
    pauseController?: NodeWeightingPauseController;
}

/**
 * Core pipeline shared by both evolutionary and standalone weighting jobs.
 * Validates config, loads transit nodes, streams CSV with pause/resume batch
 * processing, and writes node_weights.csv output.
 */
async function processWeightingFromConfig(params: ProcessWeightingParams): Promise<void> {
    const { config, stream, totalBytes, outputDir, onProgress, signal, pauseController } = params;

    const maxWalkingTimeSeconds = config.maxWalkingTimeSeconds;
    if (maxWalkingTimeSeconds === undefined || maxWalkingTimeSeconds <= 0) {
        throw new TrError(
            'maxWalkingTimeSeconds must be a positive number',
            'SNWS003',
            'transit:networkDesign.nodeWeighting.errors.maxWalkingTimeSecondsInvalid'
        );
    }

    if (!config.weightingFileAttributes?.fileAndMapping?.fieldMappings) {
        throw new TrError(
            'Weighting file and mapping are required for node weighting',
            'SNWS006',
            'transit:networkDesign.nodeWeighting.errors.weightingFileRequired'
        );
    }

    const walkingSpeedMps =
        Number(Preferences.get('transit.routing.transit.walkingSpeedMps')) || DEFAULT_WALKING_SPEED_MPS;
    const maxRadiusMeters = maxWalkingTimeSeconds * walkingSpeedMps;

    if (signal?.aborted) {
        throw new NodeWeightingCancelledError();
    }
    onProgress?.({ messageKey: 'LoadingTransitNodes' });

    const nodeCollection = await transitNodesDbQueries.geojsonCollection({});
    const features = nodeCollection.features || [];
    const nodeMap = new Map<string, NodeMapEntry>();
    for (const f of features) {
        if (f.geometry?.coordinates && f.properties?.id) {
            const id = String(f.properties.id);
            nodeMap.set(id, {
                feature: { type: 'Feature', geometry: f.geometry, properties: {} },
                weight: 0
            });
        }
    }

    const routingService = routingServiceManager.getRoutingServiceForEngine('engine');
    const decayParams: DecayFunctionParameters = config.decayFunctionParameters ?? {
        type: 'power',
        beta: 1.5
    };
    validateDecayParameters(decayParams);

    const mappings = config.weightingFileAttributes.fileAndMapping.fieldMappings as Record<string, string>;
    const odWeightingPoints = config.odWeightingPoints ?? 'both';
    const isOdFormat = detectOdFormat(mappings);
    const extractWorkItems = createWorkItemExtractor(mappings, isOdFormat, odWeightingPoints);

    const getNodesInBirdDistanceFromPoint =
        transitNodesDbQueries.getNodesInBirdDistanceFromPoint.bind(transitNodesDbQueries);

    const processBatch = async (batch: WorkItem[]): Promise<void> => {
        if (signal?.aborted) {
            throw new NodeWeightingCancelledError();
        }
        await Promise.all(
            batch.map((item) =>
                processOnePoi(
                    item.point,
                    item.weight,
                    nodeMap,
                    maxRadiusMeters,
                    maxWalkingTimeSeconds,
                    routingService,
                    decayParams,
                    getNodesInBirdDistanceFromPoint
                )
            )
        );
    };

    const { rowsProcessed } = await streamProcessWeightingFile({
        stream,
        totalBytes,
        extractWorkItems,
        processBatch,
        onProgress,
        signal,
        pauseController
    });

    if (signal?.aborted) {
        throw new NodeWeightingCancelledError();
    }
    onProgress?.({
        progress: 1,
        rowsProcessed,
        bytesProcessed: totalBytes,
        totalBytes,
        messageKey: 'WritingNodeWeights'
    });

    const outPath = path.join(outputDir, NODE_WEIGHTS_OUTPUT_FILENAME);
    const lines: string[] = ['node_uuid,weight'];
    for (const [nodeId, entry] of nodeMap.entries()) {
        if (entry.weight > 0) {
            lines.push(`${nodeId},${entry.weight}`);
        }
    }
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Streaming CSV processing with PapaParse pause/resume
// ---------------------------------------------------------------------------

interface StreamProcessingParams {
    stream: fs.ReadStream;
    totalBytes: number;
    extractWorkItems: (row: Record<string, string>) => WorkItem[];
    processBatch: (batch: WorkItem[]) => Promise<void>;
    onProgress?: (p: NodeWeightingProgress) => void;
    signal?: AbortSignal;
    pauseController?: NodeWeightingPauseController;
}

/**
 * Streams a CSV file through PapaParse, extracting work items from each row and
 * processing them in batches of BATCH_SIZE using pause/resume for backpressure.
 *
 * Memory usage is O(BATCH_SIZE) regardless of file size. Progress is tracked via
 * estimated average row size from the first batch.
 */
async function streamProcessWeightingFile(params: StreamProcessingParams): Promise<{ rowsProcessed: number }> {
    const { stream, totalBytes, extractWorkItems, processBatch, onProgress, signal, pauseController } = params;

    let bytesProcessed = 0;
    let rowsProcessed = 0;
    let batch: WorkItem[] = [];

    // PapaParse's meta.cursor is unreliable with pause/resume (resets per
    // sub-chunk because _baseIndex is never updated when parseChunk exits
    // early on pause). Instead, we estimate bytes from the first batch's
    // cursor (which IS accurate) and extrapolate using average row size.
    let avgBytesPerRow = 0;

    // We use header: false and map rows manually because PapaParse has a bug
    // where pause/resume with header: true re-parses the first data row as
    // headers on each resume (new Parser is created, headerParsed resets).
    let headers: string[] | undefined;

    return new Promise<{ rowsProcessed: number }>((resolve, reject) => {
        let failed = false;

        const fail = (err: unknown) => {
            if (failed) return;
            failed = true;
            reject(err instanceof Error ? err : new Error(String(err)));
        };

        const reportProgress = () => {
            onProgress?.({
                rowsProcessed,
                bytesProcessed: Math.min(bytesProcessed, totalBytes),
                totalBytes,
                messageKey: 'RowsProcessed'
            });
        };

        Papa.parse(stream as NodeJS.ReadableStream, {
            header: false,
            skipEmptyLines: 'greedy',
            step: (result: Papa.ParseStepResult<string[]>, parser: Papa.Parser) => {
                if (failed) return;
                if (signal?.aborted) {
                    fail(new NodeWeightingCancelledError());
                    parser.abort();
                    return;
                }

                const row = result.data;
                if (headers === undefined) {
                    headers = row.map((h) => h.trim());
                    return;
                }

                rowsProcessed++;
                if (avgBytesPerRow === 0) {
                    bytesProcessed = result.meta.cursor;
                } else {
                    bytesProcessed = Math.round(rowsProcessed * avgBytesPerRow);
                }

                const record: Record<string, string> = {};
                for (let i = 0; i < headers.length; i++) {
                    record[headers[i]] = row[i] ?? '';
                }
                const items = extractWorkItems(record);
                batch.push(...items);

                if (batch.length >= BATCH_SIZE) {
                    if (avgBytesPerRow === 0 && rowsProcessed > 0) {
                        avgBytesPerRow = result.meta.cursor / rowsProcessed;
                    }
                    parser.pause();
                    const toProcess = batch;
                    batch = [];
                    processBatch(toProcess)
                        .then(async () => {
                            reportProgress();
                            if (pauseController?.paused) {
                                onProgress?.({
                                    rowsProcessed,
                                    bytesProcessed: Math.min(bytesProcessed, totalBytes),
                                    totalBytes,
                                    messageKey: 'Paused'
                                });
                                await pauseController.waitIfPaused();
                            }
                            if (signal?.aborted) {
                                fail(new NodeWeightingCancelledError());
                                parser.abort();
                                return;
                            }
                            if (!failed) {
                                parser.resume();
                            }
                        })
                        .catch((err) => {
                            fail(err);
                            parser.abort();
                        });
                }
            },
            complete: () => {
                if (failed) return;
                const remaining = batch;
                batch = [];
                (remaining.length > 0 ? processBatch(remaining) : Promise.resolve())
                    .then(() => {
                        reportProgress();
                        resolve({ rowsProcessed });
                    })
                    .catch(fail);
            },
            error: (err: Error) => {
                fail(err);
            }
        });
    });
}

// ---------------------------------------------------------------------------
// Work item extraction
// ---------------------------------------------------------------------------

function detectOdFormat(mappings: Record<string, string>): boolean {
    return (
        (mappings.originLat !== undefined &&
            mappings.originLat !== null &&
            mappings.originLon !== undefined &&
            mappings.originLon !== null) ||
        (mappings.destinationLat !== undefined &&
            mappings.destinationLat !== null &&
            mappings.destinationLon !== undefined &&
            mappings.destinationLon !== null)
    );
}

/**
 * Creates a function that extracts 0..N WorkItems from a single CSV row,
 * depending on whether the file is POI or OD format and which points to use.
 */
function createWorkItemExtractor(
    mappings: Record<string, string>,
    isOdFormat: boolean,
    odWeightingPoints: string
): (row: Record<string, string>) => WorkItem[] {
    const weightKey = mappings.weight;

    const getWeight = (row: Record<string, string>): number => {
        if (weightKey && !_isBlank(row[weightKey])) {
            const w = parseFloat(row[weightKey]);
            if (isFinite(w) && w > 0) return w;
        }
        return NODE_WEIGHTING_DEFAULT_POI_WEIGHT;
    };

    if (isOdFormat) {
        const originLatKey = mappings.originLat;
        const originLonKey = mappings.originLon;
        const destLatKey = mappings.destinationLat;
        const destLonKey = mappings.destinationLon;
        const useOrigins =
            (odWeightingPoints === 'origins' || odWeightingPoints === 'both') &&
            originLatKey !== undefined &&
            originLonKey !== undefined;
        const useDestinations =
            (odWeightingPoints === 'destinations' || odWeightingPoints === 'both') &&
            destLatKey !== undefined &&
            destLonKey !== undefined;

        return (row) => {
            const items: WorkItem[] = [];
            const weight = getWeight(row);
            if (useOrigins) {
                const lat = parseCoord(row[originLatKey]);
                const lon = parseCoord(row[originLonKey]);
                if (isFinite(lat) && isFinite(lon)) {
                    items.push({ point: { type: 'Point', coordinates: [lon, lat] }, weight });
                }
            }
            if (useDestinations) {
                const lat = parseCoord(row[destLatKey]);
                const lon = parseCoord(row[destLonKey]);
                if (isFinite(lat) && isFinite(lon)) {
                    items.push({ point: { type: 'Point', coordinates: [lon, lat] }, weight });
                }
            }
            return items;
        };
    }

    const pointLatKey = mappings.pointLat;
    const pointLonKey = mappings.pointLon;

    return (row) => {
        const lat = parseCoord(row[pointLatKey]);
        const lon = parseCoord(row[pointLonKey]);
        if (!isFinite(lat) || !isFinite(lon)) return [];
        const weight = getWeight(row);
        return [{ point: { type: 'Point', coordinates: [lon, lat] }, weight }];
    };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateDecayParameters(params: DecayFunctionParameters): void {
    const type = params.type;
    if (type === undefined || !DECAY_TYPE_VALUES.includes(type)) {
        throw new TrError(
            'Decay type must be one of: power, exponential, gamma, combined, logistic',
            'SNWS008',
            'transit:networkDesign.nodeWeighting.errors.decayTypeInvalid'
        );
    }
    if (DECAY_TYPES_WITH_BETA.includes(type)) {
        const beta = (params as { beta?: number }).beta;
        if (beta === undefined || beta === null) {
            throw new TrError(
                'Beta is required for this decay type',
                'SNWS009',
                'transit:networkDesign.nodeWeighting.errors.decayBetaRequired'
            );
        }
        if (typeof beta !== 'number' || beta <= 0) {
            throw new TrError(
                'Beta must be greater than 0',
                'SNWS010',
                'transit:networkDesign.nodeWeighting.errors.decayBetaInvalid'
            );
        }
    }
}

function parseCoord(value: string | undefined): number {
    if (value === undefined || value === null) {
        return Number.NaN;
    }
    const n = parseFloat(String(value).trim());
    return Number.isFinite(n) ? n : Number.NaN;
}

// ---------------------------------------------------------------------------
// Single-POI OSRM processing
// ---------------------------------------------------------------------------

async function processOnePoi(
    point: GeoJSON.Point,
    poiWeight: number,
    nodeMap: Map<string, NodeMapEntry>,
    maxRadiusMeters: number,
    maxWalkingTimeSeconds: number,
    routingService: ReturnType<typeof routingServiceManager.getRoutingServiceForEngine>,
    decayParams: DecayFunctionParameters,
    getNodesInBirdDistanceFromPoint: (p: GeoJSON.Point, radius: number) => Promise<{ id: string; distance: number }[]>
): Promise<void> {
    const candidateNodes = await getNodesInBirdDistanceFromPoint(point, maxRadiusMeters);
    if (candidateNodes.length === 0) {
        return;
    }

    const destinations = candidateNodes
        .map((n) => nodeMap.get(n.id))
        .filter((e): e is NodeMapEntry => e !== undefined)
        .map((e) => e.feature);

    if (destinations.length === 0) {
        return;
    }

    const originFeature: GeoJSON.Feature<GeoJSON.Point> = {
        type: 'Feature',
        geometry: point,
        properties: {}
    };

    const routingResult = await routingService.tableFrom({
        mode: 'walking',
        origin: originFeature,
        destinations
    });

    const durations = routingResult.durations ?? [];
    for (let i = 0; i < candidateNodes.length && i < durations.length; i++) {
        const duration = durations[i];
        if (
            duration === null ||
            duration === undefined ||
            !Number.isFinite(duration) ||
            duration > maxWalkingTimeSeconds
        ) {
            continue;
        }
        const nodeId = candidateNodes[i].id;
        const entry = nodeMap.get(nodeId);
        if (!entry) {
            continue;
        }
        const inputValue: DecayInputValue = {
            travelTimeSeconds: Math.max(duration, MIN_TRAVEL_TIME_SECONDS)
        };
        const decay = DecayFunctionCalculator.calculateDecay(inputValue, 'time', decayParams);
        entry.weight += poiWeight * decay;
    }
}
