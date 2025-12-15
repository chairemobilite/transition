/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as AlgoTypes from '../internalTypes';
import { EventEmitter } from 'events';
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import { EvolutionaryTransitNetworkDesignJobType } from '../../networkDesign/transitNetworkDesign/evolutionary/types';
import { TransitNetworkDesignJobWrapper } from '../../networkDesign/transitNetworkDesign/TransitNetworkDesignJobWrapper';

export type Result = {
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

export type ResultSerialization = {
    lines: {
        /** The key is the ID of the active lines, the object is the details to
         * reproduce the services  */
        [lineId: string]: {
            shortname: string;
            nbVehicles: number;
        };
    };
    numberOfLines: number;
    numberOfVehicles: number;
    result: Result;
};

/**
 * Represents one candidate network
 */
abstract class Candidate {
    protected result: Result | undefined;

    constructor(
        protected chromosome: AlgoTypes.CandidateChromosome,
        protected wrappedJob: TransitNetworkDesignJobWrapper<EvolutionaryTransitNetworkDesignJobType>
    ) {
        // Nothing to do
    }

    toString() {
        return JSON.stringify(this.chromosome.lines);
    }

    getChromosome(): AlgoTypes.CandidateChromosome {
        return this.chromosome;
    }

    getResult(): Result {
        const result = this.result;
        if (result === undefined) {
            throw 'Result does not exist yet, this method should not have been called';
        }
        return result;
    }

    abstract serialize(): ResultSerialization;

    abstract prepareScenario(socket: EventEmitter): Promise<Scenario>;

    abstract simulate(): Promise<Result>;

    abstract getScenario(): Scenario | undefined;
}

export default Candidate;
