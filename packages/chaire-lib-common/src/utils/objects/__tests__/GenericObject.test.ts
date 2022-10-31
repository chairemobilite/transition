/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GenericObject, GenericAttributes } from '../GenericObject';
import { v4 as uuidV4 } from 'uuid';

class GenericObjectChild extends GenericObject<GenericAttributes>
{
    protected static displayName: string = "My Test";

    public constructor(attributes = {}, isNew = true)
    {
        super(attributes, isNew);
    }

}

class GenericObjectChildStub extends GenericObject<GenericAttributes>
{
    public constructor(attributes = {}, isNew = true)
    {
        super(attributes, isNew);
    }

}

const originalAttribs = {
    name: 'myName',
    data: {
        some: 'data',
        aNum: 34
    },
    id: uuidV4(),
    is_frozen: true,
    integer_id: 3,
    created_at: '2021-07-23T09:59:00.182Z',
    updated_at: '2021-07-23T10:02:00.182Z'
};

test('test constructor and clone', () =>
{
    // Empty object
    const emptyObject = new GenericObjectChild();
    expect(emptyObject.getId()).toBeTruthy();
    expect(emptyObject.get('data')).toEqual({ });
    expect(emptyObject.isFrozen()).toEqual(false);
    expect(emptyObject.isNew()).toEqual(true);

    const objectWithAttribs = new GenericObjectChild(originalAttribs, false);
    expect(objectWithAttribs.getId()).toEqual(originalAttribs.id);
    expect(objectWithAttribs.get('data')).toEqual({ ...originalAttribs.data });
    expect(objectWithAttribs.isFrozen()).toEqual(true);
    expect(objectWithAttribs.isNew()).toEqual(false);
    expect(objectWithAttribs.getAttributes()).toEqual({ geography: undefined, ...originalAttribs })

    // Test duplicate
    const duplicatedObject = objectWithAttribs.duplicate();
    expect(duplicatedObject.getId()).toBeTruthy();
    expect(duplicatedObject.getId()).not.toEqual(objectWithAttribs.getId());
    expect(duplicatedObject.get('data')).toEqual({ ...originalAttribs.data });
    expect(duplicatedObject.isFrozen()).toEqual(true);
    expect(duplicatedObject.isNew()).toEqual(true);
});

test('test get/set', () =>
{
    // With all properties
    const originalAttribs = {
        name: 'myName',
        data: {
            some: 'data',
            aNum: 34
        },
        id: uuidV4(),
        is_frozen: true
    };
    const object = new GenericObjectChild(originalAttribs, false);
    const newFieldName = 'newField';
    object.set(newFieldName, 1234);
    expect(object.get(newFieldName)).toEqual(1234);

    // Set empty and get default value
    object.set(newFieldName, undefined);
    expect(object.get(newFieldName)).toEqual(undefined);
    expect(object.get(newFieldName, 1111)).toEqual(1111);
    object.set(newFieldName, null);
    expect(object.get(newFieldName)).toEqual(null);
    expect(object.get(newFieldName, 1111)).toEqual(1111);

    // Set data
    object.setData(newFieldName, 1234);
    expect(object.get('data')).toEqual({ newField: 1234, ...originalAttribs.data });
    object.setData(newFieldName, undefined);
    expect(object.getData(newFieldName)).toEqual(undefined);
    expect(object.getData(newFieldName, 1111)).toEqual(1111);
    object.setData(newFieldName, null);
    expect(object.getData(newFieldName)).toEqual(null);
    expect(object.getData(newFieldName, 1111)).toEqual(1111);
});

test('test get names', () =>
{
    // With all properties
    const originalAttribs = {
        name: 'myName',
        data: {
            some: 'data',
            aNum: 34
        },
        id: uuidV4(),
        is_frozen: true
    };
    const object = new GenericObjectChild(originalAttribs, false);
    expect(object.getSingularName()).toEqual('myTest');
    expect(object.getPluralName()).toEqual('myTests');
    expect(object.getCapitalizedSingularName()).toEqual('MyTest');
    expect(object.getCapitalizedPluralName()).toEqual('MyTests');

    // Make sure the displayName affects only child class
    const baseObject = new GenericObject<GenericAttributes>(originalAttribs, false);
    expect(baseObject.getSingularName()).toEqual('genericObject');
    expect(baseObject.getPluralName()).toEqual('genericObjects');
    expect(baseObject.getCapitalizedSingularName()).toEqual('GenericObject');
    expect(baseObject.getCapitalizedPluralName()).toEqual('GenericObjects');

    const object2 = new GenericObjectChildStub(originalAttribs, false);
    expect(object2.getSingularName()).toEqual('genericObjectChildStub');
    expect(object2.getPluralName()).toEqual('genericObjectChildStubs');
    expect(object2.getCapitalizedSingularName()).toEqual('GenericObjectChildStub');
    expect(object2.getCapitalizedPluralName()).toEqual('GenericObjectChildStubs');
});

test('Clone with default or true for deleteSpecifics and isNew', () =>
{
    const objectWithAttribs = new GenericObjectChild(originalAttribs, false);

    // Test clone
    const clonedObject = objectWithAttribs.clone();
    expect(clonedObject.getId()).toBeTruthy();
    expect(clonedObject.getId()).not.toEqual(objectWithAttribs.getId());
    expect(clonedObject.get('data')).toEqual({ ...originalAttribs.data });
    expect(clonedObject.isFrozen()).toEqual(true);
    expect(clonedObject.isNew()).toEqual(true);

    const clonedObjectWithTrue = objectWithAttribs.clone(true, true);
    expect(clonedObjectWithTrue.getId()).toBeTruthy();
    expect(clonedObjectWithTrue.getId()).not.toEqual(objectWithAttribs.getId());
    expect(clonedObjectWithTrue.getAttributes().integer_id).not.toEqual(objectWithAttribs.getAttributes().integer_id);
    expect(clonedObjectWithTrue.getAttributes().created_at).not.toEqual(objectWithAttribs.getAttributes().created_at);
    expect(clonedObjectWithTrue.getAttributes().updated_at).not.toEqual(objectWithAttribs.getAttributes().updated_at);
    expect(clonedObjectWithTrue.get('data')).toEqual({ ...originalAttribs.data });
    expect(clonedObjectWithTrue.isFrozen()).toEqual(true);
    expect(clonedObject.isNew()).toEqual(true);
});

test('Clone with false for deleteSpecifics and isNew', () =>
{
    const objectWithAttribs = new GenericObjectChild(originalAttribs, false);

    // Test clone
    const clonedObjectWithFalse = objectWithAttribs.clone(false, false);
    expect(clonedObjectWithFalse.getId()).toBeTruthy();
    expect(clonedObjectWithFalse.getId()).toEqual(objectWithAttribs.getId());
    expect(clonedObjectWithFalse.getAttributes().integer_id).toEqual(objectWithAttribs.getAttributes().integer_id);
    expect(clonedObjectWithFalse.getAttributes().created_at).toEqual(objectWithAttribs.getAttributes().created_at);
    expect(clonedObjectWithFalse.getAttributes().updated_at).toEqual(objectWithAttribs.getAttributes().updated_at);
    expect(clonedObjectWithFalse.get('data')).toEqual({ ...originalAttribs.data });
    expect(clonedObjectWithFalse.isFrozen()).toEqual(true);
    expect(clonedObjectWithFalse.isNew()).toEqual(false);
});
