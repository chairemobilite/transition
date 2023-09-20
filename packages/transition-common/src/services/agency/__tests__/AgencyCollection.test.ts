/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Agency from '../Agency';
import AgencyCollection from '../AgencyCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

// TODO Bring the collection manager to a mocking library
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
serviceLocator.addService('collectionManager', collectionManager);

const agencyAttributes1 = {
    id: uuidV4(),
    acronym: 'AC1',
    name: 'Agency1',
    line_ids: [uuidV4(), uuidV4()],
    unit_ids: [],
    garage_ids: [],
    data: {
        gtfs: {
            agency_email: 'test@test.agency',
            agency_url: 'http://test.test.agency',
            agency_timezone: 'America/Montreal',
            agency_fare_url: 'http://test.test.agency.fare',
            agency_phone: '+1 999-999-9999',
            agency_lang: 'fr'
        }
    },
    is_frozen: false
};

const agencyAttributes2= {
    id: uuidV4(),
    acronym: 'AC2 ALLO with spaces and éèàê',
    name: 'Agency2',
    description: 'descAC2',
    internal_id: '1234AAA',
    line_ids: [],
    unit_ids: [uuidV4(), uuidV4()],
    garage_ids: [uuidV4(), uuidV4()],
    color: '#ff0000',
    data: {
        foo: 'bar'
    },
    is_frozen: true
};

const agencyAttributes3= {
    id: uuidV4(),
    acronym: 'AC3',
    name: 'Agency3',
    description: 'descAC3',
    internal_id: 'CCC',
    line_ids: [],
    unit_ids: [uuidV4(), uuidV4()],
    garage_ids: [uuidV4(), uuidV4()],
    color: '#ffff0',
    data: {
        foo: 'bar3'
    },
    is_frozen: false
};

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('should construct agency collection with or without features', function() {

    const agency1 = new Agency(agencyAttributes1, true);
    const agency2 = new Agency(agencyAttributes2, false);
    const agency3 = new Agency(agencyAttributes3, false);

    const agencyCollectionEmpty = new AgencyCollection([], {}, eventManager);
    const agencyCollection2 = new AgencyCollection([agency1, agency2], {}, eventManager);
    const agencyCollection3 = new AgencyCollection([agency1, agency2, agency3], {}, eventManager);

    expect(agencyCollectionEmpty.size()).toBe(0);
    expect(agencyCollection2.size()).toBe(2);
    expect(agencyCollection3.size()).toBe(3);

    expect(agencyCollectionEmpty.getFeatures()[0]).toBeUndefined();
    expect(agencyCollection2.getFeatures()[0]).toMatchObject(agency1);
    expect(agencyCollection3.getFeatures()[2]).toMatchObject(agency3);
    expect(agencyCollectionEmpty.getById(agencyAttributes1.id)).toBeUndefined();
    expect(agencyCollection2.getById(agencyAttributes1.id)).toMatchObject(agency1);
    expect(agencyCollection2.getById(agencyAttributes3.id)).toBeUndefined();
    expect(agencyCollection3.getById(agencyAttributes3.id)).toMatchObject(agency3);

    agencyCollectionEmpty.add(agency1);
    expect(agencyCollectionEmpty.size()).toBe(1);
    expect(agencyCollectionEmpty.getById(agencyAttributes1.id)).toMatchObject(agency1);
    agencyCollectionEmpty.removeById(agencyAttributes1.id);
    expect(agencyCollectionEmpty.size()).toBe(0);
    expect(agencyCollectionEmpty.getFeatures()[0]).toBeUndefined();

    expect(agencyCollection3.forJson()[2]).toEqual(agencyAttributes3);
    expect(agencyCollection3.forCsv()[2]).toEqual({
        uuid: agencyAttributes3.id,
        name: agencyAttributes3.name,
        acronym: agencyAttributes3.acronym,
        internal_id: agencyAttributes3.internal_id,
        color: agencyAttributes3.color,
        description: agencyAttributes3.description
    });

});

test('Load from server', async () => {
    EventManagerMock.emitResponseReturnOnce({collection: [agencyAttributes1, agencyAttributes2]});

    // Test loading a simple collection
    const collection = new AgencyCollection([], {}, eventManager);
    await collection.loadFromServer(eventManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('transitAgencies.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    const agency1 = collection.getFeatures()[0];
    const agency2 = collection.getFeatures()[1];
    expect(agency1).toEqual(new Agency(agencyAttributes1, false));
    expect(agency2).toEqual(new Agency(agencyAttributes2, false));
    expect(agency1.collectionManager).toEqual(collectionManager);
    expect(agency2.collectionManager).toEqual(collectionManager);

});

test('static attributes', () => {
    const collection = new AgencyCollection([], {}, eventManager);
    expect(collection.instanceClass.getCapitalizedPluralName()).toEqual('Agencies');
    expect(collection.socketPrefix).toEqual('transitAgencies');
    expect(collection.displayName).toEqual('AgencyCollection');
});
