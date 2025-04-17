/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

// TODO socket.io-mock does not allow to test all the parameters of the socket call.
// import SocketMock   from 'socket.io-mock';

import CollectionCacheable from '../CollectionCacheable';
import GenericCollection from '../../../utils/objects/GenericCollection';
import { GenericObject, GenericAttributes } from '../../../utils/objects/GenericObject';

const socketMock = {
    emit: jest.fn(),
    on: jest.fn()
}

// TODO Move those classes to a mock
class GenericObjectStub extends GenericObject<GenericAttributes> {
    
}
class CollectionStub extends GenericCollection<GenericObjectStub> {
    protected getFeatureId(feature: GenericObjectStub): string {
        return feature.attributes.id;
    }
    protected static socketPrefix = 'collectionStub';
    newObject(attribs: Partial<GenericAttributes>): GenericObjectStub {
        return new GenericObjectStub(attribs);
    }

}

const obj1 = new GenericObjectStub({id: uuidV4(), data: {name: 'obj1'}});
const obj2 = new GenericObjectStub({id: uuidV4(), data: {name: 'obj2'}});
const obj3 = new GenericObjectStub({id: uuidV4(), data: {name: 'obj3'}});
const collection = new CollectionStub([obj1, obj2, obj3]);
const customCachePath = 'abcdef';
const collectionCustomPath = new CollectionStub([obj1, obj2, obj3], {data: { customCachePath}});

test('Save cache', async function() {

    socketMock.emit.mockImplementation((socketPath, coll, path, ret) => {
        ret({});
    })

    // Save simple collection
    socketMock.emit.mockClear();
    await CollectionCacheable.saveCache(collection, socketMock);
    expect(socketMock.emit).toHaveBeenCalled();
    expect(socketMock.emit).toHaveBeenCalledWith('collectionStub.saveCollectionCache', undefined, undefined, expect.anything());

    // Save specific collection with custom path
    socketMock.emit.mockClear();
    const subColl = new CollectionStub([obj1, obj2]);
    await CollectionCacheable.saveCache(collectionCustomPath, socketMock, subColl);
    expect(socketMock.emit).toHaveBeenCalledWith('collectionStub.saveCollectionCache', subColl, customCachePath, expect.anything());
});

test('should load a progressable collection and emit progress', async function() {

    socketMock.emit.mockImplementation((socketPath, coll, ret) => {
        ret(collection);
    });

    // Load simple collection
    socketMock.emit.mockClear();
    let loaded = await CollectionCacheable.loadCache(collection, socketMock);
    expect(socketMock.emit).toHaveBeenCalled();
    expect(socketMock.emit).toHaveBeenCalledWith('collectionStub.loadCollectionCache', undefined, expect.anything());
    expect(loaded).toEqual(collection);

    // Load collection with custom path
    socketMock.emit.mockClear();
    loaded = await CollectionCacheable.loadCache(collectionCustomPath, socketMock);
    expect(socketMock.emit).toHaveBeenCalledWith('collectionStub.loadCollectionCache', customCachePath, expect.anything());
    expect(loaded).toEqual(collection);

});

