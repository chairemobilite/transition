/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

// TODO socket.io-mock does not allow to test all the parameters of the socket call.
// import SocketMock   from 'socket.io-mock';

import Progressable from '../../../utils/objects/Progressable';
import EventManagerMock from '../../../test/services/events/EventManagerMock';
import CollectionLoadable from '../CollectionLoadable';
import GenericObjectCollection from '../../../utils/objects/GenericObjectCollection';
import CollectionManager from '../../../utils/objects/CollectionManager';
import { GenericObject, GenericAttributes } from '../../../utils/objects/GenericObject';
import serviceLocator from '../../../utils/ServiceLocator';

// TODO Move those classes to a mock
const eventManager = EventManagerMock.eventManagerMock;
const collectionManager = new CollectionManager(eventManager);
interface GenericAttributesStub extends GenericAttributes {
    data: {name: string};
}
class GenericObjectStub extends GenericObject<GenericAttributesStub> {
    public collectionManager: any;
    constructor(attributes: Partial<GenericAttributesStub>, isNew?: boolean, collManager?: any) {
        super(attributes, isNew);
        this.collectionManager = collManager;
    }
}
class CollectionStub extends GenericObjectCollection<GenericObjectStub> {
    protected getFeatureId(feature: GenericObjectStub): string {
        return feature.getAttributes().id;
    }
    protected static socketPrefix = 'collectionStub';
    newObject(attribs: Partial<GenericAttributesStub>, isNew?: boolean, collManager?: any): GenericObjectStub {
        return new GenericObjectStub(attribs, isNew, collManager);
    }
}

class CollectionStubProgressable extends GenericObjectCollection<GenericObjectStub> implements Progressable {
    protected static socketPrefix = 'collectionStubProgressable';
    newObject(attribs: Partial<GenericAttributesStub>, isNew?: boolean, collManager?: any): GenericObjectStub {
        return new GenericObjectStub(attribs, isNew, collManager);
    }
    progress(progressEventName: string, completeRatio: number): void {
        eventManager.emitProgress(`collectionStub${progressEventName}`, completeRatio);
    }
    protected getFeatureId(feature: GenericObjectStub): string {
        return feature.getAttributes().id;
    }
}

const obj1Attribs = {id: uuidV4(), data: {name: 'obj1'}};
const obj2Attribs = {id: uuidV4(), data: {name: 'obj2'}};
const obj3Attribs = {id: uuidV4(), data: {name: 'obj3'}};
const obj1 = new GenericObjectStub(obj1Attribs, false);
const obj2 = new GenericObjectStub(obj2Attribs, false);
const obj3 = new GenericObjectStub(obj3Attribs, false);
const obj1WithColl = new GenericObjectStub(obj1Attribs, false, collectionManager);
const obj2WithColl = new GenericObjectStub(obj2Attribs, false, collectionManager);
const obj3WithColl = new GenericObjectStub(obj3Attribs, false, collectionManager);

const customCachePath = 'abcdef';

serviceLocator.addService('collectionManager', collectionManager);

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('LoadFromCollection', async function() {
    const collectionStub = new CollectionStub([]);
    // Test with a non-progressable collection
    expect(collectionStub.getFeatures().length).toEqual(0);
    let response = CollectionLoadable.loadFromCollection(collectionStub, [obj1Attribs, obj2Attribs]);
    expect(response.status).toEqual('success');
    expect(collectionStub.getFeatures().length).toEqual(2);
    expect(collectionStub.getFeatures()).toEqual([obj1, obj2]);
    expect(eventManager.emitProgress).toHaveBeenCalledTimes(0);

    // Test with a progressable collection
    const progressCollectionStub = new CollectionStubProgressable([]);
    expect(progressCollectionStub.getFeatures().length).toEqual(0);
    response = CollectionLoadable.loadFromCollection(progressCollectionStub, [obj1Attribs, obj2Attribs]);
    expect(response.status).toEqual('success');
    expect(progressCollectionStub.getFeatures().length).toEqual(2);
    expect(progressCollectionStub.getFeatures()).toEqual([obj1, obj2]);
    expect(eventManager.emitProgress).toHaveBeenCalledTimes(2);

    // Test with a collection manager
    const collectionStub2 = new CollectionStub([]);
    expect(collectionStub2.getFeatures().length).toEqual(0);
    response = CollectionLoadable.loadFromCollection(collectionStub2, [obj1Attribs, obj2Attribs], collectionManager);
    expect(response.status).toEqual('success');
    expect(collectionStub2.getFeatures().length).toEqual(2);
    expect(collectionStub2.getFeatures()[0].collectionManager).toEqual(collectionManager);
    expect(collectionStub2.getFeatures()[1].collectionManager).toEqual(collectionManager);
});

test('loadFromServer', async function() {

    EventManagerMock.emitResponseReturnOnce({collection: [obj1Attribs, obj2Attribs]});

    // Test loading a simple collection
    const collection = new CollectionStub([]);
    await CollectionLoadable.loadFromServer(collection, eventManager, collectionManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('collectionStub.collection', null, expect.anything());
    expect(collection.getFeatures().length).toEqual(2);
    expect(collection.getFeatures()).toEqual([obj1WithColl, obj2WithColl]);
    expect(eventManager.emitProgress).toHaveBeenCalledTimes(0);

    // Load a progressable collection
    EventManagerMock.mockClear();
    EventManagerMock.emitResponseReturnOnce({collection: [obj1Attribs, obj2Attribs]});
    const progressCollectionStub = new CollectionStubProgressable([]);
    expect(progressCollectionStub.getFeatures().length).toEqual(0);
    CollectionLoadable.loadFromServer(progressCollectionStub, eventManager, collectionManager);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith('collectionStubProgressable.collection', null, expect.anything());
    expect(progressCollectionStub.getFeatures().length).toEqual(2);
    expect(progressCollectionStub.getFeatures()).toEqual([obj1WithColl, obj2WithColl]);
    expect(eventManager.emitProgress).toHaveBeenCalledTimes(4);

    // Load from a specific socket path
    EventManagerMock.mockClear();
    EventManagerMock.emitResponseReturnOnce({collection: [obj1Attribs, obj3Attribs]});
    const collectionSocket = new CollectionStub([]);
    const socketEventName = 'socketEventName';
    await CollectionLoadable.loadFromServer(collectionSocket, eventManager, collectionManager, null, socketEventName);
    expect(eventManager.emit).toHaveBeenCalled();
    expect(eventManager.emit).toHaveBeenCalledWith(socketEventName, null, expect.anything());
    expect(collectionSocket.getFeatures().length).toEqual(2);
    expect(collectionSocket.getFeatures()).toEqual([obj1WithColl, obj3WithColl]);
    expect(eventManager.emitProgress).toHaveBeenCalledTimes(0);
});

test('loadGeojsonFromCollection', () => {
    // TODO Add test
});

test('loadGeojsonFromServer', () => {
    // TODO Add test
});

test('loadFromServerByFilter', () => {
    // TODO Add test
});
