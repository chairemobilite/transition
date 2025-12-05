/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { ErrorMessage } from "chaire-lib-common/lib/utils/TrError";
import { SimulationAlgorithmDescriptor } from "./TransitNetworkDesignAlgorithm";
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import Agency from "../../agency/Agency";
import Service from "../../service/Service";
import Line from "../../line/Line";

export type TransitNetworkDesignParameters = {
    /** Maximum number of minutes between passages */
    maxTimeBetweenPassages: number;
    /** Minimum number of minutes between passages */
    minTimeBetweenPassages: number;
    /** Number of vehicles on the line */
    nbOfVehicles: number;
    /** Minimum number of lines for the network */
    numberOfLinesMin: number;
    /** Maximum number of lines for the network */
    numberOfLinesMax: number;
    /** List of services to add to the simulated scenario, these will not be modified */
    nonSimulatedServices: string[];
    // TODO: The following fields are for a simulation where all lines are
    // pre-generated. When more approaches are supported like auto-generation of
    // lines, re-think these parameters. Should they be algorithm parameters
    // instead?
    /** Agencies containing the lines to simulate */
    simulatedAgencies: string[];
    /** Lines to keep for all scenarios */
    linesToKeep: string[];
};

const MAX_TIME_BETWEEN_PASSAGES = 60;
const MIN_TIME_BETWEEN_PASSAGES = 3;

export const validateTransitNetworkDesignParameters = (
    parameters: Partial<TransitNetworkDesignParameters>
): { valid: boolean; errors: string[] } => {
    let valid = true;
    const errors: string[] = [];

    const numberOfLinesMin = parameters.numberOfLinesMin;
    if (numberOfLinesMin !== undefined) {
        if (numberOfLinesMin < 0) {
            valid = false;
            errors.push('transit:simulation:errors:NumberOfLinesMinNoNegative');
        }
    } 
    const numberOfLinesMax = parameters.numberOfLinesMax;
    if (numberOfLinesMax !== undefined) {
        if (numberOfLinesMax < 0) {
            valid = false;
            errors.push('transit:simulation:errors:NumberOfLinesMaxNoNegative');
        }
        if (numberOfLinesMin !== undefined && numberOfLinesMin > numberOfLinesMax) {
            valid = false;
            errors.push('transit:simulation:errors:NumberOfLinesMinHigherThanMax');
        }
    }
    const nbOfVehicles = parameters.nbOfVehicles;
    if (nbOfVehicles !== undefined) {
        if (nbOfVehicles < 0) {
            valid = false;
            errors.push('transit:simulation:errors:NumberOfVehiclesNoNegative');
        }
    }
    const maxTimeBetweenPassages = parameters.maxTimeBetweenPassages;
    if (maxTimeBetweenPassages !== undefined) {
        if (maxTimeBetweenPassages > MAX_TIME_BETWEEN_PASSAGES) {
            valid = false;
            errors.push('transit:simulation:errors:MaxTimeBetweenPassagesTooHigh');
        }
        if (maxTimeBetweenPassages < 0) {
            valid = false;
            errors.push('transit:simulation:errors:MaxTimeBetweenPassagesNoNegative');
        }
    }
    const minTimeBetweenPassages = parameters.minTimeBetweenPassages;
    if (minTimeBetweenPassages !== undefined) {
        if (minTimeBetweenPassages < MIN_TIME_BETWEEN_PASSAGES) {
            valid = false;
            errors.push('transit:simulation:errors:MinTimeBetweenPassagesTooLow');
        }
        if (minTimeBetweenPassages > MAX_TIME_BETWEEN_PASSAGES) {
            valid = false;
            errors.push('transit:simulation:errors:MinTimeBetweenPassagesTooHigh');
        }
        if (maxTimeBetweenPassages !== undefined && minTimeBetweenPassages > maxTimeBetweenPassages) {
            valid = false;
            errors.push('transit:simulation:errors:MinTimeHigherThanMax');
        }
    }
    const agencies = parameters.simulatedAgencies;
    if (agencies === undefined || agencies.length === 0) {
        valid = false;
        errors.push('transit:simulation:errors:SimulatedAgenciesIsEmpty');
    }

    return { valid, errors };
};

