/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { renderHook, act } from '@testing-library/react';

import { useHistoryTracker } from '../useHistoryTracker';
import { BaseObject } from 'chaire-lib-common/lib/utils/objects/BaseObject';

type TestAttributes = {
    id?: number; // Optional ID field
    field1: string;
    field2?: number;
};

class TestObject extends BaseObject<TestAttributes> {
    protected _validate(): [boolean, string[]] {
        return [true, []];
    }
    protected _prepareAttributes(attributes: Partial<TestAttributes>): TestAttributes {
        return {
            field1: '',
            ...attributes
        }
    }
    get id() {
        return this.attributes.id;
    }
};

const defaultField1 = 'test';
const defaultField2 = undefined;
const defaultAttributes: TestAttributes = {
    field1: defaultField1
};

describe('useHistoryTracker hook', () => {
    let initialObject: TestObject;

    beforeEach(() => {
        initialObject = new TestObject(defaultAttributes);
    });

    test('Update field1 with valid value', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');

        // Call onValueChange
        act(() => {
            result.current.onValueChange('field1', { value: 'new value', valid: true });
        });

        // Check updated value
        expect(initialObject.attributes.field1).toBe('new value');
    });

    test('Update field1 with invalid value', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');

        // Call onValueChange
        act(() => {
            result.current.onValueChange('field1', { value: 'new value', valid: false });
        });

        // Check updated value
        expect(initialObject.attributes.field1).toBe('test');
    });

    test('Cannot undo/redo when no changes', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');
        
        // Should return false for undo/redo
        expect(result.current.canUndo()).toBe(false);
        expect(result.current.canRedo()).toBe(false);

        // Undo/redo should have no effect
        act(() => {
            result.current.undo();
        });
        expect(initialObject.attributes.field1).toBe('test');
        act(() => {
            result.current.redo();
        });
        expect(initialObject.attributes.field1).toBe('test');
    });

    test('Should undo previous changes', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        const updatedValue2 = 'new value 2';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
            result.current.updateHistory();
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
            result.current.updateHistory();
        });
        
        // Should be able to undo
        expect(result.current.canUndo()).toBe(true);

        // Undo last change
        let undoneObject: TestObject | undefined = undefined;
        act(() => {
            undoneObject = result.current.undo();
        });
        expect(undoneObject!.attributes.field1).toBe(updatedValue1);

        // Should still be able to undo
        expect(result.current.canUndo()).toBe(true);

        // Undo another change
        act(() => {
            undoneObject = result.current.undo();
        });
        expect(undoneObject!.attributes.field1).toBe(defaultField1);

        // No more undo
        expect(result.current.canUndo()).toBe(false);
    });

    test('Should redo undone changes', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        const updatedValue2 = 'new value 2';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
            result.current.updateHistory();
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
            result.current.updateHistory();
        });

        // Undo twice
        let changedObject: TestObject | undefined = undefined;
        act(() => {
            result.current.undo();
            changedObject = result.current.undo();
        });

        // Should be able to redo
        expect(result.current.canRedo()).toBe(true);

        // Redo last change
        act(() => {
            changedObject = result.current.redo();
        });
        expect(changedObject!.attributes.field1).toBe(updatedValue1);

        // Should still be able to redo
        expect(result.current.canRedo()).toBe(true);

        // Redo another change
        act(() => {
            changedObject = result.current.redo();
        });
        expect(changedObject!.attributes.field1).toBe(updatedValue2);

        // No more redo
        expect(result.current.canRedo()).toBe(false);
    });

    test('Should undo/redo atomically changes of multiple values', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');

        // Call onValueChange for 2 fields, and update the history only after the second change
        const updatedField1 = 'new value 1';
        const updatedField2 = 3;
        act(() => {
            result.current.onValueChange('field1', { value: updatedField1, valid: true });
            result.current.onValueChange('field2', { value: updatedField2, valid: true });
            result.current.updateHistory();
        });

        // Check values of object
        expect(initialObject.attributes.field1).toBe(updatedField1);
        expect(initialObject.attributes.field2).toBe(updatedField2);

        // Should be able to undo
        expect(result.current.canUndo()).toBe(true);
        expect(result.current.canRedo()).toBe(false);

        // Undo last change
        let changedObject: TestObject | undefined = undefined;
        act(() => {
            changedObject = result.current.undo();
        });
        expect(changedObject!.attributes.field1).toBe(defaultField1);
        expect(changedObject!.attributes.field2).toBe(defaultField2);

        // No more undo
        expect(result.current.canUndo()).toBe(false);
        expect(result.current.canRedo()).toBe(true);

        // Redo last change
        act(() => {
            changedObject = result.current.redo();
        });
        expect(changedObject!.attributes.field1).toBe(updatedField1);
        expect(changedObject!.attributes.field2).toBe(updatedField2);

        // No more redo
        expect(result.current.canRedo()).toBe(false);

    });

    test('Should undo/redo previous changes of invalid values', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial values of object and form values
        expect(initialObject.attributes.field1).toEqual(defaultField1);
        expect(result.current.formValues['field1']).toEqual(defaultField1);

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: false });
        });
        act(() => {
            result.current.updateHistory();
        });

        // Check object has not been updated, but form field has been
        expect(initialObject.attributes.field1).toBe(defaultField1);
        expect(result.current.formValues['field1']).toEqual(updatedValue1);

        // Should be able to undo
        expect(result.current.canUndo()).toBe(true);

        // Undo last change
        let undoneObject: TestObject | undefined = undefined;
        act(() => {
            undoneObject = result.current.undo();
        });
        // Check object has not been updated, but form field has been reverted
        expect(undoneObject!.attributes.field1).toBe(defaultField1);
        expect(result.current.formValues['field1']).toEqual(defaultField1);

        // Should not be able to undo anymore, but should be able to redo
        expect(result.current.canUndo()).toBe(false);
        expect(result.current.canRedo()).toBe(true);

        // Undo last change
        let redoneObject: TestObject | undefined = undefined;
        act(() => {
            redoneObject = result.current.redo();
        });
        // Check object has not been updated, but form field has been updated again
        expect(redoneObject!.attributes.field1).toBe(defaultField1);
        expect(result.current.formValues['field1']).toEqual(updatedValue1);
    });

    test('Update field1 with valid value and check invalid fields', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Call onValueChange
        act(() => {
            result.current.onValueChange('field1', { value: 'new value', valid: true });
        });

        // Check that there are no invalid fields
        expect(result.current.hasInvalidFields()).toBe(false);
    });

    test('Update field1 with invalid value and check invalid fields', () => {
        const { result } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Call onValueChange with invalid value
        act(() => {
            result.current.onValueChange('field1', { value: 'new value', valid: false });
        });

        // Check that there are invalid fields
        expect(result.current.hasInvalidFields()).toBe(true);
    });

    test('Should use same history tracker when re-rendering with same object without ID', () => {
        const { result, rerender } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        const updatedValue2 = 'new value 2';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });

        // Re-render with same object
        rerender({ object: initialObject });

        // Should be able to undo
        expect(result.current.canUndo()).toBe(true);

        // Re-render with another object, but with same id, should still keep history
        const newObjectSameId = new TestObject({ field1: 'new value for field1' });
        rerender({ object: newObjectSameId });
        expect(result.current.canUndo()).toBe(true);
    });

    test('Should use same history tracker when re-rendering with object with same ID', () => {
        const objectId = 1;
        const testObjectWithId = new TestObject({ ...defaultAttributes, id: objectId });
        const { result, rerender } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: testObjectWithId } });

        // Check initial value
        expect(testObjectWithId.attributes.field1).toBe('test');

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        const updatedValue2 = 'new value 2';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });

        // Re-render with same object
        rerender({ object: testObjectWithId });

        // Should be able to undo
        expect(result.current.canUndo()).toBe(true);

        // Re-render with another object, but with same id, should still keep history
        const newObjectSameId = new TestObject({ field1: 'new value for field1', id: objectId });
        rerender({ object: newObjectSameId });
        expect(result.current.canUndo()).toBe(true);
    });

    test('Should use same history tracker and follow history after undoing/redoing ', () => {
        const objectId = 1;
        let objectChangeCount = 0;
        const testObjectWithId = new TestObject({ ...defaultAttributes, id: objectId });
        const { result, rerender } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: testObjectWithId, changeCount: objectChangeCount } });

        // Check initial value
        expect(testObjectWithId.attributes.field1).toBe('test');

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        const updatedValue2 = 'new value 2';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
            result.current.updateHistory();
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
            result.current.updateHistory();
        });

        // Re-render with same object
        rerender({ object: testObjectWithId, changeCount: objectChangeCount++ });

        // Undo last change
        let changedObject: TestObject | undefined = undefined;
        act(() => {
            changedObject = result.current.undo();
        });
        expect(changedObject!.attributes.field1).toBe(updatedValue1);
        expect(changedObject!.attributes.field2).toBe(defaultField2);

        // Re-render with changed object
        rerender({ object: changedObject!, changeCount: objectChangeCount++ });

        // Make a new change to each field
        const updatedValue3 = 'new value 3';
        const updatedValue4 = 3;
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue3, valid: true });
            result.current.updateHistory();
            result.current.onValueChange('field2', { value: updatedValue4, valid: true });
            result.current.updateHistory();
        });

        // Undo last change
        act(() => {
            changedObject = result.current.undo();
        });
        expect(changedObject!.attributes.field1).toBe(updatedValue3);
        expect(changedObject!.attributes.field2).toBe(defaultField2);

        rerender({ object: changedObject!, changeCount: objectChangeCount++ });

        // Make 2 changes to field1 again
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
            result.current.updateHistory();
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
            result.current.updateHistory();
        });

        // Undo change. If the object reference did not update correctly, the resulting object will not be correct
        act(() => {
            changedObject = result.current.undo();
        });
        expect(changedObject!.attributes.field1).toBe(updatedValue2);
        expect(changedObject!.attributes.field2).toBe(defaultField2);

        rerender({ object: changedObject!, changeCount: objectChangeCount++ });
        expect(result.current.canUndo()).toBe(true);
    });

    test('Should use new history tracker when re-rendering an object with different ID', () => {
        const objectId = 1;
        const testObjectWithId = new TestObject({ ...defaultAttributes, id: objectId });
        const { result, rerender } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: testObjectWithId } });

        // Check initial value
        expect(testObjectWithId.attributes.field1).toBe('test');

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        const updatedValue2 = 'new value 2';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });
        // Make sure we can undo with current object
        expect(result.current.canUndo()).toBe(true);

        // Re-render with an object with different ID
        const newObject = new TestObject({ ...defaultAttributes, id: objectId + 1 });
        rerender({ object: newObject });
        expect(result.current.canUndo()).toBe(false);
    });

    test('Should use new history tracker when an object without ID now has one', () => {
        // Start with the initial object without ID
        const { result, rerender } = renderHook((props) => useHistoryTracker(props), { initialProps: { object: initialObject } });

        // Check initial value
        expect(initialObject.attributes.field1).toBe('test');

        // Call onValueChange twice, with an history update
        const updatedValue1 = 'new value 1';
        const updatedValue2 = 'new value 2';
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue1, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });
        act(() => {
            result.current.onValueChange('field1', { value: updatedValue2, valid: true });
        });
        act(() => {
            result.current.updateHistory();
        });
        // Make sure we can undo with current object
        expect(result.current.canUndo()).toBe(true);

        // Re-render with the same object with its ID set
        initialObject.set('id', 3);
        rerender({ object: initialObject });
        expect(result.current.canUndo()).toBe(false);
    });
});