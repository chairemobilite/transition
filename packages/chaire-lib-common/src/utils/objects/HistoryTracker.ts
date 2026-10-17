/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _isEqual from 'lodash/isEqual';

/**
 * A class that keeps track of changes on an object and allows to undo/redo them
 */
export class HistoryTracker<T extends Readonly<{ [key: string]: unknown }>> {
    private initialData: T;
    private history: T[] = [];
    private historyIndex: number = 0;

    /**
     * Constructor
     * @param initialData The object in its initial state
     * @param maxCount The maximum number of changes to keep. Defaults to 10
     */
    constructor(
        initialData: T,
        private maxCount: number = 10
    ) {
        this.initialData = _cloneDeep(initialData);
        this.history[0] = this.initialData;
    }

    /**
     * Check if there are changes to undo
     * @returns `true` if there are changes that can be undone
     */
    canUndo = () => this.historyIndex !== 0;

    /**
     * Check if there are available changes to redo
     * @returns `true` if there are changes that can be re-done
     */
    canRedo = () => this.historyIndex !== this.history.length - 1;

    /**
     * Return the previous value of the object
     * @returns A copy of the previous value, or `undefined` if there are no changes
     */
    undo = (): T | undefined => (this.historyIndex > 0 ? _cloneDeep(this.history[--this.historyIndex]) : undefined);

    /**
     * Return the next value in history after undoing previous changes
     * @returns A copy of the next value in history, or `undefined` if there are no changes
     */
    redo = (): T | undefined =>
        this.historyIndex + 1 < this.history.length ? _cloneDeep(this.history[++this.historyIndex]) : undefined;

    /**
     * Get a current value of the object
     * @returns A copy of the  current value of the object
     */
    current = (): T => _cloneDeep(this.history[this.historyIndex]);

    /**
     * Reset the data to its initial state. This adds the initial data to the
     * history such that it is still possible to undo the reset
     * @returns The initial data
     */
    reset = (): T => {
        this.record(this.initialData);
        return this.initialData;
    };

    /**
     * Save a new current value for the object.
     * @param newData The new current value of the object
     */
    record = (newData: T) => {
        const undoCount = this.maxCount;

        // Remove all future history if we are not at the end of the history
        // (i.e. if we have undone some changes)
        if (this.historyIndex + 1 < this.history.length) {
            this.history.splice(this.historyIndex + 1, this.history.length);
        }

        // Add the new data to the history, cloning the object to freeze it
        this.history.push(_cloneDeep(newData));
        this.historyIndex++;

        // If we have reached the maximum number of changes, remove the oldest
        // changes from the history
        while (this.history.length > undoCount) {
            this.history.shift();
            this.historyIndex--;
        }
    };

    /**
     * Return whether the object has changed. If an attribute is specified, it
     * will return whether this attribute has changed from its initial value
     * @param attribute An optional attribute to check for changes
     * @returns Whether the object, or one of its attributes has changed since
     * the initial state
     */
    hasChanged(attribute?: keyof T) {
        if (attribute === undefined) {
            return !_isEqual(this.current(), this.initialData);
        } else {
            return !_isEqual(this.current()[attribute], this.initialData[attribute]);
        }
    }
}
