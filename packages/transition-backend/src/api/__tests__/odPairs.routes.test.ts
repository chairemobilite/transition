/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { v4 as uuidV4 } from 'uuid';

import transitRoutes from '../odPairs.socketRoutes';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const socketStub = new EventEmitter();
transitRoutes(socketStub);

const mockedDbQuery = jest.fn();

jest.mock('../../models/db/odPairs.db.queries', () => {
    return {
        collection: jest.fn().mockImplementation(async (dsId, sampleSize) => {
            return mockedDbQuery(dsId, sampleSize);
        })
    }
});

const dataSourceId = uuidV4();

const odPairAttributes = {  
    id: uuidV4(),
    internal_id: 'test',
    origin_geography: { type: 'Point' as const, coordinates: [-73, 45] },
    destination_geography: { type: 'Point' as const, coordinates: [-73.5, 45.5] },
    timeOfTrip: 28800,
    timeType: 'departure' as const
};

const odPairAttributes2 = {
    id: uuidV4(),
    internal_id: 'test2',
    dataSourceId: dataSourceId,
    origin_geography: { type: 'Point' as const, coordinates: [-73.1, 45.2] },
    destination_geography: { type: 'Point' as const, coordinates: [-73.4, 45.4] },
    timeOfTrip: 24000,
    data: {
        expansionFactor: 2,
        foo: 'bar'
    },
    timeType: 'arrival' as const
};

describe('OdTrips: get collection', () => {

    beforeEach(() => {
        mockedDbQuery.mockClear();
    })

    test('Get collection correctly', (done) => {
        mockedDbQuery.mockResolvedValueOnce([ odPairAttributes, odPairAttributes2 ]);
        socketStub.emit('odPairs.collection', dataSourceId, function (response) {
            expect(mockedDbQuery).toHaveBeenCalledWith([dataSourceId], undefined);
            expect(response.collection).toEqual([ odPairAttributes, odPairAttributes2 ]);
            done();
        });
    });

    test('Get collection correctly for data source', (done) => {
        mockedDbQuery.mockResolvedValueOnce([ odPairAttributes, odPairAttributes2 ]);
        socketStub.emit('odPairs.collection', undefined, function (response) {
            expect(mockedDbQuery).toHaveBeenCalledWith(undefined, undefined);
            expect(response.collection).toEqual([ odPairAttributes, odPairAttributes2 ]);
            done();
        });
    });

    test('Get collection with error', (done) => {
        const message = 'Error while getting collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedDbQuery.mockRejectedValueOnce(error);
        socketStub.emit('odPairs.collection', uuidV4(), function (response) {
            expect(response.collection).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});