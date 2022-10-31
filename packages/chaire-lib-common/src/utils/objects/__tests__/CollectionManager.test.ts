/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';

import { GenericObject, GenericAttributes } from '../GenericObject';
import GenericImmutableCollection from '../GenericImmutableCollection';
import CollectionManager from '../CollectionManager';
import EventManagerMock from '../../../test/services/events/EventManagerMock';

class GenericCollectionImpl extends GenericImmutableCollection<GenericObject<GenericAttributes>> {
    protected getFeatureId(feature: GenericObject<GenericAttributes>): string {
        return feature.getAttributes().id;
    }
}

test('test constructor, getEventManager and get/getCollection', function() {

    const coll1 = new GenericCollectionImpl([]);
    const coll2 = new GenericCollectionImpl([]);
    const collectionManagerWithoutEM = new CollectionManager(null, {
        coll1,
        coll2
    });
    expect(collectionManagerWithoutEM.getEventManager()).toBeUndefined();
    expect(collectionManagerWithoutEM.getSize()).toBe(2);
    expect(collectionManagerWithoutEM.get('coll1')).toBe(coll1);
    expect(collectionManagerWithoutEM.getCollection('coll2')).toBe(coll2); // get alias

    const collectionManagerWithEM = new CollectionManager(EventManagerMock.eventManagerMock, {
        coll1,
        coll2
    });
    expect(collectionManagerWithEM.getEventManager()).toMatchObject(EventManagerMock.eventManagerMock);

});

// Objects are added to the collection. The content is not important, so all
// collections are empty and we use toBe to ensure the object is exactly the
// same
describe('Test CollectionManager methods', () => {
    beforeEach(() => {
        EventManagerMock.mockClear();
    });

    test('test has and hasCollection', function() {

        const coll1 = new GenericCollectionImpl([]);
        const collectionManager = new CollectionManager(EventManagerMock.eventManagerMock, {
            coll1
        });
        expect(collectionManager.getSize()).toBe(1);
        expect(collectionManager.get('coll1')).toBe(coll1);

        expect(collectionManager.has('coll1')).toBe(true);
        expect(collectionManager.hasCollection('coll1')).toBe(true);
        expect(collectionManager.has('coll2')).toBe(false);
        expect(collectionManager.hasCollection('coll2')).toBe(false);

    });

    test('test set', () => {
        const coll1 = new GenericCollectionImpl([]);
        const coll2 = new GenericCollectionImpl([]);
        const coll3 = new GenericCollectionImpl([]);
        const collectionManager = new CollectionManager(EventManagerMock.eventManagerMock, {
            coll1
        });

        collectionManager.set('coll2', coll2, true);
        expect(collectionManager.getSize()).toBe(2);
        expect(collectionManager.get('coll2')).toBe(coll2);
        expect(collectionManager.has('coll2')).toBe(true);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(1, 'collection.update.coll2');
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(2, 'collections.update');

        collectionManager.set('coll3', coll3, false);
        expect(collectionManager.getSize()).toBe(3);
        expect(collectionManager.get('coll3')).toBe(coll3);
        expect(collectionManager.has('coll3')).toBe(true);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);

    });

    test('Test update', () => {
        const coll1 = new GenericCollectionImpl([]);
        const coll1b = new GenericCollectionImpl([]);
        const coll2 = new GenericCollectionImpl([]);
        const collectionManager = new CollectionManager(EventManagerMock.eventManagerMock, {
            coll1
        });

        collectionManager.update('coll1', coll1b, true);
        expect(collectionManager.getSize()).toBe(1);

        expect(collectionManager.get('coll1')).toBe(coll1b);
        expect(collectionManager.get('coll1')).not.toBe(coll1);
        expect(collectionManager.has('coll1')).toBe(true);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(1, 'collection.update.coll1');
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(2, 'collections.update');

        // Updating and unexisting collection
        collectionManager.update('coll2', coll2, false); // no refresh
        expect(collectionManager.getSize()).toBe(2);
        expect(collectionManager.get('coll2')).toBe(coll2);
        expect(collectionManager.has('coll2')).toBe(true);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);

    });

    test('Test add', () => {
        const coll1 = new GenericCollectionImpl([]);
        const coll2 = new GenericCollectionImpl([]);
        const coll3 = new GenericCollectionImpl([]);
        const coll3b = new GenericCollectionImpl([]);
        const collectionManager = new CollectionManager(EventManagerMock.eventManagerMock, {
            coll1
        });

        collectionManager.add('coll2', coll2, true);
        expect(collectionManager.getSize()).toBe(2);
        expect(collectionManager.get('coll2')).toBe(coll2);
        expect(collectionManager.has('coll2')).toBe(true);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(1, 'collection.update.coll2');
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(2, 'collections.update');

        collectionManager.add('coll3', coll3, false); // no refresh
        expect(collectionManager.getSize()).toBe(3);
        expect(collectionManager.get('coll3')).toBe(coll3);
        expect(collectionManager.has('coll3')).toBe(true);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);

        // Add an existing collection
        collectionManager.add('coll3', coll3b, false); // no refresh
        expect(collectionManager.getSize()).toBe(3);
        expect(collectionManager.get('coll3')).toBe(coll3b);
        expect(collectionManager.has('coll3')).toBe(true);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);

    });

    test('Test remove', () => {
        const coll1 = new GenericCollectionImpl([]);
        const coll2 = new GenericCollectionImpl([]);
        const coll3 = new GenericCollectionImpl([]);
        const collectionManager = new CollectionManager(EventManagerMock.eventManagerMock, {
            coll1,
            coll2,
            coll3
        });

        collectionManager.remove('coll2', false);
        expect(collectionManager.getSize()).toBe(2);
        expect(collectionManager.get('coll2')).toBeUndefined();
        expect(collectionManager.has('coll2')).toBe(false);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(0);

        collectionManager.remove('coll3', true);
        expect(collectionManager.getSize()).toBe(1);
        expect(collectionManager.get('coll3')).toBeUndefined();
        expect(collectionManager.has('coll3')).toBe(false);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenCalledTimes(2);
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(1, 'collection.update.coll3');
        expect(EventManagerMock.eventManagerMock.emit).toHaveBeenNthCalledWith(2, 'collections.update');
    })
});
