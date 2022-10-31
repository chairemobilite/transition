/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import geobuf from 'geobuf';
import Pbf from 'pbf';
import { v4 as uuidV4 } from 'uuid';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import routes from '../places.socketRoutes';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import placesDbQueries from '../../models/db/places.db.queries';

const socketStub = new EventEmitter();
routes(socketStub);

jest.mock('../../models/db/places.db.queries', () => {
    return {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        collection: jest.fn(),
        geojsonCollection: jest.fn()
    }
});

const mockedCreate = placesDbQueries.create as jest.MockedFunction<typeof placesDbQueries.create>;
const mockedUpdate = placesDbQueries.update as jest.MockedFunction<typeof placesDbQueries.update>;
const mockedDelete = placesDbQueries.delete as jest.MockedFunction<typeof placesDbQueries.delete>;
const mockedCollection = placesDbQueries.collection as jest.MockedFunction<typeof placesDbQueries.collection>;
const mockedGeojsonCollection = placesDbQueries.geojsonCollection as jest.MockedFunction<typeof placesDbQueries.geojsonCollection>;

const placeAttributes1 = {
    id: uuidV4(),
    integer_id: 1,
    name: 'Place1',
    shortname: 'P1',
    geography: { type: 'Point' as const, coordinates: [-73, 45] },
    data_source_id: 'arbitrary',
    data: {
        
    }
};

const placeAttributes2= {
    id: uuidV4(),
    integer_id: 2,
    name: 'Place2',
    shortname: 'P2',
    geography: { type: 'Point' as const, coordinates: [-73.1, 45.1] },
    data_source_id: 'arbitrary',
    data: {
        
    }
};

beforeEach(() => {
    mockedCreate.mockClear();
    mockedUpdate.mockClear();
    mockedDelete.mockClear();
    mockedCollection.mockClear();
    mockedGeojsonCollection.mockClear();
});

