/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { ObjectWithHistory } from 'chaire-lib-common/lib/utils/objects/ObjectWithHistory';
// import TransitGarage from '../../../../../../src/models/transition/transit/Garage';
import SaveUtils from 'chaire-lib-common/lib/services/objects/SaveUtils';
import Saveable from 'chaire-lib-common/lib/utils/objects/Saveable';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

const onlyExceptAttributes = [
    'only_agencies',
    'except_agencies',
    'only_lines',
    'except_lines',
    'only_nodes',
    'except_nodes',
    'only_modes',
    'except_modes'
];
export interface ScenarioAttributes extends GenericAttributes {
    services: string[];
    only_agencies: string[];
    except_agencies: string[];
    only_lines: string[];
    except_lines: string[];
    only_nodes: string[];
    except_nodes: string[];
    only_modes: string[];
    except_modes: string[];
    simulation_id?: string;
    is_enabled?: boolean;
}

class Scenario extends ObjectWithHistory<ScenarioAttributes> implements Saveable {
    protected static displayName = 'Scenario';
    private _collectionManager: any;

    constructor(attributes = {}, isNew, collectionManager?) {
        super(attributes, isNew);

        this._collectionManager = collectionManager ? collectionManager : serviceLocator.collectionManager;
    }

    _prepareAttributes(attributes: Partial<ScenarioAttributes>) {
        for (let i = 0; i < onlyExceptAttributes.length; i++) {
            if (!attributes[onlyExceptAttributes[i]]) {
                attributes[onlyExceptAttributes[i]] = [];
            }
        }
        return super._prepareAttributes(attributes);
    }

    get collectionManager(): any {
        // TODO: test or use dependency injection
        return this._collectionManager;
    }

    validate() {
        this._isValid = true;
        this._errors = [];
        if (!this.get('name')) {
            this._isValid = false;
            this._errors.push('transit:transitScenario:errors:NameIsRequired');
        }
        if (_isBlank(this.get('services'))) {
            this._isValid = false;
            this._errors.push('transit:transitScenario:errors:ServicesAreRequired');
        }
        return this._isValid;
    }

    getSimulation() {
        // TODO: test
        if (this._collectionManager.get('simulations') && this.get('simulation_id')) {
            return this._collectionManager.get('simulations').getById(this.get('simulation_id'));
        } else {
            return null;
        }
    }

    toString(showId = false) {
        const name = this.get('name');
        if (name) {
            return name + (showId ? ` ${this.getId()}` : '');
        }
        return this.getId();
    }

    async delete(socket): Promise<Status.Status<{ id: string | undefined }>> {
        return SaveUtils.delete(this, socket, 'transitScenario', this._collectionManager.get('scenarios'));
    }

    async save(socket) {
        return SaveUtils.save(this, socket, 'transitScenario', this._collectionManager.get('scenarios'));
    }

    saveInMemory() {
        SaveUtils.saveInMemory(this, this._collectionManager ? this._collectionManager.get('scenarios') : undefined);
    }

    deleteInMemory() {
        SaveUtils.deleteInMemory(this, this._collectionManager ? this._collectionManager.get('scenarios') : undefined);
    }

    static getPluralName() {
        return 'scenarios';
    }

    static getCapitalizedPluralName() {
        return 'Scenarios';
    }

    static getDisplayName() {
        return Scenario.displayName;
    }
}

export default Scenario;
