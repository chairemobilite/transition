/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Simulation from '../Simulation';
import SimulationCollection from '../SimulationCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const simulationAttributes1 = {
    id: uuidV4(),
    name: 'Simulation1',
    shortname: 'Sim1',
    description: 'This is a description',
    color: '#ff00ff',
    data: {
        routingAttributes: {
            maxTotalTravelTimeSeconds: 1000
        },
        transitNetworkDesignParameters: {
            maxTimeBetweenPassages: 15,
            minTimeBetweenPassages: 5,
            nbOfVehicles: 9,
            numberOfLinesMin: 1,
            numberOfLinesMax: 10,
            simulatedAgencies: [],
            nonSimulatedServices: [],
            linesToKeep: []
        }
    },
    isEnabled: true
};

const simulationAttributes2= {
    id: uuidV4(),
    name: 'Simulation2',
    description: 'descS2',
    color: '#ff0000',
    is_frozen: true
};

const simulationAttributes3 = {
    id: uuidV4(),
    name: 'Simulation3',
    shortname: 'Sim3',
    internal_id: 'blabla',
    description: 'This is a description',
    color: '#ff00ff',
    data: {
        routingAttributes: {
            maxTotalTravelTimeSeconds: 1000
        },
        transitNetworkDesignParameters: {
            maxTimeBetweenPassages: 15,
            minTimeBetweenPassages: 5,
            nbOfVehicles: 9,
            numberOfLinesMin: 1,
            numberOfLinesMax: 10,
            simulatedAgencies: [],
            nonSimulatedServices: [],
            linesToKeep: []
        }
    },
    isEnabled: true
};


beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct service collection with or without features', () => {

    const service1 = new Simulation(simulationAttributes1, true);
    const service2 = new Simulation(simulationAttributes2, false);
    const service3 = new Simulation(simulationAttributes3, false);

    const serviceCollectionEmpty = new SimulationCollection([], {}, eventManager);
    const serviceCollection2 = new SimulationCollection([service1, service2], {}, eventManager);
    const serviceCollection3 = new SimulationCollection([service1, service2, service3], {}, eventManager);

    expect(serviceCollectionEmpty.size()).toBe(0);
    expect(serviceCollection2.size()).toBe(2);
    expect(serviceCollection3.size()).toBe(3);

    expect(serviceCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(serviceCollection2.getFeatures()[0]).toMatchObject(service1);
    expect(serviceCollection3.getFeatures()[2]).toMatchObject(service3);
    expect(serviceCollectionEmpty.getById(simulationAttributes1.id)).toBeUndefined();
    expect(serviceCollection2.getById(simulationAttributes1.id)).toMatchObject(service1);
    expect(serviceCollection2.getById(simulationAttributes3.id)).toBeUndefined();
    expect(serviceCollection3.getById(simulationAttributes3.id)).toMatchObject(service3);

    serviceCollectionEmpty.add(service1);
    expect(serviceCollectionEmpty.size()).toBe(1);
    expect(serviceCollectionEmpty.getById(simulationAttributes1.id)).toMatchObject(service1);
    serviceCollectionEmpty.removeById(simulationAttributes1.id);
    expect(serviceCollectionEmpty.size()).toBe(0);
    expect(serviceCollectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(serviceCollection3.forCsv()[2]).toEqual({
        uuid: simulationAttributes3.id,
        name: simulationAttributes3.name,
        internal_id: simulationAttributes3.internal_id,
        color: simulationAttributes3.color,
        description: simulationAttributes3.description,
        shortname: simulationAttributes3.shortname,
        is_enabled: 'true'
    });

});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({ collection: [simulationAttributes1, simulationAttributes2] });

    // Test loading a simple collection
    const collection = new SimulationCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('simulations.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const simulation1 = collection.getFeatures()[0];
    const simulation2 = collection.getFeatures()[1];
    expect(simulation1).toEqual(new Simulation(simulationAttributes1, false));
    expect(simulation2).toEqual(new Simulation(simulationAttributes2, false));

});

test('static attributes', () => {
    const collection = new SimulationCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Simulations');
    expect(collection.socketPrefix).toEqual('simulations');
    expect(collection.displayName).toEqual('SimulationCollection');
});
