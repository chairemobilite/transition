/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { SimulationRunDataAttributes } from 'transition-common/lib/services/simulation/SimulationRun';
import { TransitRoutingBaseAttributes } from 'chaire-lib-common/lib/services/routing/types';
import trRoutingService from 'chaire-lib-backend/lib/utils/trRouting/TrRoutingServiceBackend';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { TrRoutingError } from 'chaire-lib-common/lib/api/TrRouting';
import { SimulationMethodFactory, SimulationMethod } from './SimulationMethod';
import {
    OdTripSimulationDescriptor,
    OdTripSimulationOptions
} from 'transition-common/lib/services/networkDesign/transit/simulationMethod/OdTripSimulationMethod';

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
    create = (options: OdTripSimulationOptions, simulationDataAttributes: SimulationRunDataAttributes) =>
        new OdTripSimulation(options, simulationDataAttributes);
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
        private simulationDataAttributes: SimulationRunDataAttributes
    ) {
        this.fitnessFunction =
            Preferences.current.simulations.geneticAlgorithms.fitnessFunctions[options.fitnessFunction];
        this.odTripFitnessFunction =
            Preferences.current.simulations.geneticAlgorithms.odTripFitnessFunctions[options.odTripFitnessFunction];
        this.nonRoutableOdTripFitnessFunction =
            Preferences.current.simulations.geneticAlgorithms.nonRoutableOdTripFitnessFunctions['taxi'];
    }

    private generateQuery(transitRoutingParameters: TransitRoutingBaseAttributes): string[] {
        // TODO The route function should receive an object instead of a query string
        const trRoutingQueryArray = [
            'od_trips=1',
            `min_waiting_time_seconds=${transitRoutingParameters.minWaitingTimeSeconds || 180}`,
            `max_access_travel_time_seconds=${transitRoutingParameters.maxAccessEgressTravelTimeSeconds || 900}`,
            `max_egress_travel_time_seconds=${transitRoutingParameters.maxAccessEgressTravelTimeSeconds || 900}`,
            `max_transfer_travel_time_seconds=${transitRoutingParameters.maxTransferTravelTimeSeconds || 900}`,
            `max_travel_time_seconds=${transitRoutingParameters.maxTotalTravelTimeSeconds || 10800}`,
            `od_trips_periods=${8 * 60 * 60},${9 * 60 * 60}`,
            `data_source_uuid=${this.options.dataSourceId}`,
            'debug=0'
        ];

        const sampleRatio = this.options.sampleRatio;
        if (sampleRatio > 0.0 && sampleRatio <= 1.0) {
            trRoutingQueryArray.push(`od_trips_sample_ratio=${sampleRatio}`);
        }

        return trRoutingQueryArray;
    }

    private async processResults(results: any): Promise<OdTripSimulationResults> {
        const totalTravelTimeSecondsFromTrRouting = results['totalTravelTimeSeconds'] || null;
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

        results.odTrips.forEach((odTrip) => {
            if (!odTrip.expansionFactor) {
                odTrip.expansionFactor = 1.0;
            }
            if (odTrip.status === 'success' && odTrip.travelTimeSeconds > 0) {
                const userCost = odTrip.expansionFactor * this.odTripFitnessFunction(odTrip);
                usersCost += userCost;
                transfersCount += odTrip.expansionFactor * odTrip.numberOfTransfers;
                noTransferCount += odTrip.numberOfTransfers === 0 ? odTrip.expansionFactor : 0;
                routedCount += odTrip.expansionFactor;
                totalCount += odTrip.expansionFactor;
                totalWalkingTimeMinutes +=
                    (odTrip.expansionFactor *
                        (odTrip.accessTravelTimeSeconds +
                            odTrip.egressTravelTimeSeconds +
                            odTrip.transferTravelTimeSeconds)) /
                    60;
                totalWaitingTimeMinutes += (odTrip.expansionFactor * odTrip.waitingTimeSeconds) / 60;
                totalTravelTimeMinutes += (odTrip.expansionFactor * odTrip.travelTimeSeconds) / 60;
                totalRoutableUsersCost += userCost;

                if (odTrip.numberOfTransfers >= 5) {
                    countByNumberOfTransfers[5] += odTrip.expansionFactor;
                } else {
                    countByNumberOfTransfers[odTrip.numberOfTransfers] += odTrip.expansionFactor;
                }
            } else {
                const userCost = odTrip.expansionFactor * this.nonRoutableOdTripFitnessFunction(odTrip);
                totalCount += odTrip.expansionFactor;
                nonRoutedCount += odTrip.expansionFactor;
                usersCost += userCost;
                totalNonRoutableUsersCost += userCost;
            }
        });

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
            (this.simulationDataAttributes.transitNetworkDesignParameters.nbOfVehicles || 1) * 120;

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
        scenarioId: string,
        options: { trRoutingPort: number; transitRoutingParameters: TransitRoutingBaseAttributes }
    ): Promise<{ fitness: number; results: OdTripSimulationResults }> {
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

        return { fitness, results: stats };
    }
}
