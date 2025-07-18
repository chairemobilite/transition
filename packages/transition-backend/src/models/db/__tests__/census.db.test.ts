/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../census.db.queries';
import zonesDbQueries from 'chaire-lib-backend/lib/models/db/zones.db.queries';
import { Zone as ObjectClass } from 'chaire-lib-common/lib/services/zones/Zone';

const id1 = uuidV4();
const newObjectAttributes = {  
    id: id1,
    internal_id: 'test',
    geography: { type: 'Polygon' as const, coordinates: [ [ [-73, 45], [-73, 46], [-72, 46], [-73, 45] ] ] }
};

const id2 = uuidV4();
const newObjectAttributes2 = {
    id: id2,
    internal_id: 'test2',
    geography: { type: 'Polygon' as const, coordinates: [[[-73, 45], [-73, 46], [-72, 46], [-73, 45]]]}
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await zonesDbQueries.truncate();
    const newObject = new ObjectClass(newObjectAttributes, true);
    await zonesDbQueries.create(newObject.attributes);
    const newObject2 = new ObjectClass(newObjectAttributes2, true);
    await zonesDbQueries.create(newObject2.attributes);
});

afterAll(async() => {
    await dbQueries.truncate();
    await zonesDbQueries.truncate();
    await knex.destroy();
});

describe('census', () => {
    test('add population data', async () => {

        const inputArray = [
            { internalId: 'test', population: 123456 },
            { internalId: 'test2', population: 0 }
        ];

        await dbQueries.addPopulationBatch(inputArray);

        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(2);

        const byZoneId = Object.fromEntries(collection.map((row) => [row.zone_id, row.population]));
        expect(byZoneId[id1]).toEqual(123456);
        expect(byZoneId[id2]).toEqual(0);

    });

    test('add data for zone that does not exist', async () => {

        await dbQueries.addPopulationBatch([{ internalId: 'fake_id', population: 0 }]);

        const collection = await dbQueries.collection();

        // When adding data with an internalId that does not exist in the zones table, the query will add nothing.
        // Thus, we expect the number of rows to still be 2.
        expect(collection.length).toEqual(2);

    });
});