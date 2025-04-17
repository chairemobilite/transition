/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import GenericCollection from 'chaire-lib-common/lib/utils/objects/GenericCollection';
import { GenericObject, GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import GenericPlace, { GenericPlaceAttributes } from 'chaire-lib-common/lib/utils/objects/GenericPlace';
import GenericPlaceCollection from 'chaire-lib-common/lib/utils/objects/GenericPlaceCollection';
import { Feature, Point } from 'geojson';
import json2CapnpRust from '../Json2CapnpRust';

const writeCacheMock = jest.fn();
const readCacheMock = jest.fn();

jest.mock('../../../utils/json2capnp/Json2CapnpService', () => {
    return {
        writeCache: jest.fn().mockImplementation(async (cacheName, jsonData, path) => writeCacheMock(cacheName, jsonData, path)),
        readCache: jest.fn().mockImplementation(async (cacheName, params) => readCacheMock(cacheName, params)),
    }
});

// Prepare stub classes for the tests: collections of geojson and plain objects
class ObjectStub extends GenericObject<GenericAttributes> {

}

class CollectionStub extends GenericCollection<ObjectStub> {
    protected getFeatureId(feature: ObjectStub): string {
        return feature.getId();
    }
}

class ObjectCollectionJson extends CollectionStub {
    forJson() {
        return this.features.map((object) => {
            return object.attributes;
        }); 
    }
}

class GenericCollectionGeojson extends GenericPlaceCollection<GenericPlaceAttributes, GenericPlace<GenericPlaceAttributes>> {
    newObject(feature: Feature<Point, GenericPlaceAttributes>, isNew?: boolean): GenericPlace<GenericPlaceAttributes> {
        return new GenericPlace(feature.properties, isNew);
    }
}

beforeEach(() => {
    writeCacheMock.mockClear();
    readCacheMock.mockClear();
});

const stubObjects = [new ObjectStub({
    id: uuidV4(),
    name: 'stub Object 1',
    data: {
        test: 'abc'
    }
}),
new ObjectStub({
    id: uuidV4(),
    name: 'stub Object 2',
    description: 'This is a description'
})];

const stubPlaces = [{
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [ 1, 1 ] },
    properties: {
        id: uuidV4(),
        name: 'stub Object 1',
        geography: { type: 'Point' as const, coordinates: [ 1, 1 ] },
        data: {
            test: 'abc'
        }
    }
},
{
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [ 2, 2 ] },
    properties: {
        id: uuidV4(),
        name: 'stub Object 2',
        geography: { type: 'Point' as const, coordinates: [ 2, 2 ] },
        description: 'This is a description',
        data: { }
    }
}]

const collectionName = 'Stubs';
const objectName = 'Stub';

