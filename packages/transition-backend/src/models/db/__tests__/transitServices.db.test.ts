/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../transitServices.db.queries';
import simulationDbQueries from '../simulations.db.queries';
import Collection from 'transition-common/lib/services/service/ServiceCollection';
import ObjectClass, { ServiceAttributes } from 'transition-common/lib/services/service/Service';
import schedulesDbQueries from '../transitSchedules.db.queries';
import linesDbQueries from '../transitLines.db.queries';
import agenciesDbQueries from '../transitAgencies.db.queries';

const objectName = 'service';
const simulationId = uuidV4();
const lineId = uuidV4();
const agencyId = uuidV4();

const newObjectAttributes: ServiceAttributes = {  
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
  description  : undefined,
  simulation_id: undefined,
  scheduled_lines: [],
  data         : {
    foo: 'bar',
    bar: 'foo',
    variables: {}
  }
};

const newObjectAttributes2: ServiceAttributes = {
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
  scheduled_lines: [],
  data         : {
    foo2: 'bar2',
    bar2: 'foo2',
    variables: {}
  }
};

const updatedAttributes = {
  name  : 'Service test 1b',
  monday: false
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await agenciesDbQueries.create({
        id: agencyId,
        name: 'test',
        acronym: 'test'
    } as any);
    await linesDbQueries.create({
        id: lineId,
        agency_id: agencyId,
        color: '#ffffff',
    } as any);
    await simulationDbQueries.create({
        id: simulationId,
        data: {
            simulationParameters: {},
            routingAttributes: {}
        }
    });
});

afterAll(async() => {
    await dbQueries.truncate();
    await simulationDbQueries.truncate();
    await linesDbQueries.truncate();
    await agenciesDbQueries.truncate();
    await schedulesDbQueries.truncateSchedules();
    simulationDbQueries.destroy();
    dbQueries.destroy();
});

describe(`${objectName}`, function() {

    test('exists should return false if object is not in database', async() => {
        
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

        // Also create a schedule
        await schedulesDbQueries.save({
            id: uuidV4(),
            line_id: lineId,
            service_id: newObjectAttributes2.id,
            periods_group_shortname: 'complete_day',
            periods: [],
            data: {}
        });

    });

    test('should read this second object with line count', async() => {

        const expectedAttributes = Object.assign({}, newObjectAttributes2);
        const attributes = await dbQueries.read(expectedAttributes.id) as any;
        delete attributes.updated_at;
        delete attributes.created_at;
        expectedAttributes.scheduled_lines = [lineId];
        expect(attributes).toEqual(expectedAttributes);

    });

    test('should read collection from database, with line count', async() => {
        
        const _collection = await dbQueries.collection();
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributes);
        // newObjectAttributes2 has scheduled lines
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        _newObjectAttributes2.scheduled_lines = [lineId];
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        // Compare objects in DB with expected
        if (collection[0].id === _newObjectAttributes.id) {
            expect(collection[0].id).toBe(_newObjectAttributes.id);
            expect(collection[0].attributes).toEqual(_newObjectAttributes);
            expect(collection[1].id).toBe(_newObjectAttributes2.id);
            expect(collection[1].attributes).toEqual(_newObjectAttributes2);
        } else {
            expect(collection[0].id).toBe(_newObjectAttributes2.id);
            expect(collection[0].attributes).toEqual(_newObjectAttributes2);
            expect(collection[1].id).toBe(_newObjectAttributes.id);
            expect(collection[1].attributes).toEqual(_newObjectAttributes);
        }
        
    });

    test('should read partial collection from database', async() => {
        
        const _collection = await dbQueries.collection({ serviceIds: [newObjectAttributes.id] });
        const objectCollection = new Collection([], {});
        objectCollection.loadFromCollection(_collection);
        const collection = objectCollection.features;
        const _newObjectAttributes = Object.assign({}, newObjectAttributes);
        expect(collection.length).toBe(1);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].attributes.created_at;
        delete collection[0].attributes.updated_at;
        // Compare objects in DB with expected
        expect(collection[0].id).toBe(_newObjectAttributes.id);
        expect(collection[0].attributes).toEqual(_newObjectAttributes);
        
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
        // newObjectAttributes2 has scheduled lines
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2);
        _newObjectAttributes2.scheduled_lines = [lineId];
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes2[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].attributes.created_at;
        delete collection[1].attributes.created_at;
        delete collection[0].attributes.updated_at;
        delete collection[1].attributes.updated_at;
        // Find objects
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
        // Simulation ID does not exist, it shouldn't be possible to insert this object
        const newObject2 = new ObjectClass(Object.assign({}, newObjectAttributes2, { simulation_id: uuidV4() }), true);

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

    test('getServiceNamesStartingWith: should return an empty array if no services match the given prefix', async () => {
        const prefix = 'XYZ';
        const result = await dbQueries.getServiceNamesStartingWith(prefix);
        expect(result).toEqual([]);
    });

    test('getServiceNamesStartingWith: should return an array of service names starting with the given prefix', async () => {
        const prefix = 'Service test';
        const result = await dbQueries.getServiceNamesStartingWith(prefix);
        expect(result).toEqual(['Service test', 'Service test 2']);
    });

    test('getServiceNamesStartingWith: should return an array of service names starting with the given prefix (case-insensitive)', async () => {
        const prefix = 'service';
        const result = await dbQueries.getServiceNamesStartingWith(prefix);
        expect(result).toEqual(['Service test', 'Service test 2']);
    });

    test('getServiceNamesStartingWith: should return an array of service names starting with the given prefix (with whitespace)', async () => {
        const prefix = 'Service ';
        const result = await dbQueries.getServiceNamesStartingWith(prefix);
        expect(result).toEqual(['Service test', 'Service test 2']);
    });

});

