/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import osrm from 'osrm';

import { isSocketIo } from './socketUtils';
import serverConfig from 'chaire-lib-backend/lib/config/server.config';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import osrmProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import osrmService from 'chaire-lib-backend/lib/utils/osrm/OSRMService';
import { TrRoutingConstants } from 'chaire-lib-common/lib/api/TrRouting';
import { TransitionRouteOptions, TransitionMatchOptions } from 'chaire-lib-common/lib/api/OSRMRouting';
import { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import {
    BatchRoutingOdDemandFromCsvAttributes,
    TransitDemandFromCsvAccessMapAttributes
} from 'transition-common/lib/services/transitDemand/types';
import { TransitOdDemandFromCsv } from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ExecutableJob } from '../services/executableJob/ExecutableJob';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { BatchRouteJobType } from '../services/transitRouting/BatchRoutingJob';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { fileKey } from 'transition-common/lib/services/jobs/Job';
import {
    TransitMapCalculationOptions,
    TransitMapColorOptions
} from 'transition-common/lib/services/accessibilityMap/types';
import { TransitAccessibilityMapCalculator } from '../services/accessibilityMap/TransitAccessibilityMapCalculator';
import {
    TransitAccessibilityMapWithPolygonResult,
    TransitAccessibilityMapComparisonResult
} from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { ExecutableJobUtils } from '../services/executableJob/ExecutableJobUtils';
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';
import { TransitApi } from 'transition-common/lib/api/transit';
import {
    createAndEnqueueTransitNetworkDesignJob,
    getParametersFromTransitNetworkDesignJob,
    getLineWeightsForJob,
    getLineSetSummaryCsvForJob,
    LineWeightsForJobResponse,
    saveTransitNetworkDesignConfig,
    TransitNetworkDesignReplayResponse
} from '../services/networkDesign/transitNetworkDesign/TransitNetworkJobController';
import {
    StreamingNodeWeightingService,
    NodeWeightingCancelledError,
    NodeWeightingPauseController
} from '../services/networkDesign/transitNetworkDesign/StreamingNodeWeightingService';
import type { EvolutionaryTransitNetworkDesignJob } from '../services/networkDesign/transitNetworkDesign/evolutionary/types';
import {
    createNodeWeightingJob,
    saveNodeWeightingConfig,
    listNodeWeightingJobs,
    getNodeWeightingJobParameters
} from '../services/networkDesign/transitNetworkDesign/nodeWeighting/NodeWeightingJobController';
import type { NodeWeightingJob } from '../services/networkDesign/transitNetworkDesign/nodeWeighting/types';
import type { NodeWeightingJobParameters } from '../services/networkDesign/transitNetworkDesign/nodeWeighting/types';
import { NODE_WEIGHTS_OUTPUT_FILENAME } from '../services/networkDesign/transitNetworkDesign/evolutionary/types';
import transitNodesDbQueries from '../models/db/transitNodes.db.queries';
import jobsDbQueries from '../models/db/jobs.db.queries';
import { parseCsvFile } from 'chaire-lib-common/lib/utils/files/CsvFile';
import Papa from 'papaparse';

type NodeWeightingStatusResponse = {
    running: boolean;
    paused?: boolean;
    rowsProcessed?: number;
    messageKey?: string;
    hasWeightsFile?: boolean;
};

/**
 * Module-level registry of running standalone node weighting jobs.
 * Decoupled from socket so jobs survive page refreshes; a new socket
 * can re-attach by querying status and taking over progress delivery.
 */
interface RunningNodeWeightingState {
    userId: number;
    abortController: AbortController;
    pauseController: NodeWeightingPauseController;
    lastProgress?: { rowsProcessed?: number; messageKey?: string; bytesProcessed?: number; totalBytes?: number };
    /** Mutable: updated when a new socket re-attaches via the status handler. */
    socket: EventEmitter;
}
const runningNodeWeightingJobs = new Map<number, RunningNodeWeightingState>();

const ENRICHED_NODE_WEIGHTS_HEADER = 'uuid,lat,lon,code,name,weight';