describe('CollectionToCache', () => {
    test('Test valid object collection data', async () => {
        const callParams = {
            collection: new ObjectCollectionJson(stubObjects, {}),
            cacheName: collectionName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        await json2CapnpRust.collectionToCache(callParams);
        expect(writeCacheMock).toHaveBeenCalledTimes(1);
        expect(writeCacheMock).toHaveBeenCalledWith(collectionName, expect.objectContaining({
            [collectionName]: stubObjects.map(obj => obj.attributes)
        }), callParams.cachePathDirectory);
    });

    test('Test valid geojson collection data', async () => {
        const callParams = {
            collection: new GenericCollectionGeojson(stubPlaces, {}),
            cacheName: collectionName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        await json2CapnpRust.collectionToCache(callParams);
        expect(writeCacheMock).toHaveBeenCalledTimes(1);
        expect(writeCacheMock).toHaveBeenCalledWith(collectionName, expect.objectContaining({
            [collectionName]: { type: 'FeatureCollection', features: stubPlaces}
        }), callParams.cachePathDirectory);
    });

    test('Test unexportable collection', async () => {
        const callParams = {
            collection: new CollectionStub([], {}),
            cacheName: collectionName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        await expect(json2CapnpRust.collectionToCache(callParams))
        .rejects
        .toThrow(`Cannot save ${collectionName} collection (cannot convert to geojson or json)`);
    });
});

describe('CollectionFromCache', () => {
    test('Test valid object collection data', async () => {
        readCacheMock.mockResolvedValueOnce({
            data: {
                [collectionName]: stubObjects.map(obj => obj.attributes)
            }
        });
        const collection = new ObjectCollectionJson([], {});
        const callParams = {
            collection,
            cacheName: collectionName,
            bodyData: {},
            parser: (attribs) => new ObjectStub(attribs),
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        await json2CapnpRust.collectionFromCache(callParams);
        expect(readCacheMock).toHaveBeenCalledTimes(1);
        expect(readCacheMock).toHaveBeenCalledWith(collectionName, callParams.bodyData);
        expect(collection.getFeatures()).toEqual(stubObjects);
    });

    test('Test valid geojson collection data', async () => {
        readCacheMock.mockResolvedValueOnce({
            data: {
                [collectionName]: { type: 'FeatureCollection' as const, features: stubPlaces }
            }
        });
        const collection = new GenericCollectionGeojson([], {});
        const callParams = {
            collection,
            cacheName: collectionName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        await json2CapnpRust.collectionFromCache(callParams);
        expect(readCacheMock).toHaveBeenCalledTimes(1);
        expect(readCacheMock).toHaveBeenCalledWith(collectionName, callParams.bodyData);
        expect(collection.getFeatures()).toEqual(stubPlaces);
    });

    test('Bad response', async () => {
        readCacheMock.mockResolvedValueOnce({
            status: 'noData'
        });
        const collection = new ObjectCollectionJson([], {});
        const callParams = {
            collection,
            cacheName: collectionName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        await expect(json2CapnpRust.collectionFromCache(callParams))
        .rejects
        .toThrow(`Cannot load ${collectionName} collection`);
    });
});

describe('ObjectToCache', () => {
    test('Test valid object, no parser', async () => {
        const callParams = {
            object: stubObjects[0],
            cacheName: objectName,
            bodyData: {}
        };
        await json2CapnpRust.objectToCache(callParams);
        expect(writeCacheMock).toHaveBeenCalledTimes(1);
        expect(writeCacheMock).toHaveBeenCalledWith(objectName, expect.objectContaining({
            [objectName]: stubObjects[0].attributes
        }), undefined);
    });

    test('Test valid object, with parser', async () => {
        const callParams = {
            object: stubObjects[0],
            cacheName: objectName,
            bodyData: {},
            parser: (object) => ({...object.attributes, extra: 'extra' })
        };
        await json2CapnpRust.objectToCache(callParams);
        expect(writeCacheMock).toHaveBeenCalledTimes(1);
        expect(writeCacheMock).toHaveBeenCalledWith(objectName, expect.objectContaining({
            [objectName]: { ...stubObjects[0].attributes, extra: 'extra' }
        }), undefined);
    });

    test('Test valid feature data', async () => {
        const callParams = {
            object: new GenericPlace(stubPlaces[0].properties),
            cacheName: objectName,
            bodyData: {}
        };
        await json2CapnpRust.objectToCache(callParams);
        expect(writeCacheMock).toHaveBeenCalledTimes(1);
        expect(writeCacheMock).toHaveBeenCalledWith(objectName, expect.objectContaining({
            [objectName]: expect.objectContaining(stubPlaces[0].properties)
        }), undefined);

    });
});

describe('ObjectFromCache', () => {
    test('Test valid object, no parser', async () => {
        readCacheMock.mockResolvedValueOnce({
            data: {
                [objectName]: stubObjects[0].attributes
            }
        });
        const callParams = {
            objectUuid: stubObjects[0].getId(),
            newObject: (attributes) => new ObjectStub(attributes),
            cacheName: objectName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        const object = await json2CapnpRust.objectFromCache(callParams);
        expect(readCacheMock).toHaveBeenCalledTimes(1);
        expect(readCacheMock).toHaveBeenCalledWith(objectName, { ...callParams.bodyData, uuid: stubObjects[0].getId() });
        expect(object).toEqual(stubObjects[0]);
    });

    test('Test valid object, with parser', async () => {
        readCacheMock.mockResolvedValueOnce({
            data: {
                [objectName]: stubObjects[0].attributes
            }
        });
        const callParams = {
            objectUuid: stubObjects[0].getId(),
            newObject: (attributes) => new ObjectStub(attributes),
            cacheName: objectName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache',
            parser: (attribs) => ({...attribs, extra: 'extra' })
        };
        const object = await json2CapnpRust.objectFromCache(callParams);
        expect(readCacheMock).toHaveBeenCalledTimes(1);
        expect(readCacheMock).toHaveBeenCalledWith(objectName, { ...callParams.bodyData, uuid: stubObjects[0].getId() });
        expect(object).toBeDefined();
        expect((object as any).attributes).toEqual({...stubObjects[0].attributes, extra: 'extra' });
    });

    test('Invalid response', async () => {
        readCacheMock.mockResolvedValueOnce({
            status: 'error'
        });
        const callParams = {
            objectUuid: stubObjects[0].getId(),
            newObject: (attributes) => new ObjectStub(attributes),
            cacheName: objectName,
            bodyData: {},
            cachePathDirectory: 'tmp',
            cachePath: 'myCache'
        };
        const object = await json2CapnpRust.objectFromCache(callParams);
        expect(readCacheMock).toHaveBeenCalledTimes(1);
        expect(readCacheMock).toHaveBeenCalledWith(objectName, { ...callParams.bodyData, uuid: stubObjects[0].getId() });
        expect(object).toBeUndefined();
    });
});