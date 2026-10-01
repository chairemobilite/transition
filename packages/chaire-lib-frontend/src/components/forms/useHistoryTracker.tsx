/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import _cloneDeep from 'lodash/cloneDeep';
import _isEqual from 'lodash/isEqual';

import { BaseObject } from 'chaire-lib-common/lib/utils/objects/BaseObject';
import { HistoryTracker } from 'chaire-lib-common/lib/utils/objects/HistoryTracker';

export type WithHistoryTracker<T extends BaseObject<Record<string, unknown>>> = {
    /**
     * Callback to call when the value of an object's attribute is changed. If
     * the value is valid, it will mutate the object, by calling the `set`
     * function, but it will not track the change. If the value is invalid, it
     * will keep the values of the form field, without updating the object. To
     * track the change, the `updateHistory` method should be called when all
     * changes and side-effects are completed.
     * @param path The path of the attribute to change
     * @param newValue The value of the attribute and whether this value is
     * valid
     */
    onValueChange: <K extends keyof T['attributes']>(
        path: K,
        newValue: { value?: T['attributes'][K] | null; valid?: boolean }
    ) => void;

    /**
     * Return whether there are changes to undo
     * @returns `true` if there are changes that can be undone
     */
    canUndo: () => boolean;
    /**
     * Undo the last change on the object. It creates a new object with the
     * undone attributes.
     */
    undo: () => T | undefined;
    /**
     * Return whether there are changes to redo
     * @returns `true` if there are changes that can be redone
     */
    canRedo: () => boolean;
    /**
     * Redo the last change on the object. It returns a new object with the
     * redone attributes.
     */
    redo: () => T | undefined;
    /**
     * Return whether there are invalid fields in the form
     * @returns `true` if there are invalid field values in the form
     */
    hasInvalidFields: () => boolean;
    /**
     * Record the current state of the object in the history tracker. Sometimes,
     * a change of values has side effects on the object that updates other of
     * its field, so to make all those changes atomic, we need to be able to
     * decide when to record the object.
     * @returns
     */
    updateHistory: () => void;
    /**
     * Keep track of current form values, this is useful to revert the form as
     * well as the object's attributes.
     */
    formValues: { [key: string]: any };
};

/**
 * Hook that tracks changes on an object and allows to undo/redo them. It also
 * track changes to the form values, which may be invalid and not necessarily
 * result in changes to the object itself. These can also be undone/redone.
 *
 * FIXME Note that some fields, like InputStringFormatted do not send the
 * updated invalid values upon update, just the fact that the field is invalid,
 * so those fields will not be tracked here, though the result of the invalidity
 * will. Either find a way to send the invalid values so it can be properly
 * tracked, or decide not the track invalid values at all.
 *
 * FIXME We may not want to keep track of changes to invalid fields, maybe we
 * can just keep track of those in the state, only record if object attributes
 * changed, and when undoing, if the current state matches the last saved record
 * and if not, instead of undoing, just update to the last good record. This
 * would need to be tested to see if it works well, especially with multiple
 * invalid fields, with some valid updates in between.
 *
 * @param object The object to track changes on
 * @returns
 */
