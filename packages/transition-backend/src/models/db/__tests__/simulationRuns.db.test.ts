/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../simulationRuns.db.queries';
import simulationDbQueries from '../simulations.db.queries';
import scenariosDbQueries from '../transitScenarios.db.queries';
import ObjectClass, { SimulationRunAttributes } from 'transition-common/lib/services/simulation/SimulationRun';

const objectName   = 'simulation';
const simulationId = uuidV4();

const simulationAttributes = {
    id: simulationId,
    name: 'Simulation1',
    shortname: 'Sim1',
    description: 'This is a description',
    internal_id: 'InternalId',
    color: '#ff00ff',
    data: {
        routingAttributes: {
            maxTotalTravelTimeSeconds: 1000
        },
        transitNetworkDesignParameters: {
            maxTimeBetweenPassages: 15,
            nbOfVehicles: 9
        },
        algorithmConfiguration: {
            type: 'test' as any,
            config: {}
        }
    },
    isEnabled: true
};

const newObjectAttributes: SimulationRunAttributes = {
    id: uuidV4(),
    status: 'inProgress' as const,
    simulation_id: simulationId,
    seed: '1234',
    data: simulationAttributes.data,
    options: { numberOfThreads: 1, fitnessSorter: 'maximize', functions: {}, trRoutingStartingPort: 14000 },
    results: { res: 'something' },
    started_at: new Date('2022-04-06 10:13:00')
};

const newObjectAttributes2 = {
    id: uuidV4(),
    status: 'notStarted' as const,
    simulation_id: simulationId,
    seed: '1234',
    data: simulationAttributes.data
};

const updatedAttributes = {
    status: 'completed' as const,
    completed_at: new Date('2022-04-07 10:30:00')
};

const defaultScenarioAttributes = {  
    services       : [],
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
    data           : {}
};

const scenarioAttributes1 = {
    id: uuidV4(),
    simulation_id: simulationId,
    ...defaultScenarioAttributes
};
const scenarioAttributes2 = {
    id: uuidV4(),
    simulation_id: simulationId,
    ...defaultScenarioAttributes
};
const scenarioAttributes3 = {
    id: uuidV4(),
    simulation_id: simulationId,
    ...defaultScenarioAttributes
}

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await scenariosDbQueries.truncate();
    await simulationDbQueries.create(simulationAttributes);
});

