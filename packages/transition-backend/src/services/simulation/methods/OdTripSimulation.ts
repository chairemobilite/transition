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
const originalIndexCsvColumnHeader = 'originalIndex';
// Simulate trips between 8am and 9am, we do not need full day simulation for OD trip based simulation
const simulationTimeRangeStartSeconds = 8 * 3600; // 8am
const simulationTimeRangeEndSeconds = 9 * 3600; // 9am

/** Operating cost per vehicle per hour (e.g. $/h) used for operatingHourlyCost in simulation stats. */
const OPERATING_COST_PER_VEHICLE_PER_HOUR = 120;

export class OdTripSimulationFactory implements SimulationMethodFactory<OdTripSimulationOptions> {
    getDescriptor = () => new OdTripSimulationDescriptor();
    create = (options: OdTripSimulationOptions, jobWrapper: TransitNetworkDesignJobWrapper) =>
        new OdTripSimulation(options, jobWrapper);
}

// TODO Custom to store the fitnesses of the original OD trips, to be able to compare with the base scenario in a differential fitness way. Maybe should be moved to its own file if it gets more complex
export class OdTripComparisonFitnessVisitor implements BatchRouteResultVisitor<[number | undefined, number][]> {
    private fitnesses: [number | undefined, number][] = [];

    constructor(
        private options: {
            odTripFitnessFunction: OdTripFitnessFunction;
            nonRoutableOdTripFitnessFunction: NonRoutableTripFitnessFunction;
            hasTransit: boolean;
        }
    ) {
        // Nothing to do
    }

    visitTripResult = async (odTripResult: OdTripRouteResult) => {
        const transitResult = odTripResult.results?.transit;
        const nonRoutableUserCost = this.options.nonRoutableOdTripFitnessFunction(odTripResult.results || {});
        if (transitResult && transitResult.error === undefined) {
            const route = transitResult.paths[0];

            if (route.totalTravelTime === 0) {
                // TODO should be a error case which would be able by the nonRoutablecase
                // for now just warn and skip
                console.warn('odTrip.travelTimeSeconds == 0');
                return;
            }
            const userCost = this.options.odTripFitnessFunction(route);
            this.fitnesses.push([userCost, nonRoutableUserCost]);
        } else {
            // Set the original fitness to undefined if the option to compare with transit scenarion is not set, otherwise, use the nonRouteable user cost as original fitness
            this.fitnesses.push([this.options.hasTransit ? nonRoutableUserCost : undefined, nonRoutableUserCost]);
        }
    };

    end = () => {
        // Nothing to finalize
    };

    getResult(): [number | undefined, number][] {
        return this.fitnesses;
    }
}

// Od trip fitness visitor to calculate simulation results
// TODO Consider moving to its own file if it gets more complex
export class OdTripFitnessVisitor implements BatchRouteResultVisitor<SimulationStats> {
    private usersCost = 0;
    // Sum of the differential fitness of sampled OD trips. Will be equal to usersCost if no original scenario is set
    private differentialUserCost = 0;
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

