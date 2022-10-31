/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import fetchMock from 'jest-fetch-mock';

import * as cacheQueries           from '../transitAgencies.cache.queries';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ObjectClass from 'transition-common/lib/services/agency/Agency';
import Collection from 'transition-common/lib/services/agency/AgencyCollection';
import each from 'jest-each';

const simulationId = '373a583c-df49-440f-8f44-f39fb0033c56';

const newObjectAttributes = {  
  id           : uuidV4(),
  internal_id  : 'internalTestId',
  acronym      : 'ATEST',
  name         : 'Agency test',
  is_frozen    : false,
  is_enabled   : true,
  color        : '#ffffff',
  description  : null,
  simulation_id: null,
  data         : {
    foo: 'bar',
    bar: 'foo'
  }
};

const newObjectAttributes2 = {
  id           : uuidV4(),
  internal_id  : 'internalTestId2',
  acronym      : 'ATEST2',
  name         : 'Agency test 2',
  is_frozen    : false,
  is_enabled   : true,
  color        : '#000000',
  description  : 'description test',
  simulation_id: simulationId,
  data         : {
    foo2: 'bar2',
    bar2: 'foo2'
  }
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
]).describe('Testing writing/reading agency collections in cache: %s', (_name, writePreference, readPreference) => {
    test('Test write/read collection', async () => {
        // Write the agency collection
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            await cacheQueries.collectionToCache(collection);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // Read the agency collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const newCollection = await cacheQueries.collectionFromCache();

        expect(newCollection.getFeatures()).toEqual(collection.getFeatures());

        // Write an empty cache to make sure previously written cache is erased
        Preferences.set("json2Capnp.enabled", writePreference);
        await cacheQueries.collectionToCache(emptyCollection);
    })
});
