/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Line from 'transition-common/lib/services/line/Line';

import LineCollection from 'transition-common/lib/services/line/LineCollection';
import {
    deleteObjectCache as defaultDeleteObjectCache,
    deleteObjectsCache as defaultDeleteObjectsCache,
    objectToCache as defaultObjectToCache,
    objectsToCache as defaultObjectsToCache,
    objectFromCache as defaultObjectFromCache,
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from './default.cache.queries';
import { capnp_serialization } from 'transition-rust-backend';

const deleteObjectCache = function (objectId: string, cachePathDirectoryOverride?: string) {
    return defaultDeleteObjectCache({
        cacheName: 'line',
        cachePathDirectoryOverride,
        objectId
    });
};

const deleteObjectsCache = function (objectIds: string[], cachePathDirectoryOverride?: string) {
    return defaultDeleteObjectsCache({
        cacheName: 'line',
        cachePathDirectoryOverride,
        objectIds
    });
};

const objectToCache = function (object: Line, cachePathDirectoryOverride?: string) {
    return defaultObjectToCache({
        cacheName: 'line',
        cachePathDirectoryOverride,
        object,
        cacheWriteFunction: capnp_serialization.writeLineObject
    });
};

const objectsToCache = function (objects: Line[], cachePathDirectoryOverride?: string) {
    return defaultObjectsToCache(objectToCache, {
        cachePathDirectoryOverride,
        objects
    });
};

const objectFromCache = function (lineId: string, cachePathDirectoryOverride?: string) {
    return defaultObjectFromCache({
        cacheName: 'line',
        cachePathDirectoryOverride,
        objectId: lineId,
        ObjectClass: Line,
        cacheReadFunction: capnp_serialization.readLineObject
    });
};

const collectionToCache = function (collection, cachePathDirectoryOverride?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'lines',
        cachePathDirectoryOverride,
        CollectionClass: LineCollection,
        cacheWriteFunction: capnp_serialization.writeLineCollection
    });
};

const collectionFromCache = function (cachePathDirectoryOverride?: string) {
    return defaultCollectionFromCache({
        cacheName: 'lines',
        cachePathDirectoryOverride,
        CollectionClass: LineCollection,
        parser: function (object) {
            if (object.attributes) {
                return new Line(object.attributes, false);
            } else {
                return new Line(object, false);
            }
        },
        cacheReadFunction: capnp_serialization.readLineCollection
    });
};

export {
    objectToCache,
    objectsToCache,
    objectFromCache,
    deleteObjectCache,
    deleteObjectsCache,
    collectionToCache,
    collectionFromCache
};
