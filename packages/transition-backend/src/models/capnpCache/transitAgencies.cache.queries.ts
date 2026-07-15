/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Agency from 'transition-common/lib/services/agency/Agency';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import {
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from './default.cache.queries';

import { capnp_serialization } from 'transition-rust-backend';

const collectionToCache = function (collection: AgencyCollection, cachePathDirectoryOverride?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'agencies',
        cachePathDirectoryOverride,
        CollectionClass: AgencyCollection,
        cacheWriteFunction: capnp_serialization.writeAgencyCollection
    });
};

const collectionFromCache = function (cachePathDirectoryOverride?: string) {
    return defaultCollectionFromCache({
        CollectionClass: AgencyCollection,
        cacheName: 'agencies',
        cachePathDirectoryOverride,
        parser: function (object) {
            if (object.attributes) {
                return new Agency(object.attributes, false);
            } else {
                return new Agency(object, false);
            }
        },
        cacheReadFunction: capnp_serialization.readAgencyCollection
    });
};

export { collectionToCache, collectionFromCache };
