/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { EventEmitter } from 'events';
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
    TransitBatchRoutingDemandAttributes,
    TransitDemandFromCsvAccessMapAttributes
} from 'transition-common/lib/services/transitDemand/types';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ExecutableJob } from '../services/executableJob/ExecutableJob';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { BatchRouteJobType } from '../services/transitRouting/BatchRoutingJob';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import TransitOdDemandFromCsv from 'transition-common/lib/services/transitDemand/TransitOdDemandFromCsv';
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
import { TransitNetworkJobConfigurationType } from 'transition-common/lib/services/networkDesign/transit/types';
import { TransitApi } from 'transition-common/lib/api/transit';
import { createAndEnqueueTransitNetworkDesignJob } from '../services/networkDesign/transitNetworkDesign/TransitNetworkJobController';
import { EvolutionaryTransitNetworkDesignJobType } from '../services/networkDesign/transitNetworkDesign/evolutionary/types';

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
                parameters: TransitBatchRoutingDemandAttributes,
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
                    if (parameters.configuration.csvFile.location === 'upload') {
                        inputFiles.input = {
                            filepath: `${directoryManager.userDataDirectory}/${userId}/imports/batchRouting.csv`,
                            renameTo: parameters.configuration.csvFile.filename
                        };
                    } else {
                        const batchRouteJob = await ExecutableJob.loadTask<BatchRouteJobType>(
                            parameters.configuration.csvFile.fromJob
                        );
                        if (batchRouteJob.attributes.name !== 'batchRoute') {
                            throw 'Requested job is not a batchRoute job';
                        }
                        if (batchRouteJob.attributes.user_id !== userId) {
                            throw 'Not allowed to get the input file from job';
                        }
                        inputFiles.input = batchRouteJob.getInputFilePath();
                    }

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
                                demandAttributes: parameters,
                                transitRoutingAttributes: {
                                    ...baseRoutingAttributes,
                                    routingModes: routingModesForCalc
                                }
                            }
                        },
                        inputFiles,
                        hasOutputFiles: true
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
                        demand: TransitBatchRoutingDemandAttributes;
                        csvFields: string[];
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
                    const filePath = batchRouteJob.getInputFilePath();
                    const demand = new TransitOdDemandFromCsv(attributes.demandAttributes.configuration);
                    const csvFileStream = fs.createReadStream(filePath);
                    const csvFields = await demand.setCsvFile(csvFileStream, { location: 'server', fromJob: jobId });
                    callback(
                        Status.createOk({
                            parameters: attributes.transitRoutingAttributes,
                            demand: {
                                type: attributes.demandAttributes.type,
                                configuration: {
                                    ...attributes.demandAttributes.configuration,
                                    csvFile: { location: 'server', fromJob: jobId }
                                }
                            },
                            csvFields
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
                        },
                        hasOutputFiles: true
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
                jobParameters: TransitNetworkJobConfigurationType,
                callback: (status: Status.Status<unknown>) => void
            ) => {
                try {
                    socket.emit('progress', { name: 'NetworkDesign', progress: null });
                    const result = await createAndEnqueueTransitNetworkDesignJob(jobParameters, socket, userId);
                    // TODO Do a quick return with task detail instead of waiting for task to finish
                    callback(Status.createOk(result));
                } catch (error) {
                    console.error('Error creating a new transit network design job', error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : error));
                }
            }
        );

        socket.on(
            TransitApi.TRANSIT_NETWORK_DESIGN_REPLAY,
            async (jobId: number, callback: (status: Status.Status<TransitNetworkJobConfigurationType>) => void) => {
                try {
                    const job = await ExecutableJob.loadTask(jobId);
                    // TODO We only have one job type for transit network design for now, but update when we have more
                    if (job.attributes.name !== 'evolutionaryTransitNetworkDesign') {
                        throw 'Requested job is not an evolutionaryTransitNetworkDesign job';
                    }
                    const transitNetworkJob = job as ExecutableJob<EvolutionaryTransitNetworkDesignJobType>;
                    const attributes = transitNetworkJob.attributes.data.parameters;
                    // FIXME Return the csv fiels as well for the file
                    //const filePath = transitNetworkJob.getInputFilePath();
                    //const csvFileStream = fs.createReadStream(filePath);
                    const csvFields = []; //await demand.setCsvFile(csvFileStream, { location: 'server', fromJob: jobId });
                    callback(
                        Status.createOk({
                            ...attributes,
                            csvFields
                        })
                    );
                } catch (error) {
                    console.error(error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : error));
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