export class TransitNetworkDesignDescriptor implements SimulationAlgorithmDescriptor<TransitNetworkDesignParameters> {
    
    getTranslatableName(): string {
        return 'transit:networkDesign.TransitNetworkDesignParameters';
    }

    getOptions() {
        return {
            numberOfLinesMin: {
                i18nName: 'transit:networkDesign.parameters.NumberOfLinesMin',
                type: 'integer' as const,
                validate: (value: number) => value >= 1,
                required: true
            },
            numberOfLinesMax: {
                i18nName: 'transit:networkDesign.parameters.NumberOfLinesMax',
                type: 'integer' as const,
                validate: (value: number) => value >= 1,
                required: true
            },
            maxTimeBetweenPassages: {
                i18nName: 'transit:networkDesign.parameters.MaxIntervalMinutes',
                i18nHelp: 'transit:networkDesign.parameters.help.MaxIntervalMinutes',
                type: 'integer' as const,
                validate: (value: number) => value >= MIN_TIME_BETWEEN_PASSAGES,
                default: 30,
                required: true
            },
            minTimeBetweenPassages: {
                i18nName: 'transit:networkDesign.parameters.MinIntervalMinutes',
                i18nHelp: 'transit:networkDesign.parameters.help.MinIntervalMinutes',
                type: 'integer' as const,
                validate: (value: number) => value >= MIN_TIME_BETWEEN_PASSAGES,
                default: 5,
                required: true
            },
            nbOfVehicles: {
                i18nName: 'transit:networkDesign.parameters.VehiclesCount',
                type: 'integer' as const,
                validate: (value: number) => value >= 1,
                required: true
            },
            simulatedAgencies: {
                i18nName: 'transit:networkDesign.parameters.LineSetAgencies',
                i18nHelp: 'transit:networkDesign.parameters.help.LineSetAgencies',
                type: 'multiselect' as const,
                required: true,
                choices: () => 
                    serviceLocator.collectionManager.get('agencies')?.getFeatures().map((agency: Agency) => ({
                        value: agency.getId(),
                        label: agency.toString()
                    })) || []
            },
            nonSimulatedServices: {
                i18nName: 'transit:networkDesign.parameters.NonSimulatedServices',
                i18nHelp: 'transit:networkDesign.parameters.help.NonSimulatedServices',
                type: 'multiselect' as const,
                choices: () => 
                    serviceLocator.collectionManager.get('services')?.getFeatures().map((service: Service) => ({
                        value: service.getId(),
                        label: service.attributes.name || service.getId()
                    })) || []
                
            },
            linesToKeep: {
                i18nName: 'transit:networkDesign.parameters.KeepLines',
                i18nHelp: 'transit:networkDesign.parameters.help.KeepLines',
                type: 'multiselect' as const,
                choices: (object: Record<string, unknown>) => {
                    const agencyCollection = serviceLocator.collectionManager.get('agencies')
                    if (!agencyCollection) {
                        return [];
                    }
                    const simulatedAgencies: string[] = object.simulatedAgencies as string[] || [];
                    return simulatedAgencies.flatMap((agencyId: string) => {
                        const agency: Agency | undefined = agencyCollection?.getById(agencyId);
                        if (!agency) {
                            return [];
                        }
                        const lines = agency.getLines();
                        return lines.map((line: Line) => ({
                            value: line.getId(),
                            label: line.toString()
                        }));
                    });
                }
            }
        };
    }

    validateOptions(options: Partial<TransitNetworkDesignParameters>): { valid: boolean; errors: ErrorMessage[] } {
        return validateTransitNetworkDesignParameters(options);
    }
}

export const transitNetworkDesignDescriptor = new TransitNetworkDesignDescriptor();
