/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import { BaseOdTrip } from '../BaseOdTrip';
import BaseOdTripCollection from '../BaseOdTripCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const odTripAttributes1 = {
    id: uuidV4(),
    integer_id: 1,
    internal_id: 'test',
    data: { foo: 'bar' },
    dataSourceId: uuidV4(),
    origin_geography: { type: 'Point' as const, coordinates: [-73.1, 45.1] },
    destination_geography: { type: 'Point' as const, coordinates: [-73.2, 45.2] },
    timeOfTrip: 25000,
    timeType: 'arrival' as const
};

const odTripAttributes2= {
    id: uuidV4(),
    origin_geography: { type: 'Point' as const, coordinates: [-73, 45] },
    destination_geography: { type: 'Point' as const, coordinates: [-73.5, 45.5] },
    timeOfTrip: 28800,
    timeType: 'departure' as const
};

const odTripAttributes3= {
    id: uuidV4(),
    integer_id: 1,
    internal_id: 'a randome trip',
    data: { foo: 'bar' },
    dataSourceId: uuidV4(),
    origin_geography: { type: 'Point' as const, coordinates: [-73.3, 45.3] },
    destination_geography: { type: 'Point' as const, coordinates: [-73.4, 45.4] },
    timeOfTrip: 3600,
    timeType: 'arrival' as const
};

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct scenario collection with or without features', function() {

    const odTrip1 = new BaseOdTrip(odTripAttributes1, true);
    const odTrip2 = new BaseOdTrip(odTripAttributes2, false);
    const odTrip3 = new BaseOdTrip(odTripAttributes3, false);

    const odTripCollectionEmpty = new BaseOdTripCollection([], {}, eventManager);
    const odTripCollection2 = new BaseOdTripCollection([odTrip1, odTrip2], {}, eventManager);
    const odTripCollection3 = new BaseOdTripCollection([odTrip1, odTrip2, odTrip3], {}, eventManager);

    expect(odTripCollectionEmpty.size()).toBe(0);
    expect(odTripCollection2.size()).toBe(2);
    expect(odTripCollection3.size()).toBe(3);

    expect(odTripCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(odTripCollection2.getFeatures()[0]).toMatchObject(odTrip1);
    expect(odTripCollection3.getFeatures()[2]).toMatchObject(odTrip3);
    expect(odTripCollectionEmpty.getById(odTripAttributes1.id)).toBeUndefined();
    expect(odTripCollection2.getById(odTripAttributes1.id)).toMatchObject(odTrip1);
    expect(odTripCollection2.getById(odTripAttributes3.id)).toBeUndefined();
    expect(odTripCollection3.getById(odTripAttributes3.id)).toMatchObject(odTrip3);

    odTripCollectionEmpty.add(odTrip1);
    expect(odTripCollectionEmpty.size()).toBe(1);
    expect(odTripCollectionEmpty.getById(odTripAttributes1.id)).toMatchObject(odTrip1);
    odTripCollectionEmpty.removeById(odTripAttributes1.id);
    expect(odTripCollectionEmpty.size()).toBe(0);
    expect(odTripCollectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(odTripCollection3.forJson()[2]).toEqual(odTrip3.attributes);
    expect(odTripCollection3.forCsv()[2]).toEqual({
        id: odTripAttributes3.id,
        routingName: odTripAttributes3.internal_id,
        originLon: odTripAttributes3.origin_geography.coordinates[0],
        originLat: odTripAttributes3.origin_geography.coordinates[1],
        destinationLon: odTripAttributes3.destination_geography.coordinates[0],
        destinationLat: odTripAttributes3.destination_geography.coordinates[0],
        time: odTripAttributes3.timeOfTrip,
        timeType: odTripAttributes3.timeType
    });

});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({collection: [odTripAttributes1, odTripAttributes2]});

    // Test loading a simple collection
    const collection = new BaseOdTripCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('odPairs.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const odPair1 = collection.getFeatures()[0];
    const odPair2 = collection.getFeatures()[1];
    expect(odPair1.attributes).toEqual(new BaseOdTrip(odTripAttributes1, false).attributes);
    expect(odPair2.attributes).toEqual(new BaseOdTrip(odTripAttributes2, false).attributes);

});

test('Load from server for data source', async () => {
    EventManagerMock.emitResponseReturnOnce({collection: [odTripAttributes1]});

    // Test loading a simple collection
    const collection = new BaseOdTripCollection([], { dataSourceId: odTripAttributes1.dataSourceId }, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('odPairs.collection', odTripAttributes1.dataSourceId, expect.anything());
    expect(collection.getFeatures().length).toEqual(1);
    const odPair1 = collection.getFeatures()[0];
    expect(odPair1.attributes).toEqual(new BaseOdTrip(odTripAttributes1, false).attributes);

});

test('static attributes', () => {
    const collection = new BaseOdTripCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('BaseOdTrips');
    expect(collection.socketPrefix).toEqual('odPairs');
    expect(collection.displayName).toEqual('BaseOdTripCollection');
});
