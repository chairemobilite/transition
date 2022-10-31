/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import DataSource from '../DataSource';
import DataSourceCollection from '../DataSourceCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const dataSourceCompleteAttributes = {
    id: uuidV4(),
    name: 'Datasource1',
    data: {},
    shortname: 'DS1',
    description: 'description',
    type: 'odTrips',
    is_frozen: false
};

const dataSourceMinimalAttributes= {
    id: uuidV4()
};

const dataSourceAttributes3= {
    id: uuidV4(),
    name: 'Datasource3',
    data: {},
    shortname: 'DS3',
    description: 'description',
    type: 'zones',
    is_frozen: false
};

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct dataSource collection with or without features', function() {

    const dataSource1 = new DataSource(dataSourceCompleteAttributes, true);
    const dataSource2 = new DataSource(dataSourceMinimalAttributes, false);
    const dataSource3 = new DataSource(dataSourceAttributes3, false);

    const dataSourceCollectionEmpty = new DataSourceCollection([], {}, eventManager);
    const dataSourceCollection2 = new DataSourceCollection([dataSource1, dataSource2], {}, eventManager);
    const dataSourceCollection3 = new DataSourceCollection([dataSource1, dataSource2, dataSource3], {}, eventManager);

    expect(dataSourceCollectionEmpty.size()).toBe(0);
    expect(dataSourceCollection2.size()).toBe(2);
    expect(dataSourceCollection3.size()).toBe(3);

    expect(dataSourceCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(dataSourceCollection2.getFeatures()[0]).toMatchObject(dataSource1);
    expect(dataSourceCollection3.getFeatures()[2]).toMatchObject(dataSource3);
    expect(dataSourceCollectionEmpty.getById(dataSourceCompleteAttributes.id)).toBeUndefined();
    expect(dataSourceCollection2.getById(dataSourceCompleteAttributes.id)).toMatchObject(dataSource1);
    expect(dataSourceCollection2.getById(dataSourceAttributes3.id)).toBeUndefined();
    expect(dataSourceCollection3.getById(dataSourceAttributes3.id)).toMatchObject(dataSource3);

    dataSourceCollectionEmpty.add(dataSource1);
    expect(dataSourceCollectionEmpty.size()).toBe(1);
    expect(dataSourceCollectionEmpty.getById(dataSourceCompleteAttributes.id)).toMatchObject(dataSource1);
    dataSourceCollectionEmpty.removeById(dataSourceCompleteAttributes.id);
    expect(dataSourceCollectionEmpty.size()).toBe(0);
    expect(dataSourceCollectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(dataSourceCollection3.forJson()[2]).toEqual(dataSourceAttributes3);

});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({collection: [dataSourceCompleteAttributes, dataSourceMinimalAttributes]});

    // Test loading a simple collection
    const collection = new DataSourceCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('dataSources.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const dataSource1 = collection.getFeatures()[0];
    const dataSource2 = collection.getFeatures()[1];
    expect(dataSource1).toEqual(new DataSource(dataSourceCompleteAttributes, false));
    expect(dataSource2).toEqual(new DataSource(dataSourceMinimalAttributes, false));
    expect(dataSource1.collectionManager).toEqual(collectionManager);
    expect(dataSource2.collectionManager).toEqual(collectionManager);

});

test('static attributes', () => {
    const collection = new DataSourceCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('DataSources');
    expect(collection.socketPrefix).toEqual('dataSources');
    expect(collection.displayName).toEqual('DataSourceCollection');
});
