/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash/cloneDeep';
import {
    exists,
    create as defaultCreate,
    createMultiple as defaultCreateMultiple,
    update as defaultUpdate,
    updateMultiple as defaultUpdateMultiple,
    deleteRecord,
    deleteMultiple,
    truncate,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { ScenarioAttributes } from 'transition-common/lib/services/scenario/Scenario';
import { Knex } from 'knex';

const tableName = 'tr_transit_scenarios';
const scenarioServiceTableName = 'tr_transit_scenario_services';
const servicesTableName = 'tr_transit_services';

// TODO Type the return values
const attributesCleaner = function (attributes: Partial<ScenarioAttributes>): { [key: string]: any } {
    const _attributes: any = _cloneDeep(attributes);
    delete _attributes.services;
    // Set null any undefined, but specified attribute
    Object.keys(_attributes).forEach(
        (attrib) => (_attributes[attrib] = _attributes[attrib] === undefined ? null : _attributes[attrib])
    );
    return _attributes;
};

const attributesParser = (dbAttributes: {
    id: string;
    data: { [key: string]: unknown };
    [key: string]: unknown | null;
}): Partial<ScenarioAttributes> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, data, ...rest } = dbAttributes;
    Object.keys(rest).forEach(
        (key) => (dbAttributes[key] = dbAttributes[key] !== null ? dbAttributes[key] : undefined)
    );
    return dbAttributes as unknown as ScenarioAttributes;
};

const collection = async (): Promise<ScenarioAttributes[]> => {
    try {
        // TODO When the complete collection is not sent to the client directly, there should be a sort option to this method
        const response = await knex.raw(
            `
      SELECT 
        sc.*,
        COALESCE(color, '${Preferences.current.transit.scenarios.defaultColor}') as color,
        array_remove(ARRAY_AGG(scserv.service_id), null) as services
      FROM tr_transit_scenarios sc
      LEFT JOIN tr_transit_scenario_services scserv on sc.id = scserv.scenario_id
      WHERE is_enabled IS TRUE
      GROUP BY sc.id
      ORDER BY sc.name;
    `
        );
        const collection = response.rows;
        if (collection) {
            return collection.map(attributesParser);
        }
    } catch (error) {
        throw new TrError(
            `cannot fetch transit scenarios collection because of a database error (knex error: ${error})`,
            'THQGC0002',
            'TransitScenarioCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
    throw new TrError(
        'cannot fetch transit scenarios collection because database did not return a valid array',
        'THQGC0001',
        'TransitScenarioCollectionCouldNotBeFetchedBecauseDatabaseError'
    );
};

const read = async (id: string) => {
    try {
        const rows = await knex
            .select(
                'sc.*',
                knex.raw(`COALESCE(color, '${Preferences.current.transit.scenarios.defaultColor}') as color`),
                knex.raw('array_remove(ARRAY_AGG(scserv.service_id), null) as services')
            )
            .from(`${tableName} as sc`)
            .leftJoin('tr_transit_scenario_services as scserv', 'sc.id', 'scserv.scenario_id')
            .where('sc.id', id)
            .groupBy('sc.id', 'scserv.scenario_id');
        if (rows && rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRDPLC0002',
                'DatabaseCannotReadScenarioBecauseObjectDoesNotExist'
            );
        }
        return attributesParser(rows[0]);
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'THQGC0002',
            'TransitScenarioCannotReadBecauseDatabaseError'
        );
    }
};

