/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { v4 as uuidV4 } from 'uuid';

import { getDataSource } from '../dataSources';
import dataSourcesDbQueries from '../../../models/db/dataSources.db.queries';

jest.mock('../../../models/db/dataSources.db.queries', () => ({
    collection: jest.fn(),
    create: jest.fn(),
    read: jest.fn()
}));
const mockedDbCollection = dataSourcesDbQueries.collection as jest.MockedFunction<typeof dataSourcesDbQueries.collection>;
const mockedDbCreate = dataSourcesDbQueries.create as jest.MockedFunction<typeof dataSourcesDbQueries.create>;
const mockedDbRead = dataSourcesDbQueries.read as jest.MockedFunction<typeof dataSourcesDbQueries.read>;
mockedDbRead.mockImplementation(async (id: string) => {
    if (id === dataSourceAttribs1.id) {
        return dataSourceAttribs1;
    } 
    if (id === dataSourceAttribs2.id) {
        return dataSourceAttribs2;
    }
    throw new TrError('Not found', 'CODE1');
});

const dataSourceAttribs1 = {
    id: uuidV4(),
    shortname: 'new_test_data_source',
    type: 'transitSmartCardData',
    name: 'new test data source',
    description: "description for new test data source",
    is_frozen: true,
    data: {
      foo: 'bar',
      bar: 'foo'
    }
} as any;
  
const dataSourceAttribs2 = {
    id: uuidV4(),
    shortname: 'new_test_data_source2',
    type: 'transitOperationalData',
    name: 'new test data source 2',
    description: "description for new test data source 2",
    is_frozen: false,
    data: {
      foo2: 'bar2',
      bar2: 'foo2'
    }
} as any;

describe('get data sources', () => {

    beforeEach(() => {
        mockedDbCollection.mockClear();
        mockedDbCreate.mockClear();
        mockedDbRead.mockClear();
    })

    test('Get new data source, unexisting', async () => {
        const name = 'test';
        mockedDbCollection.mockResolvedValueOnce([ dataSourceAttribs1, dataSourceAttribs2 ]);
        mockedDbCreate.mockResolvedValueOnce(uuidV4());
        const dataSource = await getDataSource({ isNew: true, type: 'odTrips', dataSourceName: name });
        expect(mockedDbCollection).toHaveBeenCalledTimes(1);
        expect(mockedDbCollection).toHaveBeenCalledWith({ type: 'odTrips', userId: undefined });
        expect(mockedDbCreate).toHaveBeenCalledTimes(1);
        expect(dataSource).toBeDefined();
        expect(dataSource.attributes).toEqual(expect.objectContaining({
            type: 'odTrips',
            name,
            shortname: name
        }));
    });

    test('Get new data source for user, unexisting', async () => {
        const name = 'test';
        const userId = 1;
        mockedDbCollection.mockResolvedValueOnce([ dataSourceAttribs1, dataSourceAttribs2 ]);
        mockedDbCreate.mockResolvedValueOnce(uuidV4());
        const dataSource = await getDataSource({ isNew: true, type: 'odTrips', dataSourceName: name }, userId);
        expect(mockedDbCollection).toHaveBeenCalledTimes(1);
        expect(mockedDbCollection).toHaveBeenCalledWith({ type: 'odTrips', userId });
        expect(mockedDbCreate).toHaveBeenCalledTimes(1);
        expect(dataSource).toBeDefined();
        expect(dataSource.attributes).toEqual(expect.objectContaining({
            type: 'odTrips',
            name,
            shortname: name,
            owner: userId
        }));
    });

    test('Get new data source, exists', async () => {
        mockedDbCollection.mockResolvedValueOnce([ dataSourceAttribs1, dataSourceAttribs2 ]);
        await expect(getDataSource({ isNew: true, type: 'odTrips', dataSourceName: dataSourceAttribs1.shortname }))
            .rejects
            .toThrow(new TrError(`Cannot create data source ${dataSourceAttribs1.shortname}. A data source with that name already exists`, 'DSERR01'));
        expect(mockedDbCollection).toHaveBeenCalledTimes(1);
        expect(mockedDbCollection).toHaveBeenCalledWith({ type: 'odTrips', userId: undefined });
        expect(mockedDbCreate).toHaveBeenCalledTimes(0);
    });

    test('Get existing data source, exists', async () => {
        const dataSource = await getDataSource({ isNew: false, dataSourceId: dataSourceAttribs1.id });
        expect(mockedDbRead).toHaveBeenCalledTimes(1);
        expect(mockedDbRead).toHaveBeenCalledWith(dataSourceAttribs1.id, undefined);
        expect(dataSource).toBeDefined();
        expect(dataSource.attributes).toEqual(expect.objectContaining(dataSourceAttribs1));
    });

    test('Get existing data source, unexisting', async () => {
        await expect(getDataSource({ isNew: false, dataSourceId: uuidV4()}))
            .rejects
            .toThrow(new TrError('Not found', 'CODE1'));
        expect(mockedDbRead).toHaveBeenCalledTimes(1);
    }); 

});