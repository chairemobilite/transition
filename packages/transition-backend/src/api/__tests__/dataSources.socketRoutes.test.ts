/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import transitRoutes from '../dataSources.socketRoutes';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const socketStub = new EventEmitter();
transitRoutes(socketStub);

const mockedDbQuery = jest.fn();

jest.mock('chaire-lib-backend/lib/models/db/dataSources.db.queries', () => {
    return {
        collection: jest.fn().mockImplementation(async () => {
            return mockedDbQuery();
        })
    }
});

const dataSourceAttrib1 = {
    id: uuidV4(),
    name: 'Datasource1',
    data: {},
    shortname: 'DS1',
    description: 'description',
    type: 'odTrips',
    is_frozen: false
};

const dataSourceAttrib2 = {
    id: uuidV4(),
    name: 'Datasource2',
    data: { foo: 'bar' },
    shortname: '2',
    description: 'description',
    type: 'places',
    is_frozen: true
};

describe('DataSources: get collection', () => {

    test('Get collection correctly', (done) => {
        mockedDbQuery.mockResolvedValueOnce([ dataSourceAttrib1, dataSourceAttrib2 ]);
        socketStub.emit('dataSources.collection', uuidV4(), function (response) {
            expect(response.collection).toEqual([ dataSourceAttrib1, dataSourceAttrib2 ]);
            done();
        });
    });

    test('Get collection with error', (done) => {
        const message = 'Error while getting collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedDbQuery.mockRejectedValueOnce(error);
        socketStub.emit('dataSources.collection', uuidV4(), function (response) {
            expect(response.collection).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});