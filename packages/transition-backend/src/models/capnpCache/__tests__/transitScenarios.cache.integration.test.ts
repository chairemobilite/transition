/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import fetchMock from 'jest-fetch-mock';

import * as cacheQueries           from '../transitScenarios.cache.queries';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ObjectClass from 'transition-common/lib/services/scenario/Scenario';
import Collection from 'transition-common/lib/services/scenario/ScenarioCollection';
import each from 'jest-each';

const simulationId = '373a583c-df49-440f-8f44-f39fb0033c56';

const newObjectAttributes = {  
    id             : uuidV4(),
    name           : 'Scenario test',
    is_frozen      : false,
    is_enabled     : true,
    services       : [uuidV4(), uuidV4()],
    only_agencies  : [uuidV4(), uuidV4()],
    only_lines     : [uuidV4(), uuidV4(), uuidV4()],
    only_nodes     : [uuidV4()],
    only_modes     : [uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    except_agencies: [],
    except_lines   : [],
    except_nodes   : [],
    except_modes   : [],
    color          : '#ffffff',
    description    : null,
    simulation_id  : null,
    data           : {
      foo: 'bar',
      bar: 'foo'
    }
};
  
const newObjectAttributes2 = {
    id             : uuidV4(),
    name           : 'Scenario test 2',
    is_frozen      : false,
    is_enabled     : true,
    services       : [uuidV4()],
    only_agencies  : [],
    only_lines     : [],
    only_nodes     : [],
    only_modes     : [],
    except_agencies: [uuidV4(), uuidV4()],
    except_lines   : [uuidV4(), uuidV4(), uuidV4()],
    except_nodes   : [uuidV4()],
    except_modes   : [uuidV4(), uuidV4(), uuidV4(), uuidV4()],
    color          : '#000000',
    description    : 'description test 2',
    simulation_id  : simulationId,
    data        : {
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
