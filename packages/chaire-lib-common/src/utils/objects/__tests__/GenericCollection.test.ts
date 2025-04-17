/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import { GenericObject, GenericAttributes } from '../GenericObject';
import GenericCollection from '../GenericCollection';

class GenericCollectionImpl extends GenericCollection<GenericObject<GenericAttributes>> {
    protected getFeatureId(feature: GenericObject<GenericAttributes>): string {
        return feature.attributes.id;
    }
}

const originalAttribs1 = {
    name: 'myName',
    data: {
        some: 'data',
        aNum: 34
    },
    id: uuidV4(),
    is_frozen: true
};

const originalAttribs2 = {
    name: 'myName2',
    data: {
        some: 'data2',
        aNum: 35
    },
    id: uuidV4(),
    is_frozen: false
};

const originalAttribs3 = {
    name: 'myName3',
    data: {
        some: 'data3',
        aNum: 36
    },
    id: uuidV4(),
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

test('test constructor with features', function() {

    const collection = new GenericCollectionImpl([feature1, feature2]);
    expect(collection.size()).toBe(2);
    expect(collection.length).toBe(2);
    expect(collection.getFeatures().length).toBe(2);
    expect(collection.getIds()).toEqual([originalAttribs1.id, originalAttribs2.id]);

});

test('test add feature', function() {

    const collection = new GenericCollectionImpl([feature1, feature2]);
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
    expect(collection.getIndex(originalAttribs3.id)).toBe(2);

});

test('test setFeatures', function() {

    const collection = new GenericCollectionImpl([feature1, feature2]);
    expect(collection.length).toBe(2);
    expect(collection.getFeatures()[0]).toMatchObject(feature1);
    expect(collection.getFeatures()[1]).toMatchObject(feature2);
    collection.setFeatures([feature1, feature3]);
    expect(collection.length).toBe(2);
    expect(collection.getFeatures()[0]).toMatchObject(feature1);
    expect(collection.getFeatures()[1]).toMatchObject(feature3);
    expect(collection.getById(originalAttribs3.id)?.getData('some')).toBe('data3');
    expect(collection.getIndex(originalAttribs3.id)).toBe(1);
    expect(collection.getIndex(originalAttribs2.id)).toBeUndefined();
    collection.setFeatures([feature2]);
    expect(collection.length).toBe(1);
    expect(collection.getIndex(originalAttribs2.id)).toBe(0);
    expect(collection.getIndex(originalAttribs3.id)).toBeUndefined();
    expect(collection.getFeatures()[0]).toMatchObject(feature2);
    expect(collection.getFeatures()[1]).toBeUndefined();
    expect(collection.getById(originalAttribs2.id)).toMatchObject(feature2);
    expect(collection.getIndex(originalAttribs1.id)).toBeUndefined();

    // test emptying features
    const collection2 = new GenericCollectionImpl([feature1, feature2, feature3]);
    collection2.setFeatures([]);
    expect(collection2.length).toBe(0);
    expect(collection2.getById(feature1.id)).toBeUndefined();
    expect(collection2.getFeatures()[0]).toBeUndefined();

});

test('test getByShortenedId', function() {

    const collection = new GenericCollectionImpl([feature1, feature2, feature3]);
    const firstCharUuid1 = feature1.id.slice(0,8);
    const firstCharUuid2 = feature2.id.slice(0,12);
    expect(collection.getByShortenedId(firstCharUuid1)).toMatchObject(feature1);
    expect(collection.getByShortenedId(firstCharUuid2)).toMatchObject(feature2);    

});

test('test updateById and updateFeature', function() {

    const collection = new GenericCollectionImpl([feature1, feature2, feature3]);
    expect(collection.getFeatures()[1]).toMatchObject(feature2);
    const feature2Clone = _cloneDeep(feature2);
    feature2Clone.set('name', 'clone');
    collection.updateById(feature1.id, feature2); // should log error (id is not the same)
    expect(collection.getFeatures()[0]).toMatchObject(feature1);
    collection.updateById(feature2.id, feature2Clone);
    expect(collection.getById(feature2Clone.id)).toMatchObject(feature2Clone);
    expect(collection.getById(feature2Clone.id)?.get('name')).toBe('clone');
    const feature2Clone2 = _cloneDeep(feature2Clone);
    feature2Clone2.set('name', 'clone2');
    collection.updateFeature(feature2Clone2);
    expect(collection.getById(feature2Clone.id)).toMatchObject(feature2Clone2);
    expect(collection.getById(feature2Clone2.id)?.get('name')).toBe('clone2');

});

test('test removeById, removeByIds and empty', function() {
    const collection = new GenericCollectionImpl([feature1, feature2, feature3]);
    expect(collection.length).toBe(3);
    collection.removeById(feature1.id);
    expect(collection.length).toBe(2);
    expect(collection.getById(feature1.id)).toBeUndefined();
    expect(collection.getFeatures()[0]).toMatchObject(feature2);
    expect(collection.getFeatures()[1]).toMatchObject(feature3);
    expect(collection.getFeatures()[2]).toBeUndefined();

    const collection2 = new GenericCollectionImpl([feature1, feature2, feature3]);
    expect(collection2.length).toBe(3);
    collection2.removeByIds([feature1.id, feature3.id]);
    expect(collection2.length).toBe(1);
    expect(collection2.getById(feature1.id)).toBeUndefined();
    expect(collection2.getById(feature3.id)).toBeUndefined();
    expect(collection2.getById(feature2.id)).toMatchObject(feature2);
    expect(collection2.getFeatures()[0]).toMatchObject(feature2);

    // make sure it works if indexes are reversed:
    const collection3 = new GenericCollectionImpl([feature1, feature2, feature3]);
    collection3.removeByIds([feature3.id, feature1.id]);
    expect(collection3.length).toBe(1);
    expect(collection3.getById(feature1.id)).toBeUndefined();
    expect(collection3.getById(feature3.id)).toBeUndefined();
    expect(collection3.getById(feature2.id)).toMatchObject(feature2);
    expect(collection3.getFeatures()[0]).toMatchObject(feature2);

    const collection4 = new GenericCollectionImpl([feature1, feature2, feature3]);
    collection4.removeByIds([feature1.id, feature2.id, feature3.id]);
    expect(collection4.length).toBe(0);
    expect(collection4.getById(feature1.id)).toBeUndefined();
    expect(collection4.getFeatures()[0]).toBeUndefined();

    const collection5 = new GenericCollectionImpl([feature1, feature2, feature3]);
    collection5.clear();
    expect(collection5.length).toBe(0);
    expect(collection5.getById(feature1.id)).toBeUndefined();
    expect(collection5.getFeatures()[0]).toBeUndefined();

});

