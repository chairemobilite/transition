/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash/cloneDeep';

import dbQueries           from '../transitScenarios.db.queries';
import servicesDbQueries   from '../transitServices.db.queries';
import simulationDbQueries from '../simulations.db.queries';
import Collection          from 'transition-common/lib/services/scenario/ScenarioCollection';
import ObjectClass         from 'transition-common/lib/services/scenario/Scenario';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const objectName   = 'scenario';
const simulationId = '373a583c-df49-440f-8f44-f39fb0033c56';
const [serviceId1, serviceId2, serviceId3] = [uuidV4(), uuidV4(), uuidV4()];

const newObjectAttributes = {  
  id             : uuidV4(),
  name           : 'Scenario test',
  is_frozen      : false,
  is_enabled     : true,
  services       : [serviceId1, serviceId2],
  only_agencies  : [uuidV4(), uuidV4()],
  only_lines     : [uuidV4(), uuidV4(), uuidV4()],
  only_nodes     : [uuidV4()],
  only_modes     : [uuidV4(), uuidV4(), uuidV4(), uuidV4()],
  except_agencies: [],
  except_lines   : [],
  except_nodes   : [],
  except_modes   : [],
  color          : '#ffffff',
  description    : undefined,
  simulation_id  : undefined,
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
  services       : [],
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

const updatedAttributes = {
  name       : 'Scenario test 1b',
  description: 'changed description',
  services: [serviceId1, serviceId3]
};

const defaultServiceAttribs = {
    start_date: '2022-06-07',
    end_date: '2022-06-08',
    scheduled_lines: [],
    data: []
}

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await servicesDbQueries.truncate();
    await simulationDbQueries.truncate();
    await dbQueries.truncate();
    await simulationDbQueries.create({
        id: simulationId,
        data: {
            transitNetworkDesignParameters: {},
            routingAttributes: {}
        }
    });
    await servicesDbQueries.createMultiple([{
        id: serviceId1,
        name: 'Service test 1',
        ...defaultServiceAttribs
    }, {
        id: serviceId2,
        name: 'Service test 2',
        ...defaultServiceAttribs
    }, {
        id: serviceId3,
        name: 'Service test 3',
        ...defaultServiceAttribs
    }]);
});

afterAll(async() => {
    await dbQueries.truncate();
    await servicesDbQueries.truncate();
    await simulationDbQueries.truncate();
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
        expect(collection[0].getId()).toBe(_newObjectAttributes.id);
        expect(collection[0].attributes).toEqual(new ObjectClass(_newObjectAttributes, false).attributes);
        expect(collection[1].getId()).toBe(_newObjectAttributes2.id);
        expect(collection[1].attributes).toEqual(new ObjectClass(_newObjectAttributes2, false).attributes);
        
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
        // Update second object
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

        // All services should still be there
        const serviceCollection = await servicesDbQueries.collection();
        expect(serviceCollection.length).toEqual(3);

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

    test('Manage services', async() => {
        // Delete one service to make sure it is cascaded
        await servicesDbQueries.delete(serviceId1);
        const scenarioWithDeletedService = await dbQueries.read(newObjectAttributes.id);
        expect(scenarioWithDeletedService.services).toEqual([serviceId2]);

        // Save a scenario without any service, they should all be deleted
        scenarioWithDeletedService.services = [];
        const updated = await dbQueries.update(newObjectAttributes.id, scenarioWithDeletedService);
        const scenarioWithoutService = await dbQueries.read(newObjectAttributes.id);
        expect(scenarioWithoutService.services).toEqual([]);
    });

    test('Cascade delete services', async() => {
        // Prepare scenarios, one has service 2 and 3, the other has only 2
        const scenarioToDelete = await dbQueries.read(newObjectAttributes.id);
        scenarioToDelete.services = [serviceId2, serviceId3];
        await dbQueries.update(newObjectAttributes.id, scenarioToDelete);

        const scenarioToDelete2 = await dbQueries.read(newObjectAttributes2.id);
        scenarioToDelete2.services = [serviceId2];
        await dbQueries.update(newObjectAttributes2.id, scenarioToDelete2);

        // Delete the scenario, services 2 and 3 should have been deleted from the database
        await dbQueries.delete(newObjectAttributes.id, true);
        const serviceCollection = await servicesDbQueries.collection();
        expect(serviceCollection.length).toEqual(1);
        expect(serviceCollection[0].id).toEqual(serviceId2);

        // Delete multiple with cascade
        await dbQueries.deleteMultiple([newObjectAttributes.id, newObjectAttributes2.id], true);
        const serviceCollection2 = await servicesDbQueries.collection();
        expect(serviceCollection2.length).toEqual(0);
    });

});