describe('Services, with transactions', () => {

    beforeEach(async () => {
        // Empty the table and add 1 object
        await dbQueries.truncate();
        const newObject = new ObjectClass(newObjectAttributes, true);
        await dbQueries.create(newObject.attributes);
    });

    test('Create, update with success', async() => {
        const currentObjectNewName = 'new service name';
        await knex.transaction(async (trx) => {
            const newObject = new ObjectClass(newObjectAttributes2, true);
            await dbQueries.create(newObject.attributes, { transaction: trx });
            await dbQueries.update(newObjectAttributes.id, { name: currentObjectNewName }, { transaction: trx });
        });

        // Make sure the new object is there and the old has been updated
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(2);
        const { name, ...currentObject } = newObjectAttributes
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining({
            name: currentObjectNewName,
            ...currentObject
        }));

        const object2 = collection.find((obj) => obj.id === newObjectAttributes2.id);
        expect(object2).toBeDefined();
        expect(object2).toEqual(expect.objectContaining(newObjectAttributes2));
    });

    test('Create, then select name starting with', (done) => {
        knex.transaction(async (trx) => {
            const newObject = new ObjectClass(newObjectAttributes2, true);
            await dbQueries.create(newObject.attributes, { transaction: trx });
            // Get without the transaction, the name should not be there
            const names = await dbQueries.getServiceNamesStartingWith(newObject.attributes.name as string);
            expect(names).toEqual([]);

            // Get with the transaction, the name should be there
            const namesInTransaction = await dbQueries.getServiceNamesStartingWith(newObject.attributes.name as string, { transaction: trx });
            expect(namesInTransaction).toEqual([newObject.attributes.name]);
            done();
        });
    });

    test('Create, then get collection', (done) => {
        knex.transaction(async (trx) => {
            const newObject = new ObjectClass(newObjectAttributes2, true);
            await dbQueries.create(newObject.attributes, { transaction: trx });
            // Get without the transaction, the new service should not be there
            const services = await dbQueries.collection();
            expect(services.length).toEqual(1);

            // Get with the transaction, the new service should be there
            const servicesInTransaction = await dbQueries.collection({ transaction: trx });
            expect(servicesInTransaction.length).toEqual(2);
            done();
        });
    });

    test('Create, update with error', async() => {
        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                const newObject = new ObjectClass(newObjectAttributes2, true);
                await dbQueries.create(newObject.attributes, { transaction: trx });
                // Update with unexisting simulation ID, should throw an error
                await dbQueries.update(newObjectAttributes.id, { simulation_id: uuidV4() }, { transaction: trx });
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // The new object should not have been added and the one in DB should not have been updated
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining(newObjectAttributes));
    });

    test('Create, update, delete with error', async() => {
        const currentAgencyNewName = 'new agency name';
        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                const newObject = new ObjectClass(newObjectAttributes2, true);
                await dbQueries.create(newObject.attributes, { transaction: trx });
                await dbQueries.update(newObjectAttributes.id, { name: currentAgencyNewName }, { transaction: trx });
                await dbQueries.delete(newObjectAttributes.id, { transaction: trx });
                throw 'error';
            });
        } catch(err) {
            error = err;
        }
        expect(error).toEqual('error');

        // Make sure the existing object is still there and no new one has been added
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        const object1 = collection.find((obj) => obj.id === newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining(newObjectAttributes));
    });

});

