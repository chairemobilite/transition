/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { performance } from 'perf_hooks';
import pQueue from 'p-queue';
import { EventEmitter } from 'events';

import { TrRoutingBatchManager } from './TrRoutingBatchManager';
import routeOdTrip from './TrRoutingOdTrip';
import { parseOdTripsFromCsvStream } from '../odTrip/odTripProvider';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitBatchCalculationResult } from 'transition-common/lib/services/batchCalculation/types';

import resultsDbQueries from '../../models/db/batchRouteResults.db.queries';
import { CheckpointTracker } from '../executableJob/JobCheckpointTracker';
import { resultIsUnimodal } from 'chaire-lib-common/lib/services/routing/RoutingResultUtils';
import { ExecutableJob } from '../executableJob/ExecutableJob';
import { BatchRouteJobType, BatchRouteResultVisitor } from './BatchRoutingJob';
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import { BatchRouteFileResultVisitor } from './batchRouteCalculation/BatchRouteFileResultVisitor';

const CHECKPOINT_INTERVAL = 250;

/**
 * Do batch calculation on a csv file input. This function wraps the execution,
 * as well as result files generation. For other result handling, directly use
 * TrRoutingBatchExecutor to execute then handle the results.
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
    const batchRoutingExecutor = new TrRoutingBatchExecutor(job, options);
    const execResults = await batchRoutingExecutor.run();
    if (execResults.completed === true) {
        // Handle the result
        // TODO Consider passing the progress emitter to the result visitor instead for finer grained progress reporting
        options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 0.0 });
        // FIXME We hardcode the result visitor to file output for now, but we could have other implementations (like calculating statistics, or nothing at all)
        // FIXME2 Also, since we do not have any way of handling the results after the job is done yet, the visitor handler is now part of the job, but later, handling results could be done on completed jobs, and not as part of the job
        const resultVisitor = new BatchRouteFileResultVisitor(job);
        const { files } = await batchRoutingExecutor.handleResults(resultVisitor);
        options.progressEmitter.emit('progress', { name: 'GeneratingBatchRoutingResults', progress: 1.0 });

        const routingResult = {
            ...execResults,
            files
        };
        return routingResult;
    } else {
        return {
            ...execResults,
            files: { input: job.getInputFileName() }
        };
    }
};

/**
 * Class to actually execute a batch routing job.
 */
export class TrRoutingBatchExecutor {
    private odTrips: BaseOdTrip[] = [];
    private errors: TranslatableMessage[] = [];
    private batchManager: TrRoutingBatchManager;

    constructor(
        private job: ExecutableJob<BatchRouteJobType>,
        private options: {
            progressEmitter: EventEmitter;
            isCancelled: () => boolean;
        }
    ) {
        this.batchManager = new TrRoutingBatchManager(options.progressEmitter);
    }

    run = async (): Promise<TransitBatchCalculationResult> => {
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

            // Start the trRouting instance for the odTrips
            const { threadCount: trRoutingThreadsCount, port: trRoutingPort } = await this.batchManager.startBatch(
                odTripsCount,
                this.job.attributes.data.parameters.trRoutingJobParameters
            );

            // Prepare indexes for calculations and progress report
            const startIndex = this.job.attributes.internal_data.checkpoint || 0;
            let completedRoutingsCount = startIndex;
            // Number of od pairs after which to report progress
            const progressStep = Math.max(1, Math.ceil(this.odTrips.length / 100));

            this.options.progressEmitter.emit('progress', {
                name: 'BatchRouting',
                progress: completedRoutingsCount / odTripsCount
            });

            const promiseQueue = new pQueue({ concurrency: trRoutingThreadsCount });

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

            return {
                completed: true,
                detailed: false,
                errors: [],
                warnings: this.errors
            };
        } catch (error) {
            if (Array.isArray(error)) {
                console.log('Multiple errors in batch route calculations for job %d', this.job.id);
                return {
                    detailed: false,
                    completed: false,
                    errors: error,
                    warnings: []
                };
            } else {
                console.error(`Error in batch routing calculation job ${this.job.id}: ${error}`);
                throw error;
            }
        } finally {
            // Make sure to stop the trRouting processes, even if an error occurred
            await this.batchManager.stopBatch();
        }
    };

    handleResults = async <TReturnType>(resultVisitor: BatchRouteResultVisitor<TReturnType>): Promise<TReturnType> => {
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
        errors: TranslatableMessage[];
    }> => {
        console.log(`importing od trips from CSV file ${this.job.getInputFileName()}`);
        console.log('reading data from csv file...');

        const csvStream = this.job.getReadStream('input');
        // Cast mapping to OdTripCsvMapping, as the demand has been validated and should match
        const { odTrips, errors } = await parseOdTripsFromCsvStream(
            csvStream,
            this.job.attributes.data.parameters.demandAttributes
        );

        this.options.progressEmitter.emit('progressCount', { name: 'ParsingCsvWithLineNumber', progress: -1 });
        return { odTrips, errors };
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
