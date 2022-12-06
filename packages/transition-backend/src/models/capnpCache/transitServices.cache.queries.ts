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
} from 'chaire-lib-backend/lib/models/capnp/default.cache.queries';
import {
    ServiceCollection as CacheCollection,
    Service as CacheObject
} from '../capnpDataModel/serviceCollection.capnp';
import { boolToInt8, int8ToBool } from 'chaire-lib-backend/lib/utils/json2capnp/CapnpConversionUtils';
import { _emptyStringToNull } from 'chaire-lib-common/lib/utils/LodashExtensions';

const collectionToCache = function (collection: ServiceCollection, cachePathDirectory?: string) {
    return defaultCollectionToCache({
        collection,
        cacheName: 'services',
        cachePathDirectory,
        pluralizedCollectionName: 'Services',
        maxNumberOfObjectsPerFile: 1000,
        CacheCollection,
        CollectionClass: ServiceCollection,
        capnpParser: function (object: Service, cacheObject: CacheObject) {
            const attributes = object.getAttributes();

            cacheObject.setUuid(attributes.id);
            cacheObject.setName(attributes.name || '');
            cacheObject.setInternalId(attributes.internal_id || '');
            cacheObject.setColor(attributes.color || '');
            cacheObject.setMonday(boolToInt8(attributes.monday));
            cacheObject.setTuesday(boolToInt8(attributes.tuesday));
            cacheObject.setWednesday(boolToInt8(attributes.wednesday));
            cacheObject.setThursday(boolToInt8(attributes.thursday));
            cacheObject.setFriday(boolToInt8(attributes.friday));
            cacheObject.setSaturday(boolToInt8(attributes.saturday));
            cacheObject.setSunday(boolToInt8(attributes.sunday));
            cacheObject.setStartDate(attributes.start_date || '');
            cacheObject.setEndDate(attributes.end_date || '');
            cacheObject.setIsEnabled(boolToInt8(attributes.is_enabled));
            cacheObject.setDescription(attributes.description || '');
            cacheObject.setSimulationUuid(attributes.simulation_id || '');
            cacheObject.setIsFrozen(boolToInt8(attributes.is_frozen));
            cacheObject.setData(JSON.stringify(attributes.data || {}));

            const onlyDates = attributes.only_dates || [];
            const onlyDatesCount = onlyDates.length;
            const onlyDatesCache = cacheObject.initOnlyDates(onlyDatesCount);

            for (let i = 0; i < onlyDatesCount; i++) {
                onlyDatesCache.set(i, onlyDates[i]);
            }

            const exceptDates = attributes.except_dates || [];
            const exceptDatesCount = exceptDates.length;
            const exceptDatesCache = cacheObject.initExceptDates(exceptDatesCount);

            for (let i = 0; i < exceptDatesCount; i++) {
                //console.log(exceptDates[i]);
                exceptDatesCache.set(i, exceptDates[i]);
            }
        }
    });
};

const collectionFromCache = function (cachePathDirectory?: string) {
    return defaultCollectionFromCache({
        collection: new ServiceCollection([], {}),
        CollectionClass: ServiceCollection,
        cacheName: 'services',
        cachePathDirectory,
        pluralizedCollectionName: 'Services',
        CacheCollection,
        parser: function (object) {
            if (object.attributes) {
                return new Service(object.attributes, false);
            } else {
                return new Service(object, false);
            }
        },
        capnpParser: function (cacheObject: CacheObject) {
            return new Service(
                {
                    id: cacheObject.getUuid(),
                    name: _emptyStringToNull(cacheObject.getName()),
                    internal_id: _emptyStringToNull(cacheObject.getInternalId()),
                    color: _emptyStringToNull(cacheObject.getColor()),
                    is_enabled: int8ToBool(cacheObject.getIsEnabled()),
                    is_frozen: int8ToBool(cacheObject.getIsFrozen()),
                    description: _emptyStringToNull(cacheObject.getDescription()),
                    simulation_id: _emptyStringToNull(cacheObject.getSimulationUuid()),
                    data: JSON.parse(cacheObject.getData()),
                    monday: int8ToBool(cacheObject.getMonday()),
                    tuesday: int8ToBool(cacheObject.getTuesday()),
                    wednesday: int8ToBool(cacheObject.getWednesday()),
                    thursday: int8ToBool(cacheObject.getThursday()),
                    friday: int8ToBool(cacheObject.getFriday()),
                    saturday: int8ToBool(cacheObject.getSaturday()),
                    sunday: int8ToBool(cacheObject.getSunday()),
                    start_date: _emptyStringToNull(cacheObject.getStartDate()),
                    end_date: _emptyStringToNull(cacheObject.getEndDate()),
                    only_dates: cacheObject.getOnlyDates().map((onlyDate) => {
                        return onlyDate;
                    }),
                    except_dates: cacheObject.getExceptDates().map((exceptDate) => {
                        return exceptDate;
                    })
                },
                false
            );
        }
    });
};

export { collectionToCache, collectionFromCache };
