/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Node from 'transition-common/lib/services/nodes/Node';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import {
    deleteObjectCache as defaultDeleteObjectCache,
    objectToCache as defaultObjectToCache,
    objectsToCache as defaultObjectsToCache,
    objectFromCache as defaultObjectFromCache,
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from './default.cache.queries';
import { capnp_serialization } from 'transition-rust-backend';

const deleteObjectCache = function (objectId: string, cachePathDirectoryOverride?: string) {
    return defaultDeleteObjectCache({
        cacheName: 'node',
        cachePathDirectoryOverride,
        objectId
    });
};

const objectToCache = function (object: Node, cachePathDirectoryOverride?: string) {
    return defaultObjectToCache({
        cacheName: 'node',
        cachePathDirectoryOverride,
        object,
        cacheWriteFunction: capnp_serialization.writeNodeObject
    });
};

const objectsToCache = function (objects: Node[], cachePathDirectoryOverride?: string) {
    return defaultObjectsToCache(objectToCache, {
        cachePathDirectoryOverride,
        objects
    });
};

const objectFromCache = function (nodeId: string, cachePathDirectoryOverride?: string) {
    return defaultObjectFromCache({
        cacheName: 'node',
        cachePathDirectoryOverride,
        objectId: nodeId,
        ObjectClass: Node,
        cacheReadFunction: capnp_serialization.readNodeObject
    });
};

const collectionToCache = function (collection: NodeCollection, cachePathDirectoryOverride?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'nodes',
        cachePathDirectoryOverride,
        CollectionClass: NodeCollection,
        cacheWriteFunction: capnp_serialization.writeNodeCollection
    });
};

const collectionFromCache = function (cachePathDirectoryOverride?: string) {
    // for now we only return geojson instead of objects for geojson collection

    return defaultCollectionFromCache({
        cacheName: 'nodes',
        cachePathDirectoryOverride,
        CollectionClass: NodeCollection,
        cacheReadFunction: capnp_serialization.readNodeCollection
    });
};

export { objectToCache, objectsToCache, objectFromCache, deleteObjectCache, collectionToCache, collectionFromCache };
