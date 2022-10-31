/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import fetchMock from 'jest-fetch-mock';

import * as cacheQueries           from '../transitServices.cache.queries';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ObjectClass from 'transition-common/lib/services/service/Service';
import Collection from 'transition-common/lib/services/service/ServiceCollection';
import each from 'jest-each';

const simulationId = '373a583c-df49-440f-8f44-f39fb0033c56';

const newObjectAttributes = {  
    id           : uuidV4(),
    name         : 'Service test',
    internal_id  : 'internalIdTest1',
    is_frozen    : false,
    is_enabled   : true,
    monday       : true,
    tuesday      : true,
    wednesday    : true,
    thursday     : true,
    friday       : true,
    saturday     : false,
    sunday       : false,
    start_date   : '2019-01-01',
    end_date     : '2019-03-09',
    only_dates   : [],
    except_dates : ['2019-02-02'],
    color        : '#ffffff',
    description  : null,
    simulation_id: null,
    data         : {
      foo: 'bar',
      bar: 'foo',
      variables: {}
    }
};
  
const newObjectAttributes2 = {
    id           : uuidV4(),
    name         : 'Service test 2',
    internal_id  : 'internalIdTest2',
    is_frozen    : false,
    is_enabled   : true,
    monday       : false,
    tuesday      : false,
    wednesday    : false,
    thursday     : false,
    friday       : false,
    saturday     : true,
    sunday       : true,
    start_date   : '2018-02-24',
    end_date     : '2018-08-16',
    only_dates   : ['2018-09-14', '2018-09-15'],
    except_dates : [],
    color        : '#000000',
    description  : 'description test',
    simulation_id: simulationId,
    data         : {
      foo2: 'bar2',
      bar2: 'foo2',
      variables: {}
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
]).describe('Testing writing/reading collections in cache: %s', (_name, writePreference, readPreference) => {
    test('Test write/read collection', async () => {
        // Write the service collection
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            await cacheQueries.collectionToCache(collection);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // Read the service collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const newCollection = await cacheQueries.collectionFromCache();

        expect(newCollection.getFeatures()).toEqual(collection.getFeatures());

        // Write an empty cache to make sure previously written cache is erased
        Preferences.set("json2Capnp.enabled", writePreference);
        await cacheQueries.collectionToCache(emptyCollection);
    })
});
