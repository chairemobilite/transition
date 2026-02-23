/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random from 'random';
import _cloneDeep from 'lodash/cloneDeep';
import { unparse } from 'papaparse';
import { SimulationMethodFactory, SimulationMethod } from './SimulationMethod';
import {
    OdTripSimulationDemandFromCsvAttributes,
    OdTripSimulationDescriptor,
    OdTripSimulationOptions
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod/OdTripSimulationMethod';
import { ExecutableJob } from '../../executableJob/ExecutableJob';

import { parseCsvFile as parseCsvFileFromStream } from 'chaire-lib-common/lib/utils/files/CsvFile';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { TrRoutingBatchExecutor } from '../../transitRouting/TrRoutingBatch';
import { OdTripRouteResult } from '../../transitRouting/types';
import { BatchRouteJobType, BatchRouteResultVisitor } from '../../transitRouting/BatchRoutingJob';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { EventEmitter } from 'events';
import { ReadStream, WriteStream } from 'fs';
import {
    FitnessFunction,
    OdTripFitnessFunction,
    getFitnessFunction,
    getOdTripFitnessFunction,
    getNonRoutableOdTripFitnessFunction,
    SimulationStats,
    NonRoutableTripFitnessFunction
} from './OdTripSimulationFitnessFunctions';
import { TransitDemandFromCsvRoutingAttributes } from 'transition-common/lib/services/transitDemand/types';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

export const OdTripSimulationTitle = 'OdTripSimulation';
const timeCsvColumnHeader = 'time';
// Simulate trips between 8am and 9am, we do not need full day simulation for OD trip based simulation
const simulationTimeRangeStartSeconds = 8 * 3600; // 8am
const simulationTimeRangeEndSeconds = 9 * 3600; // 9am

export class OdTripSimulationFactory implements SimulationMethodFactory<OdTripSimulationOptions> {
    getDescriptor = () => new OdTripSimulationDescriptor();
    create = (options: OdTripSimulationOptions, jobWrapper: TransitNetworkDesignJobWrapper) =>
        new OdTripSimulation(options, jobWrapper);
}

// Od trip fitness visitor to calculate simulation results
// TODO Consider moving to its own file if it gets more complex
export class OdTripFitnessVisitor implements BatchRouteResultVisitor<SimulationStats> {
    private usersCost = 0;
    private totalRoutableUsersCost = 0;
    private totalNonRoutableUsersCost = 0;
    private transfersCount = 0;
    private totalCount = 0;
    private routedCount = 0;
    private nonRoutedCount = 0;
    private noTransferCount = 0;
    private totalWalkingTimeMinutes = 0;
    private totalWaitingTimeMinutes = 0;
    private totalTravelTimeMinutes = 0;
    private countByNumberOfTransfers = new Array(6).fill(0); // max 4, last is 5+
    private sampleFileLinesCount = 0;
    private sampleTotalWeight = 0;

    constructor(
        private job: ExecutableJob<BatchRouteJobType>,
        private options: {
            odTripFitnessFunction: OdTripFitnessFunction;
            nonRoutableOdTripFitnessFunction: NonRoutableTripFitnessFunction;
            expansionFactorField?: string;
        }
    ) {
        // Nothing to do
    }

    private getExpansionFactor(odTripResult: OdTripRouteResult): number {
        if (!this.options.expansionFactorField || _isBlank(odTripResult.data?.[this.options.expansionFactorField])) {
            return 1.0;
        }
        const expansionFactorData = odTripResult.data?.[this.options.expansionFactorField];
        const expansionFactorAsNumber =
            typeof expansionFactorData === 'number'
                ? expansionFactorData
                : typeof expansionFactorData === 'string'
                    ? parseFloat(expansionFactorData)
                    : Number.NaN;
        // Add a warning if the expansion factor is not a valid number, and use 1 as default in that case
        if (isNaN(expansionFactorAsNumber) || !isFinite(expansionFactorAsNumber) || expansionFactorAsNumber <= 0) {
            console.warn(
                `Invalid expansion factor for OD trip result with origin ${odTripResult.origin} and destination ${odTripResult.destination}: ${expansionFactorData}. Using 1 as default.`
            );
        }
        // FIXME Should we test other bounds for expansion factor? >= 1 maybe?
        return isNaN(expansionFactorAsNumber) || !isFinite(expansionFactorAsNumber) || expansionFactorAsNumber <= 0
            ? 1.0
            : expansionFactorAsNumber;
    }

    visitTripResult = async (odTripResult: OdTripRouteResult) => {
        const transitResult = odTripResult.results?.transit;
        const expansionFactor = this.getExpansionFactor(odTripResult);
        this.sampleFileLinesCount++;
        this.sampleTotalWeight += expansionFactor;
        if (transitResult && transitResult.error === undefined) {
            const route = transitResult.paths[0];

            if (route.totalTravelTime === 0) {
                // TODO should be a error case which would be able by the nonRoutablecase
                // for now just warn and skip
                console.warn('odTrip.travelTimeSeconds == 0');
                return;
            }
            const userCost = expansionFactor * this.options.odTripFitnessFunction(route);
            this.usersCost += userCost;
            this.transfersCount += expansionFactor * route.numberOfTransfers;
            this.noTransferCount += route.numberOfTransfers === 0 ? expansionFactor : 0;
            this.routedCount += expansionFactor;
            this.totalCount += expansionFactor;
            this.totalWalkingTimeMinutes +=
                (expansionFactor * (route.accessTravelTime + route.egressTravelTime + route.transferWalkingTime)) / 60;
            this.totalWaitingTimeMinutes += (expansionFactor * route.totalWaitingTime) / 60;
            this.totalTravelTimeMinutes += (expansionFactor * route.totalTravelTime) / 60;
            this.totalRoutableUsersCost += userCost;

            if (route.numberOfTransfers >= 5) {
                this.countByNumberOfTransfers[5] += expansionFactor;
            } else {
                this.countByNumberOfTransfers[route.numberOfTransfers] += expansionFactor;
            }
        } else {
            const userCost =
                this.options.nonRoutableOdTripFitnessFunction(odTripResult.results || {}) * expansionFactor;
            this.totalCount += expansionFactor;
            this.nonRoutedCount += expansionFactor;
            this.usersCost += userCost;
            this.totalNonRoutableUsersCost += userCost;
        }
    };

    end = () => {
        // Nothing to finalize
    };

    getResult(): SimulationStats {
        // TODO Simulation is done between 8 and 9 hardcoded. Maybe not hardcode this?
        const durationHours = 1;

        for (let i = 0; i < this.countByNumberOfTransfers.length; i++) {
            this.countByNumberOfTransfers[i] = Math.round(this.countByNumberOfTransfers[i]);
        }

        // todo: update this for other modes:
        // TODO: Get the actual number of vehicles for this scenario, may not be exactly the same as nbOfVehicles
        const operatingHourlyCost =
            ((this.job.attributes.data.parameters.transitRoutingAttributes as any).nbOfVehicles || 1) * 120;

        return {
            transfersCount: Math.ceil(this.transfersCount),
            totalCount: Math.round(this.totalCount),
            routedCount: Math.round(this.routedCount),
            nonRoutedCount: Math.round(this.nonRoutedCount),
            totalWalkingTimeMinutes: Math.ceil(this.totalWalkingTimeMinutes),
            totalWaitingTimeMinutes: Math.ceil(this.totalWaitingTimeMinutes),
            totalTravelTimeMinutes: Math.ceil(this.totalTravelTimeMinutes),
            avgWalkingTimeMinutes: Math.round((this.totalWalkingTimeMinutes / this.routedCount) * 100) / 100,
            avgWaitingTimeMinutes: Math.round((this.totalWaitingTimeMinutes / this.routedCount) * 100) / 100,
            avgTravelTimeMinutes: Math.round((this.totalTravelTimeMinutes / this.routedCount) * 100) / 100,
            avgNumberOfTransfers: Math.round((this.transfersCount / this.routedCount) * 100) / 100,
            noTransferCount: Math.round(this.noTransferCount),
            operatingHourlyCost: Math.round(operatingHourlyCost),
            usersHourlyCost: Math.round(this.usersCost / durationHours),
            routableHourlyCost: Math.round(this.totalRoutableUsersCost / durationHours),
            nonRoutableHourlyCost: Math.round(this.totalNonRoutableUsersCost / durationHours),
            totalTravelTimeSecondsFromTrRouting: 0, // TODO Is that used
            countByNumberOfTransfers: this.countByNumberOfTransfers,
            sampleFileLinesCount: this.sampleFileLinesCount,
            sampleTotalWeight: this.sampleTotalWeight
        };
    }
}

/**
 * Simulate a scenario using od trips
 */
export default class OdTripSimulation implements SimulationMethod {
    private fitnessFunction: FitnessFunction;
    private odTripFitnessFunction: OdTripFitnessFunction;
    private nonRoutableOdTripFitnessFunction: NonRoutableTripFitnessFunction;

    constructor(
        private options: OdTripSimulationOptions,
        private jobWrapper: TransitNetworkDesignJobWrapper
    ) {
        // Get the fitness functions by name from the centralized module
        this.fitnessFunction = getFitnessFunction(options.evaluationOptions.fitnessFunction);
        this.odTripFitnessFunction = getOdTripFitnessFunction(options.evaluationOptions.odTripFitnessFunction);
        this.nonRoutableOdTripFitnessFunction = getNonRoutableOdTripFitnessFunction('taxi');
    }

    private async sampleOdTripFile(csvStream: ReadStream, writeStream: WriteStream): Promise<string> {
        let needWriteHeader = true;
        return parseCsvFileFromStream(
            csvStream,
            (line) => {
                // FIXME Since this is random, there is no guarantee that
                // the sampled file will be exactly the sample ratio. Since
                // the file can be large, we cannot load it in memory. We
                // could count the number of lines at the beginning of the
                // job, put it in the checkpoints, then use a reservoir
                // sampling algorithm to get exactly the desired number of
                // lines for each simulation.
                //
                // Sample this line if the random number is below the sample
                // ratio, to sample only this ratio
                if (random.float() <= this.options.evaluationOptions.sampleRatio) {
                    // Give a random trip time in the time range, in seconds since midnight
                    line[timeCsvColumnHeader] = random.integer(
                        simulationTimeRangeStartSeconds,
                        simulationTimeRangeEndSeconds
                    );
                    // Need to manually add the trailing newline since papaparse
                    // unparse does not add it automatically
                    writeStream.write(unparse([line], { header: needWriteHeader, newline: '\n' }) + '\n');
                    needWriteHeader = false;
                }
            },
            { header: true }
        );
    }

    private async sampleOdTripFileForJob(routingJob: ExecutableJob<BatchRouteJobType>): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // Complete input file from the parent job
            const csvStream = this.jobWrapper.job.getReadStream('transitDemand');

            // Prepare the sampled file for the child job
            const writeStream = routingJob.getWriteStream('input');

            this.sampleOdTripFile(csvStream, writeStream)
                .then(() => {
                    writeStream.end(() => {
                        resolve();
                    });
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    private getBatchRouteDemandAttributes(): TransitDemandFromCsvRoutingAttributes {
        // Clone the demand attributes to not modify the original
        const demandAttributes = _cloneDeep(this.options.demandAttributes) as OdTripSimulationDemandFromCsvAttributes;
        const demandFieldMapping = demandAttributes.fileAndMapping
            .fieldMappings as TransitDemandFromCsvRoutingAttributes;
        // Add the time, time type and format to the demand attributes, as they are not defined or even required in the main job
        demandFieldMapping.time = timeCsvColumnHeader;
        demandFieldMapping.timeFormat = 'secondsSinceMidnight';
        demandFieldMapping.timeType = 'departure';
        return demandFieldMapping;
    }

    async simulate(scenarioId: string): Promise<{ fitness: number; results: SimulationStats }> {
        // Need to build a BatchCalculationParameters for the BatchRouteJobType
        // It's composed TransitRoutingQueryAttributes plus the withGeometries, detailed flag
        // The TransitRoutingQueryAttributes is a RoutingQueryAttributes + TransitQueryAttributes
        // The TransitQueryAttributes is a TransitRoutingBaseAttributes (coming from options.transitRoutingAttributes)
        // and a scenarioId. The RoutingQueryAttributes is the routingModes and the withAlternatives flag.
        const batchParams: BatchCalculationParameters = {
            ...this.options.transitRoutingAttributes,
            routingModes: ['transit', 'walking', 'driving'], //We need walking and driving for the fallback calculation
            withAlternatives: false,
            withGeometries: false,
            detailed: false,
            scenarioId: scenarioId
        };

        // Create the batch routing job as a child of the current job
        const routingJob: ExecutableJob<BatchRouteJobType> = await this.jobWrapper.job.createChildJob({
            name: 'batchRoute', //TODO Is this important, can I rename it do something else ???
            data: {
                parameters: {
                    demandAttributes: this.getBatchRouteDemandAttributes(),
                    transitRoutingAttributes: batchParams,
                    trRoutingJobParameters: { cacheDirectoryPath: this.jobWrapper.getCacheDirectory() }
                }
            },
            resources: {
                // Input file will be prepared later
                files: { input: `sampled_transit_demand_${scenarioId}.csv` }
            }
        });

        try {
            // Create the input file for the batch routing job as a random sample of the original demand file (from the currently running job)
            await this.sampleOdTripFileForJob(routingJob);

            //TODO Normally we would yeild the execution here. To let the child run. For now run it directly.
            // I would normally do routingJob.run() here, but it was not implemented like that :P

            // This is copied from wrapBatchRoute in `TransitionWorkerPool.ts`
            const batchJobExecutor = new TrRoutingBatchExecutor(routingJob, {
                // Child job needs its own progress emitter to avoid conflicts with the parent's
                progressEmitter: new EventEmitter(),
                isCancelled: this.jobWrapper.privexecutorOptions.isCancelled
            });
            const execResults = await batchJobExecutor.run();
            if (execResults.completed === true) {
                const facPerField = this.options.demandAttributes.fileAndMapping.fieldMappings.expansionFactor;
                // Handle results using the visitor pattern
                const fitnessVisitor = new OdTripFitnessVisitor(routingJob, {
                    odTripFitnessFunction: this.odTripFitnessFunction,
                    nonRoutableOdTripFitnessFunction: this.nonRoutableOdTripFitnessFunction,
                    expansionFactorField: facPerField
                });
                const results = await batchJobExecutor.handleResults(fitnessVisitor);
                const fitness = this.fitnessFunction(results);

                return { fitness, results };
            } else {
                throw new Error('Batch routing job did not complete successfully');
            }
        } finally {
            // Delete the child job to avoid clutter, no need to await
            routingJob.delete();
        }
    }
}
