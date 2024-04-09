/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import knex from '../../../config/shared/db.config';
import { create, truncate } from '../default.db.queries';
import dbQueries           from '../dataSources.db.queries';
import Collection          from 'chaire-lib-common/lib/services/dataSource/DataSourceCollection';
import ObjectClass         from 'chaire-lib-common/lib/services/dataSource/DataSource';

const objectName   = 'data source';

const user = {
    id: 1,
    uuid: uuidV4(),
    email: 'test@transition.city',
    is_valid: true
};

const newObjectAttributes = {
    id: uuidV4(),
    shortname: 'new_test_data_source',
    type: 'transitSmartCardData' as const,
    name: 'new test data source',
    description: "description for new test data source",
    is_frozen: true,
    data: {
      foo: 'bar',
      bar: 'foo'
    }
};
  
const newObjectAttributes2 = {
    id: uuidV4(),
    shortname: 'new_test_data_source2',
    type: 'transitOperationalData' as const,
    name: 'new test data source 2',
    description: "description for new test data source 2",
    is_frozen: false,
    owner: user.id,
    data: {
      foo2: 'bar2',
      bar2: 'foo2'
    }
};

const sameNameDifferentType = {
    id: uuidV4(),
    shortname: newObjectAttributes2.shortname,
    type: 'odTrips' as const,
    name: newObjectAttributes2.name,
    description: newObjectAttributes2.description,
    is_frozen: false,
    data: {
      foo2: 'bar2',
      bar2: 'foo2'
    }
};
  
const updatedAttributes = {
    shortname: 'updated test data source',
    type: 'other' as const
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await truncate(knex, 'users');
    await create(knex, 'users', undefined, user as any);
});

