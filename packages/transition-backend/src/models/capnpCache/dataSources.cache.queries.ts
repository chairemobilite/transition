/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _snakeCase from 'lodash/snakeCase';
import _camelCase from 'lodash/camelCase';

import DataSource from 'chaire-lib-common/lib/services/dataSource/DataSource';
import DataSourceCollection from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import {
    collectionToCache as defaultCollectionToCache,
    collectionFromCache as defaultCollectionFromCache
} from 'chaire-lib-backend/lib/models/capnp/default.cache.queries';
import { DataSourceCollection as CacheCollection } from '../capnpDataModel/dataSourceCollection.capnp';
import { DataSource_Type, DataSource as CacheObject } from '../capnpDataModel/dataSource.capnp';
import { boolToInt8, int8ToBool } from 'chaire-lib-backend/lib/utils/json2capnp/CapnpConversionUtils';
import { _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';

const collectionToCache = function (collection: DataSourceCollection, cachePathDirectory?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'dataSources',
        cachePathDirectory,
        pluralizedCollectionName: 'DataSources',
        maxNumberOfObjectsPerFile: 1000,
        CacheCollection,
        CollectionClass: DataSourceCollection,
        capnpParser: function (object: DataSource, cacheObject: CacheObject) {
            const attributes = object.getAttributes();

            cacheObject.setUuid(attributes.id);
            cacheObject.setType(Object.values(DataSource_Type).indexOf(_snakeCase(attributes.type).toUpperCase()));
            cacheObject.setShortname(attributes.shortname || '');
            cacheObject.setName(attributes.name || '');
            cacheObject.setDescription(attributes.description || '');
            cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
            cacheObject.setData(JSON.stringify(attributes.data || {}));
        }
    });
};

const collectionFromCache = function (cachePathDirectory?: string) {
    return defaultCollectionFromCache({
        collection: new DataSourceCollection([], {}),
        CollectionClass: DataSourceCollection,
        cacheName: 'dataSources',
        cachePathDirectory,
        pluralizedCollectionName: 'DataSources',
        CacheCollection,
        parser: function (object) {
            if (object.attributes) {
                return new DataSource(object.attributes, false);
            } else {
                return new DataSource(object, false);
            }
        },
        capnpParser: function (cacheObject: CacheObject) {
            return new DataSource(
                {
                    id: cacheObject.getUuid(),
                    type: _camelCase(DataSource_Type[cacheObject.getType()]),
                    shortname: _emptyStringToNull(cacheObject.getShortname()),
                    name: _emptyStringToNull(cacheObject.getName()),
                    description: _emptyStringToNull(cacheObject.getDescription()),
                    is_frozen: int8ToBool(cacheObject.getIsFrozen()),
                    data: JSON.parse(cacheObject.getData())
                },
                false
            );
        }
    });
};

export { collectionToCache, collectionFromCache };
