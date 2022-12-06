/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import geobuf from 'geobuf';
import Pbf from 'pbf';

import { isSocketIo } from './socketUtils';

import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import * as Status from 'chaire-lib-common/lib/utils/Status';

import agenciesDbQueries from '../models/db/transitAgencies.db.queries';
import linesDbQueries from '../models/db/transitLines.db.queries';
import nodesDbQueries from '../models/db/transitNodes.db.queries';
import pathsDbQueries from '../models/db/transitPaths.db.queries';
import scenariosDbQueries from '../models/db/transitScenarios.db.queries';
import servicesDbQueries from '../models/db/transitServices.db.queries';
import schedulesDbQueries from '../models/db/transitSchedules.db.queries';

import * as agenciesCacheQueries from '../models/capnpCache/transitAgencies.cache.queries';
import * as linesCacheQueries from '../models/capnpCache/transitLines.cache.queries';
import * as nodesCacheQueries from '../models/capnpCache/transitNodes.cache.queries';
import * as pathsCacheQueries from '../models/capnpCache/transitPaths.cache.queries';
import * as scenariosCacheQueries from '../models/capnpCache/transitScenarios.cache.queries';
import * as servicesCacheQueries from '../models/capnpCache/transitServices.cache.queries';

import TrError from 'chaire-lib-common/lib/utils/TrError';

const transitClassesConfig = {
    agencies: {
        lowerCaseName: 'agency',
        className: 'Agency',
        classNamePlural: 'Agencies',
        dbQueries: agenciesDbQueries,
        cacheQueries: agenciesCacheQueries,
        collection: new AgencyCollection([], {})
    },
    lines: {
        lowerCaseName: 'line',
        className: 'Line',
        classNamePlural: 'Lines',
        dbQueries: linesDbQueries,
        cacheQueries: linesCacheQueries,
        collection: new LineCollection([], {})
    },
    nodes: {
        lowerCaseName: 'node',
        className: 'Node',
        classNamePlural: 'Nodes',
        hasIntegerId: true,
        dbQueries: nodesDbQueries,
        cacheQueries: nodesCacheQueries,
        collection: new NodeCollection([], {})
    },
    paths: {
        lowerCaseName: 'path',
        className: 'Path',
        classNamePlural: 'Paths',
        hasIntegerId: true,
        dbQueries: pathsDbQueries,
        cacheQueries: pathsCacheQueries,
        collection: new PathCollection([], {})
    },
    scenarios: {
        lowerCaseName: 'scenario',
        className: 'Scenario',
        classNamePlural: 'Scenarios',
        dbQueries: scenariosDbQueries,
        cacheQueries: scenariosCacheQueries,
        collection: new ScenarioCollection([], {})
    },
    services: {
        lowerCaseName: 'service',
        className: 'Service',
        classNamePlural: 'Services',
        dbQueries: servicesDbQueries,
        cacheQueries: servicesCacheQueries,
        collection: new ServiceCollection([], {})
    },
    schedules: {
        lowerCaseName: 'schedule',
        className: 'Schedule',
        classNamePlural: 'Schedules',
        hasIntegerId: false,
        dbQueries: schedulesDbQueries,
        cacheQueries: {}
    }
};

