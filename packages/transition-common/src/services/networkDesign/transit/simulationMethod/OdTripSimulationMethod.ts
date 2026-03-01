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
import { TranslatableMessage } from 'chaire-lib-common/lib/utils/TranslatableMessage';
import {
    type NodeWeightingConfig,
    NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS,
    NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS,
    nodeWeightingPoiMappingDescriptors,
    NodeWeightingPoiFromCsv
} from './nodeWeightingTypes';

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

export type OdTripSimulationFromCsvAttributes = {
    projection: string;
    id: string;
    originLat: string;
    originLon: string;
    destinationLat: string;
    destinationLon: string;
    expansionFactor?: string;
};

export type OdTripSimulationDemandFromCsvAttributes = CsvFileAndMapping<OdTripSimulationFromCsvAttributes>;

// Define OD trip simulation options
export type OdTripSimulationOptions = {
    // Describe where to get the OD trip data for the simulation
    demandAttributes: OdTripSimulationDemandFromCsvAttributes;
    // Transit routing parameters to use for the simulation
    transitRoutingAttributes: TransitRoutingBaseAttributes;
    evaluationOptions: OdTripEvaluationOptions;
    /** Optional node weighting config (same or separate file, decay, etc.). */
    nodeWeighting?: NodeWeightingConfig;
};

class TransitRoutingAttributesDescriptor implements SimulationAlgorithmDescriptor<TransitRoutingBaseAttributes> {
    getTranslatableName = (): string => 'transit:networkDesign.simulationMethods.transitRoutingAttributes';

