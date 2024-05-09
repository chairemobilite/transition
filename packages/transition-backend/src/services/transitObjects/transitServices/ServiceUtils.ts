/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// This file contains various utility functions related to the services. To
// avoid dissiminating the database accesses, this is the place to put functions
// that call the database queries to get or save part of the services.
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { _makeStringUnique } from 'chaire-lib-common/lib/utils/LodashExtensions';
import dbQueries from '../../../models/db/transitServices.db.queries';
import Service from 'transition-common/lib/services/service/Service';
import { WithTransaction } from 'chaire-lib-backend/lib/models/db/types.db';
import { Knex } from 'knex';

/**
 * Get services by their ID from the database
 *
 * @param {string[]} serviceIds The ID of the services
 * @param {WithTransaction} options The optional transaction to use
 * @returns {Promise<Service[]>} The service objects
 * @throws {TrError} If an error occurs while querying the database
 */
export const getServicesById = async (
    serviceIds: string[],
    { transaction }: WithTransaction = {}
): Promise<Service[]> => {
    if (serviceIds.length === 0) {
        return [];
    }
    const servicesAttributes = await dbQueries.collection({ serviceIds, transaction });
    return servicesAttributes.map((attributes) => new Service(attributes, false));
};

/**
 * Save services in the database. New services will be inserted, existing ones
 * will be updated.
 *
 * @param services The services to save
 * @param {WithTransaction} options The optional transaction to use. If not set,
 * the operations are still run in a transaction
 * @returns
 * @throws {TrError} If an error occurs while saving the services
 */
export const saveServices = async (services: Service[], options: WithTransaction = {}): Promise<void> => {
    // Split in new and existing services
    const newServices = services.filter((service) => service.isNew());
    const existingServices = services.filter((service) => !service.isNew());

    const saveServicesWithTransaction = async (trx: Knex.Transaction) => {
        const promises: Promise<unknown>[] = [];
        if (newServices.length > 0) {
            promises.push(
                dbQueries.createMultiple(
                    newServices.map((service) => service.attributes),
                    { transaction: trx, returning: 'id' }
                )
            );
        }
        if (existingServices.length > 0) {
            promises.push(
                dbQueries.updateMultiple(
                    existingServices.map((service) => service.attributes),
                    { transaction: trx, returning: 'id' }
                )
            );
        }
        await Promise.all(promises);
    };

    // In a transaction, update and insert the services
    return options.transaction
        ? await saveServicesWithTransaction(options.transaction)
        : await knex.transaction(saveServicesWithTransaction);
};

/**
 * Get a unique name for a service by looking for duplicate names in the
 * database and adding a suffix to the name.
 *
 * @param {string} serviceName The name to make unique
 * @param {WithTransaction} options The optional transaction to use
 * @returns {Promise<string>} The unique name
 * @throws {TrError} If a unique name for the service cannot be found
 */
export const getUniqueServiceName = async (serviceName: string, options: WithTransaction = {}): Promise<string> => {
    const similarNames = await dbQueries.getServiceNamesStartingWith(serviceName, options);
    return _makeStringUnique(serviceName, similarNames);
};
