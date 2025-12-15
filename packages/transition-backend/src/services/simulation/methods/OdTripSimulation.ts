/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random from 'random';
import _cloneDeep from 'lodash/cloneDeep';
import { unparse } from 'papaparse';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { SimulationMethodFactory, SimulationMethod } from './SimulationMethod';
import {
    OdTripSimulationDemandFromCsvAttributes,
    OdTripSimulationDescriptor,
    OdTripSimulationOptions
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod/OdTripSimulationMethod';
import { ExecutableJob } from '../../executableJob/ExecutableJob';

import { parseCsvFile as parseCsvFileFromStream } from 'chaire-lib-common/lib/utils/files/CsvFile';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { batchRoute } from '../../transitRouting/TrRoutingBatch';
import resultsDbQueries from '../../../models/db/batchRouteResults.db.queries';
import { OdTripRouteResult } from '../../transitRouting/types';
import { BatchRouteJobType } from '../../transitRouting/BatchRoutingJob';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { EventEmitter } from 'events';
import { ReadStream, WriteStream } from 'fs';
import { TransitDemandFromCsvRoutingAttributes } from 'transition-common/lib/services/transitDemand/types';

export const OdTripSimulationTitle = 'OdTripSimulation';
const timeCsvColumnHeader = 'time';
// Simulate trips between 8am and 9am, we do not need full day simulation for OD trip based simulation
const simulationTimeRangeStartSeconds = 8 * 3600; // 8am
const simulationTimeRangeEndSeconds = 9 * 3600; // 9am

type OdTripSimulationResults = {
    transfersCount: number;
    totalCount: number;
    routedCount: number;
    nonRoutedCount: number;
    totalWalkingTimeMinutes: number;
    totalWaitingTimeMinutes: number;
    totalTravelTimeMinutes: number;
    avgWalkingTimeMinutes: number;
    avgWaitingTimeMinutes: number;
    avgTravelTimeMinutes: number;
    avgNumberOfTransfers: number;
    noTransferCount: number;
    operatingHourlyCost: number;
    usersHourlyCost: number;
    routableHourlyCost: number;
    nonRoutableHourlyCost: number;
    totalTravelTimeSecondsFromTrRouting: number;
    countByNumberOfTransfers: { [key: number]: number };
};

export class OdTripSimulationFactory implements SimulationMethodFactory<OdTripSimulationOptions> {
    getDescriptor = () => new OdTripSimulationDescriptor();
    create = (options: OdTripSimulationOptions, jobWrapper: TransitNetworkDesignJobWrapper) =>
        new OdTripSimulation(options, jobWrapper);
}

/**
 * Simulate a scenario using od trips
 */
export default class OdTripSimulation implements SimulationMethod {
    private fitnessFunction: (stats: any) => number;
    private odTripFitnessFunction: (odTrip: any) => number;
    private nonRoutableOdTripFitnessFunction: (odTrip: any) => number;

    constructor(
        private options: OdTripSimulationOptions,
        private jobWrapper: TransitNetworkDesignJobWrapper
    ) {
        //TODO THESE NEED TO MOVE OUT OF THE PREFERENCE!!! and go into the job parameter (the choice of function, not the function itself)
        this.fitnessFunction =
            Preferences.current.simulations.geneticAlgorithms.fitnessFunctions[
                options.evaluationOptions.fitnessFunction
            ];
        this.odTripFitnessFunction =
            Preferences.current.simulations.geneticAlgorithms.odTripFitnessFunctions[
                options.evaluationOptions.odTripFitnessFunction
            ];
        this.nonRoutableOdTripFitnessFunction =
            Preferences.current.simulations.geneticAlgorithms.nonRoutableOdTripFitnessFunctions['taxi'];
    }

    private async processResults(jobid: number): Promise<OdTripSimulationResults> {
        const totalTravelTimeSecondsFromTrRouting = 0; // TODO Is that used
        // TODO Simulation is done between 8 and 9 hardcoded. Maybe not hardcode this?
        const durationHours = 1;

        let usersCost = 0;
        let totalRoutableUsersCost = 0;
        let totalNonRoutableUsersCost = 0;
        let transfersCount = 0;
        let totalCount = 0;
        let routedCount = 0;
        let nonRoutedCount = 0;
        let noTransferCount = 0;
        let totalWalkingTimeMinutes = 0;
        let totalWaitingTimeMinutes = 0;
        let totalTravelTimeMinutes = 0;
        const countByNumberOfTransfers = new Array(6).fill(0); // max 4, last is 5+

        const resultStream = resultsDbQueries.streamResults(jobid);

        for await (const row of resultStream) {
            const result = resultsDbQueries.resultParser(row);
            const odTripResult: OdTripRouteResult = result.data;
            const transitResult = odTripResult.results?.transit;
            if (transitResult) {
                const route = transitResult.paths[0];
                const odTrip = { ...route, expansionFactor: 1.0 };

                // TODO Let's ignore handling the expansion factor for now
                if (!odTrip.expansionFactor) {
                    odTrip.expansionFactor = 1.0;
                }
                if (odTrip.totalTravelTime == 0) {
                    // TODO should be a error case which would be able by the nonRoutablecase
                    // for now just warn and skip
                    console.warn('odTrip.travelTimeSeconds == 0');
                    continue;
                }
                const userCost = odTrip.expansionFactor * this.odTripFitnessFunction(odTrip);
                usersCost += userCost;
                transfersCount += odTrip.expansionFactor * odTrip.numberOfTransfers;
                noTransferCount += odTrip.numberOfTransfers === 0 ? odTrip.expansionFactor : 0;
                routedCount += odTrip.expansionFactor;
                totalCount += odTrip.expansionFactor;
                totalWalkingTimeMinutes +=
                    (odTrip.expansionFactor *
                        (odTrip.accessTravelTime + odTrip.egressTravelTime + odTrip.transferWalkingTime)) /
                    60;
                totalWaitingTimeMinutes += (odTrip.expansionFactor * odTrip.totalWaitingTime) / 60;
                totalTravelTimeMinutes += (odTrip.expansionFactor * odTrip.totalTravelTime) / 60;
                totalRoutableUsersCost += userCost;

                if (odTrip.numberOfTransfers >= 5) {
                    countByNumberOfTransfers[5] += odTrip.expansionFactor;
                } else {
                    countByNumberOfTransfers[odTrip.numberOfTransfers] += odTrip.expansionFactor;
                }
            } else {
                const expansionFactor = 1.0; //TODO Do something
                //const userCost = expansionFactor * this.nonRoutableOdTripFitnessFunction(odTrip);
                // TODO HANDLE THIS PROPERLY
                console.warn('No Transit found, should call nonRoutableOdTripFitnessFunction, but using constant');
                const userCost = 100;
                totalCount += expansionFactor;
                nonRoutedCount += expansionFactor;
                usersCost += userCost;
                totalNonRoutableUsersCost += userCost;
            }
        }

        for (let i = 0; i < countByNumberOfTransfers.length; i++) {
            countByNumberOfTransfers[i] = Math.round(countByNumberOfTransfers[i]);
        }

        // todo: update this for other modes:
        // TODO: Get the actual number of vehicles for this scenario, may not be exactly the same as nbOfVehicles
        /*const operatingHourlyCost = Math.max(
            (this.simulationDataAttributes.transitNetworkDesignParameters.nbOfVehicles || 1) * 120,
            this.getTotalNumberOfVehicles() * 120
        ); */
        const operatingHourlyCost = (this.jobWrapper.parameters.transitNetworkDesignParameters.nbOfVehicles || 1) * 120;

        return {
            transfersCount: Math.ceil(transfersCount),
            totalCount: Math.round(totalCount),
            routedCount: Math.round(routedCount),
            nonRoutedCount: Math.round(nonRoutedCount),
            totalWalkingTimeMinutes: Math.ceil(totalWalkingTimeMinutes),
            totalWaitingTimeMinutes: Math.ceil(totalWaitingTimeMinutes),
            totalTravelTimeMinutes: Math.ceil(totalTravelTimeMinutes),
            avgWalkingTimeMinutes: Math.round((totalWalkingTimeMinutes / routedCount) * 100) / 100,
            avgWaitingTimeMinutes: Math.round((totalWaitingTimeMinutes / routedCount) * 100) / 100,
            avgTravelTimeMinutes: Math.round((totalTravelTimeMinutes / routedCount) * 100) / 100,
            avgNumberOfTransfers: Math.round((transfersCount / routedCount) * 100) / 100,
            noTransferCount: Math.round(noTransferCount),
            operatingHourlyCost: Math.round(operatingHourlyCost),
            usersHourlyCost: Math.round(usersCost / durationHours),
            routableHourlyCost: Math.round(totalRoutableUsersCost / durationHours),
            nonRoutableHourlyCost: Math.round(totalNonRoutableUsersCost / durationHours),
            totalTravelTimeSecondsFromTrRouting: totalTravelTimeSecondsFromTrRouting,
            countByNumberOfTransfers
        };
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

    async simulate(scenarioId: string): Promise<{ fitness: number; results: OdTripSimulationResults }> {
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

        // Create the input file for the batch routing job as a random sample of the original demand file (from the currently running job)
        await this.sampleOdTripFileForJob(routingJob);

        //TODO Normally we would yeild the execution here. To let the child run. For now run it directly.
        // I would normally do routingJob.run() here, but it was not implemented like that :P

        // This is copied from wrapBatchRoute in `TransitionWorkerPool.ts`
        const { files, errors, warnings, ...result } = await batchRoute(routingJob, {
            // Child job needs its own progress emitter to avoid conflicts with the parent's
            progressEmitter: new EventEmitter(),
            isCancelled: this.jobWrapper.privexecutorOptions.isCancelled
        });
        routingJob.attributes.data.results = result;
        routingJob.attributes.resources = { files };

        // TODO Get job results somehow
        // TODO Guessing we could transform the processResults here in some kind of result visitor and figure out a way to pass it
        // to the TrRoutingBatch job.

        const results = await this.processResults(routingJob.id);

        const fitness = this.fitnessFunction(results);

        routingJob.delete();

        return { fitness, results };
    }
}
