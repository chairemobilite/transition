/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { TransitRoutingBaseAttributes } from 'chaire-lib-common/lib/services/routing/types';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { SimulationAlgorithmDescriptor } from '../TransitNetworkDesignAlgorithm';
import { CsvFieldMappingDescriptor, CsvFileAndFieldMapper, CsvFileAndMapping } from '../../../csv';
import { demandFieldDescriptors } from '../../../transitDemand/TransitOdDemandFromCsv';
import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

type OdTripEvaluationOptions = {
    // The percentage of the OD trip in the demand to use for the simulation
    sampleRatio: number;
    /**
     * Name fo the fitness function to use for a single trip
     *
     * FIXME These functions have hard coded number, we may need to allow to
     * parameterize the various functions. Now, the functions are defined in the
     * defaultPreferences, identified by name. See if we need a { type: string;
     * parameters: ... } type
     */
    odTripFitnessFunction: string;
    /**
     * Name of the fitness function to use to evaluate the simulation run
     *
     * FIXME These functions have hard coded number, we may need to allow to
     * parameterize the various functions. Now, the functions are defined in the
     * defaultPreferences, identified by name. See if we need a { type: string;
     * parameters: ... } type
     */
    fitnessFunction: string;
};

// Define OD trip simulation options
export type OdTripSimulationOptions = {
    // Describe where to get the OD trip data for the simulation
    demandAttributes: CsvFileAndMapping;
    // Transit routing parameters to use for the simulation
    transitRoutingAttributes: TransitRoutingBaseAttributes;
    evaluationOptions: OdTripEvaluationOptions;
};

class TransitRoutingAttributesDescriptor implements SimulationAlgorithmDescriptor<TransitRoutingBaseAttributes> {
    getTranslatableName = (): string => 'transit:simulation:simulationMethods:transitRoutingAttributes';

    getOptions = () => {
        const transitRoutingAttributesDefaultsFromPref = Preferences.get(
            'transit.routing.transit'
        ) as TransitRoutingBaseAttributes;
        return {
            minWaitingTimeSeconds: {
                i18nName: 'transit:simulation:minWaitingTimeSeconds',
                type: 'integer' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.minWaitingTimeSeconds
            },
            maxTransferTravelTimeSeconds: {
                i18nName: 'transit:simulation:maxTransferTravelTimeSeconds',
                type: 'integer' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxTransferTravelTimeSeconds
            },
            maxAccessEgressTravelTimeSeconds: {
                i18nName: 'transit:simulation:maxAccessEgressTravelTimeSeconds',
                type: 'integer' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxAccessEgressTravelTimeSeconds
            },
            maxWalkingOnlyTravelTimeSeconds: {
                i18nName: 'transit:simulation:maxWalkingOnlyTravelTimeSeconds',
                type: 'integer' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxWalkingOnlyTravelTimeSeconds
            },
            maxFirstWaitingTimeSeconds: {
                i18nName: 'transit:simulation:maxFirstWaitingTimeSeconds',
                type: 'integer' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxFirstWaitingTimeSeconds
            },
            maxTotalTravelTimeSeconds: {
                i18nName: 'transit:simulation:maxTotalTravelTimeSeconds',
                type: 'integer' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxTotalTravelTimeSeconds
            },
            walkingSpeedMps: {
                i18nName: 'transit:simulation:walkingSpeedMps',
                type: 'number' as const,
                validate: (value: number) => value > 0,
                default: transitRoutingAttributesDefaultsFromPref.walkingSpeedMps
            },
            walkingSpeedFactor: {
                i18nName: 'transit:simulation:walkingSpeedFactor',
                type: 'number' as const,
                validate: (value: number) => value > 0,
                default: transitRoutingAttributesDefaultsFromPref.walkingSpeedFactor
            }
        };
    };

    validateOptions = (_options: Partial<TransitRoutingBaseAttributes>): { valid: boolean; errors: string[] } => {
        return { valid: true, errors: [] };
    };
}

class SimulationOptionsDescriptor implements SimulationAlgorithmDescriptor<OdTripEvaluationOptions> {
    getTranslatableName = (): string => 'transit:simulation:simulationMethods:simulationOptions';

    getOptions = () => ({
        sampleRatio: {
            i18nName: 'transit:simulation:simulationMethods:OdTripsSampleRatio',
            type: 'number' as const,
            validate: (value: number) => value > 0 && value <= 1,
            default: 1
        },
        odTripFitnessFunction: {
            i18nName: 'transit:simulation:fitness:odTripFitnessFunction',
            type: 'select' as const,
            required: true,
            choices: () => [
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
            required: true,
            choices: () => [
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

    validateOptions = (_options: Partial<OdTripEvaluationOptions>): { valid: boolean; errors: ErrorMessage[] } => {
        return { valid: true, errors: [] };
    };
}

// Add expansion factor to the demand field descriptors, and time is not required
const demandFieldsWithoutTime = demandFieldDescriptors.filter((descriptor) => descriptor.key !== 'time');
const timeFieldDescriptor: CsvFieldMappingDescriptor = demandFieldDescriptors.find(
    (descriptor) => descriptor.key === 'time'
)!;
const odDemandFieldDescriptors: CsvFieldMappingDescriptor[] = [
    ...demandFieldsWithoutTime,
    {
        ...timeFieldDescriptor,
        required: false
    },
    {
        key: 'expansionFactor',
        i18nLabel: 'transit:networkDesign:expansionFactorAttribute',
        type: 'single',
        required: false
    }
];
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
        demandAttributes: {
            i18nName: 'transit:simulation:simulationMethods:demandAttributes',
            type: 'csvFile' as const,
            mappingDescriptors: odDemandFieldDescriptors,
            importFileName: 'transit_od_trips.csv',
            required: true
        },
        transitRoutingAttributes: {
            i18nName: 'transit:simulation:simulationMethods:transitRoutingAttributes',
            type: 'nested' as const,
            descriptor: () => new TransitRoutingAttributesDescriptor()
        },
        evaluationOptions: {
            i18nName: 'transit:simulation:simulationMethods:simulationOptions',
            type: 'nested' as const,
            descriptor: () => new SimulationOptionsDescriptor()
        }
    });

    validateOptions = (options: Partial<OdTripSimulationOptions>): { valid: boolean; errors: ErrorMessage[] } => {
        let valid = true;
        const errors: ErrorMessage[] = [];

        // Validate the demand attributes
        if (options.demandAttributes !== undefined) {
            const demandFieldMappers = new CsvFileAndFieldMapper(
                odDemandFieldDescriptors,
                options.demandAttributes as CsvFileAndMapping
            );
            if (!demandFieldMappers.isValid()) {
                valid = false;
                errors.push(...demandFieldMappers.getErrors());
            }
        }

        return { valid, errors };
    };
}
