/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import random from 'random';
import { EventEmitter } from 'events';

import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import { GenericAttributes, GenericObject } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import { AlgorithmConfiguration } from '../networkDesign/transit/algorithm';
import { TransitNetworkDesignParameters } from '../networkDesign/transit/TransitNetworkDesignParameters';
import { TransitRoutingBaseAttributes } from 'chaire-lib-common/lib/services/routing/types';

export type SimulationRuntimeOptions = {
    numberOfThreads: number;
    fitnessSorter: string;
    trRoutingStartingPort: number;
    cachePathDirectory?: string; // the cache directory used to save cache for this simulation run
    // FIXME type this better (and rename? function is not clear). Also use an
    // array instead of map, as a same method could be used with different
    // weight and data (for example, 2 sets of odTrips from which to sample).
    // Also don't put the weight at the same level as the other parameters
    functions: {
        [key: string]: {
            weight: number;
            [key: string]: unknown;
        };
    };
    [key: string]: unknown;
};

/** Same as SimulationDataAttributes, but with mandatory algorithm configuration */
export interface SimulationRunDataAttributes {
    transitNetworkDesignParameters: TransitNetworkDesignParameters;
    routingAttributes: TransitRoutingBaseAttributes;
    algorithmConfiguration: AlgorithmConfiguration;
    [key: string]: unknown;
}

export interface SimulationRunAttributes extends GenericAttributes {
    simulation_id: string;
    status: 'notStarted' | 'pending' | 'inProgress' | 'completed' | 'failed';
    data: SimulationRunDataAttributes;
    results?: { [key: string]: unknown };
    seed?: string;
    options: SimulationRuntimeOptions;
    started_at?: Date;
    completed_at?: Date;
}

/**
 * Class to track individual simulation runs. This class is not meant to be
 * modified directly, but rather use workflow methods in its API to execute the
 * various steps of the algorithm execution.
 *
 * TODO Deprecate in favor of ExecutableJob objects with configuration stored in data
 */
class SimulationRun extends GenericObject<SimulationRunAttributes> implements Saveable {
    protected static displayName = 'SimulationRun';
    private static socketPrefix = 'simulationRun';

    constructor(attributes: Partial<SimulationRunAttributes>, isNew: boolean) {
        super(attributes, isNew);
    }

    protected _prepareAttributes(attributes: Partial<SimulationRunAttributes>): SimulationRunAttributes {
        const newAttributes = _cloneDeep(attributes);
        if (!newAttributes.status) {
            newAttributes.status = 'notStarted';
        }
        return super._prepareAttributes(newAttributes);
    }

    toString(includeSimulationId = false) {
        // TODO: show less characters of the uuid for shorter strings (need a way later on to be able to refetch the original uuid)
        return `${includeSimulationId ? `sim_${this.attributes.simulation_id}_` : ''}run_${this.getId()}`;
    }

    validate(): boolean {
        this._isValid = true;
        this._errors = [];

        return this._isValid;
    }

    getRandomGenerator() {
        let seed = this.attributes.seed;
        if (seed === undefined) {
            // Generate a random seed, so the simulation can be re-done
            seed = random.integer(100000, 999999).toString();
            this.attributes.seed = seed;
        }
        return random.clone(seed);
    }

    setStarted() {
        this.attributes.status = 'inProgress';
        this.attributes.started_at = new Date();
    }

    setCompleted() {
        this.attributes.status = 'completed';
        this.attributes.completed_at = new Date();
    }

    /**
     * Delete a simulation run
     *
     * @param socket The socket on which to send the events
     * @param cascade if `true`, the scenarios and services associated with this
     * run will also be deleted. If `false`, they will be set to null instead,
     * but kept in the database.
     * @returns
     */
    async delete(socket: EventEmitter, cascade = false) {
        return new Promise((resolve) => {
            const id = this.attributes.id;
            socket.emit(`${SimulationRun.socketPrefix}.delete`, this.attributes.id, cascade, (response) => {
                this.set('id', id);
                this.setDeleted();
                resolve(response);
            });
        });
    }

    async save(socket: EventEmitter) {
        return SaveUtils.save(this, socket, SimulationRun.socketPrefix, undefined);
    }

    static getPluralName() {
        return 'simulationRuns';
    }

    static getCapitalizedPluralName() {
        return 'SimulationRuns';
    }

    static getDisplayName() {
        return SimulationRun.displayName;
    }
}

export default SimulationRun;
