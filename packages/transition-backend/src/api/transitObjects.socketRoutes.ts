/*
 * Copyright 2022-2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import transitObjectDataHandlers from '../services/transitObjects/TransitObjectsDataHandler';
import { duplicateServices } from '../services/transitObjects/transitServices/ServiceDuplicator';

function setupObjectSocketRoutes(socket: EventEmitter) {
    for (const lowerCasePlural in transitObjectDataHandlers) {
        const dataHandler = transitObjectDataHandlers[lowerCasePlural];

        // Create a new object
        socket.on(`transit${dataHandler.className}.create`, async (attributes, callback) => {
            const response = await dataHandler.create(socket, attributes);
            callback(response);
        });

        // Read the object from the database
        socket.on(
            `transit${dataHandler.className}.read`,
            async (id: string, customCachePath: string | undefined, callback) => {
                const response = await dataHandler.read(id, customCachePath);
                callback(response);
            }
        );

        // Update the object in the database and cache if required
        socket.on(`transit${dataHandler.className}.update`, async (id: string, attributes, callback) => {
            const response = await dataHandler.update(socket, id, attributes);
            callback(response);
        });

        // Delete the object from database and cache if required
        socket.on(
            `transit${dataHandler.className}.delete`,
            async (id: string, customCachePath: string | undefined, callback) => {
                const response = await dataHandler.delete(socket, id, customCachePath);
                callback(response);
            }
        );

        // Get the geojson collection from DB if there is a geojson collection function
        if (dataHandler.geojsonCollection) {
            socket.on(
                `transit${dataHandler.classNamePlural}.geojsonCollection`,
                async (params = { format: 'geojson' }, callback) => {
                    const response = await dataHandler.geojsonCollection!(params);
                    callback(response);
                }
            );
        }

        // Get the collection from DB if there is a collection function
        if (dataHandler.collection) {
            socket.on(`transit${dataHandler.classNamePlural}.collection`, async (dataSourceId, callback) => {
                const response = await dataHandler.collection!(dataSourceId);
                callback(response);
            });
        }

        // Save an object to cache
        // TODO Saving an object to cache is included in the create and update routes. And now there is not much that is not in the database (transferable nodes for instance), this route could be removed
        if (dataHandler.saveCache) {
            socket.on(`transit${dataHandler.className}.saveCache`, async (attributes, callback) => {
                const response = await dataHandler.saveCache!(attributes);
                callback(response);
            });
        }

        // Delete object from cache if required
        // TODO Included in the call to delete, the individual call should not exist
        if (dataHandler.deleteCache) {
            socket.on(
                `transit${dataHandler.className}.deleteCache`,
                async (id: string, customCachePath: string | undefined, callback) => {
                    const response = await dataHandler.deleteCache!(id, customCachePath);
                    callback(response);
                }
            );
        }

        if (dataHandler.deleteMultipleCache) {
            socket.on(`transit${dataHandler.className}.deleteMultipleCache`, async (ids, customCachePath, callback) => {
                const response = await dataHandler.deleteMultipleCache!(ids, customCachePath);
                callback(response);
            });
        }

        // Load an object from the cache if available
        if (dataHandler.loadCache) {
            socket.on(
                `transit${dataHandler.className}.loadCache`,
                async (id: string, customCachePath: string | undefined, callback) => {
                    const response = await dataHandler.loadCache!(id, customCachePath);
                    callback(response);
                }
            );
        }

        if (dataHandler.saveCollectionCache) {
            socket.on(
                `transit${dataHandler.classNamePlural}.saveCollectionCache`,
                async (collection = null, customCachePath, callback) => {
                    const response = await dataHandler.saveCollectionCache!(collection, customCachePath);
                    callback(response);
                }
            );
        }

        // TODO Do we still need to load an entire collection from cache. Cache should be one-way?
        if (dataHandler.loadCollectionCache) {
            socket.on(
                `transit${dataHandler.classNamePlural}.loadCollectionCache`,
                async (customCachePath, callback) => {
                    const response = await dataHandler.loadCollectionCache!(customCachePath);
                    callback(response);
                }
            );
        }

        // Update multiple objects in the database and cache if required
        if (lowerCasePlural === 'schedules') {
            socket.on(`transit${dataHandler.classNamePlural}.updateBatch`, async (attributesList, callback) => {
                try {
                    const response = await dataHandler.updateBatch!(socket, attributesList);
                    callback(response);
                } catch (error) {
                    console.log('Error in transit${dataHandler.classNamePlural}.updateBatch: ', error);
                }
            });
        }
    }

    // Add duplication sockets routes. We can't add them in the loop above
    // because they are not part of the transitObjectsDataHandlers, as each
    // object's duplication has different additional options

    // Duplicate a service
    socket.on('transitServices.duplicate', async (serviceIds: string[], options, callback) => {
        const response = await duplicateServices(serviceIds, options);
        callback(response);
    });
}

// Add operations on object socket routes for each object of Transition
export default function (socket: EventEmitter) {
    setupObjectSocketRoutes(socket);
}
