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
} from 'chaire-lib-backend/lib/models/capnp/default.cache.queries';
import { AgencyCollection as CacheCollection, Agency as CacheObject } from '../capnpDataModel/agencyCollection.capnp';
import { _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';
import { boolToInt8, int8ToBool } from 'chaire-lib-backend/lib/utils/json2capnp/CapnpConversionUtils';

const collectionToCache = function (collection: AgencyCollection, cachePathDirectory?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'agencies',
        cachePathDirectory,
        pluralizedCollectionName: 'Agencies',
        maxNumberOfObjectsPerFile: 1000,
        CacheCollection,
        CollectionClass: AgencyCollection,
        capnpParser: function (object: Agency, cacheObject: CacheObject) {
            const attributes = object.attributes;
            if (!attributes.data) {
                attributes.data = {};
            }

            cacheObject.setUuid(attributes.id);
            cacheObject.setAcronym(attributes.acronym || '');
            cacheObject.setName(attributes.name || '');
            cacheObject.setInternalId(attributes.internal_id || '');
            cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
            cacheObject.setColor(attributes.color || '');
            cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
            cacheObject.setDescription(attributes.description || '');
            cacheObject.setSimulationUuid(attributes.simulation_id || '');
            cacheObject.setData(JSON.stringify(attributes.data || {}));
        }
    });
};

const collectionFromCache = function (cachePathDirectory?: string) {
    return defaultCollectionFromCache({
        collection: new AgencyCollection([], {}),
        CollectionClass: AgencyCollection,
        cacheName: 'agencies',
        cachePathDirectory,
        pluralizedCollectionName: 'Agencies',
        CacheCollection,
        parser: function (object) {
            if (object.attributes) {
                return new Agency(object.attributes, false);
            } else {
                return new Agency(object, false);
            }
        },
        capnpParser: function (cacheObject: CacheObject) {
            return new Agency(
                {
                    id: cacheObject.getUuid(),
                    acronym: _emptyStringToNull(cacheObject.getAcronym()),
                    name: _emptyStringToNull(cacheObject.getName()),
                    color: _emptyStringToNull(cacheObject.getColor()),
                    description: _emptyStringToNull(cacheObject.getDescription()),
                    is_enabled: int8ToBool(cacheObject.getIsEnabled()),
                    internal_id: _emptyStringToNull(cacheObject.getInternalId()),
                    simulation_id: _emptyStringToNull(cacheObject.getSimulationUuid()),
                    is_frozen: int8ToBool(cacheObject.getIsFrozen()),
                    data: JSON.parse(cacheObject.getData())
                },
                false
            );
        }
    });
};

export { collectionToCache, collectionFromCache };