describe('Places: create', () => {

    test('Create correctly', (done) => {
        mockedCreate.mockResolvedValueOnce(placeAttributes1.id);
        socketStub.emit('place.create', placeAttributes1, (response) => {
            expect(mockedCreate).toHaveBeenCalledWith(placeAttributes1, 'id');
            expect(response.id).toEqual(placeAttributes1.id);
            done();
        });
    });

    test('Create with error', (done) => {
        const message = 'Error while creating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedCreate.mockRejectedValueOnce(error);
        socketStub.emit('place.create', placeAttributes1, function (response) {
            expect(mockedCreate).toHaveBeenCalledWith(placeAttributes1, 'id');
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Places: update', () => {

    test('Update correctly', (done) => {
        mockedUpdate.mockResolvedValueOnce(placeAttributes1.id);
        socketStub.emit('place.update', placeAttributes1.id, placeAttributes1, (response) => {
            expect(mockedUpdate).toHaveBeenCalledWith(placeAttributes1.id, placeAttributes1);
            expect(response.id).toEqual(placeAttributes1.id);
            done();
        });
    });

    test('Update with error', (done) => {
        const message = 'Error while updating';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedUpdate.mockRejectedValueOnce(error);
        socketStub.emit('place.update', placeAttributes1.id, placeAttributes1, function (response) {
            expect(mockedUpdate).toHaveBeenCalledWith(placeAttributes1.id, placeAttributes1);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Places: delete', () => {

    test('Delete correctly', (done) => {
        mockedDelete.mockResolvedValueOnce(placeAttributes1.id);
        socketStub.emit('place.delete', placeAttributes1.id, (response) => {
            expect(mockedDelete).toHaveBeenCalledWith(placeAttributes1.id);
            expect(Status.isStatusOk(response)).toEqual(true);
            expect(Status.unwrap(response)).toEqual({ id: placeAttributes1.id });
            done();
        });
    });

    test('Delete with error', (done) => {
        const message = 'Error while deleting';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedDelete.mockRejectedValueOnce(error);
        socketStub.emit('place.delete', placeAttributes1.id, function (response) {
            expect(mockedDelete).toHaveBeenCalledWith(placeAttributes1.id);
            expect(Status.isStatusOk(response)).toBe(false);
            expect(response.error.error).toEqual(message);
            expect(response.error.localizedMessage).toEqual(localizedMessage);
            expect(response.error.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Places: collections', () => {

    test('Get collection correctly with default params', (done) => {
        mockedCollection.mockResolvedValueOnce([ placeAttributes1, placeAttributes2 ]);
        socketStub.emit('places.collection', undefined, undefined, (response) => {
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(mockedCollection).toHaveBeenCalledWith(undefined, undefined);
            expect(response.collection).toEqual([ placeAttributes1, placeAttributes2 ]);
            done();
        });
    });

    test('Get collection correctly with params', (done) => {
        mockedCollection.mockResolvedValueOnce([ placeAttributes1, placeAttributes2 ]);
        socketStub.emit('places.collection', [placeAttributes1.data_source_id], 3, (response) => {
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(mockedCollection).toHaveBeenCalledWith([placeAttributes1.data_source_id], 3);
            expect(response.collection).toEqual([ placeAttributes1, placeAttributes2 ]);
            done();
        });
    });

    test('Get collection with error', (done) => {
        const message = 'Error while getting collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedCollection.mockRejectedValueOnce(error);
        socketStub.emit('places.collection', undefined, undefined, function (response) {
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});

describe('Places: geojson collection', () => {

    const geojsonCollection = {
        type: 'FeatureCollection' as const,
        features: [
            {
                type: 'Feature' as const,
                id: placeAttributes1.integer_id,
                properties: placeAttributes1,
                geometry: placeAttributes1.geography
            }, {
                type: 'Feature' as const,
                id: placeAttributes2.integer_id,
                properties: placeAttributes2,
                geometry: placeAttributes2.geography
            }
        ]
    }

    test('Get geojson collection correctly with default params', (done) => {
        mockedGeojsonCollection.mockResolvedValueOnce(geojsonCollection);
        socketStub.emit('places.geojsonCollection', {}, (response) => {
            expect(mockedGeojsonCollection).toHaveBeenCalledTimes(1);
            expect(mockedGeojsonCollection).toHaveBeenCalledWith(undefined, undefined);
            expect(response.geojson).toEqual(geojsonCollection);
            done();
        });
    });

    test('Get geojson collection correctly with params', (done) => {
        mockedGeojsonCollection.mockResolvedValueOnce(geojsonCollection);
        socketStub.emit('places.geojsonCollection', {
            dataSourceIds: [placeAttributes1.data_source_id],
            sampleSize: 2,
            format: 'geojson'
        }, (response) => {
            expect(mockedGeojsonCollection).toHaveBeenCalledTimes(1);
            expect(mockedGeojsonCollection).toHaveBeenCalledWith([placeAttributes1.data_source_id], 2);
            expect(response.geojson).toEqual(geojsonCollection);
            done();
        });
    });

    test('Get geojson collection correctly in geobuf format', (done) => {
        mockedGeojsonCollection.mockResolvedValueOnce(geojsonCollection);
        socketStub.emit('places.geojsonCollection', {
            dataSourceIds: [placeAttributes1.data_source_id],
            sampleSize: 2,
            format: 'geobuf'
        }, (response) => {
            expect(mockedGeojsonCollection).toHaveBeenCalledTimes(1);
            expect(mockedGeojsonCollection).toHaveBeenCalledWith([placeAttributes1.data_source_id], 2);
            expect(response.geobuf).toBeDefined();
            const geojson = geobuf.decode(new Pbf(response.geobuf));
            expect(geojson).toEqual(geojsonCollection);
            done();
        });
    });

    test('Get geojson collection with error', (done) => {
        const message = 'Error while getting geojson collection';
        const code = 'CODE';
        const localizedMessage = 'transit:Message';
        const error = new TrError(message, code, localizedMessage);
        mockedGeojsonCollection.mockRejectedValueOnce(error);
        socketStub.emit('places.geojsonCollection', {}, function (response) {
            expect(mockedGeojsonCollection).toHaveBeenCalledTimes(1);
            expect(response.id).toBeUndefined();
            expect(response.error).toEqual(message);
            expect(response.localizedMessage).toEqual(localizedMessage);
            expect(response.errorCode).toEqual(code);
            done();
        });
    });
});
