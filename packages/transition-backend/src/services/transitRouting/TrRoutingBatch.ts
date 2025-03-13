/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { performance } from 'perf_hooks';
import pQueue from 'p-queue';
import { EventEmitter } from 'events';

import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import serverConfig from 'chaire-lib-backend/lib/config/server.config';
import routeOdTrip from './TrRoutingOdTrip';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { parseOdTripsFromCsv } from '../odTrip/odTripProvider';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import {
    TransitBatchRoutingDemandAttributes,
    TransitDemandFromCsvRoutingAttributes
} from 'transition-common/lib/services/transitDemand/types';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';
import odPairsDbQueries from '../../models/db/odPairs.db.queries';
import pathDbQueries from '../../models/db/transitPaths.db.queries';
import resultsDbQueries from '../../models/db/batchRouteResults.db.queries';
import { getDataSource } from 'chaire-lib-backend/lib/services/dataSources/dataSources';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import {
    BatchRoutingResultProcessor,
    createRoutingFileResultProcessor,
    generateFileOutputResults
} from './TrRoutingBatchResult';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { CheckpointTracker } from '../executableJob/JobCheckpointTracker';
import { resultIsUnimodal } from 'chaire-lib-common/lib/services/routing/RoutingResultUtils';

const CHECKPOINT_INTERVAL = 250;

/**
 * Do batch calculation on a csv file input
 *
 * @param demandParameters The parameters for the batch calculation task
 * @param batchRoutingQueryAttributes The transit routing parameters, for
 * individual calculation
 * @param options Options for this calculation: the absoluteBaseDirectory is the
 * directory where the source files are and where the output files should be
 * saved. The progress emitters allows to emit progress data to clients. The
 * isCancelled function is periodically called to see if the task is cancelled.
 * The currentCheckpoint, if specified, is the last checkpoint that was
 * registered for this task. In batch routing, it represents the number of
 * completed od trips routed.
 * @returns
 */
export const batchRoute = async (
    demandParameters: TransitBatchRoutingDemandAttributes,
    batchRoutingQueryAttributes: BatchCalculationParameters,
    options: {
        jobId: number;
        absoluteBaseDirectory: string;
        inputFileName: string;
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
        currentCheckpoint?: number;
    }
): Promise<
    TransitBatchCalculationResult & {
        files: { input: string; csv?: string; detailedCsv?: string; geojson?: string };
    }
> => {
    return new TrRoutingBatch(demandParameters.configuration, batchRoutingQueryAttributes, options).run();
};

class TrRoutingBatch {
    private odTrips: BaseOdTrip[] = [];
    private errors: ErrorMessage[] = [];
    private pathCollection: PathCollection | undefined = undefined;

    constructor(
        private demandParameters: TransitDemandFromCsvRoutingAttributes,
        private batchRoutingQueryAttributes: BatchCalculationParameters,
        private options: {
            jobId: number;
            absoluteBaseDirectory: string;
            inputFileName: string;
            progressEmitter: EventEmitter;
            isCancelled: () => boolean;
            currentCheckpoint?: number;
        }
    ) {
        // Nothing else to do
    }

    run = async (): Promise<
        TransitBatchCalculationResult & {
            files: { input: string; csv?: string; detailedCsv?: string; geojson?: string };
        }
    > => {
        console.log('TrRoutingService batchRoute Parameters', this.demandParameters);
        const parameters = this.demandParameters;

        try {
            // Get the odTrips to calculate
            const odTripData = await this.getOdTrips();
            this.odTrips = odTripData.odTrips;
            this.errors = odTripData.errors;

            const odTripsCount = this.odTrips.length;
            console.log(odTripsCount + ' OdTrips parsed');
            this.options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });

            // Delete any previous result for this job after checkpoint
            await resultsDbQueries.deleteForJob(this.options.jobId, this.options.currentCheckpoint);

            // Start the trRouting instances for the odTrips
            const [trRoutingInstancesCount, trRoutingPort] = await this.startTrRoutingInstances(odTripsCount);

            // Prepare indexes for calculations and progress report
            const startIndex = this.options.currentCheckpoint || 0;
            let completedRoutingsCount = startIndex;
            // Number of od pairs after which to report progress
            const progressStep = Math.ceil(this.odTrips.length / 100);

