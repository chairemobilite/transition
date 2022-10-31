/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import fetchMock from 'jest-fetch-mock';

import * as cacheQueries from '../transitLines.cache.queries';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ObjectClass from 'transition-common/lib/services/line/Line';
import Collection from 'transition-common/lib/services/line/LineCollection';
import each from 'jest-each';

const getNonNullObject = (orig: any) => {
    const withoutNulls: any = {};
    Object.keys(orig).forEach(key => {
        if (orig[key] !== undefined && orig[key] !== null) {
            if (typeof orig[key] === 'object') {
                withoutNulls[key] = getNonNullObject(orig[key]);
            } else {
                withoutNulls[key] = orig[key];
            }
        }
    });
    return withoutNulls;
}  

const pathId = uuidV4();
const serviceId = uuidV4();
const lineId = uuidV4();
const agencyId = uuidV4();
const scheduleId = uuidV4();

const scheduleForServiceId = {
    "allow_seconds_based_schedules": false,
    "id": scheduleId,
    "line_id": lineId,
    "service_id": serviceId,
    "is_frozen": false,
    "periods": [{
        // Period with start and end hours and multiple trips
        "custom_start_at_str": undefined,
        "schedule_id": scheduleId,
        "end_at_hour": 12,
        "inbound_path_id": undefined,
        "interval_seconds": 1800,
        "number_of_units": undefined,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_period_shortname",
        "start_at_hour": 7,
        "trips": [{
            "schedule_id": scheduleId,
            "arrival_time_seconds": 27015,
            "block_id": "a2cadcb8-ee17-4bd7-9e77-bd400ad73064",
            "departure_time_seconds": 25200,
            "id": "42cadcb8-ee17-4bd7-9e77-bd400ad73064",
            "node_arrival_times_seconds": [null, 25251, 26250, 27015],
            "node_departure_times_seconds": [25200, 25261, 26260, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }, {
            "schedule_id": scheduleId,
            "arrival_time_seconds": 32416,
            "block_id": null,
            "departure_time_seconds": 30601,
            "id": "5389b983-511e-4184-8776-ebc108cebaa2",
            "node_arrival_times_seconds": [null, 30652, 31650, 32416],
            "node_departure_times_seconds": [30601, 30662, 31660, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }, {
            "schedule_id": scheduleId,
            "arrival_time_seconds": 34216,
            "block_id": null,
            "departure_time_seconds": 32401,
            "id": "448544ae-60d1-4d5b-8734-d031332cb6bc",
            "node_arrival_times_seconds": [null, 32452, 33450, 34216],
            "node_departure_times_seconds": [32401, 32462, 33460, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }]
    }, {
        // Period with custom start and end, with a single trip
        "custom_start_at_str": "13:15",
        "custom_end_at_str": "17:24",
        "schedule_id": scheduleId,
        "end_at_hour": 18,
        "inbound_path_id": undefined,
        "interval_seconds": 1800,
        "number_of_units": undefined,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_custom_period",
        "start_at_hour": 13,
        "trips": [{
            "schedule_id": scheduleId,
            "arrival_time_seconds": 50000,
            "block_id": null,
            "departure_time_seconds": 48000,
            "id": "448544ae-cafe-4d5b-8734-d031332cb6bc",
            "node_arrival_times_seconds": [null, 48050, 49450, 50000],
            "node_departure_times_seconds": [48000, 48060, 49460, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }]
    }, {
        // Period with custom start and end, without trips
        "custom_start_at_str": "18:00",
        "custom_end_at_str": "23:00",
        "schedule_id": scheduleId,
        "end_at_hour": 23,
        "inbound_path_id": undefined,
        "interval_seconds": 1800,
        "number_of_units": undefined,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_custom_period",
        "start_at_hour": 18,
        trips: []
    }],
    "periods_group_shortname": "all_day",
};

const newObjectAttributes = {  
  id                       : lineId,
  internal_id              : 'InternalId test 1',
  is_frozen                : false,
  is_enabled               : true,
  agency_id                : agencyId,
  shortname                : '1',
  longname                 : 'Name',
  mode                     : 'bus' as const,
  category                 : 'C+' as const,
  allow_same_line_transfers: false,
  color                    : '#ffffff',
  description              : null,
  is_autonomous            : false,
  scheduleByServiceId      : { [serviceId]: scheduleForServiceId },
  data                     : {
    foo: 'bar',
    bar: 'foo'
  }
};

const newObjectAttributes2 = {
  id                       : uuidV4(),
  internal_id              : 'InternalId test 20',
  is_frozen                : false,
  is_enabled               : true,
  agency_id                : agencyId,
  shortname                : '20',
  longname                 : 'Name 20',
  mode                     : 'tram' as const,
  category                 : 'B' as const,
  allow_same_line_transfers: true,
  color                    : '#000000',
  description              : 'Description 20',
  is_autonomous            : true,
  data        : {
    foo2: 'bar2',
    bar2: 'foo2'
  }
};

beforeAll(() => {
    fetchMock.dontMock();
});

afterAll(() => {
    fetchMock.resetMocks();
});

const collection = new Collection([new ObjectClass(newObjectAttributes, false), new ObjectClass(newObjectAttributes2, false)], {});
// ScheduleByService id is not saved in the cache collection, only in objects
const expectedCollection = new Collection([new ObjectClass(Object.assign({}, newObjectAttributes, { scheduleByServiceId: {}}), false), new ObjectClass(newObjectAttributes2, false)], {});
const emptyCollection = new Collection([], {});

// Simply make sure that cache can be written and read and gives the same
// result, no matter how it is being written (javascript or rust server). Rust
// server must be running for this test to pass
each([
    ['Rust to Rust', true, true],
    ['Rust to Js', true, false],
    ['Js to Rust', false, true],
    ['Js to Js', false, false]
]).describe('Testing writing/reading objects and collections in cache: %s', (_name, writePreference, readPreference) => {
    test('Test write/read collection', async () => {
        // Write the collection
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            await cacheQueries.collectionToCache(collection);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // Read the collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const newCollection = await cacheQueries.collectionFromCache();

        expect(newCollection.getFeatures()).toEqual(expectedCollection.getFeatures());

        // Write an empty cache to make sure previously written cache is erased
        Preferences.set("json2Capnp.enabled", writePreference);
        await cacheQueries.collectionToCache(emptyCollection);
    });

    test('Test write/read single objects', async() => {
        const object = collection.getFeatures()[0];
        // Write the first object in the collection
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            await cacheQueries.objectToCache(object);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // Read the first object in the collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const newObject = await cacheQueries.objectFromCache(object.getId());

        expect(newObject).toBeDefined();
        expect(getNonNullObject((newObject as any).getAttributes())).toEqual(getNonNullObject(object.getAttributes()));

        // Delete the object
        Preferences.set("json2Capnp.enabled", writePreference);
        await cacheQueries.deleteObjectCache(object.getId());

        // Read the unexisting object
        Preferences.set("json2Capnp.enabled", readPreference);
        const unexistingObject = await cacheQueries.objectFromCache(object.getId());
        expect(unexistingObject).not.toBeDefined();
    });

    test('Test write/read multiple objects', async() => {
        const objects = collection.getFeatures();
        // Write the objects with the method to write multiple
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            const count = await cacheQueries.objectsToCache(objects);
            expect(count).toEqual(objects.length);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // Read the 2 objects in the collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const promises = objects.map(async obj => await cacheQueries.objectFromCache(obj.getId()));
        const newObjects = await Promise.all(promises);
        expect(newObjects.map(newObj => getNonNullObject((newObj as any).getAttributes()))).toEqual(objects.map(obj => getNonNullObject(obj.getAttributes())));

        // Delete multiple objects
        Preferences.set("json2Capnp.enabled", writePreference);
        cacheQueries.deleteObjectsCache(objects.map(obj => obj.getId()));

        // Read the unexisting objects
        Preferences.set("json2Capnp.enabled", readPreference);
        const unexistingPromises = objects.map(async obj => await cacheQueries.objectFromCache(obj.getId()));
        const unexistingObjects = await Promise.all(unexistingPromises);
        expect(unexistingObjects).toEqual([undefined, undefined]);
    });
});
