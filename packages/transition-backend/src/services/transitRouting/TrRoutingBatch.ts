/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import { performance } from 'perf_hooks';
import pQueue from 'p-queue';
import { EventEmitter } from 'events';

import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import routeOdTrip from './TrRoutingOdTrip';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { parseOdTripsFromCsv } from '../odTrip/odTripProvider';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import {
    TransitBatchCalculationResult,
    TransitBatchRoutingDemandAttributes,
    TransitBatchRoutingDemandFromCsvAttributes
} from 'chaire-lib-common/lib/api/TrRouting';
import odPairsDbQueries from '../../models/db/odPairs.db.queries';
import pathDbQueries from '../../models/db/transitPaths.db.queries';
import { getDataSource } from '../dataSources/dataSources';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { BatchRoutingResultProcessor, createRoutingFileResultProcessor } from './TrRoutingBatchResult';

/**
 * Do batch calculation on a csv file input
 *
 * TODO: This was naively copy/pasted from the legacy TrRoutingService class.
 * This function should be split into smaller chunks, with their own
 * responsibility, so this method can have more flexibility and be called with
 * various odTrip sources. Now it handles result stream creation, reading the
 * odTrips from csv and write and notification to caller.
 *
 * @param parameters The parameters for the batch calculation task
 * @param transitRoutingAttributes The transit routing parameters, for
 * individual calculation
 * @param options Options for this calculation: the absoluteBaseDirectory is the
 * directory where the source files are and where the output files should be
 * saved. The progress emitters allows to emit progress data to clients. The
 * isCancelled function is periodically called to see if the task is cancelled.
 * @returns
 */
export const batchRoute = async (
    demandParameters: TransitBatchRoutingDemandAttributes,
    transitRoutingAttributes: BatchCalculationParameters,
    options: {
        absoluteBaseDirectory: string;
        inputFileName: string;
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
    }
): Promise<
    TransitBatchCalculationResult & {
        files: { input: string; csv?: string; detailedCsv?: string; geojson?: string };
    }
