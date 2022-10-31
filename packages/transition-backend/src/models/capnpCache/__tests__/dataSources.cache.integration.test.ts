/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import fetchMock from 'jest-fetch-mock';

import * as cacheQueries from '../dataSources.cache.queries';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ObjectClass from 'transition-common/lib/services/dataSource/DataSource';
import Collection from 'transition-common/lib/services/dataSource/DataSourceCollection';
import each from 'jest-each';

const newObjectAttributes = {
    id: uuidV4(),
    name: 'Datasource1',
    data: {},
    shortname: 'DS1',
    description: 'description',
    type: 'odTrips',
    is_frozen: false
};

const newObjectAttributes2 = {
    id: uuidV4(),
    name: 'Datasource2',
    data: { foo: 'bar' },
    shortname: '2',
    description: 'description',
    type: 'places',
    is_frozen: true
};
  
beforeAll(() => {
    fetchMock.dontMock();
})

afterAll(() => {
    fetchMock.resetMocks();
})

const collection = new Collection([new ObjectClass(newObjectAttributes, false), new ObjectClass(newObjectAttributes2, false)], {});
const emptyCollection = new Collection([], {});

// Simply make sure that cache can be written and read and gives the same
// result, no matter how it is being written (javascript or rust server). Rust
// server must be running for this test to pass
each([
    ['Rust to Rust', true, true],
    ['Rust to Js', true, false],
    ['Js to Rust', false, true],
    ['Js to Js', false, false]
]).describe('Testing writing/reading collections in cache: %s', (_name, writePreference, readPreference) => {
    test('Test write/read collection', async () => {
        // Write the scenario collection
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            await cacheQueries.collectionToCache(collection);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // Read the scenario collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const newCollection = await cacheQueries.collectionFromCache();

        expect(newCollection.getFeatures()).toEqual(collection.getFeatures());

        // Write an empty cache to make sure previously written cache is erased
        Preferences.set("json2Capnp.enabled", writePreference);
        await cacheQueries.collectionToCache(emptyCollection);
    })
});
