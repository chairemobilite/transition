/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TransitRoutingBaseAttributes } from 'chaire-lib-common/lib/services/routing/types';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { SimulationMethodFactory, SimulationMethod } from './SimulationMethod';
import {
    OdTripSimulationDescriptor,
    OdTripSimulationOptions
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod/OdTripSimulationMethod';
import { EvolutionaryTransitNetworkDesignJob } from '../../networkDesign/transitNetworkDesign/evolutionary/types';
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { ExecutableJobUtils } from '../../executableJob/ExecutableJobUtils';

import { JobDataType } from 'transition-common/lib/services/jobs/Job';
import { TransitNetworkDesignJobType } from '../../networkDesign/transitNetworkDesign/types';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';
import { batchRoute } from '../../transitRouting/TrRoutingBatch';
import resultsDbQueries from '../../../models/db/batchRouteResults.db.queries';
import { OdTripRouteResult } from '../../transitRouting/types';
import { BatchRouteJobType } from '../../transitRouting/BatchRoutingJob';
import { fileKey } from 'transition-common/lib/services/jobs/Job';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';

export const OdTripSimulationTitle = 'OdTripSimulation';

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
                const odTrip = {...route, expansionFactor: 1.0};

                // TODO Let's ignore handling the expansion factor for now
                if (!odTrip.expansionFactor) {
                    odTrip.expansionFactor = 1.0;
                }
                if (odTrip.totalTravelTime == 0) {
                    // TODO should be a error case which would be able by the nonRoutablecase
                    // for now just warn and skip
                    console.warn("odTrip.travelTimeSeconds == 0");
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
                        (odTrip.accessTravelTime +
                            odTrip.egressTravelTime +
                            odTrip.transferWalkingTime)) /
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
                console.warn("No Transit found, should call nonRoutableOdTripFitnessFunction, but using constant");
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
        const operatingHourlyCost =
            (this.jobWrapper.parameters.transitNetworkDesignParameters.nbOfVehicles || 1) * 120;

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

    async simulate(
        _scenarioId: string
    ): Promise<{ fitness: number; results: OdTripSimulationResults }> {
        // FIXME Temporarily disable this simulation method. We will create a
        // Job of type `batchRoute` with the demand file (in issue
        // https://github.com/chairemobilite/transition/issues/1533). But we
        // need a way to wait for it.  Need to fix:
        // https://github.com/chairemobilite/transition/issues/1542,
        // https://github.com/chairemobilite/transition/issues/1545,
        // https://github.com/chairemobilite/transition/issues/1541 and probably
        // start work on
        // https://github.com/chairemobilite/transition/issues/1397 first.

        // COPIED From services.socketRoute.ts (socket.on(TrRoutingConstants.BATCH_ROUTE)
        // TODO We could do something like that and just copy the file to the new job
        // TODO DO SAMPLING
        //this.wrappedJob.job.getReadStream('input')..
        const inputFiles: {
            [Property in keyof BatchRouteJobType[fileKey]]?:
                | string
                | { filepath: string; renameTo: string };
        } = {};
        inputFiles.input = await ExecutableJobUtils.prepareJobFiles({location:'job', jobId:this.jobWrapper.job.id, fileKey:'transitDemand'},
            this.jobWrapper.job.attributes.user_id
        );



        
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
            scenarioId: _scenarioId
        };

        const routingJob: ExecutableJob<BatchRouteJobType> = await this.jobWrapper.job.createChildJob({
            name: 'batchRoute', //TODO Is this important, can I rename it do something else ???
            data: {
                parameters: {
                    demandAttributes: this.options.demandAttributes,
                    transitRoutingAttributes: batchParams,
                    trRoutingJobParameters: {cacheDirectoryPath: this.jobWrapper.getCacheDirectory()}                        
                }
            },
            inputFiles,
            hasOutputFiles: false //TODO Manage the result
        });

        //TODO Normally we would yeild the execution here. To let the child run. For now run it directly.
        // I would normally do routingJob.run() here, but it was not implemented like that :P

        // This is copied from wrapBatchRoute
        const { files, errors, warnings, ...result } = await batchRoute(routingJob,
                                                                        this.jobWrapper.privexecutorOptions
                                                                       );
        routingJob.attributes.data.results = result;
        routingJob.attributes.resources = { files };

        // TODO Get job results somehow
        // TODO Guessing we could transform the processResults here in some kind of result visitor and figure out a way to pass it
        // to the TrRoutingBatch job.

        
        
        
        const results = await this.processResults(routingJob.id);

        const fitness = this.fitnessFunction(results);
        
        routingJob.delete();
        
        
        // Step 1: Create the input file for the batch routing job as a random sample of the original demand file (from the currently running job)

        // Step 2: Prepare the parameters for the job

        // Step 3: Create and enqueue the batchRoute job

        // Step 4: Need to return context to parent job so it can wait for the batch job to finish and get the results

        // ...

        // Step 5: Process the results when the batch job is finished

        /*
        const queryArray = this.generateQuery(options.transitRoutingParameters);
        queryArray.push(`scenario_uuid=${scenarioId}`);

        const result = await trRoutingService.v1TransitCall(
            queryArray.join('&'),
            'http://localhost',
            options.trRoutingPort.toString()
        );
        if (result.status !== 'success') {
            if ((result as TrRoutingError).error) {
                console.error((result as TrRoutingError).error);
            }
            throw new TrError(`Error returned for trRouting odTrips: ${result.status}`, 'SIMOD001');
        }

        const stats = await this.processResults(result);

        const fitness = this.fitnessFunction(stats);
        */

        

        
        return { fitness, results };
    }
}
