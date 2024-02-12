/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import EventEmitter from 'events';
import geobuf from 'geobuf';
import Pbf from 'pbf';

import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';

import agenciesDbQueries from '../../models/db/transitAgencies.db.queries';
import linesDbQueries from '../../models/db/transitLines.db.queries';
import nodesDbQueries from '../../models/db/transitNodes.db.queries';
import pathsDbQueries from '../../models/db/transitPaths.db.queries';
import scenariosDbQueries from '../../models/db/transitScenarios.db.queries';
import servicesDbQueries from '../../models/db/transitServices.db.queries';
import schedulesDbQueries from '../../models/db/transitSchedules.db.queries';

import * as agenciesCacheQueries from '../../models/capnpCache/transitAgencies.cache.queries';
import * as linesCacheQueries from '../../models/capnpCache/transitLines.cache.queries';
import * as nodesCacheQueries from '../../models/capnpCache/transitNodes.cache.queries';
import * as pathsCacheQueries from '../../models/capnpCache/transitPaths.cache.queries';
import * as scenariosCacheQueries from '../../models/capnpCache/transitScenarios.cache.queries';
import * as servicesCacheQueries from '../../models/capnpCache/transitServices.cache.queries';

import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { isSocketIo } from '../socketUtils';

interface TransitObjectEndpointDefinitions {
    lowerCaseName: string,
    className: string,
    classNamePlural: string,
    create: (socket: EventEmitter, attributes: GenericAttributes) => Promise<Record<string, any>>,
    read: (id: string, customCachePath: string | undefined) => Promise<Record<string, any>>,
    update: (socket: EventEmitter, id: string, attributes: GenericAttributes) => Promise<Record<string, any>>,
    delete: (socket: EventEmitter, id: string, customCachePath: string | undefined) => Promise<Record<string, any>>,
    geojsonCollection?: (params?) => Promise<Record<string, any>>,
    collection?: (dataSourceId) => Promise<Record<string, any>>,
    saveCache?: (attributes) => Promise<Record<string, any>>,
    deleteCache?: (id: string, customCachePath: string | undefined) => Promise<Record<string, any>>,
    deleteMultipleCache?: (ids: string[], customCachePath: string) => Promise<Record<string, any>>,
    loadCache?: (id: string, customCachePath: string | undefined) => Promise<Record<string, any>>,
    saveCollectionCache?: (collection, customCachePath) => Promise<Record<string, any>>,
    loadCollectionCache?: (customCachePath) => Promise<Record<string, any>>
}

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
function createObjectEndpointDefinitions(): Record<string, TransitObjectEndpointDefinitions> {
    const allEndpointDefinitions: Record<string, TransitObjectEndpointDefinitions> = {};

    for (const lowerCasePlural in transitClassesConfig) {
        const transitClassConfig = transitClassesConfig[lowerCasePlural];

        const endpointDefinitions: TransitObjectEndpointDefinitions = {
            lowerCaseName: transitClassConfig.lowerCaseName,
            className: transitClassConfig.className,
            classNamePlural: transitClassConfig.classNamePlural,

            // Create a new object
            create: async (socket: EventEmitter, attributes: GenericAttributes) => {
                try {
                    const returningArray = transitClassConfig.hasIntegerId ? ['id', 'integer_id'] : ['id'];
                    const returning = await transitClassConfig.dbQueries.create(attributes, returningArray);
                    if (transitClassConfig.hasIntegerId) {
                        attributes.integer_id = returning.integer_id;
                    }
                    if (isSocketIo(socket)) {
                        socket.broadcast.emit('data.updated');
                    }
                    if (transitClassConfig.cacheQueries.objectsToCache) {
                        try {
                            await transitClassConfig.cacheQueries.objectToCache(
                                attributes,
                                attributes.data.customCachePath
                            );
                            return {...returning};
                        } catch (error) {
                            throw new TrError(
                                `cannot save cache file ${transitClassConfig.className} because of an error: ${error}`,
                                'SKTTRRD0001',
                                'CacheCouldNotBeSavedBecauseError'
                            );
                        }
                    } else {
                        socket.emit('cache.dirty');
                        return {...returning};
                    }
                } catch (error) {
                    console.error(error);
                    return TrError.isTrError(error) ? error.export() : { error };
                }

            },

            // Read the object from the database
            read: async (id: string, customCachePath: string | undefined) => {
                try {
                    const object = await transitClassConfig.dbQueries.read(id);
                    return {
                        [transitClassConfig.lowerCaseName]: object.attributes ? object.attributes : object
                    };
                } catch (error) {
                    console.error(error);
                    return TrError.isTrError(error) ? error.export() : { error };
                }
            },

            // Update the object in the database and cache if required
            update: async (socket: EventEmitter, id: string, attributes: GenericAttributes) => {
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
                            return {
                                id: updatedId
                            };
                        } catch (error) {
                            throw new TrError(
                                `cannot update cache file ${transitClassConfig.className} because of an error: ${error}`,
                                'SKTTRUP0001',
                                'CacheCouldNotBeUpdatedBecauseError'
                            );
                        }
                    } else {
                        socket.emit('cache.dirty');
                        return {
                            id: updatedId
                        };
                    }
                } catch (error) {
                    console.error(error);
                    return TrError.isTrError(error) ? error.export() : { error };
                }
            },

            // Delete the object from database and cache if required
            delete: async (socket: EventEmitter, id: string, customCachePath: string | undefined) => {
                try {
                    const deletedId = await transitClassConfig.dbQueries.delete(id);
                    if (deletedId === undefined) {
                        // The object was not deleted
                        return Status.createOk({ id: undefined });
                    }
                    if (isSocketIo(socket)) {
                        socket.broadcast.emit('data.updated');
                    }
                    if (transitClassConfig.cacheQueries.deleteObjectCache) {
                        try {
                            await transitClassConfig.cacheQueries.deleteObjectCache(id, customCachePath);
                            return Status.createOk({ id: deletedId });
                        } catch (error) {
                            throw new TrError(
                                `cannot delete cache file ${transitClassConfig.className} because of an error: ${error}`,
                                'SKTTRDL0001',
                                'CacheCouldNotBeDeletedBecauseError'
                            );
                        }
                    } else {
                        socket.emit('cache.dirty');
                        return Status.createOk({ id: deletedId });
                    }
                } catch (error) {
                    console.error(error);
                    return Status.createError(TrError.isTrError(error) ? error.message : 'Error deleting object');
                }
            }
        };

        // Get the geojson collection from DB if there is a geojson collection function
        if (transitClassConfig.dbQueries.geojsonCollection) {
            endpointDefinitions.geojsonCollection = async (params = { format: 'geojson' }) => {
                try {
                    const geojson = await transitClassConfig.dbQueries.geojsonCollection(params);
                    if (params.format === 'geobuf') {
                        const geobufjson = Buffer.from(geobuf.encode(geojson, new Pbf()));
                        return { geobuf: geobufjson };
                    } else {
                        return { geojson };
                    }
                } catch (error) {
                    console.error(error);
                    return TrError.isTrError(error) ? error.export() : { error };
                }
            }
        }

        // Get the collection from DB if there is a collection function
        if (transitClassConfig.dbQueries.collection) {
            endpointDefinitions.collection = async (dataSourceId) => {
                try {
                    const collection = await transitClassConfig.dbQueries.collection();
                    return { collection };
                } catch (error) {
                    console.error(error);
                    return TrError.isTrError(error) ? error.export() : { error };
                }
            }
        }

        // Save an object to cache
        // TODO Saving an object to cache is included in the create and update routes. And now there is not much that is not in the database (transferable nodes for instance), this route could be removed
        if (transitClassConfig.cacheQueries.objectToCache) {
            endpointDefinitions.saveCache = async (attributes) => {
                try {
                    await transitClassConfig.cacheQueries.objectToCache(attributes, attributes.data.customCachePath);
                    return {};
                } catch (error) {
                    console.error(error);
                    return new TrError(
                        `cannot save cache file ${transitClassConfig.className} because of an error: ${error}`,
                        'SKTTRSVC0001',
                        'CacheCouldNotBeSavedBecauseError'
                    ).export();
                }
            }
        }

        // Delete object from cache if required
        // TODO Included in the call to delete, the individual call should not exist
        if (transitClassConfig.cacheQueries.deleteObjectCache) {
            endpointDefinitions.deleteCache = async (id: string, customCachePath: string | undefined) => {
                try {
                    await transitClassConfig.cacheQueries.deleteObjectCache(id, customCachePath);
                    return {};
                } catch (error) {
                    console.error(error);
                    return new TrError(
                        `cannot delete cache file ${transitClassConfig.className} because of an error: ${error}`,
                        'SKTTRDLC0001',
                        'CacheCouldNotBeDeletedBecauseError'
                    ).export();
                }
            }
        }

        // Delete multiple objects from cache if required
        if (transitClassConfig.cacheQueries.deleteObjectsCache) {
            endpointDefinitions.deleteMultipleCache = async (ids: string[], customCachePath: string) => {
                try {
                    await transitClassConfig.cacheQueries.deleteObjectsCache(ids, customCachePath);
                    return {error: null};
                } catch (error) {
                    console.error(error);
                    return new TrError(
                        `cannot delete cache files ${transitClassConfig.className} because of an error: ${error}`,
                        'SKTTRDLC0002',
                        'CacheCouldNotBeDeletedBecauseError'
                    ).export();
                }
            }
        }

        // Load an object from the cache if available
        if (transitClassConfig.cacheQueries.objectFromCache) {
            endpointDefinitions.loadCache = async (id: string, customCachePath: string | undefined) => {
                try {
                    const object = await transitClassConfig.cacheQueries.objectFromCache(id, customCachePath);
                    return {
                        [transitClassConfig.lowerCaseName]: object && object.attributes ? object.attributes : object
                    };
                } catch (error) {
                    console.error(error);
                    return new TrError(
                        `cannot load cache file ${transitClassConfig.className} because of an error: ${error}`,
                        'SKTTRLDC0001',
                        'CacheCouldNotBeLoadedBecauseError'
                    ).export();
                }
            }
        }

        if (transitClassConfig.cacheQueries.collectionToCache) {
            endpointDefinitions.saveCollectionCache = async (collection = null, customCachePath) => {
                if (collection) {
                    try {
                        await transitClassConfig.cacheQueries.collectionToCache(collection, customCachePath);
                        return {
                            error: null
                        };
                    } catch (error) {
                        throw new TrError(
                            `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                            'SKTTRSGC0001',
                            'CacheCouldNotBeSavedBecauseError'
                        );
                    }
                } else if (transitClassConfig.dbQueries.geojsonCollection) {
                    try {
                        const collection = await transitClassConfig.dbQueries.geojsonCollection();
                        transitClassConfig.collection.loadFromCollection(collection.features);
                        try {
                            await transitClassConfig.cacheQueries.collectionToCache(transitClassConfig.collection, customCachePath);
                            return {
                                error: null
                            };
                        } catch (error) {
                            throw new TrError(
                                `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                'SKTTRSGC0002',
                                'CacheCouldNotBeSavedBecauseError'
                            );
                        }
                    } catch (error) {
                        throw new TrError(
                            `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                            'SKTTRSGC0003',
                            'CacheCouldNotBeSavedBecauseError'
                        );
                    }
                } else {
                    try {
                        const collection = await transitClassConfig.dbQueries.collection();
                        transitClassConfig.collection.loadFromCollection(collection);
                        try {
                            await transitClassConfig.cacheQueries.collectionToCache(transitClassConfig.collection, customCachePath);
                            return {
                                error: null
                            };
                        } catch (error) {
                            throw new TrError(
                                `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                                'SKTTRSC0001',
                                'CacheCouldNotBeSavedBecauseError'
                            );
                        }
                    } catch (error) {
                        throw new TrError(
                            `cannot save cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                            'SKTTRSC0002',
                            'CacheCouldNotBeSavedBecauseError'
                        );
                    }
                }
            }
        }

        // TODO Do we still need to load an entire collection from cache. Cache should be one-way?
        if (transitClassConfig.cacheQueries.collectionFromCache) {
            endpointDefinitions.loadCollectionCache = async (customCachePath) => {
                try {
                    const collection = await transitClassConfig.cacheQueries.collectionFromCache(customCachePath);
                    return {
                        collection
                    };
                } catch (error: any) {
                    if (!error.export) {
                        throw new TrError(
                            `cannot load cache collection file ${transitClassConfig.classNamePlural} because of an error: ${error}`,
                            'SKTTRLC0001',
                            'CacheCouldNotBeLoadedBecauseError'
                        );
                    }  
                    console.error(error);
                    return error.export();
                }
            }
        }

        allEndpointDefinitions[lowerCasePlural] = endpointDefinitions;
    }

    return allEndpointDefinitions;
}

const transitObjectEndpointDefinitions: Record<string, TransitObjectEndpointDefinitions> = createObjectEndpointDefinitions();
export default transitObjectEndpointDefinitions;