afterAll(async() => {
    await dbQueries.truncate();
    await simulationDbQueries.truncate();
    await scenariosDbQueries.truncate();
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
        expect(attributes).toEqual(expect.objectContaining(newObjectAttributes));

    });

    test('should update an object in database', async() => {
        
        const id = await dbQueries.update(newObjectAttributes.id, updatedAttributes);
        expect(id).toEqual(newObjectAttributes.id);

    });

    test('should read an updated object from database', async() => {

        const updatedObject = await dbQueries.read(newObjectAttributes.id) as any;
        for (const attribute in updatedAttributes)
        {
            expect(updatedObject[attribute]).toEqual(updatedAttributes[attribute]);
        }

    });

    test('should create a second new object indatabase', async() => {
        
        const newObject = new ObjectClass(newObjectAttributes2, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toEqual(newObjectAttributes2.id);

    });

    test('should get a collection of runs for simulation', async() => {
        
        const collection = await dbQueries.getForSimulation(simulationId);
        const { seed: _seed1, options: _options1, results: _results1, ..._newObjectAttributes } = Object.assign({}, newObjectAttributes);
        const { seed: _seed2, ..._newObjectAttributes2 } = Object.assign({}, newObjectAttributes2);
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].created_at;
        delete collection[1].created_at;
        delete collection[0].updated_at;
        delete collection[1].updated_at;
        // objects are sorted by creation date descending
        expect(collection[1].id).toBe(_newObjectAttributes.id);
        expect(collection[1]).toEqual(_newObjectAttributes);
        expect(collection[0].id).toBe(_newObjectAttributes2.id);
        expect(collection[0]).toEqual(_newObjectAttributes2);
        
    });

    test('update multiple objects, with error, none should be updated', async() => {
        
        // Reset the first object to its original state
        const _updatedAttributes = Object.assign({}, newObjectAttributes);
        _updatedAttributes.completed_at = updatedAttributes.completed_at;
        const updatedObject = new ObjectClass(_updatedAttributes, true);
        // Add an unknown field to second object, should throw an error
        const _updatedAttributes2 = { id: newObjectAttributes2.id, foo: uuidV4() };
        const updatedObject2 = new ObjectClass(_updatedAttributes2, true);

        let error: any = undefined;
        try {
            await dbQueries.updateMultiple([updatedObject.attributes, updatedObject2.attributes]);
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Make sure the first object has not been updated since the update is a transaction
        const _collection = await dbQueries.getForSimulation(simulationId);
        const object = _collection.find(obj => obj.id === newObjectAttributes.id);
        expect(object).toBeDefined();
        for (const attribute in updatedAttributes)
        {
            expect((object as any)[attribute]).toEqual(updatedAttributes[attribute]);
        }
    });

    test('update multiple objects, with success', async() => {
        
        // Reset the first object to its original state
        const _updatedAttributes: SimulationRunAttributes = Object.assign({}, newObjectAttributes);
        const updatedObject = new ObjectClass(_updatedAttributes, true);
        const _updatedAttributes2 = { id: newObjectAttributes2.id, ...updatedAttributes };

        const response = await dbQueries.updateMultiple([updatedObject.attributes, _updatedAttributes2]);
        expect(response.length).toEqual(2);

        // Make sure both objects have been updated
        const collection = await dbQueries.getForSimulation(simulationId);
        const { seed: _seed1, options: _options1, results: _results1, ..._newObjectAttributes } = Object.assign({}, newObjectAttributes);
        const { seed: _seed2, ..._newObjectAttributes2 } = Object.assign({}, newObjectAttributes2);
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes2[attribute] = updatedAttributes[attribute];
        }
        delete collection[0].created_at;
        delete collection[1].created_at;
        delete collection[0].updated_at;
        delete collection[1].updated_at;
        console.log("Collection", collection);
        // Find new object
        const object1 = collection.find((obj) => obj.id === _newObjectAttributes.id);
        expect(object1).toBeDefined();
        expect(object1).toEqual(expect.objectContaining(_newObjectAttributes));
        const object2 = collection.find((obj) => obj.id === _newObjectAttributes2.id);
        expect(object2).toBeDefined();
        expect(object2).toEqual(_newObjectAttributes2);
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
        const _collection = await dbQueries.getForSimulation(simulationId);
        expect(_collection.length).toEqual(0);
        
    });

    test('create multiple with success', async() => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const newObject2 = new ObjectClass(newObjectAttributes2, true);

        const ids = await dbQueries.createMultiple([newObject.attributes, newObject2.attributes]);
        
        expect(ids).toEqual([{ id: newObject.getId() }, { id: newObject2.getId() }]);
        const _collection = await dbQueries.getForSimulation(simulationId);
        expect(_collection.length).toEqual(2);

    });

    test('get collection for a non existing simulation ID', async() => {

        const _collection = await dbQueries.getForSimulation(uuidV4());
        expect(_collection.length).toEqual(0);

    });

    test('save scenarios for non-existing scenarios', async() => {
        await expect(dbQueries.saveSimulationRunScenarios(newObjectAttributes.id, [uuidV4(), uuidV4()]))
            .rejects
            .toThrow(expect.anything());
    });

    test('save scenarios for simulation run', async() => {
        // Create 2 scenarios and add them to the database
        
        await scenariosDbQueries.create(scenarioAttributes1);
        await scenariosDbQueries.create(scenarioAttributes2);
        await scenariosDbQueries.create(scenarioAttributes3);

        // Match 2 of those scenarios to simulation run 1 and 1 to the second
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes.id, [scenarioAttributes1.id, scenarioAttributes2.id]);
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes2.id, [scenarioAttributes1.id]);

        const scenarioForRun1 = await dbQueries.getScenarioIdsForRun(newObjectAttributes.id);
        expect(scenarioForRun1).toEqual(expect.arrayContaining([scenarioAttributes1.id, scenarioAttributes2.id]));

        const scenarioForRun2 = await dbQueries.getScenarioIdsForRun(newObjectAttributes2.id);
        expect(scenarioForRun2).toEqual(expect.arrayContaining([scenarioAttributes1.id]));

        // Add a scenario for first run, with a duplicate, there should be 3 scenarios now
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes.id, [scenarioAttributes3.id, scenarioAttributes2.id]);
        const scenarioForRun1Part2 = await dbQueries.getScenarioIdsForRun(newObjectAttributes.id);
        expect(scenarioForRun1Part2).toEqual(expect.arrayContaining([scenarioAttributes1.id, scenarioAttributes2.id, scenarioAttributes3.id]));
        
    });

    test('delete individual scenarios for simulation run, keeping the scenario', async() => {
        // Delete scenario 3 from run 1, without deleting the scenario, 
        expect(await dbQueries.deleteSimulationRunScenarios(newObjectAttributes.id, [scenarioAttributes3.id], false)).toBeFalsy();

        // 2 scenarios should remain
        const scenarioForRun1 = await dbQueries.getScenarioIdsForRun(newObjectAttributes.id);
        expect(scenarioForRun1).toEqual(expect.arrayContaining([scenarioAttributes1.id, scenarioAttributes2.id]));
        
        // All scenarios should still be there
        const scCollection = await scenariosDbQueries.collection();
        expect(scCollection.length).toEqual(3);
    });

    test('delete all scenarios for simulation run, recursively', async() => {
        // Delete all scenarios from run 1, recursively deleting the unused scenarios
        expect(await dbQueries.deleteSimulationRunScenarios(newObjectAttributes.id, undefined, true)).toBeTruthy();

        // There should be no scenarios for this simulation run
        const scenarioForRun1 = await dbQueries.getScenarioIdsForRun(newObjectAttributes.id);
        expect(scenarioForRun1).toEqual([]);
        
        // scenario 2 should have been deleted from scenarios table
        const scCollection = await scenariosDbQueries.collection();
        expect(scCollection.length).toEqual(2);
    });

    test('delete individual scenarios for simulation run, recursively', async() => {
        // Delete scenario 1 from simulation run 2
        expect(await dbQueries.deleteSimulationRunScenarios(newObjectAttributes2.id, [scenarioAttributes1.id], true)).toBeTruthy();

        // There should be no scenarios for this simulation run
        const scenarioForRun2 = await dbQueries.getScenarioIdsForRun(newObjectAttributes2.id);
        expect(scenarioForRun2).toEqual([]);
        
        // scenario 1 should have been deleted from scenarios table
        const scCollection = await scenariosDbQueries.collection();
        expect(scCollection.length).toEqual(1);
    });

    test('should delete scenarios when deleting run, in cascade', async() => {

        // Add scenarios again for the simulation runs
        await scenariosDbQueries.create(scenarioAttributes1);
        await scenariosDbQueries.create(scenarioAttributes2);

        // Match 2 of those scenarios to simulation run 1 and 1 to the second
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes.id, [scenarioAttributes1.id, scenarioAttributes2.id, scenarioAttributes3.id]);
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes2.id, [scenarioAttributes1.id]);
        
        // Delete the first simulation run, should delete scenarios 2 and 3, 1 is still used by run 2
        const id = await dbQueries.delete(newObjectAttributes.id, true)
        expect(id).toBe(newObjectAttributes.id);

        const scenarioForRun1 = await dbQueries.getScenarioIdsForRun(newObjectAttributes.id);
        expect(scenarioForRun1).toEqual([]);

        const scenarioCollection = await scenariosDbQueries.collection();
        expect(scenarioCollection.length).toEqual(1);
        expect(scenarioCollection[0].id).toEqual(scenarioAttributes1.id);

    });

    test('should keep all scenarios when deleting run if cascade is false', async() => {
        
        // Delete the second simulation run
        const id = await dbQueries.delete(newObjectAttributes2.id, false)
        expect(id).toBe(newObjectAttributes2.id);

        const scenarioForRun1 = await dbQueries.getScenarioIdsForRun(newObjectAttributes2.id);
        expect(scenarioForRun1).toEqual([]);

        const scenarioCollection = await scenariosDbQueries.collection();
        expect(scenarioCollection.length).toEqual(1);

    });

    test('should delete scenarios when multiple deleting runs, with cascade', async() => {

        // Recreate runs
        const newObject = new ObjectClass(newObjectAttributes, true);
        const newObject2 = new ObjectClass(newObjectAttributes2, true);
        await dbQueries.createMultiple([newObject.attributes, newObject2.attributes]);

        // Add scenarios again for the simulation runs
        await scenariosDbQueries.create(scenarioAttributes2);
        await scenariosDbQueries.create(scenarioAttributes3);

        // Match 2 of those scenarios to simulation run 1 and 1 to the second
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes.id, [scenarioAttributes1.id, scenarioAttributes2.id, scenarioAttributes3.id]);
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes2.id, [scenarioAttributes1.id]);

        // Delete multiple record, with cascade
        const deletedIds = await dbQueries.deleteMultiple([newObjectAttributes2.id, newObjectAttributes.id], true)
        expect(deletedIds).toEqual([newObjectAttributes2.id, newObjectAttributes.id]);

        const scenarioForRun1 = await dbQueries.getScenarioIdsForRun(newObjectAttributes.id);
        expect(scenarioForRun1).toEqual([]);

        // Scenarios should all have been deleted
        const scenarioCollection = await scenariosDbQueries.collection();
        expect(scenarioCollection.length).toEqual(0);

    });

    test('should keep scenarios when deleting multiple runs, without cascade', async() => {

        // Recreate runs
        const newObject = new ObjectClass(newObjectAttributes, true);
        const newObject2 = new ObjectClass(newObjectAttributes2, true);

        const ids = await dbQueries.createMultiple([newObject.attributes, newObject2.attributes]);

        // Add scenarios again for the simulation runs
        await scenariosDbQueries.create(scenarioAttributes1);
        await scenariosDbQueries.create(scenarioAttributes2);
        await scenariosDbQueries.create(scenarioAttributes3);

        // Match 2 of those scenarios to simulation run 1 and 1 to the second
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes.id, [scenarioAttributes1.id, scenarioAttributes2.id, scenarioAttributes3.id]);
        await dbQueries.saveSimulationRunScenarios(newObjectAttributes2.id, [scenarioAttributes1.id]);

        // Delete multiple record, without cascade
        const deletedIds = await dbQueries.deleteMultiple([newObjectAttributes2.id, newObjectAttributes.id], false)
        expect(deletedIds).toEqual([newObjectAttributes2.id, newObjectAttributes.id]);

        const scenarioForRun1 = await dbQueries.getScenarioIdsForRun(newObjectAttributes.id);
        expect(scenarioForRun1).toEqual([]);

        // Scenarios and services from previous tests are still there, so 2 of each
        const scenarioCollection = await scenariosDbQueries.collection();
        expect(scenarioCollection.length).toEqual(3);

    });

});