// TODO Add unit tests and typings when db queries and cache queries are refactored again. See if cache/db relation needs to be revisited now
export const setupObjectSocketRoutes = (
    socket: EventEmitter,
    transitClassesConfig: {
        [key: string]: {
            lowerCaseName: string;
            className: string;
            classNamePlural: string;
            hasIntegerId?: boolean;
            dbQueries: any;
            cacheQueries: any;
            // TODO Used to temporarily load collections. needed?
            collection?: any;
        };
    }
) => {
    for (const lowerCasePlural in transitClassesConfig) {
        const transitClassConfig = transitClassesConfig[lowerCasePlural];

        // Create a new object
        socket.on(`transit${transitClassConfig.className}.create`, async (attributes, callback) => {
            try {
                const returningArray = transitClassConfig.hasIntegerId ? ['id', 'integer_id'] : ['id'];
                const returning = await transitClassConfig.dbQueries.create(attributes, returningArray);
                if (transitClassConfig.hasIntegerId) {
                    attributes.integer_id = returning.integer_id;
                }
                if (isSocketIo(socket)) {
                    socket.broadcast.emit('data.updated');
                }
                if (transitClassConfig.cacheQueries.objectToCache) {
                    try {
                        await transitClassConfig.cacheQueries.objectToCache(
                            attributes,
                            attributes.data.customCachePath
                        );
                        callback({
                            ...returning
                        });
                    } catch (error) {
                        throw new TrError(
                            `cannot save cache file ${transitClassConfig.className} because of an error: ${error}`,
                            'SKTTRRD0001',
                            'CacheCouldNotBeSavedBecauseError'
                        );
                    }
                } else {
                    socket.emit('cache.dirty');
                    callback({
                        ...returning
                    });
                }
            } catch (error) {
                console.error(error);
                callback(TrError.isTrError(error) ? error.export() : { error });
            }
        });

        // Read the object from the database
        socket.on(
            `transit${transitClassConfig.className}.read`,
            async (id: string, customCachePath: string | undefined, callback) => {
                try {
                    const object = await transitClassConfig.dbQueries.read(id);
                    callback({
                        [transitClassConfig.lowerCaseName]: object.attributes ? object.attributes : object
                    });
                } catch (error) {
                    console.error(error);
                    callback(TrError.isTrError(error) ? error.export() : { error });
                }
            }
        );

        // Update the object in the database and cache if required
        socket.on(`transit${transitClassConfig.className}.update`, async (id: string, attributes, callback) => {
            try {
                const updatedId = await transitClassConfig.dbQueries.update(id, attributes);
                if (isSocketIo(socket)) {
                    socket.broadcast.emit('data.updated');
                }
                if (transitClassConfig.cacheQueries.objectToCache) {
                    try {
                        await transitClassConfig.cacheQueries.objectToCache(
                            attributes,
                            attributes.data.customCachePath
                        );
                        callback({
                            id: updatedId
                        });
                    } catch (error) {
                        throw new TrError(
                            `cannot update cache file ${transitClassConfig.className} because of an error: ${error}`,
                            'SKTTRUP0001',
                            'CacheCouldNotBeUpdatedBecauseError'
                        );
                    }
                } else {
                    socket.emit('cache.dirty');
                    callback({
                        id: updatedId
                    });
                }
            } catch (error) {
                console.error(error);
                callback(TrError.isTrError(error) ? error.export() : { error });
            }
        });

        // Delete the object from database and cache if required
        socket.on(
            `transit${transitClassConfig.className}.delete`,
            async (id: string, customCachePath: string | undefined, callback) => {
                try {
                    const deletedId = await transitClassConfig.dbQueries.delete(id);
                    if (deletedId === undefined) {
                        // The object was not deleted
                        callback(Status.createOk({ id: undefined }));
                        return;
                    }
                    if (isSocketIo(socket)) {
                        socket.broadcast.emit('data.updated');
                    }
                    if (transitClassConfig.cacheQueries.deleteObjectCache) {
                        try {
                            await transitClassConfig.cacheQueries.deleteObjectCache(id, customCachePath);
                            callback(Status.createOk({ id: deletedId }));
                        } catch (error) {
                            throw new TrError(
                                `cannot delete cache file ${transitClassConfig.className} because of an error: ${error}`,
                                'SKTTRDL0001',
                                'CacheCouldNotBeDeletedBecauseError'
                            );
                        }
                    } else {
                        socket.emit('cache.dirty');
                        callback(Status.createOk({ id: deletedId }));
                    }
                } catch (error) {
                    console.error(error);
                    callback(Status.createError(TrError.isTrError(error) ? error.message : 'Error deleting object'));
                }
            }
        );

        // Get the geojson collection from DB if there is a geojson collection function
        if (transitClassConfig.dbQueries.geojsonCollection) {
            socket.on(
                `transit${transitClassConfig.classNamePlural}.geojsonCollection`,
                async (params = { format: 'geojson' }, callback) => {
                    try {
                        const geojson = await transitClassConfig.dbQueries.geojsonCollection(params);
                        if (params.format === 'geobuf') {
                            const geobufjson = Buffer.from(geobuf.encode(geojson, new Pbf()));
                            callback({ geobuf: geobufjson });
                        } else {
                            callback({ geojson });
                        }
                    } catch (error) {
                        console.error(error);
                        callback(TrError.isTrError(error) ? error.export() : { error });
                    }
                }
            );
        }

        // Get the collection from DB if there is a collection function
        if (transitClassConfig.dbQueries.collection) {
            socket.on(`transit${transitClassConfig.classNamePlural}.collection`, async (dataSourceId, callback) => {
                try {
                    const collection = await transitClassConfig.dbQueries.collection();
                    callback({ collection });
                } catch (error) {
                    console.error(error);
                    callback(TrError.isTrError(error) ? error.export() : { error });
                }
            });
        }

        // Save an object to cache
        // TODO Saving an object to cache is included in the create and update routes. And now there is not much that is not in the database (transferable nodes for instance), this route could be removed
        if (transitClassConfig.cacheQueries.objectToCache) {
            socket.on(`transit${transitClassConfig.className}.saveCache`, async (attributes, callback) => {
                try {
                    await transitClassConfig.cacheQueries.objectToCache(attributes, attributes.data.customCachePath);
                    callback({});
                } catch (error) {
                    console.error(error);
                    callback(
                        new TrError(
                            `cannot save cache file ${transitClassConfig.className} because of an error: ${error}`,
                            'SKTTRSVC0001',
                            'CacheCouldNotBeSavedBecauseError'
                        ).export()
                    );
                }
            });
        }

        // Delete object from cache if required
        // TODO Included in the call to delete, the individual call should not exist
        if (transitClassConfig.cacheQueries.deleteObjectCache) {
            socket.on(
                `transit${transitClassConfig.className}.deleteCache`,
                async (id: string, customCachePath: string | undefined, callback) => {
                    try {
                        await transitClassConfig.cacheQueries.deleteObjectCache(id, customCachePath);
                        callback({});
                    } catch (error) {
                        console.error(error);
                        callback(
                            new TrError(
                                `cannot delete cache file ${transitClassConfig.className} because of an error: ${error}`,
                                'SKTTRDLC0001',
                                'CacheCouldNotBeDeletedBecauseError'
                            ).export()
                        );
                    }
                }
            );
        }

        if (transitClassConfig.cacheQueries.deleteObjectsCache) {
            socket.on(
                `transit${transitClassConfig.className}.deleteMultipleCache`,
                (ids, customCachePath, callback) => {
                    transitClassConfig.cacheQueries
                        .deleteObjectsCache(ids, customCachePath)
                        .then(() => {
                            callback({
                                error: null
                            });
                        })
                        .catch((error) => {
                            console.error(error);
                            callback(
                                new TrError(
                                    `cannot delete cache files ${transitClassConfig.className} because of an error: ${error}`,
                                    'SKTTRDLC0002',
                                    'CacheCouldNotBeDeletedBecauseError'
                                ).export()
                            );
                        });
                }
            );
        }

        // Load an object from the cache if available
        if (transitClassConfig.cacheQueries.objectFromCache) {
            socket.on(
                `transit${transitClassConfig.className}.loadCache`,
                async (id: string, customCachePath: string | undefined, callback) => {
                    try {
                        const object = await transitClassConfig.cacheQueries.objectFromCache(id, customCachePath);
                        callback({
                            [transitClassConfig.lowerCaseName]: object && object.attributes ? object.attributes : object
                        });
                    } catch (error) {
                        console.error(error);
                        callback(
                            new TrError(
                                `cannot load cache file ${transitClassConfig.className} because of an error: ${error}`,
                                'SKTTRLDC0001',
                                'CacheCouldNotBeLoadedBecauseError'
                            ).export()
                        );
                    }
                }
            );
        }

        if (transitClassConfig.cacheQueries.collectionToCache) {
            socket.on(
                `transit${transitClassConfig.classNamePlural}.saveCollectionCache`,
                (collection = null, customCachePath, callback) => {
                    if (collection) {
                        transitClassConfig.cacheQueries
                            .collectionToCache(collection, customCachePath)
                            .then(() => {
                                callback({
                                    error: null
                                });
                            })
                            .catch((error) => {
                                throw new TrError(
                                    `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                    'SKTTRSGC0001',
                                    'CacheCouldNotBeSavedBecauseError'
                                );
                            });
                    } else if (transitClassConfig.dbQueries.geojsonCollection) {
                        transitClassConfig.dbQueries
                            .geojsonCollection()
                            .then((collection) => {
                                transitClassConfig.collection.loadFromCollection(collection.features);
                                transitClassConfig.cacheQueries
                                    .collectionToCache(transitClassConfig.collection, customCachePath)
                                    .then(() => {
                                        callback({
                                            error: null
                                        });
                                    })
                                    .catch((error) => {
                                        throw new TrError(
                                            `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                            'SKTTRSGC0002',
                                            'CacheCouldNotBeSavedBecauseError'
                                        );
                                    });
                            })
                            .catch((error) => {
                                throw new TrError(
                                    `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                    'SKTTRSGC0003',
                                    'CacheCouldNotBeSavedBecauseError'
                                );
                            });
                    } else {
                        transitClassConfig.dbQueries
                            .collection()
                            .then((collection) => {
                                transitClassConfig.collection.loadFromCollection(collection);
                                transitClassConfig.cacheQueries
                                    .collectionToCache(transitClassConfig.collection, customCachePath)
                                    .then(() => {
                                        callback({
                                            error: null
                                        });
                                    })
                                    .catch((error) => {
                                        throw new TrError(
                                            `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                            'SKTTRSC0001',
                                            'CacheCouldNotBeSavedBecauseError'
                                        );
                                    });
                            })
                            .catch((error) => {
                                throw new TrError(
                                    `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                    'SKTTRSC0002',
                                    'CacheCouldNotBeSavedBecauseError'
                                );
                            });
                    }
                }
            );
        }

        // TODO Do we still need to load an entire collection from cache. Cache should be one-way?
        if (transitClassConfig.cacheQueries.collectionFromCache) {
            socket.on(
                `transit${transitClassConfig.classNamePlural}.loadCollectionCache`,
                (customCachePath, callback) => {
                    transitClassConfig.cacheQueries
                        .collectionFromCache(customCachePath)
                        .then((collection) => {
                            callback({
                                collection
                            });
                        })
                        .catch((error) => {
                            if (!error.export) {
                                throw new TrError(
                                    `cannot load cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                    'SKTTRLC0001',
                                    'CacheCouldNotBeLoadedBecauseError'
                                );
                            }
                            console.error(error);
                            callback(error.export());
                        });
                }
            );
        }
    }
};

// Add operations on object socket routes for each object of Transition
export default function (socket: EventEmitter) {
    setupObjectSocketRoutes(socket, transitClassesConfig);
}