            this.options.progressEmitter.emit('progress', {
                name: 'BatchRouting',
                progress: completedRoutingsCount / odTripsCount
            });

            // force add walking when selecting transit mode, so we can check if walking is better
            const routingModes = this.batchRoutingQueryAttributes.routingModes;
            if (routingModes.includes('transit') && !routingModes.includes('walking')) {
                routingModes.push('walking');
            }
            this.batchRoutingQueryAttributes.routingModes = routingModes;

            // TODO: This is a test
            // When we do not calculate alternatives, we are not saturating all the code that we have available.
            // Let's test having twice the concurrency in the queue if we do not ask for alternatives
            const desiredConcurrency = this.batchRoutingQueryAttributes.withAlternatives
                ? trRoutingInstancesCount
                : trRoutingInstancesCount * 2;
            const promiseQueue = new pQueue({ concurrency: desiredConcurrency });

            // Log progress at most for each 1% progress
            const logInterval = Math.ceil(odTripsCount / 100);
            const benchmarkStart = performance.now();
            let lastLogTime = performance.now();
            let lastLogCount = startIndex;
            const logOdTripBefore = (index: number) => {
                if ((index + 1) % logInterval === 0) {
                    console.log(`Routing odTrip ${index + 1}/${odTripsCount}`);
                }
            };
            const logOdTripAfter = (index: number) => {
                if (benchmarkStart >= 0 && index > 0 && index % 100 === 0) {
                    // Log the calculation speed every 100 calculations. Divide the number of completed calculation (substract startIndex if the task was resumed) by the time taken in seconds. Round to 2 decimals
                    // TODO: Check if we could do all this magic with some function in the performance class
                    const now = performance.now(); // Save now() to not have to call multiple time
                    // Calculate rate since the last logged line
                    const currentRate =
                        Math.round((100 * (completedRoutingsCount - lastLogCount)) / ((now - lastLogTime) / 1000)) /
                        100;
                    lastLogTime = now;
                    lastLogCount = completedRoutingsCount;

                    // Calculate rate since the beginning
                    const globalRate =
                        Math.round((100 * (completedRoutingsCount - startIndex)) / ((now - benchmarkStart) / 1000)) /
                        100;
                    console.log(`calc/sec: ${globalRate} (current: ${currentRate})`);
                }
            };
            const checkpointTracker = new CheckpointTracker(
                CHECKPOINT_INTERVAL,
                this.options.progressEmitter,
                this.options.currentCheckpoint
            );
            for (let odTripIndex = startIndex; odTripIndex < odTripsCount; odTripIndex++) {
                promiseQueue.add(async () => {
                    // Assert the job is not cancelled, otherwise clear the queue and let the job exit
                    if (this.options.isCancelled()) {
                        promiseQueue.clear();
                    }
                    try {
                        console.log('tripRouting: Start handling batch routing odTrip %d', odTripIndex);
                        await this.odTripTask(odTripIndex, {
                            trRoutingPort,
                            logBefore: logOdTripBefore,
                            logAfter: logOdTripAfter
                        });
                    } finally {
                        try {
                            completedRoutingsCount++;
                            if (completedRoutingsCount % progressStep === 0) {
                                this.options.progressEmitter.emit('progress', {
                                    name: 'BatchRouting',
                                    progress: completedRoutingsCount / odTripsCount
                                });
                            }
                            console.log('tripRouting: Handled batch routing odTrip %d', odTripIndex);
                            checkpointTracker.handled(odTripIndex);
                        } catch (error) {
                            console.error(
                                `tripRouting: Error completing od trip handling. The checkpoint will be missed: ${odTripIndex}: ${error}`
                            );
                        }
                    }
                });
            }

            await promiseQueue.onIdle();
            console.log('Batch odTrip routing completed for job %d', this.options.jobId);
            checkpointTracker.completed();

            this.options.progressEmitter.emit('progress', { name: 'BatchRouting', progress: 1.0 });

            // FIXME Should we return here if the job is cancelled? Or we still
            // generate the results that have been calculated since now?

