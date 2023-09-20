/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import _omit from 'lodash/omit';

import Agency from '../Agency';

const agencyAttributes1 = {
    id: uuidV4(),
    acronym: 'AC1',
    name: 'Agency1',
    line_ids: [uuidV4(), uuidV4()],
    unit_ids: [],
    garage_ids: [],
    data: {
        arbitraryField: 'foo',
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


test('should construct new agencies', function() {

    const agency1 = new Agency(agencyAttributes1, true);
    expect(agency1.getAttributes()).toEqual(agencyAttributes1);
    expect(agency1.isNew()).toBe(true);

    const agency2 = new Agency(agencyAttributes2, false);
    expect(agency2.getAttributes()).toEqual(agencyAttributes2);
    expect(agency2.isNew()).toBe(false);
    
    // no collection manager, so lines should be empty:
    expect(agency1.getLines()).toEqual([]);
    expect(agency2.getLines()).toEqual([]);

    expect(agency1.hasLines()).toBe(true);
    expect(agency2.hasLines()).toBe(false);

    expect(agency1.getLineIds()).toEqual(agencyAttributes1.line_ids);
    expect(agency2.getLineIds()).toEqual([]);

    // no collection manager, so units should be empty:
    expect(agency1.getUnits()).toEqual([]);
    expect(agency2.getUnits()).toEqual([]);

    expect(agency1.hasUnits()).toBe(false);
    expect(agency2.hasUnits()).toBe(true);

    expect(agency1.getUnitIds()).toEqual([]);
    expect(agency2.getUnitIds()).toEqual(agencyAttributes2.unit_ids);

    // no collection manager, so garages should be empty:
    expect(agency1.getGarages()).toEqual([]);
    expect(agency2.getGarages()).toEqual([]);

    expect(agency1.hasGarages()).toBe(false);
    expect(agency2.hasGarages()).toBe(true);

    expect(agency1.getGarageIds()).toEqual([]);
    expect(agency2.getGarageIds()).toEqual(agencyAttributes2.garage_ids);

});

test('should validate', function() {
    const agency = new Agency(agencyAttributes1, true);
    expect(agency.validate()).toBe(true);
    agency.set('acronym', undefined);
    expect(agency.validate()).toBe(false);
    agency.set('acronym', null);
    expect(agency.validate()).toBe(false);
    agency.set('acronym', 'test');
    expect(agency.validate()).toBe(true);
});

test('should convert to string', function() {
    const agency1a = new Agency(agencyAttributes1, true);
    expect(agency1a.toString()).toBe('AC1 Agency1');
    agency1a.set('name', undefined);
    expect(agency1a.toString()).toBe('AC1');
    agency1a.set('acronym', undefined);
    expect(agency1a.toString()).toBe(agencyAttributes1.id);
    const agency1b = new Agency(agencyAttributes1, true);
    expect(agency1b.toString(true)).toBe(`AC1 Agency1 ${agencyAttributes1.id}`);
    agency1b.set('name', undefined);
    expect(agency1b.toString(true)).toBe(`AC1 ${agencyAttributes1.id}`);
    agency1b.set('acronym', undefined);
    expect(agency1b.toString(true)).toBe(agencyAttributes1.id);
});

test('should save and delete in memory', function() {
    const agency = new Agency(agencyAttributes1, true);
    expect(agency.isNew()).toBe(true);
    expect(agency.isDeleted()).toBe(false);
    agency.saveInMemory();
    expect(agency.isNew()).toBe(false);
    agency.deleteInMemory();
    expect(agency.isDeleted()).toBe(true);
});

test('static methods should work', function() {
    expect(Agency.getPluralName()).toBe('agencies');
    expect(Agency.getCapitalizedPluralName()).toBe('Agencies');
    expect(Agency.getDisplayName()).toBe('Agency');
    const agency = new Agency(agencyAttributes1, true);
    expect(agency.getPluralName()).toBe('agencies');
    expect(agency.getCapitalizedPluralName()).toBe('Agencies');
    expect(agency.getDisplayName()).toBe('Agency');
});

test('getClonedAttributes', () => {
    const agency = new Agency(agencyAttributes1, true);

    // Delete specifics
    const clonedAttributes = agency.getClonedAttributes();
    const { id, line_ids, data, ...expected } = _cloneDeep(agencyAttributes1);
    (expected as any).line_ids = [];
    (expected as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes).toEqual(expected);

    // Complete copy
    const clonedAttributes2 = agency.getClonedAttributes(false);
    const { data: data2, ...expectedWithSpecifics } = _cloneDeep(agencyAttributes1);
    (expectedWithSpecifics as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes2).toEqual(expectedWithSpecifics);

    // With second object
    const agency2 = new Agency(agencyAttributes2, true);

    // Delete specifics
    const clonedAttributes3 = agency2.getClonedAttributes();
    const expected2 = _omit(agencyAttributes2, 'id');
    expected2.garage_ids = [];
    expected2.unit_ids = [];
    expect(clonedAttributes3).toEqual(expected2);

    // Complete copy
    const clonedAttributes4 = agency2.getClonedAttributes(false);
    expect(clonedAttributes4).toEqual(agencyAttributes2);
});