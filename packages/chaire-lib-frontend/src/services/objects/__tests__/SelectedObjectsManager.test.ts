/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { EventEmitter } from 'events';
import SelectedObjectsManager from '../SelectedObjectsManager'; // Adjust path as needed

// Test object classes with different id implementations
class BasicObject {
    constructor(public id: string) {
        return;
    }
}

class ObjectWithGetter {
    private _id: string;

    constructor(id: string) {
        this._id = id;
    }

    get id(): string {
        return this._id;
    }
}

class ObjectWithMethod {
    private _id: string;

    constructor(id: string) {
        this._id = id;
    }

    id() {
        return this._id;
    }
}

class ObjectWithoutId {
    private _name: string;

    constructor(name: string) {
        this._name = name;
    }

    get name(): string {
        return this._name;
    }
}

describe('SelectedObjectsManager', () => {
    let eventEmitter: EventEmitter;
    let manager: SelectedObjectsManager;

    // Mock for event emitter to track emitted events
    const emitSpy = jest.fn();

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Create new event emitter and manager for each test
        eventEmitter = new EventEmitter();
        eventEmitter.emit = emitSpy;
        manager = new SelectedObjectsManager(eventEmitter);
    });

    describe('initObjectType', () => {
        it('should initialize an empty array for a new object type', () => {
            manager.initObjectType('testType');
            expect(manager.getSelection('testType')).toEqual([]);
        });

        it('should not overwrite existing object type collections', () => {
            // Add some objects first
            manager.initObjectType('testType');
            manager.setSelection('testType', [new BasicObject('1'), new BasicObject('2')]);

            // Reinitialize the same type
            manager.initObjectType('testType');

            // Selection should remain
            expect(manager.getSelection('testType')).toHaveLength(2);
        });
    });

    describe('addToSelection', () => {
        it('should add an object to the selection for a type', () => {
            const obj = new BasicObject('test');
            manager.addToSelection('testType', obj);

            expect(manager.getSelection('testType')).toContain(obj);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
        });

        it('should initialize object type if it does not exist', () => {
            const obj = new BasicObject('test');
            manager.addToSelection('newType', obj);

            expect(manager.getSelection('newType')).toContain(obj);
        });

        it('should log an error and do nothing when trying to add an already selected object', () => {
            // Mock console.error
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const obj = new BasicObject('test');

            // First add is fine
            manager.addToSelection('testType', obj);
            expect(manager.getSelection('testType')).toHaveLength(1);
            expect(consoleErrorSpy).not.toHaveBeenCalled();

            // Reset emit spy
            emitSpy.mockClear();

            // Second add should be ignored
            manager.addToSelection('testType', obj);
            expect(manager.getSelection('testType')).toHaveLength(1);
            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(emitSpy).not.toHaveBeenCalled();

            // Clean up
            consoleErrorSpy.mockRestore();
        });

        it('should work with objects that use getter for id property', () => {
            const obj = new ObjectWithGetter('test');
            manager.addToSelection('testType', obj);

            expect(manager.getSelection('testType')).toContain(obj);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
        });

        it('should handle objects with id as a method incorrectly', () => {
            // Objects with id as a method will be added, but the id used
            // will be the function reference itself, not the intended string
            const obj = new ObjectWithMethod('test') as any;
            manager.addToSelection('testType', obj);
            expect(emitSpy).not.toHaveBeenCalledWith('selected.update.testType');

            // The object is ignored
            expect(manager.getSelection('testType')).toHaveLength(0);
            expect(manager.getSelection('testType')[0]).toBe(undefined);

        });

        it('should handle objects without an id property', () => {

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            // Objects without an id property will be ignored
            const obj = new ObjectWithoutId('test') as any;
            manager.addToSelection('testType', obj);

            // The object is added
            expect(manager.getSelection('testType')).toHaveLength(0);
            expect(manager.getSelection('testType')[0]).toBe(undefined);

            // But the id is undefined
            expect(obj.id).toBeUndefined();

            // This means isSelected won't work as expected
            expect(manager.isSelected('testType', 'test')).toBe(false);
            expect(manager.isSelected('nonExistingType', 'test')).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('removeFromSelection', () => {
        it('should remove an object from the selection', () => {
            const obj1 = new BasicObject('test1');
            const obj2 = new BasicObject('test2');

            // Add objects
            manager.addToSelection('testType', obj1);
            manager.addToSelection('testType', obj2);

            // Reset emit spy
            emitSpy.mockClear();

            // Remove one object
            manager.removeFromSelection('testType', obj1);

            expect(manager.getSelection('testType')).not.toContain(obj1);
            expect(manager.getSelection('testType')).toContain(obj2);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
        });

        it('should do nothing if the object is not in the selection', () => {
            const obj1 = new BasicObject('test1');
            const obj2 = new BasicObject('test2');

            // Add one object
            manager.addToSelection('testType', obj1);

            // Reset emit spy
            emitSpy.mockClear();

            // Try to remove an object that isn't in the selection
            manager.removeFromSelection('testType', obj2);

            expect(manager.getSelection('testType')).toContain(obj1);
            expect(emitSpy).not.toHaveBeenCalled();
        });

        it('should initialize object type if it does not exist', () => {
            const obj = new BasicObject('test');
            manager.removeFromSelection('newType', obj);

            expect(manager.getSelection('newType')).toEqual([]);
        });
    });

    describe('setSelection', () => {
        it('should replace the current selection with a new one', () => {
            const obj1 = new BasicObject('test1');
            const obj2 = new BasicObject('test2');
            const obj3 = new BasicObject('test3');

            // Add initial objects
            manager.addToSelection('testType', obj1);
            manager.addToSelection('testType', obj2);

            // Reset emit spy
            emitSpy.mockClear();

            // Set new selection
            manager.setSelection('testType', [obj2, obj3]);

            expect(manager.getSelection('testType')).toHaveLength(2);
            expect(manager.getSelection('testType')).not.toContain(obj1);
            expect(manager.getSelection('testType')).toContain(obj2);
            expect(manager.getSelection('testType')).toContain(obj3);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
        });

        it('should initialize object type if it does not exist', () => {
            const objects = [new BasicObject('test1'), new BasicObject('test2')];
            manager.setSelection('newType', objects);

            expect(manager.getSelection('newType')).toEqual(objects);
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.newType');
        });
    });

    describe('replaceSelection', () => {
        it('should be an alias for setSelection', () => {
            // Mock setSelection
            const setSelectionSpy = jest.spyOn(manager, 'setSelection');

            const objects = [new BasicObject('test1'), new BasicObject('test2')];
            manager.replaceSelection('testType', objects);

            expect(setSelectionSpy).toHaveBeenCalledWith('testType', objects);
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
        });
    });

    describe('deselect', () => {
        it('should clear the selection for an object type', () => {
            // Add some objects
            manager.addToSelection('testType', new BasicObject('test1'));
            manager.addToSelection('testType', new BasicObject('test2'));

            // Reset emit spy
            emitSpy.mockClear();

            // Deselect testType
            manager.deselect('testType');

            expect(manager.getSelection('testType')).toHaveLength(0);
            expect(emitSpy).toHaveBeenCalledTimes(2);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.testType');
        });
    });

    describe('isSelected', () => {
        it('should return true if the object is in the selection', () => {
            const obj = new BasicObject('test');
            manager.addToSelection('testType', obj);

            expect(manager.isSelected('testType', 'test')).toBe(true);
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
        });

        it('should return false if the object is not in the selection', () => {
            const obj = new BasicObject('test1');
            manager.addToSelection('testType', obj);

            expect(manager.isSelected('testType', 'test2')).toBe(false);
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');
        });
    });

    describe('getSelection', () => {
        it('should return the selected objects for a type', () => {
            const objects = [new BasicObject('test1'), new BasicObject('test2')];
            manager.setSelection('testType', objects);
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.testType');

            expect(manager.getSelection('testType')).toEqual(objects);
        });

        it('should return an empty array for a non-initialized type', () => {
            expect(manager.getSelection('nonExistentType')).toEqual([]);
            expect(emitSpy).not.toHaveBeenCalled();
        });
    });

    describe('getSelection', () => {
        it('should be an alias for get', () => {
            const objects = [new BasicObject('test1'), new BasicObject('test2')];
            manager.setSelection('testType', objects);

            expect(manager.getSelection('testType')).toEqual(objects);
            expect(manager.getSelection('testType')).toEqual(manager.getSelections()['testType']);
        });
    });

    describe('getSelections', () => {
        it('should return all selections as an object', () => {
            // Add selections of different types
            const obj1 = new BasicObject('test1');
            const obj2 = new BasicObject('test2');
            const obj3 = new BasicObject('test3');

            manager.addToSelection('typeA', obj1);
            manager.addToSelection('typeB', obj2);
            manager.addToSelection('typeB', obj3);

            const allSelections = manager.getSelections();

            // Verify structure and content
            expect(allSelections).toEqual(manager['_selectedCollectionByObjectType']);
            expect(Object.keys(allSelections)).toHaveLength(2);
            expect(allSelections['typeA']).toHaveLength(1);
            expect(allSelections['typeB']).toHaveLength(2);
            expect(allSelections['typeA'][0]).toBe(obj1);
            expect(allSelections['typeB']).toContain(obj2);
            expect(allSelections['typeB']).toContain(obj3);
        });

        it('should return an empty object when no selections exist', () => {
            const allSelections = manager.getSelections();
            expect(allSelections).toEqual({});
            expect(Object.keys(allSelections)).toHaveLength(0);
        });

        it('should return a copy, not a reference of the array', () => {
            // Add initial selection
            const obj = new BasicObject('test');
            manager.addToSelection('testType', obj);

            // Get reference to selections
            const allSelections = manager.getSelections();

            // Make changes through the manager
            const newObj = new BasicObject('newTest');
            manager.addToSelection('testType', newObj);

            // Verify changes are not reflected in our reference
            expect(allSelections['testType']).toHaveLength(1);
            expect(allSelections['testType'][1]).not.toBe(newObj);

        });
    });

    describe('deselectAll', () => {
        it('should clear all selections across all object types by calling deselect on each type', () => {
            // Set up multiple selections of different types
            const obj1 = new BasicObject('test1');
            const obj2 = new BasicObject('test2');
            const obj3 = new BasicObject('test3');

            manager.addToSelection('typeA', obj1);
            manager.addToSelection('typeB', obj2);
            manager.addToSelection('typeC', obj3);

            // Verify we have selections before clearing
            expect(Object.keys(manager.getSelections())).toHaveLength(3);

            // Spy on the deselect method
            const deselectSpy = jest.spyOn(manager, 'deselect');

            // Reset emit spy to track new events
            emitSpy.mockClear();

            // Execute the method
            manager.deselectAll();

            // Verify deselect was called for each type
            expect(deselectSpy).toHaveBeenCalledTimes(3);
            expect(deselectSpy).toHaveBeenCalledWith('typeA');
            expect(deselectSpy).toHaveBeenCalledWith('typeB');
            expect(deselectSpy).toHaveBeenCalledWith('typeC');

            // Each deselect call will emit a "selected.set.${type}" event
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeA');
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeB');
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeC');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.typeA');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.typeB');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.typeC');
            expect(emitSpy).toHaveBeenCalledTimes(6);

            // Verify all selections are empty but keys still exist
            expect(Object.keys(manager.getSelections())).toHaveLength(3);
            expect(manager.getSelection('typeA')).toEqual([]);
            expect(manager.getSelection('typeB')).toEqual([]);
            expect(manager.getSelection('typeC')).toEqual([]);

            // Clean up
            deselectSpy.mockRestore();
        });

        it('should do nothing when there are no selections to clear', () => {
            // Start with an empty manager
            expect(Object.keys(manager.getSelections())).toHaveLength(0);

            // Spy on the deselect method
            const deselectSpy = jest.spyOn(manager, 'deselect');

            // Reset emit spy
            emitSpy.mockClear();

            // Execute the method
            manager.deselectAll();

            // Verify no events were emitted and deselect wasn't called
            expect(deselectSpy).not.toHaveBeenCalled();
            expect(emitSpy).not.toHaveBeenCalled();

            // Clean up
            deselectSpy.mockRestore();
        });

        it('should maintain object type keys after deselecting', () => {
            // Add some selections
            manager.addToSelection('typeA', new BasicObject('test1'));

            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeA');

            emitSpy.mockClear();
            // Clear all
            manager.deselectAll();
            expect(emitSpy).toHaveBeenCalledTimes(2);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeA');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.typeA');

            emitSpy.mockClear();
            // Verify the type still exists but is empty
            expect(manager.getSelection('typeA')).toEqual([]);
            expect(manager.getSelections()['typeA']).toBeDefined();
            expect(manager.getSelections()['typeA']).toHaveLength(0);

            // Add a new item to the existing type
            const newObj = new BasicObject('new');
            manager.addToSelection('typeA', newObj);
            expect(emitSpy).toHaveBeenCalledTimes(1);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeA');

            // Verify it was added correctly
            expect(manager.getSelection('typeA')).toContain(newObj);

        });

        it('should call deselect in the correct order for all types', () => {
            // Mock implementation of deselect to track call order
            const callOrder: any[] = [];
            const originalDeselect = manager.deselect;
            manager.deselect = jest.fn((type) => {
                callOrder.push(type);
                originalDeselect.call(manager, type);
            });

            // Add selections in specific order
            manager.addToSelection('typeC', new BasicObject('test3'));
            manager.addToSelection('typeA', new BasicObject('test1'));
            manager.addToSelection('typeB', new BasicObject('test2'));
            expect(emitSpy).toHaveBeenCalledTimes(3);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeA');
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeB');
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeC');

            emitSpy.mockClear();
            // Clear all
            manager.deselectAll();
            expect(emitSpy).toHaveBeenCalledTimes(6);
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeA');
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeB');
            expect(emitSpy).toHaveBeenCalledWith('selected.update.typeC');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.typeA');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.typeB');
            expect(emitSpy).toHaveBeenCalledWith('selected.deselect.typeC');

            // Verify the order matches the object property iteration order
            const expectedOrder = Object.keys(manager.getSelections());
            expect(callOrder).toEqual(expectedOrder);

            // Restore original method
            manager.deselect = originalDeselect;
        });
    });

    describe('getSingleSelection', () => {
        it('should return the object when exactly one object is selected', () => {
            // Add a single object
            const obj = new BasicObject('test');
            manager.addToSelection('testType', obj);

            // Get the single selection
            const result = manager.getSingleSelection('testType');

            // Verify result is the object
            expect(result).toBe(obj);
        });

        it('should return undefined when no objects are selected', () => {
            // Initialize type but don't add any objects
            manager.initObjectType('testType');

            // Get the single selection
            const result = manager.getSingleSelection('testType');

            // Verify result is undefined
            expect(result).toBeUndefined();
        });

        it('should return undefined when multiple objects are selected', () => {
            // Add multiple objects
            const obj1 = new BasicObject('test1');
            const obj2 = new BasicObject('test2');
            manager.addToSelection('testType', obj1);
            manager.addToSelection('testType', obj2);

            // Get the single selection
            const result = manager.getSingleSelection('testType');

            // Verify result is undefined
            expect(result).toBeUndefined();
        });

        it('should return undefined when the object type does not exist', () => {
            // Get the single selection for a non-existent type
            const result = manager.getSingleSelection('nonExistentType');

            // Verify result is undefined
            expect(result).toBeUndefined();
        });

        it('should use getSelection under the hood', () => {
            // Spy on getSelection
            const getSelectionSpy = jest.spyOn(manager, 'getSelection');

            // Add a single object
            const obj = new BasicObject('test');
            manager.addToSelection('testType', obj);

            // Get the single selection
            manager.getSingleSelection('testType');

            // Verify getSelection was called
            expect(getSelectionSpy).toHaveBeenCalledWith('testType');

            // Clean up
            getSelectionSpy.mockRestore();
        });

        it('should handle changes to selection correctly', () => {
            // Add a single object initially
            const obj1 = new BasicObject('test1');
            manager.addToSelection('testType', obj1);

            // Initial check - should return the object
            expect(manager.getSingleSelection('testType')).toBe(obj1);

            // Add another object
            const obj2 = new BasicObject('test2');
            manager.addToSelection('testType', obj2);

            // Should now return undefined (multiple objects)
            expect(manager.getSingleSelection('testType')).toBeUndefined();

            // Remove first object
            manager.removeFromSelection('testType', obj1);

            // Should return the remaining single object
            expect(manager.getSingleSelection('testType')).toBe(obj2);

            // Remove last object
            manager.removeFromSelection('testType', obj2);

            // Should return undefined (no objects)
            expect(manager.getSingleSelection('testType')).toBeUndefined();
        });
    });
});
