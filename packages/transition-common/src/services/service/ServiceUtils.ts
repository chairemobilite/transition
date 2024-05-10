import ServiceCollection from './ServiceCollection';
import { _makeStringUnique } from 'chaire-lib-common/lib/utils/LodashExtensions';

/**
 * Get a unique name for a service by looking for duplicate names in the
 * collection and adding a suffix to the name.
 *
 * @param {ServiceCollection} services The service collection to look for
 * similar names
 * @param {string} serviceName The name to make unique
 * @deprecated Use the backend version of this function, still called in the frontend by the service duplication operation
 */
export const getUniqueServiceName = (services: ServiceCollection | undefined, serviceName: string): any => {
    if (!services) {
        return serviceName;
    }
    return _makeStringUnique(
        serviceName,
        services.features.map((service) => service.attributes.name || '')
    );
};
