/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import Agency from '../Agency';
import { getUniqueAgencyAcronym } from '../AgencyUtils';
import AgencyCollection from '../AgencyCollection';

const agencyAttributes1 = {
    id: uuidV4(),
    acronym: 'A1',
    name: 'Agency1',
    is_frozen: false
};

const agencyAttributes2 = {
    id: uuidV4(),
    acronym: 'A1-1',
    name: 'Copy of A1',
    is_frozen: false
};

let agencyCollection = new AgencyCollection([new Agency(agencyAttributes1, false), new Agency(agencyAttributes2, false)], {});

test('Unique acronym, not exists', () => {
    const uniqueAcronym = 'UniqA'
    const newAcronym = getUniqueAgencyAcronym(agencyCollection, uniqueAcronym);
    expect(newAcronym).toEqual(uniqueAcronym);
});

test('Unique acronym, exists', () => {
    const newAcronym = getUniqueAgencyAcronym(agencyCollection, agencyAttributes1.acronym);
    expect(newAcronym).not.toEqual(agencyAttributes1.acronym);
    expect(newAcronym).not.toEqual(agencyAttributes2.acronym);
});