describe('Scenarios, single queries with transaction errors', () => {

    beforeEach(async () => {
        // Empty the table
        await dbQueries.truncate();
        servicesDbQueries.truncate();
        await servicesDbQueries.createMultiple([{
            id: serviceId1,
            name: 'Service test 1',
            ...defaultServiceAttribs
        }, {
            id: serviceId2,
            name: 'Service test 2',
            ...defaultServiceAttribs
        }, {
            id: serviceId3,
            name: 'Service test 3',
            ...defaultServiceAttribs
        }]);
    });

    test('Create with services transaction, with error', async() => {
        const newScenario = _cloneDeep(newObjectAttributes);
        // Add services that are not in the database, should throw error
        newScenario.services = [uuidV4(), uuidV4()];
        await expect(dbQueries.create(newScenario)).rejects.toThrowError(TrError);
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(0);
    });

    test('Create multiple with services transaction, with error', async() => {
        const newScenario = _cloneDeep(newObjectAttributes);
        const newScenario2 = newObjectAttributes2;
        // Add services that are not in the database for one of the scenarios, should throw error
        newScenario.services = [uuidV4(), uuidV4()];
        await expect(dbQueries.createMultiple([newScenario, newScenario2])).rejects.toThrowError(TrError);
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(0);
    });

    test('Update with services transaction, with error', async() => {
        // Insert object
        const updatedName = 'Scenario to update';
        const newScenario = _cloneDeep(newObjectAttributes);
        await dbQueries.create(newScenario);

        // Update the object, with invalid services
        await expect(dbQueries.update(newScenario.id, { services: [uuidV4(), uuidV4()], name: updatedName })).rejects.toThrowError(TrError);
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        expect(collection[0]).toEqual(expect.objectContaining(newObjectAttributes));
        
    });

    test('Update multiple with services transaction, with error', async() => {
        // Insert object
        const updatedName = 'Scenario to update';
        const newScenario = _cloneDeep(newObjectAttributes);
        await dbQueries.create(newScenario);
        const newScenario2 = _cloneDeep(newObjectAttributes2);
        await dbQueries.create(newScenario2);

        // Update both names, but add invalid services to second
        await expect(dbQueries.updateMultiple([
            { name: updatedName, id: newScenario.id },
            { services: [uuidV4(), uuidV4()], name: `${updatedName}2`, id: newScenario2.id }
        ])).rejects.toThrowError(TrError);
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(2);
        expect(collection[0]).toEqual(expect.objectContaining(newObjectAttributes));
        expect(collection.find((scenario) => scenario.name === newObjectAttributes.name)).toBeDefined();
        expect(collection.find((scenario) => scenario.name === newObjectAttributes2.name)).toBeDefined();
    });
})

describe('Scenarios, with transactions', () => {

    beforeEach(async () => {
        // Empty the table and add 1 object
        await dbQueries.truncate();
        servicesDbQueries.truncate();
        await servicesDbQueries.createMultiple([{
            id: serviceId1,
            name: 'Service test 1',
            ...defaultServiceAttribs
        }, {
            id: serviceId2,
            name: 'Service test 2',
            ...defaultServiceAttribs
        }, {
            id: serviceId3,
            name: 'Service test 3',
            ...defaultServiceAttribs
        }]);
        const newObject = new ObjectClass(newObjectAttributes, true);
        await dbQueries.create(newObject.attributes);
    });

    test('Create, update with success', async() => {
        const currentObjectNewName = 'new scenario name';
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
        const currentObjectNewName = 'new scenario name';
        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                const newObject = new ObjectClass(newObjectAttributes2, true);
                await dbQueries.create(newObject.attributes, { transaction: trx });
                await dbQueries.update(newObjectAttributes.id, { name: currentObjectNewName }, { transaction: trx });
                await dbQueries.delete(newObjectAttributes.id, false, { transaction: trx });
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
