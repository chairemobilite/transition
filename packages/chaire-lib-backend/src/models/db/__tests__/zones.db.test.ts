/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from '../../../config/shared/db.config';

import dbQueries from '../zones.db.queries';
import dataSourceDbQueries from '../dataSources.db.queries';
import { Zone as ObjectClass } from 'chaire-lib-common/lib/services/zones/Zone';
import Collection from 'chaire-lib-common/lib/services/zones/ZoneCollection';

const objectName   = 'zone';
const dataSourceId = uuidV4();
const otherDataSource = uuidV4();
const dataSourceShortname = 'DS';
const dataSourceName = 'DS Name';

const newObjectAttributes = {  
    id: uuidV4(),
    internal_id: 'test',
    geography: { type: 'Polygon' as const, coordinates: [ [ [-73, 45], [-73, 46], [-72, 46], [-73, 45] ] ] },
    dataSourceId: otherDataSource // Not the same datasource
};

const newObjectAttributes2 = {
    id: uuidV4(),
    internal_id: 'test2',
    shortname: 'T',
    name: 'Some test zone',
    dataSourceId: dataSourceId,
    geography: { type: 'Polygon' as const, coordinates: [[[-73, 45], [-73, 46], [-72, 46], [-73, 45]]]},
    data: {
        foo: 'bar'
    }
};

const updatedAttributes = {
  internal_id: 'new internal ID',
  geography: { type: 'Polygon' as const, coordinates: [[[-73, 45], [-73, 40], [-72, 40], [-73, 45]]]},
    
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await dataSourceDbQueries.create({
        id: dataSourceId,
        type: 'zones',
        shortname: dataSourceShortname,
        name: dataSourceName,
        data: {}
    });
    await dataSourceDbQueries.create({
        id: otherDataSource,
        type: 'zones',
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
        delete attributes.name;
        delete attributes.shortname;
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
            expect(updatedObject[attribute]).toEqual(updatedAttributes[attribute]);
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
        // Objects are sorted by shortname, so object 2 will be first
        expect(collection[0].attributes.id).toBe(_newObjectAttributes2.id);
        expect(collection[0].attributes).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);
        expect(collection[1].attributes.id).toBe(_newObjectAttributes.id);
        expect(collection[1].attributes).toEqual(new ObjectClass(_newObjectAttributes, false).attributes);
        
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

        const _collection = await dbQueries.collection({ dataSourceId });
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

    test('get zones intersecting point', async() => {

        // Point within the 2 zones
        const zones = await dbQueries.getZonesContaining({ type: 'Feature', geometry: { type: 'Point', coordinates: [-72.75, 45.5] }, properties: {} });
        expect(zones.length).toEqual(2);
        expect(zones[0]).toEqual(expect.objectContaining({
            ...newObjectAttributes,
            dsShortname: null,
            dsName: null
        }));
        expect(zones[1]).toEqual(expect.objectContaining({
            ...newObjectAttributes2,
            dsShortname: dataSourceShortname,
            dsName: dataSourceName
        }))

        // Point within the zones, for data source
        const zonesDs = await dbQueries.getZonesContaining({ type: 'Feature', geometry: { type: 'Point', coordinates: [-72.75, 45.5] }, properties: {} }, { dsId: newObjectAttributes.dataSourceId });
        expect(zonesDs.length).toEqual(1);

        // Point outside
        const zones2 = await dbQueries.getZonesContaining({ type: 'Feature', geometry: { type: 'Point', coordinates: [-72.25, 45.25] }, properties: {} });
        expect(zones2.length).toEqual(0);

    });

    test('delete for data source', async() => {
        
        const _collectionBefore = await dbQueries.collection({ dataSourceId });
        expect(_collectionBefore.length).toEqual(1);

        const id = await dbQueries.deleteForDataSourceId(dataSourceId)
        expect(id).toEqual(dataSourceId);

        const _collection = await dbQueries.collection({ dataSourceId });
        expect(_collection.length).toEqual(0);
    });

});
