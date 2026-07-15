/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Scenario from 'transition-common/lib/services/scenario/Scenario';
import ScenarioCollection from 'transition-common/lib/services/scenario/ScenarioCollection';
import {
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from './default.cache.queries';
import { capnp_serialization } from 'transition-rust-backend';

const collectionToCache = async (collection: ScenarioCollection, cachePathDirectoryOverride?: string) => {
    return defaultCollectionToCache({
        collection,
        cacheName: 'scenarios',
        cachePathDirectoryOverride,
        CollectionClass: ScenarioCollection,
        cacheWriteFunction: capnp_serialization.writeScenarioCollection
    });
};

const collectionFromCache = function (cachePathDirectoryOverride?: string) {
    return defaultCollectionFromCache({
        CollectionClass: ScenarioCollection,
        cacheName: 'scenarios',
        cachePathDirectoryOverride,
        cacheReadFunction: capnp_serialization.readScenarioCollection,
        parser: function (object) {
            if (object.attributes) {
                return new Scenario(object.attributes, false);
            } else {
                return new Scenario(object, false);
            }
        }
    });
};

export { collectionToCache, collectionFromCache };
