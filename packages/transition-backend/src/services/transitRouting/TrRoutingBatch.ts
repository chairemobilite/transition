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
import { parseOdTripsFromCsvStream } from '../odTrip/odTripProvider';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';

import resultsDbQueries from '../../models/db/batchRouteResults.db.queries';
import { CheckpointTracker } from '../executableJob/JobCheckpointTracker';
import { resultIsUnimodal } from 'chaire-lib-common/lib/services/routing/RoutingResultUtils';
import { ExecutableJob } from '../executableJob/ExecutableJob';
import { BatchRouteJobType, BatchRouteResultVisitor } from './BatchRoutingJob';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';
import { BatchRouteFileResultVisitor } from './batchRouteCalculation/BatchRouteFileResultVisitor';

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
    job: ExecutableJob<BatchRouteJobType>,
    options: {
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
    }
): Promise<
    TransitBatchCalculationResult & {
        files: { input: string; csv?: string; detailedCsv?: string; geojson?: string };
    }
> => {
    return new TrRoutingBatch(job, options).run();
};

class TrRoutingBatch {
    private odTrips: BaseOdTrip[] = [];
    private errors: ErrorMessage[] = [];

    constructor(
        private job: ExecutableJob<BatchRouteJobType>,
        private options: {
            progressEmitter: EventEmitter;
            isCancelled: () => boolean;
        }
    ) {
        // Nothing else to do
    }

    run = async (): Promise<
        TransitBatchCalculationResult & {
            files: { input: string; csv?: string; detailedCsv?: string; geojson?: string };
        }
    > => {
        const parameters = this.job.attributes.data.parameters.demandAttributes.configuration;
        console.log('TrRoutingService batchRoute Parameters', parameters);

        try {
            // Get the odTrips to calculate
            const odTripData = await this.getOdTrips();
            this.odTrips = odTripData.odTrips;
            this.errors = odTripData.errors;

            const odTripsCount = this.odTrips.length;
            console.log(odTripsCount + ' OdTrips parsed');
            this.options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });

            // Delete any previous result for this job after checkpoint
            await resultsDbQueries.deleteForJob(this.job.id, this.job.attributes.internal_data.checkpoint);

            // Start the trRouting instances for the odTrips
            const [trRoutingInstancesCount, trRoutingPort] = await this.startTrRoutingInstances(odTripsCount);

            // Prepare indexes for calculations and progress report
            const startIndex = this.job.attributes.internal_data.checkpoint || 0;
            let completedRoutingsCount = startIndex;
            // Number of od pairs after which to report progress
            const progressStep = Math.max(1, Math.ceil(this.odTrips.length / 100));

            this.options.progressEmitter.emit('progress', {
                name: 'BatchRouting',
                progress: completedRoutingsCount / odTripsCount
            });

            const promiseQueue = new pQueue({ concurrency: trRoutingInstancesCount });

            const benchmarkStart = performance.now();
            let lastLogTime = performance.now();
            let lastLogCount = startIndex;
            const logOdTripBefore = (index: number) => {
                if ((index + 1) % progressStep === 0) {
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
                this.job.attributes.internal_data.checkpoint
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
            console.log('Batch odTrip routing completed for job %d', this.job.id);
            checkpointTracker.completed();

            this.options.progressEmitter.emit('progress', { name: 'BatchRouting', progress: 1.0 });

            // FIXME Should we return here if the job is cancelled? Or we still
            // generate the results that have been calculated since now? Anyway,
            // on we decouple result handling from the job execution, we could
            // handle results on cancelled jobs also, if we want

            // Handle the result
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 0.0 });
            // FIXME We hardcode the result visitor to file output for now, but we could have other implementations (like calculating statistics, or nothing at all)
            // FIXME2 Also, since we do not have any way of handling the results after the job is done yet, the visitor handler is now part of the job, but later, handling results could be done on completed jobs, and not as part of the job
            const resultVisitor = new BatchRouteFileResultVisitor(this.job);
            const { files } = await this.handlResults(resultVisitor);
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 1.0 });

            const routingResult = {
                calculationName: parameters.calculationName,
                detailed: this.job.attributes.data.parameters.transitRoutingAttributes.detailed,
                completed: true,
                errors: [],
                warnings: this.errors,
                files
            };

            return routingResult;
        } catch (error) {
            if (Array.isArray(error)) {
                console.log('Multiple errors in batch route calculations for job %d', this.job.id);
                return {
                    calculationName: parameters.calculationName,
                    detailed: false,
                    completed: false,
                    errors: error,
                    warnings: [],
                    files: { input: this.job.getInputFileName() }
                };
            } else {
                console.error(`Error in batch routing calculation job ${this.job.id}: ${error}`);
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

    private handlResults = async <TReturnType>(
        resultVisitor: BatchRouteResultVisitor<TReturnType>
    ): Promise<TReturnType> => {
        // Generate the output files
        this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 0.0 });

        try {
            // Log every 1% of the results
            const resultCount = await resultsDbQueries.countResults(this.job.id);
            const logInterval = Math.max(1, Math.ceil(resultCount / 100));
            let currentResultIdx = 0;

            console.log('Generating %d results for job %d...', resultCount, this.job.id);
            const resultStream = resultsDbQueries.streamResults(this.job.id);

            for await (const row of resultStream) {
                currentResultIdx++;
                if (currentResultIdx % logInterval === 0 || currentResultIdx === resultCount) {
                    console.log(
                        'Generating results %d of %d for job %d...',
                        currentResultIdx,
                        resultCount,
                        this.job.id
                    );
                }
                // TODO Try to pipe the result generator and processor directly into this database result stream, to avoid all the awaits
                const result = resultsDbQueries.resultParser(row);
                await resultVisitor.visitTripResult(result.data);
            }
            console.log('Generated results for job %d', this.job.id);

            resultVisitor.end();

            return resultVisitor.getResult();
        } finally {
            this.options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 1.0 });
        }
    };

    private getOdTrips = async (): Promise<{
        odTrips: BaseOdTrip[];
        errors: ErrorMessage[];
    }> => {
        console.log(`importing od trips from CSV file ${this.job.getInputFileName()}`);
        console.log('reading data from csv file...');

        const csvStream = this.job.getReadStream('input');
        const { odTrips, errors } = await parseOdTripsFromCsvStream(
            csvStream,
            this.job.attributes.data.parameters.demandAttributes.configuration
        );

        this.options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });
        return { odTrips, errors };
    };

    // Get the number of parallel calculations to run, it makes sure to not exceed the server's maximum value
    private getParallelCalculationCount = (): number => {
        if (typeof this.job.attributes.data.parameters.transitRoutingAttributes.parallelCalculations === 'number') {
            return Math.min(
                serverConfig.maxParallelCalculators,
                this.job.attributes.data.parameters.transitRoutingAttributes.parallelCalculations
            );
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
                routing: this.job.attributes.data.parameters.transitRoutingAttributes,
                reverseOD: false
            });
            // Delete geometries from unimodal results if they are not requested
            // TODO This should be handled lower in the stack and not make its way here. Need to check how deep the withGeometries flag goes
            if (!this.job.attributes.data.parameters.transitRoutingAttributes.withGeometries && routingResult.results) {
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
                jobId: this.job.id,
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
