/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _omit from 'lodash/omit';
import fetchMock from 'jest-fetch-mock';

import * as cacheQueries from '../transitNodes.cache.queries';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ObjectClass, { NodeAttributes } from 'transition-common/lib/services/nodes/Node';
import Collection from 'transition-common/lib/services/nodes/NodeCollection';
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

const getCollectionAttributes = (feature: GeoJSON.Feature<GeoJSON.Point, NodeAttributes>) => {
    const { data, ...rest } = feature.properties;
    return getNonNullObject({ ...rest, data: _omit(data, 'transferableNodes', 'accessiblePlaces', 'accessibleResidentialEntrances') })
}

const newObjectAttributes = {
    id: uuidV4(),
    code: '0001',
    name: 'NewNode 1',
    internal_id: 'Test1',
    integer_id: 1,
    geography: {
        type: "Point" as const,
        coordinates: [-73.0, 45.0]
    },
    color: '#ffff00',
    is_enabled: true,
    is_frozen: false,
    description: 'New node description',
    default_dwell_time_seconds: 25,
    routing_radius_meters: 50,
    data: {
        foo: 'bar',
        transferableNodes: {
            nodesIds: [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
            walkingTravelTimesSeconds: [125, 582, 654, 497, 115],
            walkingDistancesMeters: [145, 574, 944, 579, 157]
        },
        accessiblePlaces: {},
        accessibleResidentialEntrances: {}
    }
};

const newObjectAttributes2 = {
    id: uuidV4(),
    code: '0002',
    name: 'NewSNode 2',
    internal_id: 'Test2',
    integer_id: 2,
    geography: {
        type: "Point" as const,
        coordinates: [-73.2, 45.4]
    },
    color: '#00ff00',
    is_enabled: true,
    is_frozen: false,
    data: {
        foo2: 'bar2',
        transferableNodes: {
            nodesIds: [],
            walkingTravelTimesSeconds: [],
            walkingDistancesMeters: []
        }
    }
};

beforeAll(() => {
    fetchMock.dontMock();
});

afterAll(() => {
    fetchMock.resetMocks();
});

const baseObjects = [new ObjectClass(newObjectAttributes, false), new ObjectClass(newObjectAttributes2, false)];
const collection = new Collection(baseObjects.map(obj => obj.toGeojson()), {}, undefined);
const emptyCollection = new Collection([], {}, undefined);

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
        const newCollection = await cacheQueries.collectionFromCache() as Collection;

        expect(newCollection.getFeatures().map(feature => newCollection.newObject(feature).toGeojson()).map(getCollectionAttributes)).toEqual(collection.getFeatures().map(getCollectionAttributes));

        // Write an empty cache to make sure previously written cache is erased
        Preferences.set("json2Capnp.enabled", writePreference);
        await cacheQueries.collectionToCache(emptyCollection);
    });

    test('Test write/read single objects', async () => {
        const node = baseObjects[0];

        if (node.attributes.data.accessiblePlaces) {
            delete node.attributes.data.accessiblePlaces;
        }
        if (node.attributes.data.accessibleResidentialEntrances) {
            delete node.attributes.data.accessibleResidentialEntrances;
        }

        // Write the first object in the collection
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            await cacheQueries.objectToCache(node);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // Read the first object in the collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const newObject = await cacheQueries.objectFromCache(node.getId());

        expect(newObject).toBeDefined();
        expect(getNonNullObject((newObject as ObjectClass).attributes)).toEqual(getNonNullObject(node.attributes));

        // Delete the object
        Preferences.set("json2Capnp.enabled", writePreference);
        await cacheQueries.deleteObjectCache(node.getId());

        // Read the unexisting object
        Preferences.set("json2Capnp.enabled", readPreference);
        const unexistingObject = await cacheQueries.objectFromCache(node.getId());
        expect(unexistingObject).not.toBeDefined();
    });

    test('Test write/read multiple objects', async () => {
        const nodes = baseObjects;
        // Write the objects with the method to write multiple
        Preferences.set("json2Capnp.enabled", writePreference);
        try {
            const count = await cacheQueries.objectsToCache(nodes);
            expect(count).toEqual(nodes.length);
        } catch (error) {
            console.error('Error writing to cache. If this is the rust server, make sure the server runs and has the right cache path: To run it, use `cargo run 2000 ../../projects/test/test_cache/test`')
            throw error;
        }

        // add accessiblePlaces and accessibleResidentialEntrances if empty:
        for (let i = 0, count = nodes.length; i < count; i++) {
            if (nodes[i].attributes.data.accessiblePlaces) {
                delete nodes[i].attributes.data.accessiblePlaces;
            }
            if (nodes[i].attributes.data.accessibleResidentialEntrances) {
                delete nodes[i].attributes.data.accessibleResidentialEntrances;
            }
        }

        // Read the 2 objects in the collection
        Preferences.set("json2Capnp.enabled", readPreference);
        const promises = nodes.map(async obj => await cacheQueries.objectFromCache(obj.getId()));
        const newObjects = await Promise.all(promises);

        expect(newObjects.map(newObj => getNonNullObject((newObj as ObjectClass).attributes))).toEqual(nodes.map(obj => getNonNullObject(obj.attributes)));

        // Delete the object
        Preferences.set("json2Capnp.enabled", writePreference);
        nodes.forEach(async obj => {
            await cacheQueries.deleteObjectCache(obj.getId());
        })

        // Read the unexisting objects
        Preferences.set("json2Capnp.enabled", readPreference);
        const unexistingPromises = nodes.map(async obj => await cacheQueries.objectFromCache(obj.getId()));
        const unexistingObjects = await Promise.all(unexistingPromises);
        expect(unexistingObjects).toEqual([undefined, undefined]);
    });
});
