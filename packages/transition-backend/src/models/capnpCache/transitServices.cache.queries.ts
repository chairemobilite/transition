/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Service from 'transition-common/lib/services/service/Service';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import {
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from './default.cache.queries';
import { capnp_serialization } from 'transition-rust-backend';

const collectionToCache = function (collection: ServiceCollection, cachePathDirectoryOverride?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'services',
        cachePathDirectoryOverride,
        CollectionClass: ServiceCollection,
        cacheWriteFunction: capnp_serialization.writeServiceCollection
    });
};

const collectionFromCache = function (cachePathDirectoryOverride?: string) {
    return defaultCollectionFromCache({
        CollectionClass: ServiceCollection,
        cacheName: 'services',
        cachePathDirectoryOverride,
        cacheReadFunction: capnp_serialization.readServiceCollection,
        parser: function (object) {
            if (object.attributes) {
                return new Service(object.attributes, false);
            } else {
                return new Service(object, false);
            }
        }
    });
};

export { collectionToCache, collectionFromCache };
