/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Results for a single candidate of the evolutionary algorithm
 */
export type CandidateResult = {
    /**
     * Total fitness of this candidate, considering each individual method. It
     * may be relative to other candidates, so it can be initialized to
     * `Number.NaN` if still unknown
     */
    totalFitness: number;
    /**
     * Key is the simulation method and the value is the detail for this method
     */
    results: { [method: string]: { fitness: number; results: unknown } };
};

/**
 * Serialization type for storing and retrieving candidate results
 */
export type ResultSerialization = {
    lines: {
        /** The key is the ID of the active lines, the object is the details to
         * reproduce the services  */
        [lineId: string]: {
            shortname: string;
            nbVehicles: number;
            timeBetweenPassages: number;
            outboundPathId: string;
            inboundPathId?: string;
        };
    };
    numberOfLines: number;
    numberOfVehicles: number;
    result: CandidateResult;
};
