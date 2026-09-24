/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { HistoryTracker } from '../HistoryTracker';

type TestType = {
    id: number;
    value: number;
    optionalField?: string;
}

describe('HistoryTracker', () => {
    let tracker: HistoryTracker<TestType>;
    const initialData: TestType = { id: 1, value: 10 };

    beforeEach(() => {
        tracker = new HistoryTracker(initialData);
    });

    test('should initialize with original data', () => {
        expect(tracker.current()).toEqual(initialData);
    });

    test('should have no possible changes when no changes recorded', () => {
        expect(tracker.canUndo()).toEqual(false);
        expect(tracker.canRedo()).toEqual(false);
        expect(tracker.hasChanged()).toEqual(false);
        expect(tracker.hasChanged('value')).toEqual(false);
        expect(tracker.undo()).toBeUndefined();
        expect(tracker.redo()).toBeUndefined();
    })

    test('should record changes and undo them', () => {
        const newData: TestType = { id: 1, value: 20 };
        tracker.record(newData);
        expect(tracker.current()).toEqual(newData);

        expect(tracker.canUndo()).toEqual(true);
        expect(tracker.canRedo()).toEqual(false);
        const undoneData = tracker.undo();
        expect(undoneData).toEqual(initialData);
        expect(tracker.current()).toEqual(initialData);
    });

    test('should redo changes after undo', () => {
        const newData: TestType = { id: 1, value: 20 };
        tracker.record(newData);
        tracker.undo();

        expect(tracker.canUndo()).toEqual(false);
        expect(tracker.canRedo()).toEqual(true);
        const redoneData = tracker.redo();
        expect(redoneData).toEqual(newData);
        expect(tracker.current()).toEqual(newData);
    });

    test('should not undo past the initial state', () => {
        tracker.undo();
        expect(tracker.current()).toEqual(initialData);
    });

    test('should not redo past the latest state', () => {
        const newData: TestType = { id: 1, value: 20 };
        tracker.record(newData);
        tracker.redo();
        expect(tracker.current()).toEqual(newData);
    });

    test('should undo additional of an optional fields', () => {
        // Update an optional field
        const newDataWithOptionalField: TestType = { ...initialData, optionalField: 'test' };
        tracker.record(newDataWithOptionalField);
        tracker.undo();

        expect(tracker.current()).toEqual({ ...initialData, optionalField: undefined });
    });

    test('should redo removal of an optional fields', () => {
        // Record a change with the optional field set
        const newDataWithOptionalField: TestType = { ...initialData, optionalField: 'test' };
        tracker.record(newDataWithOptionalField);
        // Reset the optional field to undefined
        tracker.record(initialData);

        // Undo and make sure the optional field is set
        tracker.undo();
        expect(tracker.current()).toEqual(newDataWithOptionalField);

        // Redo and make sure the optional field is removed
        tracker.redo();
        expect(tracker.current()).toEqual(initialData);
    });

    test('should reset to original data', () => {
        const newData: TestType = { id: 1, value: 20 };
        tracker.record(newData);
        const resetData = tracker.reset();
        expect(tracker.current()).toEqual(initialData);
        expect(resetData).toEqual(initialData);
        
        // Make sure reset can be undone
        const undoneData = tracker.undo();
        expect(undoneData).toEqual(newData);
    });

    test('should reset future history with new changes after undo', () => {
        // Add 3 elements
        for (let i = 1; i <= 3; i++) {
            tracker.record({ id: 1, value: 10 + i });
        }
        // Undo 2 of them
        tracker.undo();
        tracker.undo();
        expect(tracker.canRedo()).toEqual(true);

        // Record a new change
        tracker.record({ id: 1, value: 20 });
        expect(tracker.canRedo()).toEqual(false);
    })

    test('should limit history to maxCount', () => {
        const maxCount = 5;
        tracker = new HistoryTracker(initialData, maxCount);

        for (let i = 1; i <= maxCount + 2; i++) {
            tracker.record({ id: 1, value: 10 + i });
        }

        expect(tracker.canUndo()).toBe(true);
        for (let i = 0; i < maxCount; i++) {
            tracker.undo();
        }
        expect(tracker.canUndo()).toBe(false);
        expect(tracker.current()).toEqual({ id: 1, value: 13 });
    });

    test('should detect changes', () => {
        const newData: TestType = { id: 1, value: 20 };
        expect(tracker.hasChanged()).toBe(false);
        tracker.record(newData);
        expect(tracker.hasChanged()).toBe(true);
    });

    test('should detect attribute changes', () => {
        const newData: TestType = { id: 1, value: 20 };
        expect(tracker.hasChanged('value')).toBe(false);
        tracker.record(newData);
        expect(tracker.hasChanged('value')).toBe(true);
        expect(tracker.hasChanged('id')).toBe(false);
    });

    test('should have a copy of the object to record', () => {
        const newData: TestType = { id: 1, value: 20 };
        tracker.record(newData);
        // Change the data
        newData.value = 30;
        expect(tracker.current()).toEqual({ id: 1, value: 20 });
    });
});
