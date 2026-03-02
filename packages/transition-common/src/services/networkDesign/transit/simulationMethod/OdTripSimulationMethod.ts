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
    DECAY_TYPES_WITH_BETA,
    DECAY_TYPE_VALUES,
    type DecayFunctionType,
    type DecayFunctionParameters
} from '../../../weighting/types';
import {
    type NodeWeightingConfig,
    type NodeWeightingPoiFileAttributes,
    type NodeWeightingOdFileAttributes,
    type WeightingInputType,
    NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS,
    NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS,
    nodeWeightingPoiMappingDescriptors,
    getNodeWeightingMappingDescriptors,
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
type DecayParametersOptions = { type: DecayFunctionType; beta?: number };

class DecayFunctionParametersDescriptor implements SimulationAlgorithmDescriptor<DecayParametersOptions> {
    getTranslatableName = (): string => 'transit:networkDesign.nodeWeighting.decayParameters';

    getOptions = () => ({
        type: {
            i18nName: 'transit:networkDesign.nodeWeighting.decayTypeLabel',
            type: 'select' as const,
            default: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS.type as DecayFunctionType,
            choices: (_obj: Record<string, unknown>) =>
                DECAY_TYPE_VALUES.map((value) => ({
                    value,
                    label: `transit:networkDesign.nodeWeighting.decayType.${value}`
                }))
        },
        beta: {
            i18nName: 'transit:networkDesign.nodeWeighting.decayBeta',
            type: 'number' as const,
            default: NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS.beta,
            validate: (value: number) => value > 0
        }
    });

    validateOptions = (options: Partial<DecayParametersOptions>): { valid: boolean; errors: TranslatableMessage[] } => {
        const errors: TranslatableMessage[] = [];
        const type = options.type;
        if (type !== undefined && !DECAY_TYPE_VALUES.includes(type)) {
            errors.push('transit:networkDesign.nodeWeighting.errors.decayTypeInvalid');
        }
        if (type !== undefined && DECAY_TYPES_WITH_BETA.includes(type)) {
            const beta = options.beta;
            if (beta === undefined || beta === null) {
                errors.push('transit:networkDesign.nodeWeighting.errors.decayBetaRequired');
            } else if (typeof beta !== 'number' || beta <= 0) {
                errors.push('transit:networkDesign.nodeWeighting.errors.decayBetaInvalid');
            }
        }
        return { valid: errors.length === 0, errors };
    };
}

export class NodeWeightingOptionsDescriptor implements SimulationAlgorithmDescriptor<NodeWeightingConfig> {
    getTranslatableName = (): string => 'transit:networkDesign.simulationMethods.odTrips.nodeWeighting';

    getOptions = () => ({
        weightingEnabled: {
            i18nName: 'transit:networkDesign.nodeWeighting.weightingEnabled',
            type: 'boolean' as const,
            default: false
        },
        odWeightingPoints: {
            i18nName: 'transit:networkDesign.nodeWeighting.odWeightingPointsLabel',
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

/** Exported for standalone node weighting form (Nodes section). */
export const nodeWeightingOptionsDescriptor = new NodeWeightingOptionsDescriptor();

/**
 * Minimal node weighting options for the network design form only.
 * Shows only "Node weighting enabled"; decay, source, max walking time and file are configured in the Nodes section.
 */
export type MinimalNodeWeightingFormValue = { weightingEnabled: boolean };

class MinimalNodeWeightingOptionsDescriptor implements SimulationAlgorithmDescriptor<MinimalNodeWeightingFormValue> {
    getTranslatableName = (): string => 'transit:networkDesign.simulationMethods.odTrips.nodeWeighting';

    getOptions = () => ({
        weightingEnabled: {
            i18nName: 'transit:networkDesign.nodeWeighting.weightingEnabled',
            type: 'boolean' as const,
            default: false
        }
    });

    validateOptions = (): { valid: boolean; errors: TranslatableMessage[] } => ({ valid: true, errors: [] });
}

const minimalNodeWeightingOptionsDescriptor = new MinimalNodeWeightingOptionsDescriptor();

/**
 * Form value type for standalone node weighting (Nodes section).
 * Only the four fields shown in the form; no weightingEnabled or odWeightingPoints.
 */
export type StandaloneNodeWeightingFormValue = {
    weightingInputType: WeightingInputType;
    maxWalkingTimeSeconds: number;
    decayFunctionParameters: DecayFunctionParameters;
    /** POI format when weightingInputType is 'poi'; OD format (origin/destination columns) when odOrigins/odDestinations/odBoth. */
    weightingFileAttributes: NodeWeightingPoiFileAttributes | NodeWeightingOdFileAttributes;
};

/**
 * Descriptor for the standalone node weighting form (Nodes section).
 * Omits "Node weighting enabled"; replaces source + OD points with a single "input file type" radio.
 */
export class StandaloneNodeWeightingOptionsDescriptor
implements SimulationAlgorithmDescriptor<StandaloneNodeWeightingFormValue> {
    getTranslatableName = (): string => 'transit:networkDesign.nodeWeighting.NodeWeightingSectionTitle';

    getOptions = () => ({
        weightingInputType: {
            i18nName: 'transit:networkDesign.nodeWeighting.weightingInputTypeLabel',
            type: 'select' as const,
            default: 'poi' as const,
            choices: (_obj: Record<string, unknown>) => [
                { value: 'poi', label: 'transit:networkDesign.nodeWeighting.weightingInputType.poi' },
                { value: 'odOrigins', label: 'transit:networkDesign.nodeWeighting.weightingInputType.odOrigins' },
                {
                    value: 'odDestinations',
                    label: 'transit:networkDesign.nodeWeighting.weightingInputType.odDestinations'
                },
                { value: 'odBoth', label: 'transit:networkDesign.nodeWeighting.weightingInputType.odBoth' }
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
            importFileName: 'node_weighting_poi.csv',
            getMappingDescriptors: (context: Record<string, unknown>) =>
                getNodeWeightingMappingDescriptors((context.weightingInputType as WeightingInputType) ?? 'poi')
        }
    });

    validateOptions = (): { valid: boolean; errors: TranslatableMessage[] } => ({ valid: true, errors: [] });
}

export const standaloneNodeWeightingOptionsDescriptor = new StandaloneNodeWeightingOptionsDescriptor();

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

        // Validate node weighting when enabled
        const nodeWeighting = options.nodeWeighting;
        if (nodeWeighting?.weightingEnabled) {
            if (nodeWeighting.maxWalkingTimeSeconds === undefined || nodeWeighting.maxWalkingTimeSeconds <= 0) {
                valid = false;
                errors.push('transit:networkDesign.nodeWeighting.errors.maxWalkingTimeSecondsInvalid');
            }

            // Validate decay parameters
            const decayDescriptor = new DecayFunctionParametersDescriptor();
            const decayValidation = decayDescriptor.validateOptions(nodeWeighting.decayFunctionParameters ?? {});
            if (!decayValidation.valid) {
                valid = false;
                errors.push(...decayValidation.errors);
            }

            // Validate weighting file when present
            if (nodeWeighting.weightingFileAttributes !== undefined) {
                const poiMapper = new NodeWeightingPoiFromCsv(
                    nodeWeighting.weightingFileAttributes as NodeWeightingPoiFileAttributes
                );
                if (!poiMapper.isValid()) {
                    valid = false;
                    errors.push(...poiMapper.getErrors());
                }
            }
        }

        return { valid, errors };
    };
}

/**
 * OD Trip descriptor for the network design form only.
 * Node weighting shows only "Node weighting enabled"; upload of node weights file is handled by the form.
 */
export class OdTripSimulationDescriptorForNetworkDesign
implements SimulationAlgorithmDescriptor<OdTripSimulationOptions> {
    getTranslatableName = (): string => 'transit:networkDesign.simulationMethods.odTrips.Title';

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
            descriptor: minimalNodeWeightingOptionsDescriptor
        }
    });

    validateOptions = (
        options: Partial<OdTripSimulationOptions>
    ): { valid: boolean; errors: TranslatableMessage[] } => {
        let valid = true;
        const errors: TranslatableMessage[] = [];

        if (options.demandAttributes !== undefined) {
            const demandFieldMappers = new TransitOdTripSimulationDemandFromCsv(
                options.demandAttributes as OdTripSimulationDemandFromCsvAttributes
            );
            if (!demandFieldMappers.isValid()) {
                valid = false;
                errors.push(...demandFieldMappers.getErrors());
            }
        }

        // Node weighting: only weightingEnabled is shown; no validation of decay/source/file here
        return { valid, errors };
    };
}
