/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { GenericObject, GenericAttributes } from '../GenericObject';
import { ObjectWithHistory } from '../ObjectWithHistory';

const defaultAttributes = {
    name: 'Transit stop',
    color: 'red',
    geography: {
        type: 'Feature' as const,
        geometry: {
            type: 'Point' as const,
            coordinates: [-73.6, 45.5]
        },
        properties: {
            name: 'Transit stop'
        }
    }
};

class GenericObjectChildStub extends GenericObject<GenericAttributes>
{
    public constructor(attributes = {}, isNew = true)
    {
        super(attributes, isNew);
    }
}

class GenericObjectWithHistoryChildStub extends ObjectWithHistory<GenericAttributes>
{
    public constructor(attributes = {}, isNew = true)
    {
        super(attributes, isNew);
    }
}

const genericObject = new ObjectWithHistory(defaultAttributes);

test('Cannot Undo/redo at the beginning', () =>
{
    expect(genericObject.canUndo()).toEqual(false);
    expect(genericObject.canRedo()).toEqual(false);
});

test('Updating a field and undo/redo', () =>
{
    genericObject.startEditing();
    genericObject.set('color', 'green');
    expect(genericObject.get('color')).toEqual('green');
    expect(genericObject.canUndo()).toEqual(true);
    expect(genericObject.canRedo()).toEqual(false);
    genericObject.stopEditing();
    genericObject.set('color', 'red');

});

test('Undo and redo should work', () =>
{
    genericObject.startEditing();
    genericObject.set('color', 'green');
    genericObject.undo();
    expect(genericObject.get('color')).toEqual('red');
    expect(genericObject.canUndo()).toEqual(false);
    expect(genericObject.canRedo()).toEqual(true);
    genericObject.redo();
    expect(genericObject.get('color')).toEqual('green');
    expect(genericObject.canUndo()).toEqual(true);
    expect(genericObject.canRedo()).toEqual(false);
    genericObject.stopEditing();
});

test('Undo and redo should no work if is_editing is not true', () =>
{
    genericObject.undo();
    expect(genericObject.get('color')).toEqual('green');
    expect(genericObject.canUndo()).toEqual(false);
    expect(genericObject.canRedo()).toEqual(false);
});



const genericObject2 = new ObjectWithHistory(defaultAttributes);

test('Cancel edit should work', () =>
{
    genericObject2.startEditing();
    genericObject2.set('color', 'yellow');
    genericObject2.set('color', 'white');
    genericObject2.cancelEditing();
    expect(genericObject2.get('color')).toEqual('red');
    expect(genericObject.canUndo()).toEqual(false);
    expect(genericObject.canRedo()).toEqual(false);
});

test('Has changed', () =>
{
    // Test with a new object object
    const newObject = new ObjectWithHistory(defaultAttributes);
    expect(newObject.hasChanged()).toEqual(false);
    expect(newObject.hasChanged('color')).toEqual(false);
    expect(newObject.hasChanged('name')).toEqual(false);

    // If the object is not in editing mode, values can be set, but they are not part of the object's history
    newObject.set('color', 'blue');
    expect(newObject.hasChanged()).toEqual(false);
    expect(newObject.hasChanged('color')).toEqual(false);

    // Edit the object
    newObject.startEditing();
    newObject.set('color', 'yellow');
    expect(newObject.hasChanged()).toEqual(true);
    expect(newObject.hasChanged('color')).toEqual(true);
    expect(newObject.hasChanged('name')).toEqual(false);

    // Test with an existing object
    const existingObject = new ObjectWithHistory(defaultAttributes, false);
    expect(existingObject.hasChanged()).toEqual(false);
    expect(existingObject.hasChanged('color')).toEqual(false);
    expect(existingObject.hasChanged('name')).toEqual(false);

    // If the object is not in editing mode, values can be set, but they are not part of the object's history
    existingObject.set('color', 'blue');
    expect(existingObject.hasChanged()).toEqual(false);
    expect(existingObject.hasChanged('color')).toEqual(false);

    // Edit the object
    existingObject.startEditing();
    existingObject.set('color', 'yellow');
    expect(existingObject.hasChanged()).toEqual(true);
    expect(existingObject.hasChanged('color')).toEqual(true);
    expect(existingObject.hasChanged('name')).toEqual(false);

});

test('isObjectWithHistory', () => {
    const genericObjStub = new GenericObjectChildStub();
    const genericHistoryObjStub = new GenericObjectWithHistoryChildStub();

    expect(ObjectWithHistory.isObjectWithHistory(undefined)).toBe(false);
    expect(ObjectWithHistory.isObjectWithHistory(null)).toBe(false);
    expect(ObjectWithHistory.isObjectWithHistory('string')).toBe(false);
    expect(ObjectWithHistory.isObjectWithHistory(['string', 'string2'])).toBe(false);
    expect(ObjectWithHistory.isObjectWithHistory({ foo: 'bar' })).toBe(false);
    expect(ObjectWithHistory.isObjectWithHistory(genericObjStub)).toBe(false);
    expect(ObjectWithHistory.isObjectWithHistory(genericObject)).toBe(true);
    expect(ObjectWithHistory.isObjectWithHistory(genericHistoryObjStub)).toBe(true);
});