export const useHistoryTracker = <T extends BaseObject<any>>({ object }: { object: T }): WithHistoryTracker<T> => {
    // Keep a state for rendering purposes
    // FIXME, like invalidFieldsCount below, we might want to keep a count instead of the whole object
    const [formValues, setFormValues] = useState<{ [key: string]: any }>(_cloneDeep(object.attributes));
    // Use a ref for immediate access to current values
    const formValuesRef = useRef<{ [key: string]: any }>(_cloneDeep(object.attributes));
    // Keep ref of invalid fields to track changes
    const invalidFieldsRef = useRef<Partial<Record<keyof T['attributes'], boolean>>>({});
    // Keep a state for re-render triggering when invalidFields change
    const [invalidFieldsCount, setInvalidFieldsCount] = useState(0);

    const [historyTracker, setHistoryTracker] = useState(
        new HistoryTracker({
            attributes: object.attributes,
            formValues: _cloneDeep(object.attributes),
            invalidFields: {}
        })
    );

    // Reset the history tracker and invalid fields when the object is a new
    // one. Only re-run the effect if the object's id changed.
    useEffect(() => {
        const trackedAttributes = {
            attributes: object.attributes,
            formValues: _cloneDeep(object.attributes),
            invalidFields: {}
        };
        // Create a new history tracker and reset fields when the object id changes
        const newHistoryTracker = new HistoryTracker(trackedAttributes);
        setHistoryTracker(newHistoryTracker);

        // Reset the invalidFields ref when object ID changes
        invalidFieldsRef.current = {};
        setInvalidFieldsCount(0);

        // Also reset the ref when object ID changes
        formValuesRef.current = _cloneDeep(object.attributes);
        setFormValues(_cloneDeep(object.attributes));
    }, [(object as any).id]);

    const onValueChange = useCallback(
        <K extends keyof T['attributes']>(
            path: K,
            newValue: { value?: T['attributes'][K] | null; valid?: boolean } = { value: null, valid: true }
        ) => {
            // Update form values in both ref (immediately) and state (for rendering)
            formValuesRef.current = {
                ...formValuesRef.current,
                [path]: newValue.value
            };

            // Update state to trigger re-render
            setFormValues(formValuesRef.current);

            // Update invalid fields status in the ref
            const currentInvalidValue = !!invalidFieldsRef.current[path];
            const isFieldInvalid = newValue.valid !== undefined && !newValue.valid;
            invalidFieldsRef.current[path] = isFieldInvalid;

            // Only trigger re-render if the field validity changes
            if (currentInvalidValue && !isFieldInvalid) {
                setInvalidFieldsCount((count) => count - 1);
            } else if (!currentInvalidValue && isFieldInvalid) {
                setInvalidFieldsCount((count) => count + 1);
            }
            // Only update the object if the value is valid
            if (!isFieldInvalid) {
                object.set(path as keyof T['attributes'], newValue.value);
            }
        },
        [object]
    );

    const hasInvalidFields = useCallback((): boolean => {
        return invalidFieldsCount > 0;
    }, [invalidFieldsCount]); // Depend on count for re-rendering

    // Update the history if necessary
    const updateHistory = useCallback(() => {
        const newValues = {
            attributes: object.attributes,
            formValues: formValuesRef.current, // Always has the latest values
            invalidFields: { ...invalidFieldsRef.current } // Add invalid fields
        };
        if (!_isEqual(newValues, historyTracker.current())) {
            historyTracker.record(newValues);
        }
    }, [historyTracker, object]);

    const undo = useCallback(() => {
        const undoneData = historyTracker.undo();
        if (undoneData !== undefined) {
            const {
                attributes: undoneAttributes,
                formValues: undoneFormValues,
                invalidFields: undoneInvalidFields
            } = undoneData;

            // Update both ref and state
            formValuesRef.current = undoneFormValues;
            setFormValues(undoneFormValues);
            // Reset invalid fields
            invalidFieldsRef.current = { ...undoneInvalidFields };
            setInvalidFieldsCount(Object.keys(undoneInvalidFields).filter((key) => undoneInvalidFields[key]).length);

            return new (object.constructor as new (attributes: Partial<T['attributes']>) => T)(undoneAttributes);
        }
        return undefined;
    }, [historyTracker]);

    const canUndo = useCallback(() => historyTracker.canUndo(), [historyTracker]);

    const redo = useCallback(() => {
        const redoneData = historyTracker.redo();
        if (redoneData !== undefined) {
            const {
                attributes: redoneAttributes,
                formValues: redoneFormValues,
                invalidFields: redoneInvalidFields
            } = redoneData;

            // Update both ref and state
            formValuesRef.current = redoneFormValues;
            setFormValues(redoneFormValues);
            // Reset invalid fields
            invalidFieldsRef.current = { ...redoneInvalidFields };
            setInvalidFieldsCount(Object.keys(redoneInvalidFields).filter((key) => redoneInvalidFields[key]).length);

            return new (object.constructor as new (attributes: Partial<T['attributes']>) => T)(redoneAttributes);
        }
        return undefined;
    }, [historyTracker]);

    const canRedo = useCallback(() => historyTracker.canRedo(), [historyTracker]);

    return {
        onValueChange,
        canUndo,
        undo,
        canRedo,
        redo,
        hasInvalidFields,
        updateHistory,
        formValues // Return the state version for rendering
    };
};