const create = async (
    newObject: ScenarioAttributes,
    { transaction, ...options }: Parameters<typeof defaultCreate>[4] = {}
) => {
    try {
        // Nested function to require a transaction around the insert
        const createWithTransaction = async (trx: Knex.Transaction) => {
            const services = newObject.services || [];
            // Create the main object in main table
            const created = await defaultCreate(knex, tableName, attributesCleaner, newObject, {
                transaction: trx,
                ...options
            });

            if (services.length > 0) {
                // Fill the service table
                const scenarioServices = services.map((serviceId: string) => ({
                    scenario_id: newObject.id,
                    service_id: serviceId
                }));
                await knex(scenarioServiceTableName).insert(scenarioServices).transacting(trx);
            }
            return created;
        };
        // Make sure the insert is done in a transaction, use the one in the options if available
        return transaction ? await createWithTransaction(transaction) : await knex.transaction(createWithTransaction);
    } catch (error) {
        throw new TrError(
            `Cannot insert services for scenario with id ${newObject.id} in table ${scenarioServiceTableName} database (knex error: ${error})`,
            'THQGC0003',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

const createMultiple = async (
    newObjects: ScenarioAttributes[],
    { transaction, ...options }: Parameters<typeof defaultCreateMultiple>[4] = {}
) => {
    try {
        // Nested function to require a transaction around the inserts
        const createWithTransaction = async (trx: Knex.Transaction) => {
            const services = newObjects
                .map((newObject) => ({ scenario_id: newObject.id, services: newObject.services || [] }))
                .filter((scServices) => scServices.services.length > 0);
            // Create the main object in main table
            const created = await defaultCreateMultiple(knex, tableName, attributesCleaner, newObjects, {
                transaction: trx,
                ...options
            });

            if (services.length > 0) {
                // Fill the service table
                const scenarioServices = services.flatMap((scServices) =>
                    scServices.services.map((service) => ({ scenario_id: scServices.scenario_id, service_id: service }))
                );
                await knex(scenarioServiceTableName).insert(scenarioServices).transacting(trx);
            }
            return created;
        };
        // Make sure the inserts are done in a transaction, use the one in the options if available
        return transaction ? await createWithTransaction(transaction) : await knex.transaction(createWithTransaction);
    } catch (error) {
        throw new TrError(
            `Cannot insert services for scenarios in table ${scenarioServiceTableName} database (knex error: ${error})`,
            'THQGC0004',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

// Private function to delete old services and add new ones
const _updateServicesForScenario = async (scenario_id: string, services: string[], transaction: Knex.Transaction) => {
    // Delete services that are not in the scenario anymore
    await knex(scenarioServiceTableName)
        .where('scenario_id', scenario_id)
        .whereNotIn('service_id', services)
        .del()
        .transacting(transaction);

    // Upsert the updated services
    if (services.length > 0) {
        const updatedServices = services.map((serviceId) => ({ scenario_id: scenario_id, service_id: serviceId }));
        await knex(scenarioServiceTableName).insert(updatedServices).onConflict().ignore().transacting(transaction);
    }
};

const update = async (
    id: string,
    updatedObject: Partial<ScenarioAttributes>,
    { transaction, ...options }: Parameters<typeof defaultUpdate>[5] = {}
) => {
    try {
        // Nested function to require a transaction around the update
        const updateWithTransaction = async (trx: Knex.Transaction) => {
            // Update the main object in main table
            const updated = await defaultUpdate(knex, tableName, attributesCleaner, id, updatedObject, {
                transaction: trx,
                ...options
            });

            // Update services if they are not undefined (partial update)
            const services = updatedObject.services;
            if (services !== undefined) {
                await _updateServicesForScenario(id, services, trx);
            }
            return updated;
        };
        // Make sure the update is done in a transaction, use the one in the options if available
        return transaction ? await updateWithTransaction(transaction) : await knex.transaction(updateWithTransaction);
    } catch (error) {
        throw new TrError(
            `Cannot update services for scenarios in table ${scenarioServiceTableName} database (knex error: ${error})`,
            'THQGC0004',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

const updateMultiple = async (
    updatedObjects: Partial<ScenarioAttributes>[],
    { transaction, ...options }: Parameters<typeof defaultUpdateMultiple>[4] = {}
) => {
    try {
        // Nested function to require a transaction around the updates
        const updateWithTransaction = async (trx: Knex.Transaction) => {
            // Update multiple scenarios
            const updated = await defaultUpdateMultiple(knex, tableName, attributesCleaner, updatedObjects, {
                transaction: trx,
                ...options
            });

            // Update services if they are not undefined (partial update)
            const objectsToUpdate = updatedObjects.filter((object) => object.services !== undefined);
            if (objectsToUpdate.length > 0) {
                // Update services for each scenario individually
                const updateServicesPromises = objectsToUpdate.map((objectToUpdate) =>
                    _updateServicesForScenario(objectToUpdate.id as string, objectToUpdate.services as string[], trx)
                );
                await Promise.all(updateServicesPromises);
            }
            return updated;
        };
        // Make sure the updates are done in a transaction, use the one in the options if available
        return transaction ? await updateWithTransaction(transaction) : await knex.transaction(updateWithTransaction);
    } catch (error) {
        throw new TrError(
            `Cannot update services for scenarios in table ${scenarioServiceTableName} database (knex error: ${error})`,
            'THQGC0004',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

// private function to completely delete the services if they were used only the
// scenario with given ID
const _cascadeDeleteServices = async (scenarioId: string, { transaction }: { transaction: Knex.Transaction }) => {
    const innerScenarioServiceQuery = knex
        .select('service_id')
        .from(`${scenarioServiceTableName}`)
        .where('scenario_id', scenarioId);
    const countServiceQuery = knex
        .select('service_id')
        .from(`${scenarioServiceTableName}`)
        .count()
        .whereIn('service_id', innerScenarioServiceQuery)
        .groupBy('service_id')
        .as('servCount');
    const servicesOnlyInThisScenarioQuery = knex.select('service_id').from(countServiceQuery).where('count', '=', 1);
    return knex(servicesTableName).whereIn('id', servicesOnlyInThisScenarioQuery).del().transacting(transaction);
};

const deleteScenario = async (
    id: string,
    cascade = false,
    { transaction, ...options }: Parameters<typeof deleteRecord>[3] = {}
) => {
    try {
        // Nested function to require a transaction around the delete
        const deleteWithTransaction = async (trx: Knex.Transaction) => {
            if (cascade) {
                await _cascadeDeleteServices(id, { transaction: trx });
            }
            return deleteRecord(knex, tableName, id, { transaction: trx, ...options });
        };
        // Make sure the delete is done in a transaction, use the one in the options if available
        return await (transaction ? deleteWithTransaction(transaction) : knex.transaction(deleteWithTransaction));
    } catch (error) {
        throw new TrError(
            `cannot delete scenario because of a database error (knex error: ${error})`,
            'THQGC0005',
            'TransitScenarioCannotDeleteBecauseDatabaseError'
        );
    }
};

const deleteMultipleScenarios = async (
    ids: string[],
    cascade = false,
    { transaction, ...options }: Parameters<typeof deleteMultiple>[3] = {}
) => {
    try {
        // Nested function to require a transaction around the deletes
        const deleteWithTransaction = async (trx: Knex.Transaction) => {
            if (cascade) {
                // cascade delete has to be called synchronously for each scenario, otherwise some scenarios do not get deleted if used by more than one run
                for (let i = 0; i < ids.length; i++) {
                    await _cascadeDeleteServices(ids[i], { transaction: trx });
                }
            }
            return deleteMultiple(knex, tableName, ids, { transaction: trx, ...options });
        };
        // Make sure the deletes are done in a transaction, use the one in the options if available
        return await (transaction ? deleteWithTransaction(transaction) : knex.transaction(deleteWithTransaction));
    } catch (error) {
        throw new TrError(
            `cannot delete multiple scenarios because of a database error (knex error: ${error})`,
            'THQGC0006',
            'TransitScenarioCannotDeleteMultipleBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create,
    createMultiple,
    update,
    updateMultiple,
    delete: deleteScenario,
    deleteMultiple: deleteMultipleScenarios,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
