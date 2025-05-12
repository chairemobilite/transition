/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../odPairs.db.queries';
import dataSourceDbQueries from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import Collection from 'transition-common/lib/services/odTrip/BaseOdTripCollection';
import { BaseOdTrip as ObjectClass } from 'transition-common/lib/services/odTrip/BaseOdTrip';

const objectName   = 'odTrip';
const dataSourceId = '373a583c-df49-440f-8f44-f39fb0033c56';

const newObjectAttributes = {  
    id: uuidV4(),
    internal_id: 'test',
    origin_geography: { type: 'Point' as const, coordinates: [-73, 45] },
    destination_geography: { type: 'Point' as const, coordinates: [-73.5, 45.5] },
    timeOfTrip: 28800,
    timeType: 'departure' as const
};

const newObjectAttributes2 = {
    id: uuidV4(),
    internal_id: 'test2',
    dataSourceId: dataSourceId,
    origin_geography: { type: 'Point' as const, coordinates: [-73.1, 45.2] },
    destination_geography: { type: 'Point' as const, coordinates: [-73.4, 45.4] },
    timeOfTrip: 24000,
    data: {
        expansionFactor: 2,
        foo: 'bar'
    },
    timeType: 'arrival' as const
};

const updatedAttributes = {
  internal_id: 'new internal ID',
  timeOfTrip: 3600
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await dataSourceDbQueries.create({
        id: dataSourceId,
        type: 'odTrips',
        data: {}
    });
});

afterAll(async() => {
    await dbQueries.truncate();
    await dataSourceDbQueries.truncate();
    await knex.destroy();
});

describe(`${objectName}`, () => {

    test('exists should return false if object is not in database', async () => {

        const exists = await dbQueries.exists(uuidV4())
        expect(exists).toBe(false);

    });

    test('should create a new object in database', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read a new object in database', async() => {
        
        const attributes = await dbQueries.read(newObjectAttributes.id) as any;
        delete attributes.updated_at;
        delete attributes.created_at;
        delete attributes.integer_id;
        expect(attributes.dataSourceId).toBeUndefined();
        delete attributes.dataSourceId;
        expect(attributes.data).toEqual({});
        delete attributes.data;
        expect(attributes).toEqual(newObjectAttributes);

    });

    test('should update an object in database', async() => {
        
        const id = await dbQueries.update(newObjectAttributes.id, updatedAttributes);
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read an updated object from database', async() => {

        const updatedObject = await dbQueries.read(newObjectAttributes.id) as any;
        for (const attribute in updatedAttributes)
        {
            expect(updatedObject[attribute]).toBe(updatedAttributes[attribute]);
        }

    });

    test('should create a second new object in database', async() => {
        
        const newObject = new ObjectClass(newObjectAttributes2, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes2.id);

    });

    test('should read collection from database', async() => {
        
        const _collection = await dbQueries.collection();
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributes);
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        delete collection[0].attributes.integer_id;
        delete collection[1].attributes.integer_id;
        expect(collection[0].attributes.dataSourceId).toBeUndefined();
        delete collection[0].attributes.dataSourceId;
        expect(collection[0].getId()).toBe(_newObjectAttributes.id);
        expect(collection[0].attributes).toEqual(new ObjectClass(_newObjectAttributes, false).attributes);
        expect(collection[1].getId()).toBe(_newObjectAttributes2.id);
        expect(collection[1].attributes).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);
        
    });

    test('update multiple objects, with error, none should be updated', async() => {
        
        // Reset the first object to its original state
        const _updatedAttributes = Object.assign({}, newObjectAttributes);
        const updatedObject = new ObjectClass(_updatedAttributes, true);
        // Add a dataSourceId to second object, should throw an error
        const _updatedAttributes2 = { id: newObjectAttributes2.id, dataSourceId: uuidV4() };
        const updatedObject2 = new ObjectClass(_updatedAttributes2, true);

        let error: any = undefined;
        try {
            await dbQueries.updateMultiple([updatedObject.attributes, updatedObject2.attributes]);
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Make sure the first object has not been updated since the update is a transaction
        const _collection = await dbQueries.collection();
        const object = _collection.find(obj => obj.id === newObjectAttributes.id);
        expect(object).toBeDefined();
        for (const attribute in updatedAttributes)
        {
            expect((object as any)[attribute]).toEqual(updatedAttributes[attribute]);
        }
    });

    test('update multiple objects, with success', async() => {
        
        // Reset the first object to its original state
        const _updatedAttributes = Object.assign({}, newObjectAttributes);
        const updatedObject = new ObjectClass(_updatedAttributes, true);
        const _updatedAttributes2 = { id: newObjectAttributes2.id, ...updatedAttributes };

        const response = await dbQueries.updateMultiple([updatedObject.attributes, _updatedAttributes2]);
        expect(response.length).toEqual(2);

        // Make sure both objects have been updated
        const _collection = await dbQueries.collection();
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributes);
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes2[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        delete collection[0].attributes.integer_id;
        delete collection[1].attributes.integer_id;
        // Find new object
        const object1 = collection.find((obj) => obj.getId() === _newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect((object1 as any).attributes).toEqual(new ObjectClass(_newObjectAttributes, false).attributes);
        const object2 = collection.find((obj) => obj.getId() === _newObjectAttributes2.id);
        expect(object2).toBeDefined();
        expect((object2 as any).attributes).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);
    });

    test('should delete objects from database', async() => {
        
        const id = await dbQueries.delete(newObjectAttributes.id)
        expect(id).toBe(newObjectAttributes.id);

        const ids = await dbQueries.deleteMultiple([newObjectAttributes.id, newObjectAttributes2.id]);
        expect(ids).toEqual([newObjectAttributes.id, newObjectAttributes2.id]);

    });

    test('create multiple with errors, it should be a transaction', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        // Data source ID does not exist, it shouldn't be possible to insert this object
        const newObject2 = new ObjectClass(Object.assign({}, newObjectAttributes2, { dataSourceId: uuidV4() }), true);

        let error: any = undefined;
        try {
            await dbQueries.createMultiple([newObject.attributes, newObject2.attributes]);
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();
        const _collection = await dbQueries.collection();
        expect(_collection.length).toEqual(0);
        
    });

    test('create multiple with success', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const newObject2 = new ObjectClass(newObjectAttributes2, true);

        const ids = await dbQueries.createMultiple([newObject.attributes, newObject2.attributes]);
        
        expect(ids).toEqual([{ id: newObject.getId() }, { id: newObject2.getId() }]);
        const _collection = await dbQueries.collection();
        expect(_collection.length).toEqual(2);

    });

    test('get a collection for specific data source id', async() => {

        const _collection = await dbQueries.collection([dataSourceId]);
        const objectCollection = new Collection();
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        expect(collection.length).toBe(1);

        delete collection[0].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[0].attributes.integer_id;
        expect(collection[0].getId()).toBe(_newObjectAttributes2.id);
        expect(collection[0].attributes).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);

    });

});
