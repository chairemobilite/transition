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
import { CandidateResult, ResultSerialization } from './types';

/**
 * Represents one candidate network
 */
abstract class Candidate {
    protected result: CandidateResult | undefined;

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

    getResult(): CandidateResult {
        const result = this.result;
        if (result === undefined) {
            throw 'Result does not exist yet, this method should not have been called';
        }
        return result;
    }

    abstract serialize(): ResultSerialization;

    abstract prepareScenario(socket: EventEmitter): Promise<Scenario>;

    abstract simulate(): Promise<CandidateResult>;

    abstract getScenario(): Scenario | undefined;
}

export default Candidate;