function escapeCsvField(value: string | undefined | null): string {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * Build enriched node weights CSV (uuid, lat, lon, code, name, weight) for a job.
 * Reads node_weights.csv from job directory and joins with transit nodes for attributes.
 */
async function getEnrichedNodeWeightsCsv(
    jobId: number,
    userId: number | undefined
): Promise<{ csv: string; filename: string }> {
    const job = await ExecutableJob.loadTask(jobId);
    if (job.attributes.user_id !== userId) {
        throw new TrError('Not allowed to get node weights for this job', 'TNDNW001', 'transit:main:errors:Forbidden');
    }
    const jobDir = job.getJobFileDirectory();
    const nodeWeightsPath = path.join(jobDir, NODE_WEIGHTS_OUTPUT_FILENAME);
    if (!fs.existsSync(nodeWeightsPath)) {
        throw new TrError(
            'Node weights file not found. Run node weighting or upload a file first.',
            'TNDNW002',
            'transit:networkDesign.nodeWeighting.errors.NodeWeightsFileNotFound'
        );
    }
    const rows: { node_uuid: string; weight: string }[] = [];
    const readStream = fs.createReadStream(nodeWeightsPath);
    await parseCsvFile(
        readStream,
        (row: Record<string, string>) => {
            const nodeUuid = row.node_uuid ?? row.uuid;
            const weight = row.weight;
            if (nodeUuid && weight) {
                rows.push({ node_uuid: nodeUuid.trim(), weight: weight.trim() });
            }
        },
        { header: true, skipEmptyLines: 'greedy' }
    );
    if (rows.length === 0) {
        const headerLine = ENRICHED_NODE_WEIGHTS_HEADER + '\n';
        return { csv: headerLine, filename: 'node_weights.csv' };
    }
    const nodeIds = [...new Set(rows.map((r) => r.node_uuid))];
    const nodeCollection = await transitNodesDbQueries.geojsonCollection({ nodeIds });
    const nodeMap = new Map<string, { lat: number; lon: number; code: string | undefined; name: string | undefined }>();
    for (const f of nodeCollection.features || []) {
        const id = f.properties?.id;
        if (id === undefined || f.geometry?.coordinates === undefined) {
            continue;
        }
        const [lon, lat] = f.geometry.coordinates;
        nodeMap.set(String(id), {
            lat: Number(lat),
            lon: Number(lon),
            code: f.properties?.code,
            name: f.properties?.name
        });
    }
    const lines: string[] = [ENRICHED_NODE_WEIGHTS_HEADER];
    for (const row of rows) {
        const info = nodeMap.get(row.node_uuid);
        const lat = info?.lat ?? '';
        const lon = info?.lon ?? '';
        const code = info?.code ?? '';
        const name = info?.name ?? '';
        const weight = row.weight;
        lines.push([row.node_uuid, lat, lon, escapeCsvField(code), escapeCsvField(name), weight].join(','));
    }
    return { csv: lines.join('\n') + '\n', filename: 'node_weights.csv' };
}

/**
 * Parse uploaded CSV content and write normalized node_weights.csv (node_uuid, weight) to job directory.
 */
async function uploadNodeWeightsFile(jobId: number, userId: number | undefined, csvContent: string): Promise<void> {
    const job = await ExecutableJob.loadTask(jobId);
    if (job.attributes.user_id !== userId) {
        throw new TrError(
            'Not allowed to upload node weights for this job',
            'TNDNW003',
            'transit:main:errors:Forbidden'
        );
    }
    if (job.attributes.name !== 'evolutionaryTransitNetworkDesign') {
        throw new TrError(
            'Job is not an evolutionary transit network design job',
            'TNDNW004',
            'transit:main:errors:InvalidJobType'
        );
    }
    const parsed = Papa.parse<Record<string, string>>(csvContent, { header: true, skipEmptyLines: 'greedy' });
    const rows = parsed.data;
    if (!rows || rows.length === 0) {
        throw new TrError(
            'CSV has no data rows. Expected header with uuid (or node_uuid) and weight.',
            'TNDNW005',
            'transit:networkDesign.nodeWeighting.errors.UploadCsvNoData'
        );
    }
    const first = rows[0];
    const headerKeys = Object.keys(first).map((k) => k.trim().toLowerCase());
    const uuidKey = headerKeys.find((k) => k === 'node_uuid' || k === 'uuid');
    const weightKey = headerKeys.find((k) => k === 'weight');
    if (!uuidKey || !weightKey) {
        throw new TrError(
            'CSV must have columns "uuid" (or "node_uuid") and "weight".',
            'TNDNW006',
            'transit:networkDesign.nodeWeighting.errors.UploadCsvMissingColumns'
        );
    }
    const originalUuidKey = Object.keys(first).find((k) => k.trim().toLowerCase() === uuidKey) ?? uuidKey;
    const originalWeightKey = Object.keys(first).find((k) => k.trim().toLowerCase() === weightKey) ?? weightKey;
    const outLines: string[] = ['node_uuid,weight'];
    for (const row of rows) {
        const nodeUuid = (row[originalUuidKey] ?? '').trim();
        const weightStr = (row[originalWeightKey] ?? '').trim();
        if (!nodeUuid || !weightStr) {
            continue;
        }
        const weight = parseFloat(weightStr);
        if (!Number.isFinite(weight) || weight <= 0) {
            continue;
        }
        outLines.push(`${nodeUuid},${weight}`);
    }
    if (outLines.length <= 1) {
        throw new TrError(
            'No valid rows (uuid and positive weight required).',
            'TNDNW007',
            'transit:networkDesign.nodeWeighting.errors.UploadCsvNoValidRows'
        );
    }
    const jobDir = job.getJobFileDirectory();
    if (!fs.existsSync(jobDir)) {
        fs.mkdirSync(jobDir, { recursive: true });
    }
    const outPath = path.join(jobDir, NODE_WEIGHTS_OUTPUT_FILENAME);
    fs.writeFileSync(outPath, outLines.join('\n') + '\n', 'utf-8');
}

// TODO The socket routes should validate parameters as even typescript cannot guarantee the types over the network
// TODO Add more unit tests as the called methods are cleaned up
export default function (socket: EventEmitter, userId?: number) {
    socket.on('service.osrmRouting.routingModeIsAvailable', async (parameters, callback) => {
        callback(await osrmProcessManager.routingModeIsAvailable(parameters.mode));
    });

    socket.on('service.osrmRouting.availableRoutingModes', async (callback) => {
        callback(await osrmProcessManager.availableRoutingModes());
    });

    socket.on(
        'service.osrmRouting.route',
        async (parameters: TransitionRouteOptions, callback: (status: Status.Status<osrm.RouteResults>) => void) => {
            try {
                const routingResults = await osrmService.route(parameters);
                callback(routingResults);
            } catch (error) {
                console.error(error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : 'Error routing points'));
            }
        }
    );

    socket.on('service.osrmRouting.tableFrom', async (parameters, callback) => {
        try {
            const routingResults = await osrmService.tableFrom(parameters);
            callback(routingResults);
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.message : 'Error getting table from'));
        }
    });

    socket.on('service.osrmRouting.tableTo', async (parameters, callback) => {
        try {
            const routingResults = await osrmService.tableTo(parameters);
            callback(routingResults);
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.message : 'Error getting table to'));
        }
    });

    // TODO: Better type the match method and the status in the callback (see PR #1719)
    socket.on(
        'service.osrmRouting.match',
        async (parameters: TransitionMatchOptions, callback: (status: unknown) => void) => {
            try {
                const routingResults = await osrmService.match(parameters);
                callback(routingResults);
            } catch (error) {
                console.error(error);
                callback(Status.createError(TrError.isTrError(error) ? error.message : 'Error matching points'));
            }
        }
    );

    socket.on('service.trRouting.stop', async (parameters, callback) => {
        try {
            const response = await trRoutingProcessManager.stop(parameters);
            if (response.status === 'stopped' && isSocketIo(socket)) {
                socket.broadcast.emit('service.trRouting.stopped');
            }
            callback(response);
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.message : error));
        }
    });

    socket.on('service.trRouting.restart', async (parameters, callback) => {
        try {
            const response = await trRoutingProcessManager.restart(parameters);
            if (response.status === 'started' && isSocketIo(socket)) {
                socket.broadcast.emit('service.trRouting.started');
            }
            callback(response);
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.message : error));
        }
    });

    socket.on('service.trRouting.status', async (parameters, callback) => {
        try {
            const response = await trRoutingProcessManager.status(parameters);
            callback(response);
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.message : error));
        }
    });

    socket.on(
        'accessibiliyMap.calculateWithPolygons',
        async (
            routingAttributes: AccessibilityMapAttributes,
            options: TransitMapCalculationOptions,
            callback: (status: Status.Status<TransitAccessibilityMapWithPolygonResult>) => void
        ) => {
            try {
                const resultsWithPolygon = await TransitAccessibilityMapCalculator.calculateWithPolygons(
                    routingAttributes,
                    options
                );
                callback(Status.createOk(resultsWithPolygon));
            } catch (error) {
                console.error(error);
                callback(
                    Status.createError(
                        error instanceof Error ? error.message : 'Error occurred while calculating route'
                    )
                );
            }
        }
    );

    // With two received accessibilty maps, calculate their intersections and differences, and send the result back to the frontend.
    socket.on(
        'accessibiliyMap.calculateComparison',
        async (
            result1: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>,
            result2: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>,
            numberOfPolygons: number,
            colors: TransitMapColorOptions,
            callback: (status: Status.Status<TransitAccessibilityMapComparisonResult[]>) => void
        ) => {
            try {
                const finalMap = await TransitAccessibilityMapCalculator.getMapComparison(
                    result1,
                    result2,
                    numberOfPolygons,
                    colors
                );
                callback(Status.createOk(finalMap));
            } catch (error) {
                console.error(error);
                callback(
                    Status.createError(
                        error instanceof Error
                            ? error.message
                            : 'Error occurred while calculating the comparison of accessibility maps.'
                    )
                );
            }
        }
    );

    // These routes create tasks, which need to be associated to a user. If
    // there is no userId here, it means the socket routes are set from CLI and
    // it can't run these tasks now.
    if (userId !== undefined) {
        socket.on(
            TrRoutingConstants.BATCH_ROUTE,
            async (
                parameters: BatchRoutingOdDemandFromCsvAttributes,
                transitRoutingAttributes: BatchCalculationParameters,
                callback
            ) => {
                try {
                    socket.emit('progress', { name: 'BatchRouting', progress: null });
                    const inputFiles: {
                        [Property in keyof BatchRouteJobType[fileKey]]?:
                            | string
                            | { filepath: string; renameTo: string };
                    } = {};
                    // TODO This is a bad security flaw, we let the front end decide whatever to do with backend files
                    inputFiles.input = await ExecutableJobUtils.prepareJobFiles(
                        parameters.fileAndMapping.csvFile,
                        userId
                    );

                    // Force add walking when selecting transit mode, so we can check if walking is better
                    // TODO Consider doing that in the frontend, as a forceful suggestion to the user instead
                    // forcing it for all use cases.
                    const baseRoutingAttributes = transitRoutingAttributes;
                    const modes = baseRoutingAttributes.routingModes || [];
                    const routingModesForCalc =
                        modes.includes('transit') && !modes.includes('walking')
                            ? [...modes, 'walking' as const]
                            : modes;

                    // TODO Handle the input file and add it to the task
                    const job: ExecutableJob<BatchRouteJobType> = await ExecutableJob.createJob({
                        user_id: userId,
                        name: 'batchRoute',
                        data: {
                            parameters: {
                                demandAttributes: parameters.fileAndMapping.fieldMappings,
                                transitRoutingAttributes: {
                                    ...baseRoutingAttributes,
                                    routingModes: routingModesForCalc
                                }
                            }
                        },
                        inputFiles
                    });
                    await job.enqueue();
                    await job.refresh();
                    // TODO Do a quick return with task detail instead of waiting for task to finish
                    callback(Status.createOk(job.attributes.data.results));
                } catch (error) {
                    console.error(error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : error));
                }
            }
        );

        socket.on(
            TrRoutingConstants.BATCH_ROUTE_REPLAY,
            async (
                jobId: number,
                callback: (
                    status: Status.Status<{
                        parameters: BatchCalculationParameters;
                        demand: BatchRoutingOdDemandFromCsvAttributes;
                    }>
                ) => void
            ) => {
                try {
                    const job = await ExecutableJob.loadTask(jobId);
                    if (job.attributes.name !== 'batchRoute') {
                        throw 'Requested job is not a batchRoute job';
                    }
                    const batchRouteJob = job as ExecutableJob<BatchRouteJobType>;
                    const attributes = batchRouteJob.attributes.data.parameters;
                    if (attributes.demandAttributes.originLat === undefined) {
                        // Demand attribute format has changed, jobs using the old format cannot be re-run automatically.
                        // FIXME Consider a conversion path later if necessary
                        throw 'Demand attributes have changed, this job cannot be re-run';
                    }
                    const demandAttributes = {
                        type: 'csv' as const,
                        fileAndMapping: {
                            csvFile: {
                                location: 'job' as const,
                                jobId,
                                fileKey: 'input' as const
                            },
                            fieldMappings: attributes.demandAttributes
                        },
                        csvFields: []
                    };
                    const filePath = batchRouteJob.getInputFilePath();
                    const demand = new TransitOdDemandFromCsv(demandAttributes);
                    const csvFileStream = fs.createReadStream(filePath);
                    await demand.setCsvFileFromStream(csvFileStream, {
                        location: 'job' as const,
                        jobId,
                        fileKey: 'input' as const
                    });

                    callback(
                        Status.createOk({
                            parameters: attributes.transitRoutingAttributes,
                            demand: demand.getCurrentFileAndMapping()!
                        })
                    );
                } catch (error) {
                    console.error(error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : error));
                }
            }
        );

        socket.on(
            TrRoutingConstants.BATCH_ACCESS_MAP,
            async (
                parameters: TransitDemandFromCsvAccessMapAttributes,
                accessMapAttributes: AccessibilityMapAttributes,
                callback
            ) => {
                try {
                    socket.emit('progress', { name: 'BatchAccessMap', progress: null });
                    // TODO Handle the input file and add it to the task
                    const job = await ExecutableJob.createJob({
                        user_id: userId,
                        name: 'batchAccessMap',
                        data: {
                            parameters: {
                                batchAccessMapAttributes: parameters,
                                accessMapAttributes
                            }
                        },
                        inputFiles: {
                            input: `${directoryManager.userDataDirectory}/${userId}/imports/batchAccessMap.csv`
                        }
                    });
                    await job.enqueue();
                    await job.refresh();
                    // TODO Do a quick return with task detail instead of waiting for task to finish
                    callback(Status.createOk(job.attributes.data.results));
                } catch (error) {
                    console.error(error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : error));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_CREATE,
            async (
                payload: { jobParameters: TransitNetworkJobConfigurationType; existingJobId?: number },
                callback: (status: Status.Status<unknown>) => void
            ) => {
                try {
                    socket.emit('progress', { name: 'NetworkDesign', progress: null });
                    const result = await createAndEnqueueTransitNetworkDesignJob(
                        payload.jobParameters,
                        socket,
                        userId,
                        payload.existingJobId
                    );
                    callback(Status.createOk(result));
                } catch (error) {
                    console.error('Error creating a new transit network design job', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : error));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_REPLAY,
            async (jobId: number, callback: (status: Status.Status<TransitNetworkDesignReplayResponse>) => void) => {
                try {
                    const response = await getParametersFromTransitNetworkDesignJob(jobId, userId);
                    callback(Status.createOk(response));
                } catch (error) {
                    console.error(error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : error));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_SAVE_CONFIG,
            async (
                payload: {
                    jobParameters: TransitNetworkJobConfigurationType;
                    existingJobId?: number;
                },
                callback: (status: Status.Status<{ jobId: number }>) => void
            ) => {
                try {
                    const jobId = await saveTransitNetworkDesignConfig(
                        payload.jobParameters,
                        userId as number,
                        payload.existingJobId
                    );
                    callback(Status.createOk({ jobId }));
                } catch (error) {
                    console.error('Error saving transit network design config', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_CONTINUE,
            async (
                payload: { jobId: number; additionalGenerations: number },
                callback: (status: Status.Status<boolean>) => void
            ) => {
                try {
                    const { jobId, additionalGenerations } = payload;
                    if (!Number.isInteger(additionalGenerations) || additionalGenerations <= 0) {
                        callback(Status.createError('Additional generations must be a positive integer'));
                        return;
                    }
                    const job = await ExecutableJob.loadTask(jobId);
                    if (job.attributes.user_id !== userId) {
                        callback(Status.createError('Not allowed to continue this job'));
                        return;
                    }
                    if (job.status !== 'completed') {
                        callback(Status.createError('Only completed jobs can be continued'));
                        return;
                    }
                    const params = (job.attributes.data as any)?.parameters?.algorithmConfiguration?.config;
                    if (!params || typeof params.numberOfGenerations !== 'number') {
                        callback(Status.createError('Job does not have valid algorithm configuration'));
                        return;
                    }
                    params.numberOfGenerations += additionalGenerations;
                    (job as any).status = 'pending';
                    await job.enqueue(socket);
                    callback(Status.createOk(true));
                } catch (error) {
                    console.error('Error continuing evolutionary job', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_START_NODE_WEIGHTING,
            async (jobId: number, callback: (status: Status.Status<{ jobId: number }>) => void) => {
                try {
                    const job = await ExecutableJob.loadTask(jobId);
                    if (job.attributes.user_id !== userId) {
                        callback(Status.createError('Not allowed to run node weighting for this job'));
                        return;
                    }
                    if (job.attributes.name !== 'evolutionaryTransitNetworkDesign') {
                        callback(Status.createError('Job is not an evolutionary transit network design job'));
                        return;
                    }
                    const evolutionaryJob = job as EvolutionaryTransitNetworkDesignJob;
                    const abortController = new AbortController();
                    const socketWithRef = socket as EventEmitter & {
                        _nodeWeightingAbortController?: AbortController;
                        _nodeWeightingJobId?: number;
                        _nodeWeightingLastProgress?: { rowsProcessed?: number; messageKey?: string };
                    };
                    socketWithRef._nodeWeightingAbortController = abortController;
                    socketWithRef._nodeWeightingJobId = jobId;
                    socketWithRef._nodeWeightingLastProgress = undefined;

                    try {
                        await StreamingNodeWeightingService.run(
                            evolutionaryJob,
                            (progress) => {
                                socketWithRef._nodeWeightingLastProgress = {
                                    rowsProcessed: progress.rowsProcessed,
                                    messageKey: progress.messageKey
                                };
                                socket.emit(TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_PROGRESS, {
                                    jobId,
                                    ...progress
                                });
                            },
                            abortController.signal
                        );
                        socket.emit(TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_COMPLETE, { jobId });
                        callback(Status.createOk({ jobId }));
                    } catch (runError) {
                        if (runError instanceof NodeWeightingCancelledError) {
                            socket.emit(TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_COMPLETE, {
                                jobId,
                                cancelled: true
                            });
                            callback(Status.createOk({ jobId }));
                        } else {
                            throw runError;
                        }
                    } finally {
                        socketWithRef._nodeWeightingAbortController = undefined;
                        socketWithRef._nodeWeightingJobId = undefined;
                        socketWithRef._nodeWeightingLastProgress = undefined;
                    }
                } catch (error) {
                    console.error('Error running node weighting', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(TransitApi.TRANSIT_NETWORK_DESIGN_CANCEL_NODE_WEIGHTING, (jobId: number) => {
            const socketWithRef = socket as EventEmitter & {
                _nodeWeightingAbortController?: AbortController;
                _nodeWeightingJobId?: number;
            };
            if (socketWithRef._nodeWeightingJobId === jobId && socketWithRef._nodeWeightingAbortController) {
                socketWithRef._nodeWeightingAbortController.abort();
            }
        });

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_NODE_WEIGHTING_STATUS,
            async (jobId: number, callback: (status: Status.Status<NodeWeightingStatusResponse>) => void) => {
                const socketWithRef = socket as EventEmitter & {
                    _nodeWeightingJobId?: number;
                    _nodeWeightingLastProgress?: { rowsProcessed?: number; messageKey?: string };
                };
                const running = socketWithRef._nodeWeightingJobId === jobId;
                const lastProgress = running ? socketWithRef._nodeWeightingLastProgress : undefined;
                if (running) {
                    callback(
                        Status.createOk({
                            running: true,
                            rowsProcessed: lastProgress?.rowsProcessed,
                            messageKey: lastProgress?.messageKey
                        })
                    );
                    return;
                }
                try {
                    const job = await ExecutableJob.loadTask(jobId);
                    if (job.attributes.user_id !== userId) {
                        callback(Status.createOk({ running: false, hasWeightsFile: false }));
                        return;
                    }
                    const nodeWeightsPath = path.join(job.getJobFileDirectory(), NODE_WEIGHTS_OUTPUT_FILENAME);
                    const hasWeightsFile = fs.existsSync(nodeWeightsPath);
                    callback(Status.createOk({ running: false, hasWeightsFile }));
                } catch {
                    callback(Status.createOk({ running: false, hasWeightsFile: false }));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_GET_NODE_WEIGHTS_FILE,
            async (jobId: number, callback: (status: Status.Status<{ csv: string; filename: string }>) => void) => {
                try {
                    const result = await getEnrichedNodeWeightsCsv(jobId, userId);
                    callback(Status.createOk(result));
                } catch (error) {
                    console.error('Error getting node weights file', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_UPLOAD_NODE_WEIGHTS,
            async (
                payload: { jobId: number; csvContent: string },
                callback: (status: Status.Status<unknown>) => void
            ) => {
                try {
                    await uploadNodeWeightsFile(payload.jobId, userId, payload.csvContent);
                    callback(Status.createOk(undefined));
                } catch (error) {
                    console.error('Error uploading node weights file', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_GET_LINE_WEIGHTS,
            async (jobId: number, callback: (status: Status.Status<LineWeightsForJobResponse>) => void) => {
                try {
                    const result = await getLineWeightsForJob(jobId, userId, socket);
                    callback(Status.createOk(result));
                } catch (error) {
                    console.error('Error getting line weights for job', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_GET_LINE_SET_SUMMARY_CSV,
            async (jobId: number, callback: (status: Status.Status<{ csv: string; filename: string }>) => void) => {
                try {
                    const result = await getLineSetSummaryCsvForJob(jobId, userId, socket);
                    callback(Status.createOk(result));
                } catch (error) {
                    console.error('Error getting line set summary CSV', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        // --- Standalone node weighting (Nodes section) ---
        socket.on(
            TransitApi.NODE_WEIGHTING_CREATE,
            async (
                parameters: NodeWeightingJobParameters,
                callback: (status: Status.Status<{ jobId: number }>) => void
            ) => {
                try {
                    const job = await createNodeWeightingJob(parameters, userId);
                    callback(Status.createOk({ jobId: job.attributes.id }));
                } catch (error) {
                    console.error('Error creating node weighting job', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.NODE_WEIGHTING_SAVE_CONFIG,
            async (
                payload: { parameters: NodeWeightingJobParameters; existingJobId?: number },
                callback: (status: Status.Status<{ jobId: number }>) => void
            ) => {
                try {
                    const jobId = await saveNodeWeightingConfig(payload.parameters, userId, payload.existingJobId);
                    callback(Status.createOk({ jobId }));
                } catch (error) {
                    console.error('Error saving node weighting config', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.NODE_WEIGHTING_LIST,
            async (
                callback: (
                    status: Status.Status<{ jobs: { id: number; description?: string; hasWeightsFile: boolean }[] }>
                ) => void
            ) => {
                try {
                    const jobs = await listNodeWeightingJobs(userId);
                    callback(Status.createOk({ jobs }));
                } catch (error) {
                    console.error('Error listing node weighting jobs', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.NODE_WEIGHTING_GET_PARAMETERS,
            async (
                jobId: number,
                callback: (
                    status: Status.Status<{
                        parameters: NodeWeightingJobParameters;
                        existingFileNames?: Record<string, string>;
                    }>
                ) => void
            ) => {
                try {
                    const result = await getNodeWeightingJobParameters(jobId, userId);
                    callback(Status.createOk(result));
                } catch (error) {
                    console.error('Error getting node weighting job parameters', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.NODE_WEIGHTING_START,
            async (jobId: number, callback: (status: Status.Status<{ jobId: number }>) => void) => {
                try {
                    const job = await ExecutableJob.loadTask(jobId);
                    if (job.attributes.user_id !== userId) {
                        callback(Status.createError('Not allowed to run node weighting for this job'));
                        return;
                    }
                    if (job.attributes.name !== 'nodeWeighting') {
                        callback(Status.createError('Job is not a node weighting job'));
                        return;
                    }
                    const nodeWeightingJob = job as NodeWeightingJob;
                    const abortController = new AbortController();
                    const pauseController = new NodeWeightingPauseController();

                    const state: RunningNodeWeightingState = {
                        userId: userId!,
                        abortController,
                        pauseController,
                        lastProgress: undefined,
                        socket
                    };
                    runningNodeWeightingJobs.set(jobId, state);

                    await jobsDbQueries.update(jobId, { status: 'inProgress' });

                    try {
                        await StreamingNodeWeightingService.runForNodeWeightingJob(
                            nodeWeightingJob,
                            (progress) => {
                                state.lastProgress = {
                                    rowsProcessed: progress.rowsProcessed,
                                    messageKey: progress.messageKey,
                                    bytesProcessed: progress.bytesProcessed,
                                    totalBytes: progress.totalBytes
                                };
                                state.socket.emit(TransitApi.NODE_WEIGHTING_PROGRESS, { jobId, ...progress });
                            },
                            abortController.signal,
                            pauseController
                        );
                        await jobsDbQueries.update(jobId, { status: 'completed' });
                        state.socket.emit(TransitApi.NODE_WEIGHTING_COMPLETE, { jobId });
                        callback(Status.createOk({ jobId }));
                    } catch (runError) {
                        if (runError instanceof NodeWeightingCancelledError) {
                            await jobsDbQueries.update(jobId, { status: 'cancelled' });
                            state.socket.emit(TransitApi.NODE_WEIGHTING_COMPLETE, { jobId, cancelled: true });
                            callback(Status.createOk({ jobId }));
                        } else {
                            await jobsDbQueries.update(jobId, { status: 'failed' }).catch(() => {
                                /* best effort */
                            });
                            throw runError;
                        }
                    } finally {
                        runningNodeWeightingJobs.delete(jobId);
                    }
                } catch (error) {
                    console.error('Error running node weighting', error);
                    runningNodeWeightingJobs.delete(jobId);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(TransitApi.NODE_WEIGHTING_CANCEL, (jobId: number) => {
            const state = runningNodeWeightingJobs.get(jobId);
            if (state !== undefined && state.userId === userId) {
                state.pauseController.resume();
                state.abortController.abort();
            }
        });

        socket.on(TransitApi.NODE_WEIGHTING_PAUSE, (jobId: number) => {
            const state = runningNodeWeightingJobs.get(jobId);
            if (state !== undefined && state.userId === userId) {
                state.pauseController.pause();
            }
        });

        socket.on(TransitApi.NODE_WEIGHTING_RESUME, (jobId: number) => {
            const state = runningNodeWeightingJobs.get(jobId);
            if (state !== undefined && state.userId === userId) {
                state.pauseController.resume();
            }
        });

        socket.on(
            TransitApi.NODE_WEIGHTING_STATUS,
            async (jobId: number, callback: (status: Status.Status<NodeWeightingStatusResponse>) => void) => {
                const state = runningNodeWeightingJobs.get(jobId);
                if (state !== undefined && state.userId === userId) {
                    // Re-attach: future progress goes to this (possibly new) socket
                    state.socket = socket;
                    callback(
                        Status.createOk({
                            running: true,
                            paused: state.pauseController.paused,
                            rowsProcessed: state.lastProgress?.rowsProcessed,
                            messageKey: state.lastProgress?.messageKey
                        })
                    );
                    return;
                }
                try {
                    const job = await ExecutableJob.loadTask(jobId);
                    if (job.attributes.user_id !== userId) {
                        callback(Status.createOk({ running: false, hasWeightsFile: false }));
                        return;
                    }
                    const nodeWeightsPath = path.join(job.getJobFileDirectory(), NODE_WEIGHTS_OUTPUT_FILENAME);
                    const hasWeightsFile = fs.existsSync(nodeWeightsPath);
                    callback(Status.createOk({ running: false, hasWeightsFile }));
                } catch {
                    callback(Status.createOk({ running: false, hasWeightsFile: false }));
                }
            }
        );

        socket.on(
            TransitApi.NODE_WEIGHTING_GET_FILE,
            async (jobId: number, callback: (status: Status.Status<{ csv: string; filename: string }>) => void) => {
                try {
                    const result = await getEnrichedNodeWeightsCsv(jobId, userId);
                    callback(Status.createOk(result));
                } catch (error) {
                    console.error('Error getting node weights file', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );

        socket.on(
            TransitApi.NODE_WEIGHTING_UPLOAD,
            async (
                payload: { jobId: number; csvContent: string },
                callback: (status: Status.Status<unknown>) => void
            ) => {
                try {
                    await uploadNodeWeightsFile(payload.jobId, userId, payload.csvContent);
                    callback(Status.createOk(undefined));
                } catch (error) {
                    console.error('Error uploading node weights file', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : String(error)));
                }
            }
        );
    }

    socket.on('service.parallelThreadCount', (callback: (response: { count: number }) => void) => {
        callback({
            count: serverConfig.maxParallelCalculators
        });
    });
}
