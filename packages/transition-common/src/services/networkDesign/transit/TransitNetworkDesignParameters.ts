/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
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

export const MIN_TIME_BETWEEN_PASSAGES = 3;
export const MAX_TIME_BETWEEN_PASSAGES = 60;

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
        if (maxTimeBetweenPassages < MIN_TIME_BETWEEN_PASSAGES) {
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
