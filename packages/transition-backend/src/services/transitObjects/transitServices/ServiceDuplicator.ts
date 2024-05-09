/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// This file contains functions related to the duplication and copy of the
// services. Except for the high level database transactions, this file should
// not contain any functions calling directly database queries. These should be
// in the ServiceUtils.ts file.
import { Knex } from 'knex';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import Service from 'transition-common/lib/services/service/Service';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { getServicesById, getUniqueServiceName, saveServices } from './ServiceUtils';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { WithTransaction } from 'chaire-lib-backend/lib/models/db/types.db';

// TODO Add more options, like the complete name of the new service
export type DuplicateServiceOptions = {
    newServiceSuffix?: string;
};

/**
 * Duplicate services and save them in the database.
 *
 * @param serviceIds The IDs of the services to duplicate
 * @param options Duplication options
 * @returns A status object a mapping of the previous service IDs to the new
 * ones
 */
export const duplicateServices = async (
    serviceIds: string[],
    { transaction, ...options }: DuplicateServiceOptions & WithTransaction
): Promise<Status.Status<{ [previousId: string]: string }>> => {
    try {
        // Nested function to require a transaction around the duplication
        const duplicateWithTransaction = async (trx: Knex.Transaction) => {
            const duplicatedServices: Service[] = [];
            const oldNewIdMapping = {} as { [previousId: string]: string };
            const services = await getServicesById(serviceIds, { transaction: trx });

            for (const service of services) {
                const duplicatedService = await duplicateService(service, { ...options, transaction: trx });
                duplicatedServices.push(duplicatedService);
                oldNewIdMapping[service.getId()] = duplicatedService.getId();
            }

            await saveServices(duplicatedServices, { transaction: trx });
            return Status.createOk(oldNewIdMapping);
        };
        // Make sure the update is done in a transaction, use the one in the options if available
        return transaction
            ? await duplicateWithTransaction(transaction)
            : await knex.transaction(duplicateWithTransaction);
    } catch (error) {
        console.log('An error occurred while duplicating services: ', error);
        return Status.createError('An error occurred while duplicating services');
    }
};

/**
 * Duplicate a service and return the new service. The new service will have a
 * unique name. It is not saved in the database at this point.
 *
 * @param service The service to duplicate
 * @param options The service duplication options
 * @returns The duplicated service object
 * @throws {TrError} If a unique name for the service cannot be found
 */
const duplicateService = async (
    service: Service,
    { newServiceSuffix = '', transaction }: DuplicateServiceOptions & WithTransaction
): Promise<Service> => {
    // Clone the complete object instead of just the attributes to make sure all
    // unique attributes are deleted from the original data and initialized on
    // the new object
    const clone = service.clone(true);
    const newService = clone as Service;
    newService.attributes.name = await getUniqueServiceName(
        `${newService.attributes.name}${!_isBlank(newServiceSuffix) ? `${newServiceSuffix}` : ''}`,
        { transaction }
    );

    return newService;
};
