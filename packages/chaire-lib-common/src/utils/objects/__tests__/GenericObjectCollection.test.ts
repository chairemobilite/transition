/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';

import { GenericObject, GenericAttributes } from '../GenericObject';
import GenericObjectCollection from '../GenericObjectCollection';
import CollectionManager from '../CollectionManager';

class GenericObjectCollectionImpl extends GenericObjectCollection<GenericObject<GenericAttributes>> {
    
    newObject(attribs: Partial<GenericAttributes>, isNew = false, _collectionManager?: any): GenericObject<GenericAttributes> {
       
        return new GenericObject(attribs, isNew);
    }
}

const originalAttribs1 = {
    name: 'myName',
    data: {
        some: 'data',
        aNum: 34
    },
    id: uuidV4(),
    internal_id: 'iid1',
    shortname: 'sn1',
    is_frozen: true
};

const originalAttribs2 = {
    name: 'myName2',
    data: {
        some: 'data2',
        aNum: 35
    },
    id: uuidV4(),
    internal_id: 'iid2',
    shortname: 'sn2',
    is_frozen: false
};

const originalAttribs3 = {
    name: 'myName3',
    data: {
        some: 'data3',
        aNum: 36
    },
    id: uuidV4(),
    shortname: 'sn3',
    internal_id: 'iid3',
    is_frozen: null,
    foo: {
        bar: {
            foo2: {
                bar2: 99
            }
        }
    }
};

const feature1 = new GenericObject(originalAttribs1);
const feature2 = new GenericObject(originalAttribs2);
const feature3 = new GenericObject(originalAttribs3);

test('test constructor with no features', function() {

    const immCollection = new GenericObjectCollectionImpl([]);
    expect(immCollection.size()).toBe(0);
    expect(immCollection.length).toBe(0);
    expect(immCollection.getFeatures().length).toBe(0);
    expect(immCollection.getIds()).toEqual([]);

});

test('test collection attributes', function() {

    const attributes = {
        foo: 'bar',
        bar: ['foo', 'bar'],
        foobar: { 
            foo: 'bar', 
            bar: ['foo', 'bar']
        }
    };
    const immCollection = new GenericObjectCollectionImpl([], attributes);

    expect(immCollection.getAttributes()).toEqual(attributes);

});

test('test constructor with features', function() {

    const immCollection = new GenericObjectCollectionImpl([feature1, feature2]);

    expect(immCollection.size()).toBe(2);
    expect(immCollection.length).toBe(2);
    expect(immCollection.getFeatures().length).toBe(2);
    expect(immCollection.getFeatures()[0]?.getAttributes()).toEqual(originalAttribs1);
    expect(immCollection.getFeatures()[1]?.getAttributes()).toEqual(originalAttribs2);
    expect(immCollection.getFeatures()[2]?.getAttributes()).toBeUndefined();
    expect(immCollection.getById(originalAttribs2.id)?.getAttributes()).toEqual(originalAttribs2);
    expect(immCollection.getById(uuidV4())).toBeUndefined();
    expect(immCollection.getIds()).toEqual([originalAttribs1.id, originalAttribs2.id]);
    expect(immCollection.getIndex(uuidV4())).toBeUndefined();
    expect(immCollection.getIndex(originalAttribs1.id)).toBe(0);
    expect(immCollection.getIndex(originalAttribs2.id)).toBe(1);
    expect(immCollection.getIndexByInternalId(originalAttribs1.internal_id)).toBeUndefined();
    expect(immCollection.getIndexByShortname(originalAttribs1.shortname)).toBeUndefined();

    // Test the features getter
    expect(immCollection.features.length).toBe(2);
    expect(immCollection.features[0]?.getAttributes()).toEqual(originalAttribs1);
    expect(immCollection.features[1]?.getAttributes()).toEqual(originalAttribs2);
    expect(immCollection.features[2]?.getAttributes()).toBeUndefined();

});

test('test index by internal_id', function() {

    const immCollection = new GenericObjectCollectionImpl([feature1, feature2], {}, true);

    expect(immCollection.getIndexByInternalId('foo')).toBeUndefined();
    expect(immCollection.getIndexByInternalId(originalAttribs1.internal_id)).toBe(0);
    expect(immCollection.getByInternalId(originalAttribs1.internal_id)).toMatchObject(feature1);
    expect(immCollection.getByInternalId(originalAttribs2.internal_id)).toMatchObject(feature2);

});

