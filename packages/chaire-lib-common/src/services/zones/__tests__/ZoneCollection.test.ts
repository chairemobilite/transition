/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import EventManagerMock from '../../../test/services/events/EventManagerMock';
import { Zone } from '../Zone';
import ZoneCollection from '../ZoneCollection';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;

const dataSourceId = uuidV4();
const zoneAttributes1 = {  
    id: uuidV4(),
    internal_id: 'test',
    geography: { type: 'Polygon' as const, coordinates: [[[-73, 45], [-73, 46], [-72, 46], [-73, 45]]]},
    dataSourceId: dataSourceId
};

const zoneAttributes2 = {
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

const zoneAttributes3 = {
    id: uuidV4(),
    internal_id: 'test2',
    shortname: 'T',
    name: 'Some test zone',
    dataSourceId: uuidV4(),
    geography: { type: 'Polygon' as const, coordinates: [[[-73, 45], [-73, 46], [-72, 46], [-73, 45]]]},
    data: {
        foo: 'bar'
    }
};

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct zones collection with or without features', function() {

    const odTrip1 = new Zone(zoneAttributes1, true);
    const odTrip2 = new Zone(zoneAttributes2, false);
    const odTrip3 = new Zone(zoneAttributes3, false);

    const odTripCollectionEmpty = new ZoneCollection([], {}, eventManager);
    const odTripCollection2 = new ZoneCollection([odTrip1, odTrip2], {}, eventManager);
    const odTripCollection3 = new ZoneCollection([odTrip1, odTrip2, odTrip3], {}, eventManager);

    expect(odTripCollectionEmpty.size()).toBe(0);
    expect(odTripCollection2.size()).toBe(2);
    expect(odTripCollection3.size()).toBe(3);

    expect(odTripCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(odTripCollection2.getFeatures()[0]).toMatchObject(odTrip1);
    expect(odTripCollection3.getFeatures()[2]).toMatchObject(odTrip3);
    expect(odTripCollectionEmpty.getById(zoneAttributes1.id)).toBeUndefined();
    expect(odTripCollection2.getById(zoneAttributes1.id)).toMatchObject(odTrip1);
    expect(odTripCollection2.getById(zoneAttributes3.id)).toBeUndefined();
    expect(odTripCollection3.getById(zoneAttributes3.id)).toMatchObject(odTrip3);

    odTripCollectionEmpty.add(odTrip1);
    expect(odTripCollectionEmpty.size()).toBe(1);
    expect(odTripCollectionEmpty.getById(zoneAttributes1.id)).toMatchObject(odTrip1);
    odTripCollectionEmpty.removeById(zoneAttributes1.id);
    expect(odTripCollectionEmpty.size()).toBe(0);
    expect(odTripCollectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(odTripCollection3.forJson()[2]).toEqual(odTrip3.getAttributes());

});

test('static attributes', () => {
    const collection = new ZoneCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Zones');
    expect(collection.displayName).toEqual('ZoneCollection');
});
