/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Scenario from '../Scenario';
import ScenarioCollection from '../ScenarioCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const scenarioAttributes1 = {
    id: uuidV4(),
    name: 'Scenario1',
    data: {},
    services: [],
    only_agencies: [],
    except_agencies: [],
    only_lines: [],
    except_lines: [],
    only_nodes: [],
    except_nodes: [],
    only_modes: [],
    except_modes: [],
    is_frozen: false
};

const scenarioAttributes2= {
    id: uuidV4(),
    name: 'Scenario2',
    services: [uuidV4(), uuidV4()],
    only_agencies: [uuidV4()],
    except_agencies: [],
    only_lines: [uuidV4(), uuidV4()],
    except_lines: [],
    only_nodes: [uuidV4()],
    except_nodes: [],
    only_modes: [uuidV4(), uuidV4(), uuidV4()],
    except_modes: [],
    description: 'descS2',
    color: '#ff0000',
    data: {
        foo: 'bar',
    },
    is_frozen: true
};

const scenarioAttributes3= {
    id: uuidV4(),
    name: 'Scenario3',
    services: [uuidV4()],
    only_agencies: [],
    except_agencies: [uuidV4(), uuidV4()],
    only_lines: [],
    except_lines: [uuidV4()],
    only_nodes: [],
    except_nodes: [uuidV4(), uuidV4()],
    only_modes: [],
    except_modes: [uuidV4(), uuidV4(), uuidV4()],
    description: 'descS3',
    data: {
        foo: 'bar2',
    },
    is_frozen: false
};

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct scenario collection with or without features', function() {

    const scenario1 = new Scenario(scenarioAttributes1, true);
    const scenario2 = new Scenario(scenarioAttributes2, false);
    const scenario3 = new Scenario(scenarioAttributes3, false);

    const scenarioCollectionEmpty = new ScenarioCollection([], {}, eventManager);
    const scenarioCollection2 = new ScenarioCollection([scenario1, scenario2], {}, eventManager);
    const scenarioCollection3 = new ScenarioCollection([scenario1, scenario2, scenario3], {}, eventManager);

    expect(scenarioCollectionEmpty.size()).toBe(0);
    expect(scenarioCollection2.size()).toBe(2);
    expect(scenarioCollection3.size()).toBe(3);

    expect(scenarioCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(scenarioCollection2.getFeatures()[0]).toMatchObject(scenario1);
    expect(scenarioCollection3.getFeatures()[2]).toMatchObject(scenario3);
    expect(scenarioCollectionEmpty.getById(scenarioAttributes1.id)).toBeUndefined();
    expect(scenarioCollection2.getById(scenarioAttributes1.id)).toMatchObject(scenario1);
    expect(scenarioCollection2.getById(scenarioAttributes3.id)).toBeUndefined();
    expect(scenarioCollection3.getById(scenarioAttributes3.id)).toMatchObject(scenario3);

    scenarioCollectionEmpty.add(scenario1);
    expect(scenarioCollectionEmpty.size()).toBe(1);
    expect(scenarioCollectionEmpty.getById(scenarioAttributes1.id)).toMatchObject(scenario1);
    scenarioCollectionEmpty.removeById(scenarioAttributes1.id);
    expect(scenarioCollectionEmpty.size()).toBe(0);
    expect(scenarioCollectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(scenarioCollection3.forJson()[2]).toEqual(scenarioAttributes3);
    expect(scenarioCollection3.forCsv()[2]).toEqual({
        uuid: scenarioAttributes3.id,
        name: scenarioAttributes3.name,
        services: scenarioAttributes3.services.join('|'),
        only_agencies: scenarioAttributes3.only_agencies.join('|'),
        except_agencies: scenarioAttributes3.except_agencies.join('|'),
        only_lines: scenarioAttributes3.only_lines.join('|'),
        except_lines: scenarioAttributes3.except_lines.join('|'),
        only_nodes: scenarioAttributes3.only_nodes.join('|'),
        except_nodes: scenarioAttributes3.except_nodes.join('|'),
        only_modes: scenarioAttributes3.only_modes.join('|'),
        except_modes: scenarioAttributes3.except_modes.join('|'),
        description: scenarioAttributes3.description
    });

});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({collection: [scenarioAttributes1, scenarioAttributes2]});

    // Test loading a simple collection
    const collection = new ScenarioCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitScenarios.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const agency1 = collection.getFeatures()[0];
    const agency2 = collection.getFeatures()[1];
    expect(agency1).toEqual(new Scenario(scenarioAttributes1, false));
    expect(agency2).toEqual(new Scenario(scenarioAttributes2, false));
    expect(agency1.collectionManager).toEqual(collectionManager);
    expect(agency2.collectionManager).toEqual(collectionManager);

});

test('static attributes', () => {
    const collection = new ScenarioCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Scenarios');
    expect(collection.socketPrefix).toEqual('transitScenarios');
    expect(collection.displayName).toEqual('ScenarioCollection');
});