> => {
    console.log('TrRoutingService batchRoute Parameters', demandParameters);
    const parameters = demandParameters.configuration;

    console.log(`importing od trips from CSV file ${options.inputFileName}`);
    console.log('reading data from csv file...');
    let files: { input: string; csv?: string; detailedCsv?: string; geojson?: string } = {
        input: options.inputFileName
    };

    try {
        const { odTrips, errors } = await parseOdTripsFromCsv(
            `${options.absoluteBaseDirectory}/${options.inputFileName}`,
            parameters
        );

        const odTripsCount = odTrips.length;
        console.log(odTripsCount + ' OdTrips parsed');
        options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });

        // Divide odTripCount by 3 for the minimum number of calculation, to avoid creating too many processes if trip count is small
        const trRoutingInstancesCount = Math.max(1, Math.min(Math.ceil(odTripsCount / 3), parameters.cpuCount));

        options.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 0.0 });

        // Because of cancellation, we need to make sure processes are stopped before restarting
        // TODO trRouting should be multi-threaded, this will be useless then.
        await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);
        const startStatus = await TrRoutingProcessManager.startMultiple(trRoutingInstancesCount);

        const batchRoutingPromise = async () => {
            console.log('trRouting multiple startStatus', startStatus);

            options.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 1.0 });

            options.progressEmitter.emit('progress', { name: 'BatchRouting', progress: 0.0 });
            // Number of od pairs after which to report progress
            const progressStep = Math.ceil(odTrips.length / 100);

            const routingObject = new TransitRouting(transitRoutingAttributes);
            const { resultHandler, pathCollection } = await prepareResultData(parameters, routingObject, options);
            files = resultHandler.getFiles();

            //let completedOdTripsCount = 0;

            const poolOfTrRoutingPorts = _cloneDeep(
                Object.keys(TrRoutingProcessManager.getAvailablePortsByStartingPort())
            ).map((portStr) => parseInt(portStr));

            let completedRoutingsCount = 0;

            const promiseQueue = new pQueue({ concurrency: poolOfTrRoutingPorts.length });

            // Log progress at most for each 1% progress
            const logInterval = Math.ceil(odTripsCount / 100);
            const odTripTask = async ({ odTrip, odTripIndex }: { odTrip: BaseOdTrip; odTripIndex: number }) => {
                const trRoutingPort = poolOfTrRoutingPorts.pop();
                try {
                    if (trRoutingPort === undefined) {
                        throw 'TrRoutingBatch: No available routing port. This should not happen';
                    }
                    if ((odTripIndex + 1) % logInterval === 0) {
                        console.log(`Routing odTrip ${odTripIndex + 1}/${odTripsCount}`);
                    }

                    const routingResult = await routeOdTrip(odTrip, {
                        trRoutingPort,
                        odTripIndex: odTripIndex,
                        odTripsCount,
                        routing: routingObject,
                        exportCsv: true,
                        exportCsvDetailed: parameters.detailed !== false ? true : false,
                        withGeometries: parameters.withGeometries === true ? true : false,
                        reverseOD: false,
                        pathCollection
                    });
                    if (benchmarkStart >= 0 && odTripIndex > 0 && odTripIndex % 100 === 0) {
                        console.log(
                            'calc/sec',
                            Math.round(
                                (100 * completedRoutingsCount) / ((1 / 1000) * (performance.now() - benchmarkStart))
                            ) / 100
                        );
                    }
                    resultHandler.processResult(routingResult);

                    return routingResult;
                } catch (error) {
                    errors.push({
                        text: 'transit:transitRouting:errors:ErrorCalculatingOdTrip',
                        params: { id: odTrip.attributes.internal_id || String(odTripIndex) }
                    });
                    console.error(`Error getting od trip result ${error}`);
                } finally {
                    completedRoutingsCount++;
                    if (completedRoutingsCount % progressStep === 0) {
                        options.progressEmitter.emit('progress', {
                            name: 'BatchRouting',
                            progress: completedRoutingsCount / odTripsCount
                        });
                    }
                    if (trRoutingPort !== undefined) {
                        poolOfTrRoutingPorts.push(trRoutingPort);
                    }
                }
            };

            const benchmarkStart = performance.now();
            for (let odTripIndex = 0; odTripIndex < odTripsCount; odTripIndex++) {
                promiseQueue.add(async () => {
                    // Assert the job is not cancelled, otherwise clear the queue and let the job exit
                    if (options.isCancelled()) {
                        promiseQueue.clear();
                    }
                    await odTripTask({
                        odTripIndex,
                        odTrip: odTrips[odTripIndex]
                    });
                });
            }

            await promiseQueue.onIdle();

            resultHandler.end();

            options.progressEmitter.emit('progress', { name: 'BatchRouting', progress: 1.0 });
            options.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 0.0 });

            const stopStatus = await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);

            options.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 1.0 });
            console.log('trRouting multiple stopStatus', stopStatus);

            return {
                calculationName: parameters.calculationName,
                detailed: parameters.detailed,
                completed: true,
                errors: [],
                warnings: errors,
                files: resultHandler.getFiles()
            };
        };

        const routingResult = await batchRoutingPromise();

        if (parameters.saveToDb !== false) {
            console.log('Saving OD pairs to database...');
            try {
                await saveOdPairs(odTrips, parameters.saveToDb);
            } catch (error) {
                console.error(
                    `Error saving od pairs to database: ${
                        TrError.isTrError(error) ? JSON.stringify(error.export()) : JSON.stringify(error)
                    }`
                );
                const localizedMessage = TrError.isTrError(error) ? error.export().localizedMessage : '';
                routingResult.warnings.push(
                    localizedMessage !== '' ? localizedMessage : 'transit:transitRouting:errors:ErrorSavingOdTripsToDb'
                );
            }
            console.log('Saved OD pairs to database...');
        }

        return routingResult;
    } catch (error) {
        if (Array.isArray(error)) {
            return {
                calculationName: parameters.calculationName,
                detailed: false,
                completed: false,
                errors: error,
                warnings: [],
                files
            };
        } else {
            console.error(`Error in batch routing calculation: ${error}`);
            throw error;
        }
    }
};

export const saveOdPairs = async (
    odTrips: BaseOdTrip[],
    saveOptions: { type: 'new'; dataSourceName: string } | { type: 'overwrite'; dataSourceId: string }
) => {
    const dataSource =
        saveOptions.type === 'new'
            ? await getDataSource({ isNew: true, dataSourceName: saveOptions.dataSourceName, type: 'odTrips' })
            : await getDataSource({ isNew: false, dataSourceId: saveOptions.dataSourceId });
    await odPairsDbQueries.deleteForDataSourceId(dataSource.getId());
    await odPairsDbQueries.createMultiple(
        odTrips.map((odTrip) => {
            odTrip.attributes.dataSourceId = dataSource.getId();
            return odTrip.attributes;
        })
    );
};

const prepareResultData = async (
    parameters: TransitBatchRoutingDemandFromCsvAttributes,
    routing: TransitRouting,
    options: {
        absoluteBaseDirectory: string;
        inputFileName: string;
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
    }
): Promise<{
    resultHandler: BatchRoutingResultProcessor;
    pathCollection?: PathCollection;
}> => {
    const resultHandler = createRoutingFileResultProcessor(
        options.absoluteBaseDirectory,
        parameters,
        routing,
        options.inputFileName
    );

    let pathCollection: PathCollection | undefined = undefined;
    if (parameters.withGeometries) {
        pathCollection = new PathCollection([], {});
        if (routing.attributes.scenarioId) {
            const pathGeojson = await pathDbQueries.geojsonCollection({
                scenarioId: routing.attributes.scenarioId
            });
            pathCollection.loadFromCollection(pathGeojson.features);
        }
    }

    return { resultHandler, pathCollection };
};