    constructor(
        private job: ExecutableJob<BatchRouteJobType>,
        private options: {
            odTripFitnessFunction: OdTripFitnessFunction;
            nonRoutableOdTripFitnessFunction: NonRoutableTripFitnessFunction;
            expansionFactorField?: string;
            getOriginalFitness: (index: number) => [number | undefined, number] | undefined;
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
        // FIXME Better formalize match between original index and demand index
        // Original fitness in base scenario, use 0 if undefined to use only the new fitness
        const [originalFitness, nonRoutedFitness] = this.options.getOriginalFitness(
            parseInt(odTripResult.internalId)
        ) || [0, 0];
        if (transitResult && transitResult.error === undefined) {
            const route = transitResult.paths[0];

            if (route.totalTravelTime === 0) {
                // TODO should be an error case which would be handled by the non-routable case
                // for now just warn and skip
                console.warn('odTrip.travelTimeSeconds == 0');
                return;
            }
            const currentTripFitness = this.options.odTripFitnessFunction(route);
            const differentialFitness = currentTripFitness - (originalFitness || 0);
            const userCost = expansionFactor * currentTripFitness;
            this.usersCost += userCost;
            this.differentialUserCost += expansionFactor * differentialFitness;
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
            const currentTripFitness = nonRoutedFitness;
            const differentialFitness = currentTripFitness - (originalFitness || 0);
            const userCost = currentTripFitness * expansionFactor;
            this.totalCount += expansionFactor;
            this.nonRoutedCount += expansionFactor;
            this.usersCost += userCost;
            this.differentialUserCost += expansionFactor * differentialFitness;
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
        // TODO: type the attributes correctly for simulations, because BatchCalculationParameters does not include nbOfVehicles
        const transitRoutingAttrs = this.job.attributes.data.parameters
            .transitRoutingAttributes as BatchCalculationParameters & { nbOfVehicles?: number };
        const operatingHourlyCost = (transitRoutingAttrs.nbOfVehicles || 1) * OPERATING_COST_PER_VEHICLE_PER_HOUR;

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
            differentialUsersHourlyCost: Math.round(this.differentialUserCost / durationHours)
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
            (line, rowNumber) => {
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
                    // Set the index of the original line in the file, to be able to match results with original demand in case of differential fitness
                    line[originalIndexCsvColumnHeader] = rowNumber - 1;
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
        demandFieldMapping.id = originalIndexCsvColumnHeader; // We use the original index in the file as id, to be able to match results with original demand in case of differential fitness
        return demandFieldMapping;
    }

    async simulate(scenarioId: string): Promise<{ fitness: number; results: SimulationStats }> {
        const batchParams: BatchCalculationParameters = {
            ...this.options.transitRoutingAttributes,
            // Just transit, walking and driving have been calculated at the start of the job
            routingModes: ['transit'],
            withAlternatives: false,
            withGeometries: false,
            detailed: false,
            scenarioId: scenarioId
        };

        // Fetch memcached information from global job
        const memcachedServer = this.jobWrapper.getMemcachedInstance()?.getServer();

        // Create the batch routing job as a child of the current job
        const routingJob: ExecutableJob<BatchRouteJobType> = await this.jobWrapper.job.createChildJob({
            name: 'batchRoute', // TODO: Should we rename to batchRouteChild or something similar? Rename in TransitionWorkerPool and services.socketRoutes too (it may be used elsewhere too).
            data: {
                parameters: {
                    demandAttributes: this.getBatchRouteDemandAttributes(),
                    transitRoutingAttributes: batchParams,
                    trRoutingJobParameters: { cacheDirectoryPath: this.jobWrapper.getCacheDirectory(), memcachedServer }
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

            // Child job needs its own progress emitter to avoid conflicts with the parent's
            const childProgressEmitter = new EventEmitter();

            const batchJobExecutor = new TrRoutingBatchExecutor(
                routingJob,
                {
                    progressEmitter: childProgressEmitter,
                    isCancelled: this.jobWrapper.privexecutorOptions.isCancelled
                },
                this.jobWrapper.getFakeTrRoutingBatchManager(childProgressEmitter)
            );
            const execResults = await batchJobExecutor.run();
            if (execResults.completed === true) {
                const facPerField = this.options.demandAttributes.fileAndMapping.fieldMappings.expansionFactor;
                // Handle results using the visitor pattern
                const fitnessVisitor = new OdTripFitnessVisitor(routingJob, {
                    odTripFitnessFunction: this.odTripFitnessFunction,
                    nonRoutableOdTripFitnessFunction: this.nonRoutableOdTripFitnessFunction,
                    expansionFactorField: facPerField,
                    getOriginalFitness: this.jobWrapper.getOriginalFitness
                });
                const results = await batchJobExecutor.handleResults(fitnessVisitor);
                const fitness = this.fitnessFunction(results);
                console.log(
                    `OdTripSimulation: scenario=${scenarioId} fitness=${fitness.toFixed(2)} routed=${results.routedCount} nonRouted=${results.nonRoutedCount} total=${results.totalCount}`
                );

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
