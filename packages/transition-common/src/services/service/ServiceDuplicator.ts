/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Service from './Service';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import ServiceCollection from './ServiceCollection';
import { getUniqueServiceName } from './ServiceUtils';

export interface DuplicateServiceOptions {
    socket: any;
    newServiceSuffix?: string;
    serviceCollection?: ServiceCollection;
}

// @deprecated Service duplication should be done in the backend, but this function is still used in the frontend by other object's duplication
export const duplicateService = async (
    service: Service,
    { socket, serviceCollection, newServiceSuffix = '' }: DuplicateServiceOptions
): Promise<Service> => {
    const clone = service.clone(true);
    const newService = clone as Service;
    newService.attributes.name = getUniqueServiceName(
        serviceCollection,
        `${newService.attributes.name}${!_isBlank(newServiceSuffix) ? ` ${newServiceSuffix}` : ''}`
    );

    await newService.save(socket);
    if (serviceCollection) {
        serviceCollection.add(newService);
    }
    return newService;
};
