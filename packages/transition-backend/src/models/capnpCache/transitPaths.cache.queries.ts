/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import {
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from './default.cache.queries';
import { capnp_serialization } from 'transition-rust-backend';

const collectionToCache = function (collection: PathCollection, cachePathDirectoryOverride?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'paths',
        cachePathDirectoryOverride,
        CollectionClass: PathCollection,
        cacheWriteFunction: capnp_serialization.writePathCollection
    });
};

const collectionFromCache = function (cachePathDirectoryOverride?: string) {
    return defaultCollectionFromCache({
        cacheName: 'paths',
        cachePathDirectoryOverride,
        CollectionClass: PathCollection,
        cacheReadFunction: capnp_serialization.readPathCollection
    });
};

export { collectionToCache, collectionFromCache };
