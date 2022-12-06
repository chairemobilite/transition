/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash.clonedeep';

import {
    exists,
    read as defaultRead,
    create,
    createMultiple,
    update,
    updateMultiple,
    deleteRecord,
    deleteMultiple,
    truncate,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { SimulationAttributes, SimulationDataAttributes } from 'transition-common/lib/services/simulation/Simulation';

const tableName = 'tr_simulations';

const attributesCleaner = function (attributes: Partial<SimulationAttributes>) {
    const _attributes: any = _cloneDeep(attributes);
    _attributes.is_enabled = attributes.isEnabled;
    delete _attributes.isEnabled;
    return _attributes;
};

type SimulationDbAttributes = {
    id: string;
    internal_id: string;
    shortname: string;
    name: string;
    color: string;
    description: string;
    is_enabled: boolean;
    is_frozen: boolean;
    data: SimulationDataAttributes;
};

const attributesParser = ({
    internal_id,
    shortname,
    name,
    color,
    description,
    is_enabled,
    ...rest
}: SimulationDbAttributes): Partial<SimulationAttributes> => ({
    internal_id: internal_id || undefined,
    shortname: shortname || undefined,
    name: name || undefined,
    color: color || undefined,
    description: description || undefined,
    isEnabled: is_enabled !== null ? is_enabled : true,
    ...rest
});

const collection = async (): Promise<SimulationAttributes[]> => {
    try {
        const response = await knex.raw(
            `
      SELECT 
        sim.*,
        COALESCE(sim.color, '${Preferences.current.simulations.defaultColor}') as color
      FROM tr_simulations sim 
      WHERE sim.is_enabled IS TRUE
      ORDER BY sim.shortname, sim.name, sim.id;
    `
        );
        const collection = response.rows;
        if (collection) {
            return collection.map(attributesParser);
        }
        throw new TrError(
            'cannot fetch transit Simulations collection because database did not return a valid array',
            'TSIMGQGC0001',
            'TransitSimulationCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch transit Simulations collection because of a database error (knex error: ${error})`,
            'TSIMGQGC0002',
            'TransitSimulationCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const read = async (id: string) => {
    return await defaultRead<SimulationAttributes, SimulationDbAttributes>(knex, tableName, attributesParser, '*', id);
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: SimulationAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    createMultiple: (newObjects: SimulationAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<SimulationAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<SimulationAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