afterAll(async() => {
    await dbQueries.truncate();
    await truncate(knex, 'users');
    dbQueries.destroy();
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
        delete attributes.owner;
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

    test('should read a second object if allowed', async() => {
        
        const attributes = await dbQueries.read(newObjectAttributes2.id, user.id) as any;
        delete attributes.updated_at;
        delete attributes.created_at;
        expect(attributes).toEqual(newObjectAttributes2);

    });

    test('should not read an object if not the owner allowed', async() => {
        
        let exception: any = undefined;
        try {
            await dbQueries.read(newObjectAttributes2.id, user.id + 1);
        } catch (error) {
            exception = error;
        }
        expect(exception).toBeDefined();

    });

    test('should find by name', async() => {
        // By shortname
        const object = await dbQueries.findByName(newObjectAttributes2.shortname);
        expect(object).toEqual(expect.objectContaining(newObjectAttributes2));

        // By name
        const object2 = await dbQueries.findByName(newObjectAttributes2.name);
        expect(object2).toEqual(expect.objectContaining(newObjectAttributes2));
    });

    test('should find by name and user', async() => {
        // By shortname and owner
        const object = await dbQueries.findByName(newObjectAttributes2.shortname, user.id);
        expect(object).toEqual(expect.objectContaining(newObjectAttributes2));

        // By name and owner
        const object2 = await dbQueries.findByName(newObjectAttributes2.name, user.id);
        expect(object2).toEqual(expect.objectContaining(newObjectAttributes2));

        // By shortname and owner
        const object3 = await dbQueries.findByName(newObjectAttributes2.shortname, user.id + 1);
        expect(object3).toBeUndefined();

        // By name and owner
        const object4 = await dbQueries.findByName(newObjectAttributes2.name, user.id + 1);
        expect(object4).toBeUndefined();
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
        expect(collection[0].getId()).toBe(_newObjectAttributes.id);
        expect(collection[0].getAttributes()).toEqual({ ...(new ObjectClass(_newObjectAttributes, false).getAttributes()), owner: null });
        expect(collection[1].getId()).toBe(_newObjectAttributes2.id);
        expect(collection[1].getAttributes()).toEqual(new ObjectClass(_newObjectAttributes2, false).getAttributes());
        
    });

    test('update multiple objects, with error, none should be updated', async() => {
        
        // Reset the first object to its original state
        const _updatedAttributes = Object.assign({}, newObjectAttributes);
        const updatedObject = new ObjectClass(_updatedAttributes, true);
        // Add a simulationID to second object, should throw an error
        const _updatedAttributes2 = { id: newObjectAttributes2.id, simulation_id: uuidV4() };
        const updatedObject2 = new ObjectClass(_updatedAttributes2, true);

        let error: any = undefined;
        try {
            await dbQueries.updateMultiple([updatedObject.getAttributes(), updatedObject2.getAttributes()]);
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

        const response = await dbQueries.updateMultiple([updatedObject.getAttributes(), _updatedAttributes2]);
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
        // Find new object
        const object1 = collection.find((obj) => obj.getId() === _newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect((object1 as any).getAttributes()).toEqual({ ...(new ObjectClass(_newObjectAttributes, false).getAttributes()), owner: null });
        const object2 = collection.find((obj) => obj.getId() === _newObjectAttributes2.id);
        expect(object2).toBeDefined();
        expect((object2 as any).getAttributes()).toEqual(new ObjectClass(_newObjectAttributes2, false).getAttributes());
    });

    test('should delete objects from database', async() => {
        
        newObjectAttributes.id = "id not in table"
        const id = await dbQueries.delete(newObjectAttributes.id)
        expect(id).toThrow();
    });

    test('should return an error from database', async() => {
        const id = await dbQueries.delete(newObjectAttributes.id)
        expect(id).toBe(newObjectAttributes.id);
    });

    test('create multiple with errors, it should be a transaction', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        // Simulation ID does not exist, it shouldn't be possible to insert this object
        const newObject2 = new ObjectClass(Object.assign({}, newObjectAttributes2, { simulation_id: uuidV4() }), true);

        let error: any = undefined;
        try {
            await dbQueries.createMultiple([newObject.getAttributes(), newObject2.getAttributes()]);
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
        const newObject3 = new ObjectClass(sameNameDifferentType, true);

        const ids = await dbQueries.createMultiple([newObject.getAttributes(), newObject2.getAttributes(), newObject3.getAttributes()]);
        
        expect(ids).toEqual([{ id: newObject.getId() }, { id: newObject2.getId() }, { id: newObject3.getId() }]);
        const _collection = await dbQueries.collection();
        expect(_collection.length).toEqual(3);

    });

    test('Get collection of specific type', async() => {
        const _collection = await dbQueries.collection({ type: sameNameDifferentType.type });
        expect(_collection.length).toEqual(1);

        const _collectionNone = await dbQueries.collection({ type: 'none' });
        expect(_collectionNone.length).toEqual(0);
    });

    test('Get collection for specific user', async() => {
        // Should get all collections for the user
        const _collection = await dbQueries.collection({ userId: user.id });
        expect(_collection.length).toEqual(3);

        // Shoule get only the collection with null owner
        const _collectionNone = await dbQueries.collection({ userId: user.id + 1 });
        expect(_collectionNone.length).toEqual(2);
    });

    test('Get collection for specific user and type', async() => {
        // The user should get his collection for this type
        let _collection = await dbQueries.collection({ userId: user.id, type: newObjectAttributes2.type });
        expect(_collection.length).toEqual(1);

        // The other user should not get anything
        _collection = await dbQueries.collection({ userId: user.id + 1, type: newObjectAttributes2.type });
        expect(_collection.length).toEqual(0);

        // Both users should get the collection with null owner for other type
        _collection = await dbQueries.collection({ userId: user.id, type: newObjectAttributes.type  });
        expect(_collection.length).toEqual(1);
        _collection = await dbQueries.collection({ userId: user.id + 1, type: newObjectAttributes.type  });
        expect(_collection.length).toEqual(1);
    });

});
