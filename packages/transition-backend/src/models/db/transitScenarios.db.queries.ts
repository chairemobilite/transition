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
import servicesDbQueries from './transitServices.db.queries';

const tableName = 'tr_transit_scenarios';
const serviceTableName = 'tr_transit_scenario_services';

// TODO Type the return values
const attributesCleaner = function(attributes: Partial<ScenarioAttributes>): { [key: string]: any } {
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
    return (dbAttributes as unknown) as ScenarioAttributes;
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

const create = async (newObject: ScenarioAttributes, returning?: string) => {
    const services = newObject.services || [];
    // Create the main object in main table
    const created = await defaultCreate(knex, tableName, attributesCleaner, newObject, returning);
    try {
        if (services.length > 0) {
            // Fill the service table
            const scenarioServices = services.map((serviceId) => ({
                scenario_id: newObject.id,
                service_id: serviceId
            }));
            await knex(serviceTableName).insert(scenarioServices);
        }
        return created;
    } catch (error) {
        throw new TrError(
            `Cannot insert services for scenario with id ${newObject.id} in table ${serviceTableName} database (knex error: ${error})`,
            'THQGC0003',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

const createMultiple = async (newObjects: ScenarioAttributes[], returning?: string[]) => {
    const services = newObjects
        .map((newObject) => ({ scenario_id: newObject.id, services: newObject.services || [] }))
        .filter((scServices) => scServices.services.length > 0);
    // Create the main object in main table
    const created = await defaultCreateMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    try {
        if (services.length > 0) {
            // Fill the service table
            const scenarioServices = services.flatMap((scServices) =>
                scServices.services.map((service) => ({ scenario_id: scServices.scenario_id, service_id: service }))
            );
            await knex(serviceTableName).insert(scenarioServices);
        }
        return created;
    } catch (error) {
        throw new TrError(
            `Cannot insert services for scenarios in table ${serviceTableName} database (knex error: ${error})`,
            'THQGC0004',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

const getNewAndDeletedServicesForScenario = (
    scenarioId: string,
    currentServiceIds: string[],
    previousServices: { scenario_id: string; service_id: string }[]
): {
    newServices: { scenario_id: string; service_id: string }[];
    deletedServices: { scenario_id: string; service_id: string }[];
} => {
    const current: { [serviceId: string]: boolean } = {};
    previousServices
        .filter((scService) => scService.scenario_id === scenarioId)
        .forEach((service) => (current[service.service_id] = currentServiceIds.includes(service.service_id)));

    // Get new and deleted services
    const deletedServices = Object.keys(current)
        .filter((serviceId) => current[serviceId] === false)
        .map((serviceId) => ({ scenario_id: scenarioId, service_id: serviceId }));
    const newServices = currentServiceIds
        .filter((serviceId) => current[serviceId] === undefined)
        .map((serviceId) => ({ scenario_id: scenarioId, service_id: serviceId }));
    return { newServices, deletedServices };
};

const update = async (id: string, updatedObject: Partial<ScenarioAttributes>, returning?: string) => {
    // Create the main object in main table
    const updated = await defaultUpdate(knex, tableName, attributesCleaner, id, updatedObject, returning);
    try {
        // Update services if they are not undefined (partial update)
        const services = updatedObject.services;
        if (services !== undefined) {
            // Prepare current services for scenario
            const currentServices = await knex(serviceTableName)
                .select()
                .where('scenario_id', id);
            const { newServices, deletedServices } = getNewAndDeletedServicesForScenario(id, services, currentServices);

            // Insert and delete services if required
            if (newServices.length > 0) {
                await knex(serviceTableName).insert(newServices);
            }
            if (deletedServices.length > 0) {
                const deletePromises = deletedServices.map((deletedService) =>
                    knex(serviceTableName)
                        .delete()
                        .where(deletedService)
                );
                await Promise.all(deletePromises);
            }
        }
        return updated;
    } catch (error) {
        throw new TrError(
            `Cannot update services for scenarios in table ${serviceTableName} database (knex error: ${error})`,
            'THQGC0004',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

const updateMultiple = async (updatedObjects: Partial<ScenarioAttributes>[], returning?: string) => {
    const updated = await defaultUpdateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    try {
        // Update services if they are not undefined (partial update)
        const objectsToUpdate = updatedObjects.filter((object) => object.services !== undefined);
        if (objectsToUpdate.length > 0) {
            // Prepare current services for scenario
            const scenarioIds = objectsToUpdate.map((object) => object.id as string);
            const currentServices = await knex(serviceTableName)
                .select()
                .whereIn('scenario_id', scenarioIds);

            const allNewServices: { scenario_id: string; service_id: string }[] = [];
            const allDeletedServices: { scenario_id: string; service_id: string }[] = [];

            for (let objectIdx = 0; objectIdx < objectsToUpdate.length; objectIdx++) {
                const { newServices, deletedServices } = getNewAndDeletedServicesForScenario(
                    objectsToUpdate[objectIdx].id as string,
                    objectsToUpdate[objectIdx].services || [],
                    currentServices
                );
                allNewServices.push(...newServices);
                allDeletedServices.push(...deletedServices);
            }

            // Insert and delete services if required
            if (allNewServices.length > 0) {
                await knex(serviceTableName).insert(allNewServices);
            }
            if (allDeletedServices.length > 0) {
                const deletePromises = allDeletedServices.map((deletedService) =>
                    knex(serviceTableName)
                        .delete()
                        .where(deletedService)
                );
                await Promise.all(deletePromises);
            }
        }
        return updated;
    } catch (error) {
        throw new TrError(
            `Cannot update services for scenarios in table ${serviceTableName} database (knex error: ${error})`,
            'THQGC0004',
            'TransitScenarioCannotInsertServicesBecauseDatabaseError'
        );
    }
};

const cascadeDeleteServices = async (id: string) => {
    try {
        const scenarioServices = knex
            .select('service_id')
            .from(`${serviceTableName}`)
            .where('scenario_id', id);
        const countServiceQuery = knex
            .select('service_id')
            .from(`${serviceTableName}`)
            .count()
            .whereIn('service_id', scenarioServices)
            .groupBy('service_id')
            .as('servCount');
        const servicesOnlyInThisScenario = (
            await knex
                .select('service_id')
                .from(countServiceQuery)
                .where('count', '=', 1)
        ).map((service) => service.service_id);
        if (servicesOnlyInThisScenario.length > 0) {
            servicesDbQueries.deleteMultiple(servicesOnlyInThisScenario);
        }
    } catch (error) {
        throw new TrError(
            `cannot delete services for scenario because of a database error (knex error: ${error})`,
            'THQGC0005',
            'TransitScenarioCannotDeleteServicesBecauseDatabaseError'
        );
    }
};

const deleteScenario = async (id: string, cascade = false) => {
    if (cascade) {
        await cascadeDeleteServices(id);
    }
    return deleteRecord(knex, tableName, id);
};

const deleteMultipleScenarios = async (ids: string[], cascade = false) => {
    if (cascade) {
        // cascade delete has to be called synchronously for each scenario, otherwise some scenarios do not get deleted if used by more than one run
        for (let i = 0; i < ids.length; i++) {
            await cascadeDeleteServices(ids[i]);
        }
    }
    return deleteMultiple(knex, tableName, ids);
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
