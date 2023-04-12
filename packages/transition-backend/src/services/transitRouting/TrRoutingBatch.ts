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
import TransitRouting from 'transition-common/lib/services/transitRouting/TransitRouting';
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
import { getDataSource } from '../dataSources/dataSources';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import {
    BatchRoutingResultProcessor,
    createRoutingFileResultProcessor,
    generateFileOutputResults
} from './TrRoutingBatchResult';
import TrError, { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { CheckpointTracker } from '../executableJob/JobCheckpointTracker';

const CHECKPOINT_INTERVAL = 250;

/**
 * Do batch calculation on a csv file input
 *
 * @param demandParameters The parameters for the batch calculation task
 * @param transitRoutingAttributes The transit routing parameters, for
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
    transitRoutingAttributes: BatchCalculationParameters,
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
    return new TrRoutingBatch(demandParameters.configuration, transitRoutingAttributes, options).run();
};

class TrRoutingBatch {
    private odTrips: BaseOdTrip[] = [];
    private errors: ErrorMessage[] = [];
    private pathCollection: PathCollection | undefined = undefined;

    constructor(
        private demandParameters: TransitDemandFromCsvRoutingAttributes,
        private transitRoutingAttributes: BatchCalculationParameters,
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
            const trRoutingInstancesCount = await this.startTrRoutingInstances(odTripsCount);

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
            const routingModes = this.transitRoutingAttributes.routingModes;
            if (routingModes.includes('transit') && !routingModes.includes('walking')) {
                routingModes.push('walking');
            }
            this.transitRoutingAttributes.routingModes = routingModes;
            const routingObject = new TransitRouting(this.transitRoutingAttributes);

            const poolOfTrRoutingPorts = _cloneDeep(
                Object.keys(TrRoutingProcessManager.getAvailablePortsByStartingPort())
            ).map((portStr) => parseInt(portStr));

            const promiseQueue = new pQueue({ concurrency: poolOfTrRoutingPorts.length });

            // Log progress at most for each 1% progress
            const logInterval = Math.ceil(odTripsCount / 100);
            const benchmarkStart = performance.now();
            const logOdTripBefore = (index: number) => {
                if ((index + 1) % logInterval === 0) {
                    console.log(`Routing odTrip ${index + 1}/${odTripsCount}`);
                }
            };
            const logOdTripAfter = (index: number) => {
                if (benchmarkStart >= 0 && index > 0 && index % 100 === 0) {
                    console.log(
                        'calc/sec',
                        Math.round(
                            (100 * completedRoutingsCount) / ((1 / 1000) * (performance.now() - benchmarkStart))
                        ) / 100
                    );
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
                    const trRoutingPort = poolOfTrRoutingPorts.pop() as number;
                    try {
                        await this.odTripTask(odTripIndex, routingObject, {
                            trRoutingPort,
                            logBefore: logOdTripBefore,
                            logAfter: logOdTripAfter
                        });
                    } finally {
                        completedRoutingsCount++;
                        if (completedRoutingsCount % progressStep === 0) {
                            this.options.progressEmitter.emit('progress', {
                                name: 'BatchRouting',
                                progress: completedRoutingsCount / odTripsCount
                            });
                        }
                        if (trRoutingPort !== undefined) {
                            poolOfTrRoutingPorts.push(trRoutingPort);
                        }
                        checkpointTracker.handled(odTripIndex);
                    }
                });
            }

            await promiseQueue.onIdle();
            checkpointTracker.completed();

            this.options.progressEmitter.emit('progress', { name: 'BatchRouting', progress: 1.0 });
            this.options.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 0.0 });

            const stopStatus = await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);

            this.options.progressEmitter.emit('progress', { name: 'StoppingRoutingParallelServers', progress: 1.0 });
            console.log('trRouting multiple stopStatus', stopStatus);

            // Generate the output files
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 0.0 });
            const files = await this.generateResultFiles(routingObject);
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 1.0 });

            const routingResult = {
                calculationName: parameters.calculationName,
                detailed: this.transitRoutingAttributes.detailed,
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
                return {
                    calculationName: parameters.calculationName,
                    detailed: false,
                    completed: false,
                    errors: error,
                    warnings: [],
                    files: { input: this.options.inputFileName }
                };
            } else {
                console.error(`Error in batch routing calculation: ${error}`);
                throw error;
            }
        }
    };

    private generateResultFiles = async (
        routing: TransitRouting
    ): Promise<{ input: string; csv?: string; detailedCsv?: string; geojson?: string }> => {
        const { resultHandler, pathCollection } = await this.prepareResultData(routing);

        let currentResultPage = 0;
        let totalCount = 0;
        const pageSize = 250;
        do {
            const { totalCount: total, tripResults } = await resultsDbQueries.collection(this.options.jobId, {
                pageIndex: currentResultPage,
                pageSize
            });
            totalCount = total;
            for (let i = 0; i < tripResults.length; i++) {
                const processedResults = await generateFileOutputResults(
                    tripResults[i].data,
                    routing.attributes.routingModes,
                    {
                        exportCsv: true,
                        exportDetailed: this.transitRoutingAttributes.detailed === true,
                        withGeometries: this.transitRoutingAttributes.withGeometries === true,
                        pathCollection
                    }
                );
                resultHandler.processResult(processedResults);
            }
            currentResultPage++;
        } while (Math.ceil(totalCount / pageSize) > currentResultPage);
        resultHandler.end();

        // FIXME Results are kept in the database instead of being deleted
        // because if the server is restarted after the results are deleted but
        // before the job is marked as completed, all calculations will be lost.
        // The results will be automatically deleted when the job is deleted
        // from the interface though.
        return resultHandler.getFiles();
    };

    private prepareResultData = async (
        routing: TransitRouting
    ): Promise<{ resultHandler: BatchRoutingResultProcessor; pathCollection?: PathCollection }> => {
        const resultHandler = createRoutingFileResultProcessor(
            this.options.absoluteBaseDirectory,
            this.demandParameters,
            this.transitRoutingAttributes,
            this.options.inputFileName
        );

        let pathCollection: PathCollection | undefined = undefined;
        if (this.transitRoutingAttributes.withGeometries) {
            pathCollection = new PathCollection([], {});
            if (routing.attributes.scenarioId) {
                const pathGeojson = await pathDbQueries.geojsonCollection({
                    scenarioId: routing.attributes.scenarioId
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

    private startTrRoutingInstances = async (odTripsCount: number): Promise<number> => {
        // Divide odTripCount by 3 for the minimum number of calculation, to avoid creating too many processes if trip count is small
        const trRoutingInstancesCount = Math.max(
            1,
            Math.min(Math.ceil(odTripsCount / 3), this.transitRoutingAttributes.cpuCount || 1)
        );

        try {
            this.options.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 0.0 });

            // Because of cancellation, we need to make sure processes are stopped before restarting
            // TODO trRouting should be multi-threaded, this will be useless then.
            await TrRoutingProcessManager.stopMultiple(trRoutingInstancesCount);
            const startStatus = await TrRoutingProcessManager.startMultiple(trRoutingInstancesCount);

            console.log('trRouting multiple startStatus', startStatus);
        } finally {
            this.options.progressEmitter.emit('progress', { name: 'StartingRoutingParallelServers', progress: 1.0 });
        }
        return trRoutingInstancesCount;
    };

    private odTripTask = async (
        odTripIndex: number,
        routingObject: TransitRouting,
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

            const routingResult = await routeOdTrip(odTrip, {
                trRoutingPort: options.trRoutingPort,
                odTripIndex: odTripIndex,
                odTripsCount: this.odTrips.length,
                routing: routingObject,
                reverseOD: false,
                pathCollection: this.pathCollection
            });
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
            console.error(`Error getting od trip result ${error}`);
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
