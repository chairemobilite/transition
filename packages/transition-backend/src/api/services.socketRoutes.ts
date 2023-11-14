/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import os from 'os';
import fs from 'fs';
import { EventEmitter } from 'events';
import osrm from 'osrm';

import { isSocketIo } from './socketUtils';
import serverConfig from 'chaire-lib-backend/lib/config/server.config';
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import trRoutingService from 'chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend';
import osrmProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import osrmService from 'chaire-lib-backend/lib/utils/osrm/OSRMService';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { TrRoutingConstants } from 'chaire-lib-common/lib/api/TrRouting';
import { transitionRouteOptions, transitionMatchOptions } from 'chaire-lib-common/lib/api/OSRMRouting';
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
        async (parameters: transitionRouteOptions, callback: (status: Status.Status<osrm.RouteResults>) => void) => {
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
        async (parameters: transitionMatchOptions, callback: (status: unknown) => void) => {
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

    socket.on(TrRoutingConstants.UPDATE_CACHE, (parameters, callback) => {
        trRoutingService
            .updateCache(
                parameters,
                parameters.host || 'http://localhost',
                parameters.port || Preferences.get('trRouting.port')
            )
            .then((response) => {
                callback(response);
            })
            .catch((error) => {
                console.error(error);
                callback({
                    status: 'error',
                    error
                });
            });
    });

    socket.on(TrRoutingConstants.ROUTE, async ({ parameters, hostPort }, callback) => {
        try {
            const routingResults = await trRoutingService.route(parameters, hostPort);
            callback(Status.createOk(routingResults));
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.message : error));
        }
    });

    socket.on(TrRoutingConstants.ACCESSIBILITY_MAP, async ({ parameters, hostPort }, callback) => {
        try {
            const routingResults = await trRoutingService.accessibilityMap(parameters, hostPort);
            callback(Status.createOk(routingResults));
        } catch (error) {
            console.error(error);
            callback(Status.createError(TrError.isTrError(error) ? error.message : error));
        }
    });

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
                        const filePath = batchRouteJob.getFilePath('input');
                        if (filePath === undefined) {
                            throw 'InputFileNotAvailable';
                        }
                        inputFiles.input = filePath;
                    }

                    // TODO Handle the input file and add it to the task
                    const job: ExecutableJob<BatchRouteJobType> = await ExecutableJob.createJob({
                        user_id: userId,
                        name: 'batchRoute',
                        data: {
                            parameters: {
                                demandAttributes: parameters,
                                transitRoutingAttributes
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
                    const filePath = batchRouteJob.getFilePath('input');
                    if (filePath === undefined) {
                        throw 'InputFileUnavailable';
                    }
                    const demand = new TransitOdDemandFromCsv(attributes.demandAttributes.configuration);
                    // Make sure saving to db is set to false, as it was already imported if so
                    demand.attributes.saveToDb = false;
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
    }

    socket.on('service.parallelThreadCount', (callback: (response: { count: number }) => void) => {
        callback({
            count: serverConfig.maxParallelCalculators || os.cpus().length
        });
    });
}