            // Generate the output files
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 0.0 });
            const files = await this.generateResultFiles();
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 1.0 });

            const routingResult = {
                calculationName: parameters.calculationName,
                detailed: this.batchRoutingQueryAttributes.detailed,
                completed: true,
                errors: [],
                warnings: this.errors,
                files
            };

            // FIXME Saving to DB should be done in a separate workflow. See #583
            if (parameters.saveToDb !== false) {
                console.log('Saving OD pairs to database...');
                try {
                    await saveOdPairs(this.odTrips, parameters.saveToDb);
                } catch (error) {
                    console.error(
                        `Error saving od pairs to database: ${
                            TrError.isTrError(error) ? JSON.stringify(error.export()) : JSON.stringify(error)
                        }`
                    );
                    const localizedMessage = TrError.isTrError(error) ? error.export().localizedMessage : '';
                    routingResult.warnings.push(
                        localizedMessage !== ''
                            ? localizedMessage
                            : 'transit:transitRouting:errors:ErrorSavingOdTripsToDb'
                    );
                }
                console.log('Saved OD pairs to database...');
            }

            return routingResult;
        } catch (error) {
            if (Array.isArray(error)) {
                console.log('Multiple errors in batch route calculations for job %d', this.options.jobId);
                return {
                    calculationName: parameters.calculationName,
                    detailed: false,
                    completed: false,
                    errors: error,
                    warnings: [],
                    files: { input: this.options.inputFileName }
                };
            } else {
                console.error(`Error in batch routing calculation job ${this.options.jobId}: ${error}`);
                throw error;
            }
        } finally {
            // Make sure to stop the trRouting processes, even if an error occurred
            this.options.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 0.0 });

            const stopStatus = await TrRoutingProcessManager.stopBatch();

            this.options.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 1.0 });
            console.log('trRouting multiple stopStatus', stopStatus);
        }
    };

    private generateResultFiles = async (): Promise<{
        input: string;
        csv?: string;
        detailedCsv?: string;
        geojson?: string;
    }> => {
        console.log('Preparing result files for job %d...', this.options.jobId);
        const { resultHandler, pathCollection } = await this.prepareResultData();
        console.log('Prepared result files for job %d', this.options.jobId);

        // Log every 1% of the results
        const resultCount = await resultsDbQueries.countResults(this.options.jobId);
        const logInterval = Math.ceil(resultCount / 100);
        let currentResultIdx = 0;

        console.log('Generating %d results for job %d...', resultCount, this.options.jobId);
        const resultStream = resultsDbQueries.streamResults(this.options.jobId);

        for await (const row of resultStream) {
            currentResultIdx++;
            if (currentResultIdx % logInterval === 0 || currentResultIdx === resultCount) {
                console.log(
                    'Generating results %d of %d for job %d...',
                    currentResultIdx,
                    resultCount,
                    this.options.jobId
                );
            }
            // TODO Try to pipe the result generator and processor directly into this database result stream, to avoid all the awaits
            const result = resultsDbQueries.resultParser(row);
            const processedResults = await generateFileOutputResults(
                result.data,
                this.batchRoutingQueryAttributes.routingModes,
                {
                    exportCsv: true,
                    exportDetailed: this.batchRoutingQueryAttributes.detailed === true,
                    withGeometries: this.batchRoutingQueryAttributes.withGeometries === true,
                    pathCollection
                }
            );
            resultHandler.processResult(processedResults);
        }
        console.log('Generated results for job %d', this.options.jobId);

        resultHandler.end();
        return resultHandler.getFiles();
    };

    private prepareResultData = async (): Promise<{
        resultHandler: BatchRoutingResultProcessor;
        pathCollection?: PathCollection;
    }> => {
        const resultHandler = createRoutingFileResultProcessor(
            this.options.absoluteBaseDirectory,
            this.demandParameters,
            this.batchRoutingQueryAttributes,
            this.options.inputFileName
        );

        let pathCollection: PathCollection | undefined = undefined;
        if (this.batchRoutingQueryAttributes.withGeometries) {
            pathCollection = new PathCollection([], {});
            if (this.batchRoutingQueryAttributes.scenarioId) {
                const pathGeojson = await pathDbQueries.geojsonCollection({
                    scenarioId: this.batchRoutingQueryAttributes.scenarioId
                });
                pathCollection.loadFromCollection(pathGeojson.features);
            }
            this.pathCollection = pathCollection;
        }
        return { resultHandler, pathCollection };
    };

    private getOdTrips = async (): Promise<{
        odTrips: BaseOdTrip[];
        errors: ErrorMessage[];
    }> => {
        console.log(`importing od trips from CSV file ${this.options.inputFileName}`);
        console.log('reading data from csv file...');

        const { odTrips, errors } = await parseOdTripsFromCsv(
            `${this.options.absoluteBaseDirectory}/${this.options.inputFileName}`,
            this.demandParameters
        );

        const odTripsCount = odTrips.length;
        console.log(odTripsCount + ' OdTrips parsed');
        this.options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });
        return { odTrips, errors };
    };

    // Get the number of parallel calculations to run, it makes sure to not exceed the server's maximum value
    private getParallelCalculationCount = (): number => {
        if (typeof this.batchRoutingQueryAttributes.parallelCalculations === 'number') {
            return Math.min(serverConfig.maxParallelCalculators, this.batchRoutingQueryAttributes.parallelCalculations);
        } else {
            return serverConfig.maxParallelCalculators;
        }
    };

    private startTrRoutingInstances = async (odTripsCount: number): Promise<[number, number]> => {
        // Divide odTripCount by 3 for the minimum number of calculation, to avoid creating too many processes if trip count is small
        const trRoutingInstancesCount = Math.max(
            1,
            Math.min(Math.ceil(odTripsCount / 3), this.getParallelCalculationCount())
        );
        try {
            this.options.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 0.0 });

            // Because of cancellation, we need to make sure processes are stopped before restarting
            await TrRoutingProcessManager.stopBatch();
            // TODO Instead of handling port number everywhere, this (or a wrapper), should return
            // and instance which represent the TrRouting instance, like the OSRMMode for OSRM
            const startStatus = await TrRoutingProcessManager.startBatch(trRoutingInstancesCount);
            const trRoutingPort = startStatus.port;
            console.log('trRouting multiple startStatus', startStatus);
            // We can return in here directly since we don't have a catch part
            return [trRoutingInstancesCount, trRoutingPort];
        } finally {
            this.options.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 1.0 });
        }
    };

    private odTripTask = async (
        odTripIndex: number,
        options: {
            trRoutingPort?: number;
            logBefore: (index: number) => void;
            logAfter: (index: number) => void;
        }
    ) => {
        const odTrip = this.odTrips[odTripIndex];
        try {
            if (options.trRoutingPort === undefined) {
                throw 'TrRoutingBatch: No available routing port. This should not happen';
            }
            options.logBefore(odTripIndex);

            const origDestStr = `${odTrip.attributes.origin_geography.coordinates.join(',')} to ${odTrip.attributes.destination_geography.coordinates.join(',')}`;
            console.log('tripRouting: Routing odTrip %d with coordinates %s', odTripIndex, origDestStr);
            const routingResult = await routeOdTrip(odTrip, {
                trRoutingPort: options.trRoutingPort,
                odTripIndex: odTripIndex,
                odTripsCount: this.odTrips.length,
                routing: this.batchRoutingQueryAttributes,
                reverseOD: false,
                pathCollection: this.pathCollection
            });
            // Delete geometries from unimodal results if they are not requested
            if (!this.batchRoutingQueryAttributes.withGeometries && routingResult.results) {
                const resultsByMode = routingResult.results;
                Object.keys(resultsByMode).forEach((mode) => {
                    if (resultIsUnimodal(resultsByMode[mode]) && resultsByMode[mode].paths) {
                        resultsByMode[mode].paths!.forEach((path) => {
                            delete path.geometry;
                        });
                    }
                });
            }
            // FIXME Do not synchronously wait for the save (~10% time overhead). When we have checkpoint support, we can do .then/catch to handle completion instead
            await resultsDbQueries.create({
                jobId: this.options.jobId,
                tripIndex: odTripIndex,
                data: routingResult
            });
            options.logAfter(odTripIndex);

            return routingResult;
        } catch (error) {
            this.errors.push({
                text: 'transit:transitRouting:errors:ErrorCalculatingOdTrip',
                params: { id: odTrip.attributes.internal_id || String(odTripIndex) }
            });
            console.error(`Error getting od trip result for ${odTripIndex}: ${error}`);
        }
    };
}

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
