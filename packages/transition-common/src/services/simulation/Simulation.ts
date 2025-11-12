/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import slugify from 'slugify';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { validateTrBaseAttributes } from '../transitRouting/TransitRoutingQueryAttributes';
import { TransitRoutingBaseAttributes } from 'chaire-lib-common/lib/services/routing/types';
import { SimulationParameters, validateSimulationParameters } from './SimulationParameters';
import { SimulationAlgorithmDescriptor } from './SimulationAlgorithm';
import { AlgorithmConfiguration, getAlgorithmDescriptor, getAllAlgorithmTypes } from './algorithm';

/**
 * Algorithm implementation should provide their own type, with a fixed value
 * for type, which allows them to type the options.
 */
export interface SimulationDataAttributes {
    simulationParameters: SimulationParameters;
    routingAttributes: TransitRoutingBaseAttributes;
    algorithmConfiguration?: AlgorithmConfiguration;
    [key: string]: unknown;
}

export interface SimulationAttributes extends GenericAttributes {
    isEnabled?: boolean;
    data: SimulationDataAttributes;
    // TODO Some fields now exist, but they will removed soon
    [key: string]: unknown;
}

// TODO This class is completely algorithm agnostic and should remain so. But it
// needs to be algorithm aware, with a proper API to advertise the various
// possible algorithms.
class Simulation extends ObjectWithHistory<SimulationAttributes> implements Saveable {
    protected static displayName = 'Simulation';

    private _collectionManager?: CollectionManager;

    constructor(attributes: Partial<SimulationAttributes>, isNew: boolean, collectionManager?: CollectionManager) {
        super(attributes, isNew);
        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;
    }

    protected _prepareAttributes(attributes: Partial<SimulationAttributes>): SimulationAttributes {
        const newAttributes = _cloneDeep(attributes);
        newAttributes.isEnabled = attributes.isEnabled !== undefined ? attributes.isEnabled : true;
        if (!newAttributes.data) {
            newAttributes.data = {
                simulationParameters: {},
                routingAttributes: {}
            };
        } else {
            if (!newAttributes.data.simulationParameters) {
                newAttributes.data.simulationParameters = {};
            }
            if (!newAttributes.data.routingAttributes) {
                newAttributes.data.routingAttributes = {};
            }
        }
        // Add undefined configuration options for algorithm to make sure all keys are defined
        const algoConfig = newAttributes.data.algorithmConfiguration;
        if (algoConfig && algoConfig.type) {
            const descriptor = getAlgorithmDescriptor(algoConfig.type);
            if (descriptor !== undefined) {
                const options = descriptor.getOptions();
                Object.keys(options).forEach((key) => {
                    if (algoConfig.config[key] === undefined) {
                        algoConfig.config[key] = undefined;
                    }
                });
            } else {
                console.log('Simulation: The algorithm if of unknown type: ', algoConfig.type);
            }
        }
        return super._prepareAttributes(newAttributes);
    }

    validate(): boolean {
        this._isValid = true;
        this._errors = [];
        if (!this.get('name')) {
            this._isValid = false;
            this._errors.push('transit:simulation:errors:NameIsRequired');
        }
        // Validate routing parameters
        const { valid: routingValid, errors: routingErrors } = validateTrBaseAttributes(
            this.attributes.data.routingAttributes
        );
        this._isValid = this._isValid && routingValid;
        this._errors.push(...routingErrors);

        // Validate simulation parameters
        const { valid: paramValid, errors: paramErrors } = validateSimulationParameters(
            this.attributes.data.simulationParameters
        );
        this._isValid = this._isValid && paramValid;
        this._errors.push(...paramErrors);

        // Validate algorithm
        const algoConfig = this.attributes.data.algorithmConfiguration;
        const algorithmId = algoConfig ? algoConfig.type : undefined;
        if (algoConfig !== undefined && algorithmId !== undefined) {
            // Make sure the algorithm is defined
            const availableAlgorithms = getAllAlgorithmTypes();
            if (!availableAlgorithms.includes(algorithmId)) {
                this._isValid = false;
                this._errors.push('transit:simulation:errors:UnknownAlgorithm');
            } else {
                const algorithmDescriptor = getAlgorithmDescriptor(algorithmId);
                if (algorithmDescriptor) {
                    // TODO Add a method to set the type of the algorithm and initialize the data
                    const options = algorithmDescriptor.getOptions();
                    if (algoConfig.config === undefined) {
                        algoConfig.config = {};
                    }
                    const erroneousFields = Object.keys(options).filter(
                        (option) =>
                            algoConfig.config[option] !== undefined &&
                            (options[option] as any).validate !== undefined &&
                            !(options[option] as any).validate(algoConfig.config[option])
                    );
                    if (erroneousFields.length > 0) {
                        this._isValid = false;
                        this._errors.push('main:InvalidFormFields');
                    }
                    const { valid: algoValid, errors: algoErrors } = algorithmDescriptor.validateOptions(
                        algoConfig.config
                    );
                    this._isValid = this._isValid && algoValid;
                    this._errors.push(...algoErrors);
                }
            }
        }

        return this._isValid;
    }

    toString(showId = true) {
        const shortname = this.attributes.shortname;
        const name = this.attributes.name;
        if (shortname && name) {
            return `${name} [${shortname}]`;
        } else if (name) {
            return name;
        } else if (shortname) {
            return shortname;
        }
        return showId ? this.id : undefined;
    }

    toStringSlugify(showId = true) {
        // slug: https://itnext.io/whats-a-slug-f7e74b6c23e0
        const shortname = this.attributes.shortname;
        if (shortname) {
            return slugify(`${shortname}${showId ? '_' + this.id : ''}`, {
                replacement: '_',
                remove: /[/^*=;:#$%?&|[\]{}+~.()'"!\\@]/g
            }); // regex for valid filenames
        }
        return showId ? slugify(this.id, { replacement: '_', remove: /[/^*=;:#$%?&|[\]{}+~.()'"!\\@]/g }) : undefined; // regex for valid filenames
    }

    getAlgorithmDescriptor(): SimulationAlgorithmDescriptor<any> | undefined {
        const algoType = this.attributes.data.algorithmConfiguration?.type;
        return algoType !== undefined ? getAlgorithmDescriptor(algoType) : undefined;
    }

    async delete(socket): Promise<Status.Status<{ id: string | undefined }>> {
        return SaveUtils.delete(this, socket, 'simulation', this._collectionManager?.get('simulations'));
    }

    async save(socket) {
        return SaveUtils.save(this, socket, 'simulation', this._collectionManager?.get('simulations'));
    }

    saveInMemory() {
        SaveUtils.saveInMemory(this, this._collectionManager ? this._collectionManager?.get('simulations') : undefined);
    }

    deleteInMemory() {
        SaveUtils.deleteInMemory(
            this,
            this._collectionManager ? this._collectionManager?.get('simulations') : undefined
        );
    }

    static getPluralName() {
        return 'simulations';
    }

    static getCapitalizedPluralName() {
        return 'Simulations';
    }

    static getDisplayName() {
        return Simulation.displayName;
    }
}

export default Simulation;