    getOptions = () => {
        const transitRoutingAttributesDefaultsFromPref = Preferences.get(
            'transit.routing.transit'
        ) as TransitRoutingBaseAttributes;
        return {
            minWaitingTimeSeconds: {
                i18nName: 'transit:transitRouting.MinimumWaitingTimeMinutes',
                i18nHelp: 'transit:transitRouting.MinimumWaitingTimeMinutesHelp',
                type: 'seconds' as const,
                askAs: 'minutes' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.minWaitingTimeSeconds
            },
            maxTransferTravelTimeSeconds: {
                i18nName: 'transit:transitRouting.MaximumTransferTravelTimeMinutes',
                i18nHelp: 'transit:transitRouting.MaximumTransferTravelTimeMinutesHelp',
                type: 'seconds' as const,
                askAs: 'minutes' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxTransferTravelTimeSeconds
            },
            maxAccessEgressTravelTimeSeconds: {
                i18nName: 'transit:transitRouting.MaximumAccessEgressTravelTimeMinutes',
                i18nHelp: 'transit:transitRouting.MaximumAccessEgressTravelTimeMinutesHelp',
                type: 'seconds' as const,
                askAs: 'minutes' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxAccessEgressTravelTimeSeconds
            },
            maxWalkingOnlyTravelTimeSeconds: {
                i18nName: 'transit:networkDesign.simulationMethods.odTrips.MaxWalkingOnlyTravelTimeMinutes',
                type: 'seconds' as const,
                askAs: 'minutes' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxWalkingOnlyTravelTimeSeconds
            },
            maxFirstWaitingTimeSeconds: {
                i18nName: 'transit:transitRouting.MaximumFirstWaitingTimeMinutes',
                type: 'seconds' as const,
                askAs: 'minutes' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxFirstWaitingTimeSeconds
            },
            maxTotalTravelTimeSeconds: {
                i18nName: 'transit:transitRouting.MaximumTotalTravelTimeMinutes',
                type: 'seconds' as const,
                askAs: 'minutes' as const,
                validate: (value: number) => value >= 0,
                default: transitRoutingAttributesDefaultsFromPref.maxTotalTravelTimeSeconds
            },
            walkingSpeedMps: {
                i18nName: 'transit:networkDesign.simulationMethods.odTrips.WalkingSpeedMps',
                type: 'number' as const,
                validate: (value: number) => value > 0,
                default: transitRoutingAttributesDefaultsFromPref.walkingSpeedMps
            },
            walkingSpeedFactor: {
                i18nName: 'transit:networkDesign.simulationMethods.odTrips.WalkingSpeedFactor',
                i18nHelp: 'transit:networkDesign.simulationMethods.odTrips.WalkingSpeedFactorHelp',
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
    getTranslatableName = (): string => 'transit:networkDesign.simulationMethods.odTrips.simulationOptions';

    getOptions = () => ({
        sampleRatio: {
            i18nName: 'transit:networkDesign.simulationMethods.odTrips.OdTripsSampleRatio',
            type: 'percentage' as const,
            validate: (value: number) => value > 0 && value <= 1,
            default: 1
        },
        odTripFitnessFunction: {
            i18nName: 'transit:networkDesign.simulationMethods.odTrips.fitness.odTripFitnessFunction',
            i18nHelp: 'transit:networkDesign.simulationMethods.odTrips.fitness.help.odTripFitnessFunction',
            type: 'select' as const,
            required: true,
            choices: () => [
                {
                    label: 'transit:networkDesign.simulationMethods.odTrips.fitness.travelTimeCost',
                    value: 'travelTimeCost'
                },
                {
                    label: 'transit:networkDesign.simulationMethods.odTrips.fitness.travelTimeWithTransferPenalty',
                    value: 'travelTimeWithTransferPenalty'
                }
            ]
        },
        fitnessFunction: {
            i18nName: 'transit:networkDesign.simulationMethods.odTrips.fitness.fitnessFunction',
            i18nHelp: 'transit:networkDesign.simulationMethods.odTrips.fitness.help.fitnessFunction',
            type: 'select' as const,
            required: true,
            choices: () => [
                {
                    label: 'transit:networkDesign.simulationMethods.odTrips.fitness.hourlyUserPlusOperatingCosts',
                    value: 'hourlyUserPlusOperatingCosts'
                },
                {
                    label: 'transit:networkDesign.simulationMethods.odTrips.fitness.hourlyUserCosts',
                    value: 'hourlyUserCosts'
                },
                {
                    label: 'transit:networkDesign.simulationMethods.odTrips.fitness.hourlyOperatingCosts',
                    value: 'hourlyOperatingCosts'
                }
            ]
        }
    });

    validateOptions = (
        _options: Partial<OdTripEvaluationOptions>
    ): { valid: boolean; errors: TranslatableMessage[] } => {
        return { valid: true, errors: [] };
    };
}

// Add expansion factor to the demand field descriptors, and time is not required
const demandFieldsWithoutTime = demandFieldDescriptors.filter((descriptor) => descriptor.key !== 'time');
const odDemandFieldDescriptors: CsvFieldMappingDescriptor[] = [
    ...demandFieldsWithoutTime,
    {
        key: 'expansionFactor',
        i18nLabel: 'transit:networkDesign.simulationMethods.odTrips.expansionFactorAttribute',
        type: 'single',
        required: false
    }
];

/**
 * Describe a CSV file field mapping for a transition origin/destination pair file
 */
export class TransitOdTripSimulationDemandFromCsv extends CsvFileAndFieldMapper<OdTripSimulationFromCsvAttributes> {
    constructor(csvFileAndMapping?: OdTripSimulationDemandFromCsvAttributes | undefined) {
        super(odDemandFieldDescriptors, csvFileAndMapping);
    }
}

const transitRoutingAttributesDescriptor = new TransitRoutingAttributesDescriptor();
const simulationOptionsDescriptor = new SimulationOptionsDescriptor();

/** Options shape for the decay parameters nested descriptor (power: type + beta; other types add more fields). */
type DecayParametersOptions = { type: string; beta?: number };

class DecayFunctionParametersDescriptor implements SimulationAlgorithmDescriptor<DecayParametersOptions> {
    getTranslatableName = (): string => 'transit:networkDesign.nodeWeighting.decayParameters';

    getOptions = () => ({
        type: {
            i18nName: 'transit:networkDesign.nodeWeighting.decayType',
            type: 'select' as const,
            default: 'power' as const,
            choices: (_obj: Record<string, unknown>) => [
                { value: 'power', label: 'transit:networkDesign.nodeWeighting.decayType.power' },
                { value: 'exponential', label: 'transit:networkDesign.nodeWeighting.decayType.exponential' },
                { value: 'gamma', label: 'transit:networkDesign.nodeWeighting.decayType.gamma' },
                { value: 'combined', label: 'transit:networkDesign.nodeWeighting.decayType.combined' },
                { value: 'logistic', label: 'transit:networkDesign.nodeWeighting.decayType.logistic' }
            ]
        },
        beta: {
            i18nName: 'transit:networkDesign.nodeWeighting.decayBeta',
            type: 'number' as const,
            default: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS.beta,
            validate: (value: number) => value > 0
        }
    });

    validateOptions = (): { valid: boolean; errors: TranslatableMessage[] } => ({ valid: true, errors: [] });
}

class NodeWeightingOptionsDescriptor implements SimulationAlgorithmDescriptor<NodeWeightingConfig> {
    getTranslatableName = (): string => 'transit:networkDesign.simulationMethods.odTrips.nodeWeighting';

    getOptions = () => ({
        weightingEnabled: {
            i18nName: 'transit:networkDesign.nodeWeighting.weightingEnabled',
            type: 'boolean' as const,
            default: false
        },
        weightingSource: {
            i18nName: 'transit:networkDesign.nodeWeighting.weightingSource',
            type: 'select' as const,
            default: 'sameFile' as const,
            choices: (_obj: Record<string, unknown>) => [
                { value: 'sameFile', label: 'transit:networkDesign.nodeWeighting.weightingSource.sameFile' },
                { value: 'separateFile', label: 'transit:networkDesign.nodeWeighting.weightingSource.separateFile' }
            ]
        },
        odWeightingPoints: {
            i18nName: 'transit:networkDesign.nodeWeighting.odWeightingPoints',
            type: 'select' as const,
            default: 'both' as const,
            choices: (_obj: Record<string, unknown>) => [
                { value: 'origins', label: 'transit:networkDesign.nodeWeighting.odWeightingPoints.origins' },
                { value: 'destinations', label: 'transit:networkDesign.nodeWeighting.odWeightingPoints.destinations' },
                { value: 'both', label: 'transit:networkDesign.nodeWeighting.odWeightingPoints.both' }
            ]
        },
        maxWalkingTimeSeconds: {
            i18nName: 'transit:networkDesign.nodeWeighting.maxWalkingTimeSeconds',
            type: 'seconds' as const,
            askAs: 'minutes' as const,
            default: NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS,
            validate: (value: number) => value > 0
        },
        decayFunctionParameters: {
            i18nName: 'transit:networkDesign.nodeWeighting.decayParameters',
            type: 'nested' as const,
            descriptor: new DecayFunctionParametersDescriptor()
        },
        weightingFileAttributes: {
            i18nName: 'transit:networkDesign.nodeWeighting.weightingFileAttributes',
            type: 'csvFile' as const,
            mappingDescriptors: nodeWeightingPoiMappingDescriptors,
            importFileName: 'node_weighting_poi.csv'
        }
    });

    validateOptions = (): { valid: boolean; errors: TranslatableMessage[] } => ({ valid: true, errors: [] });
}

const nodeWeightingOptionsDescriptor = new NodeWeightingOptionsDescriptor();

/**
 * Descriptor class for the OD trip simulation method options. It documents the
 * options, types, validation and default values. It also validates the whole
 * options object.
 *
 * The OD Trip simulation method simulates the network using origin-destination
 * trip routing results.
 */
export class OdTripSimulationDescriptor implements SimulationAlgorithmDescriptor<OdTripSimulationOptions> {
    getTranslatableName = (): string => 'transit:networkDesign.simulationMethods.odTrips.Title';

    // TODO Add help texts
    getOptions = () => ({
        demandAttributes: {
            i18nName: 'transit:networkDesign.simulationMethods.odTrips.demandAttributes',
            type: 'csvFile' as const,
            mappingDescriptors: odDemandFieldDescriptors,
            importFileName: 'transit_od_trips.csv',
            required: true
        },
        transitRoutingAttributes: {
            i18nName: 'transit:networkDesign.simulationMethods.odTrips.transitRoutingAttributes',
            type: 'nested' as const,
            descriptor: transitRoutingAttributesDescriptor
        },
        evaluationOptions: {
            i18nName: 'transit:networkDesign.simulationMethods.odTrips.simulationOptions',
            type: 'nested' as const,
            descriptor: simulationOptionsDescriptor
        },
        nodeWeighting: {
            i18nName: 'transit:networkDesign.simulationMethods.odTrips.nodeWeighting',
            type: 'nested' as const,
            descriptor: nodeWeightingOptionsDescriptor
        }
    });

    validateOptions = (
        options: Partial<OdTripSimulationOptions>
    ): { valid: boolean; errors: TranslatableMessage[] } => {
        let valid = true;
        const errors: TranslatableMessage[] = [];

        // Validate the demand attributes
        if (options.demandAttributes !== undefined) {
            const demandFieldMappers = new TransitOdTripSimulationDemandFromCsv(
                options.demandAttributes as OdTripSimulationDemandFromCsvAttributes
            );
            if (!demandFieldMappers.isValid()) {
                valid = false;
                errors.push(...demandFieldMappers.getErrors());
            }
        }

        // Validate node weighting when enabled with separate file (weighting file required)
        const nw = options.nodeWeighting;
        if (nw?.weightingEnabled && nw.weightingSource === 'separateFile') {
            if (nw.weightingFileAttributes === undefined) {
                valid = false;
                errors.push('transit:networkDesign.nodeWeighting.errors.weightingFileRequired');
            } else {
                const poiMapper = new NodeWeightingPoiFromCsv(nw.weightingFileAttributes);
                if (!poiMapper.isValid()) {
                    valid = false;
                    errors.push(...poiMapper.getErrors());
                }
            }
        }

        return { valid, errors };
    };
}
