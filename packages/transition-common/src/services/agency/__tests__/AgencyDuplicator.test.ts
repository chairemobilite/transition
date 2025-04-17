/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _omit from 'lodash/omit';

import Agency from '../Agency';
import { duplicateAgency } from '../AgencyDuplicator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import AgencyCollection from '../AgencyCollection';

const agencySaveFct = Agency.prototype.save = jest.fn();
const eventManager = EventManagerMock.eventManagerMock;

const agencyAttributes1 = {
    id: uuidV4(),
    acronym: 'AC1',
    name: 'Agency1',
    line_ids: [],
    unit_ids: [uuidV4()],
    garage_ids: [uuidV4(), uuidV4()],
    data: {
        arbitraryDataField: 'foo',
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

let agencyCollection: AgencyCollection;
let collectionManager: CollectionManager;

beforeEach(() => {
    agencyCollection = new AgencyCollection([], {});
    collectionManager = new CollectionManager(eventManager, {
        agencies: agencyCollection
    });
    agencySaveFct.mockClear();
    EventManagerMock.mockClear();
})

test('duplicate simple agency', async () => {

    // Add a agency that is not new
    const baseAgency = new Agency(agencyAttributes1, false, collectionManager);
    agencyCollection.add(baseAgency);

    // Copy the agency a first time
    const copy1 = await duplicateAgency(baseAgency, { socket: eventManager });

    expect(copy1.attributes.id).not.toEqual(baseAgency.attributes.id);
    expect(copy1.attributes.acronym).not.toEqual(baseAgency.attributes.acronym);
    expect(copy1.attributes.name).toEqual(baseAgency.attributes.name);
    expect(copy1.attributes.data).toEqual(_omit(baseAgency.attributes.data, 'gtfs'));
    expect(copy1.attributes.garage_ids).toEqual([]);
    expect(copy1.attributes.unit_ids).toEqual([]);
    expect(agencySaveFct).toHaveBeenCalledTimes(2);
    expect(agencyCollection.size()).toEqual(2);
    
    // Make a second copy to make sure it id added with a different acronym
    const copy2 = await duplicateAgency(baseAgency, { socket: eventManager });

    expect(copy2.attributes.id).not.toEqual(baseAgency.attributes.id);
    expect(copy2.attributes.id).not.toEqual(copy1.attributes.id);
    expect(copy2.attributes.acronym).not.toEqual(baseAgency.attributes.acronym);
    expect(copy2.attributes.acronym).not.toEqual(copy1.attributes.acronym);
    expect(copy2.attributes.name).toEqual(baseAgency.attributes.name);
    expect(copy2.attributes.data).toEqual(_omit(baseAgency.attributes.data, 'gtfs'));
    expect(copy1.attributes.garage_ids).toEqual([]);
    expect(copy1.attributes.unit_ids).toEqual([]);
    expect(agencySaveFct).toHaveBeenCalledTimes(4);
    expect(agencyCollection.size()).toEqual(3);

});

test('duplicate simple agency with params', async () => {

    // Add a agency that is not new
    const baseAgency = new Agency(agencyAttributes1, false, collectionManager);
    agencyCollection.add(baseAgency);

    // Copy the agency a first time
    const newAgencyName = "new agency";
    const newAcronym = "NEW";
    const copy = await duplicateAgency(baseAgency, { 
        socket: eventManager, 
        newAcronym: newAcronym,
        newName: newAgencyName
    });

    expect(copy.attributes.id).not.toEqual(baseAgency.attributes.id);
    expect(copy.attributes.acronym).toEqual(newAcronym);
    expect(copy.attributes.name).toEqual(newAgencyName);
    expect(copy.attributes.garage_ids).toEqual([]);
    expect(copy.attributes.unit_ids).toEqual([]);
    expect(agencySaveFct).toHaveBeenCalledTimes(2);
});

test('duplicate agency with lines, services and schedules', async() => {
    // TODO Add test with lines, services and schedules once all those classes are in typescript
});