test('test index by shortname', function() {

    const immCollection = new GenericObjectCollectionImpl([feature1, feature2], {}, false, true);

    expect(immCollection.getIndexByShortname('foo')).toBeUndefined();
    expect(immCollection.getIndexByShortname(originalAttribs1.shortname)).toBe(0);
    expect(immCollection.getByShortname(originalAttribs1.shortname)).toMatchObject(feature1);
    expect(immCollection.getByShortname(originalAttribs2.shortname)).toMatchObject(feature2);

});

test('test forJson with optional parser', function() {

    const parser1 = function(_object) {
        const object = _cloneDeep(_object);
        object.name += ' modified';
        object.foo = 'bar';
        object.bar = {foo: 'bar'};
        object.fooArray = [1,2,3,'bar'];
        return object;
    };

    const parser2 = function(_object) {
        return _object;
    }

    const immCollection = new GenericObjectCollectionImpl([feature1, feature2], {});

    const jsonDataParser1 = immCollection.forJson(parser1);
    const jsonDataParser2 = immCollection.forJson(parser2);
    const jsonDataParserNull = immCollection.forJson(null);
    const jsonDataNoParser = immCollection.forJson(undefined);

    const expected1 = {
        name: 'myName modified',
        data: {
            some: 'data',
            aNum: 34
        },
        id: feature1.getId(),
        is_frozen: true,
        internal_id: 'iid1',
        shortname: 'sn1',
        foo: 'bar',
        bar: {foo: 'bar'},
        fooArray: [1,2,3,'bar']
    };

    const expected2 = {
        name: 'myName2 modified',
        data: {
            some: 'data2',
            aNum: 35
        },
        id: feature2.getId(),
        is_frozen: false,
        internal_id: 'iid2',
        shortname: 'sn2',
        foo: 'bar',
        bar: {foo: 'bar'},
        fooArray: [1,2,3,'bar']
    };

    expect(jsonDataParser1).toEqual([expected1, expected2]);
    expect(jsonDataParser2).toEqual([originalAttribs1, originalAttribs2]);
    expect(jsonDataParserNull).toEqual([originalAttribs1, originalAttribs2]);
    expect(jsonDataNoParser).toEqual([originalAttribs1, originalAttribs2]);

});

test('test getByAttribute', function() {

    const collection = new GenericObjectCollectionImpl([feature1, feature2, feature3]);
    expect(collection.getByAttribute('name', 'myName2')[0]).toMatchObject(feature2);
    expect(collection.getByAttribute('data.aNum', 34)[0]).toMatchObject(feature1);
    expect(collection.getByAttribute('foo.bar.foo2.bar2', 99)[0]).toMatchObject(feature3);
    const isFrozenFalse = collection.getByAttribute('is_frozen', false);
    expect(isFrozenFalse[0]).toMatchObject(feature2);
    expect(isFrozenFalse[1]).toMatchObject(feature3);

});

test('test add and index', function() {

    const collection = new GenericObjectCollectionImpl([feature1, feature2], {}, true, true);
    expect(collection.size()).toBe(2);
    expect(collection.length).toBe(2);
    expect(collection.getFeatures().length).toBe(2);
    collection.add(feature3);
    expect(collection.size()).toBe(3);
    expect(collection.length).toBe(3);
    expect(collection.getFeatures().length).toBe(3);
    expect(collection.getFeatures()[2]?.getData('some')).toBe('data3');
    expect(collection.getById(originalAttribs3.id)?.getData('aNum')).toBe(36);
    expect(collection.getById(uuidV4())).toBeUndefined();
    expect(collection.getIds()).toEqual([originalAttribs1.id, originalAttribs2.id, originalAttribs3.id]);
    expect(collection.getIndex(uuidV4())).toBeUndefined();
    expect(collection.getIndex(originalAttribs3.id)).toEqual(2);
    expect(collection.getIndexByInternalId(originalAttribs3.internal_id)).toEqual(2);
    expect(collection.getIndexByShortname(originalAttribs3.shortname)).toEqual(2);
});
