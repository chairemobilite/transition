/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import { getUniqueAgencyAcronym } from '../AgencyUtils';
import transitAgenciesDbQueries from '../../../../models/db/transitAgencies.db.queries';

jest.mock('../../../../models/db/transitAgencies.db.queries', () => ({
    collection: jest.fn()
}));
const mockCollection = transitAgenciesDbQueries.collection as jest.MockedFunction<
    typeof transitAgenciesDbQueries.collection
>;

const agencyAttributes1 = {
    id: uuidV4(),
    acronym: 'A1',
    name: 'Agency1',
    is_frozen: false,
    data: {}
};

const agencyAttributes2 = {
    id: uuidV4(),
    acronym: 'A1-1',
    name: 'Copy of A1',
    is_frozen: false,
    data: {}
};

mockCollection.mockResolvedValue([agencyAttributes1, agencyAttributes2]);

test('Unique acronym, not exists', async () => {
    const uniqueAcronym = 'UniqA'
    const newAcronym = await getUniqueAgencyAcronym(uniqueAcronym);
    expect(newAcronym).toEqual(uniqueAcronym);
});

test('Unique acronym, exists', async () => {
    const baseAcronym = 'A1';
    const newAcronym = await getUniqueAgencyAcronym(baseAcronym);
    expect(newAcronym).toEqual('A1-2');
});
