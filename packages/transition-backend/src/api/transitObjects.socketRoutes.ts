/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { transitObjectEndpointDefinitions } from './definitions/transitObjects.definitions';


function setupObjectSocketRoutes(socket: EventEmitter) {
    for (const lowerCasePlural in transitObjectEndpointDefinitions) {
        const endpointDefinitions = transitObjectEndpointDefinitions[lowerCasePlural]

        // Create a new object
        socket.on(`transit${endpointDefinitions.className}.create`, async (attributes, callback) => {
            const response = await endpointDefinitions.create(socket, attributes);
            callback(response);
        });

        // Read the object from the database
        socket.on(
            `transit${endpointDefinitions.className}.read`,
            async (id: string, customCachePath: string | undefined, callback) => {
                const response = await endpointDefinitions.read(id, customCachePath);
                callback(response);
            }
        );

        // Update the object in the database and cache if required
        socket.on(`transit${endpointDefinitions.className}.update`, async (id: string, attributes, callback) => {
            const response = await endpointDefinitions.update(socket, id, attributes);
            callback(response);
        });

        // Delete the object from database and cache if required
        socket.on(
            `transit${endpointDefinitions.className}.delete`,
            async (id: string, customCachePath: string | undefined, callback) => {
                const response = await endpointDefinitions.delete(socket, id, customCachePath);
                callback(response);
            }
        );

        // Get the geojson collection from DB if there is a geojson collection function
        if (endpointDefinitions.geojsonCollection) {
            socket.on(
                `transit${endpointDefinitions.classNamePlural}.geojsonCollection`,
                async (params = { format: 'geojson' }, callback) => {
                    const response = await endpointDefinitions.geojsonCollection!(params);
                    callback(response);
                }
            );
        }

        // Get the collection from DB if there is a collection function
        if (endpointDefinitions.collection) {
            socket.on(`transit${endpointDefinitions.classNamePlural}.collection`, async (dataSourceId, callback) => {
                const response = await endpointDefinitions.collection!(dataSourceId);
                callback(response);
            });
        }

        // Save an object to cache
        // TODO Saving an object to cache is included in the create and update routes. And now there is not much that is not in the database (transferable nodes for instance), this route could be removed
        if (endpointDefinitions.saveCache) {
            socket.on(`transit${endpointDefinitions.className}.saveCache`, async (attributes, callback) => {
                const response = await endpointDefinitions.saveCache!(attributes);
                callback(response);
            });
        }

        // Delete object from cache if required
        // TODO Included in the call to delete, the individual call should not exist
        if (endpointDefinitions.deleteCache) {
            socket.on(
                `transit${endpointDefinitions.className}.deleteCache`,
                async (id: string, customCachePath: string | undefined, callback) => {
                    const response = await endpointDefinitions.deleteCache!(id, customCachePath);
                    callback(response);
                }
            );
        }

        if (endpointDefinitions.deleteMultipleCache) {
            socket.on(
                `transit${endpointDefinitions.className}.deleteMultipleCache`,
                async (ids, customCachePath, callback) => {
                    const response = await endpointDefinitions.deleteMultipleCache!(ids, customCachePath);
                    callback(response);
                }
            );
        }

        // Load an object from the cache if available
        if (endpointDefinitions.loadCache) {
            socket.on(
                `transit${endpointDefinitions.className}.loadCache`,
                async (id: string, customCachePath: string | undefined, callback) => {
                    const response = await endpointDefinitions.loadCache!(id, customCachePath);
                    callback(response);
                }
            );
        }

        if (endpointDefinitions.saveCollectionCache) {
            socket.on(
                `transit${endpointDefinitions.classNamePlural}.saveCollectionCache`,
                async (collection = null, customCachePath, callback) => {
                    const response = await endpointDefinitions.saveCollectionCache!(collection, customCachePath);
                    callback(response);
                }
            );
        }

        // TODO Do we still need to load an entire collection from cache. Cache should be one-way?
        if (endpointDefinitions.loadCollectionCache) {
            socket.on(
                `transit${endpointDefinitions.classNamePlural}.loadCollectionCache`,
                async (customCachePath, callback) => {
                    const response = await endpointDefinitions.loadCollectionCache!(customCachePath);
                    callback(response);
                }
            );
        }
    }
};

// Add operations on object socket routes for each object of Transition
export default function (socket: EventEmitter) {
    setupObjectSocketRoutes(socket);
}
