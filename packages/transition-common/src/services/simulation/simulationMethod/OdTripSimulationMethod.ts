/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { SimulationAlgorithmDescriptor } from '../SimulationAlgorithm';

// Define OD trip simulation options
export type OdTripSimulationOptions = {
    dataSourceId: string;
    sampleRatio: number;
    odTripFitnessFunction: string;
    fitnessFunction: string;
};

/**
 * Descriptor class for the OD trip simulation method options. It documents the
 * options, types, validation and default values. It also validates the whole
 * options object.
 *
 * The OD Trip simulation method simulates the network using origin-destination
 * trip routing results.
 */
export class OdTripSimulationDescriptor implements SimulationAlgorithmDescriptor<OdTripSimulationOptions> {
    getTranslatableName = (): string => 'transit:simulation:simulationMethods:OdTrips';

    // TODO Add help texts
    getOptions = () => ({
        dataSourceId: {
            i18nName: 'transit:simulation:simulationMethods:OdTripsDataSource',
            type: 'select' as const,
            choices: async () => {
                // FIXME Still using data source queries. When this code was in the
                // backend, it used the query to fetch the data source, now let's just
                // use an empty array (this won't work, but it already doesn't work)
                const dataSources: { id: string; shortname: string }[] = [];
                return dataSources.map((ds) => ({
                    value: ds.id,
                    label: ds.shortname
                }));
            }
        },
        sampleRatio: {
            i18nName: 'transit:simulation:simulationMethods:OdTripsSampleRatio',
            type: 'number' as const,
            validate: (value: number) => value > 0 && value <= 1,
            default: 1
        },
        odTripFitnessFunction: {
            i18nName: 'transit:simulation:fitness:odTripFitnessFunction',
            type: 'select' as const,
            choices: async () => [
                {
                    label: 'transit:simulation:fitness:travelTimeCost',
                    value: 'travelTimeCost'
                },
                {
                    label: 'transit:simulation:fitness:travelTimeWithTransferPenalty',
                    value: 'travelTimeWithTransferPenalty'
                }
            ]
        },
        fitnessFunction: {
            i18nName: 'transit:simulation:fitness:fitnessFunction',
            type: 'select' as const,
            choices: async () => [
                {
                    label: 'transit:simulation:fitness:hourlyUserPlusOperatingCosts',
                    value: 'hourlyUserPlusOperatingCosts'
                },
                {
                    label: 'transit:simulation:fitness:hourlyUserCosts',
                    value: 'hourlyUserCosts'
                },
                {
                    label: 'transit:simulation:fitness:hourlyOperatingCosts',
                    value: 'hourlyOperatingCosts'
                }
            ]
        }
    });

    validateOptions = (_options: Partial<OdTripSimulationOptions>): { valid: boolean; errors: string[] } => {
        const valid = true;
        const errors: string[] = [];

        // TODO Actually validate something

        return { valid, errors };
    };
}
