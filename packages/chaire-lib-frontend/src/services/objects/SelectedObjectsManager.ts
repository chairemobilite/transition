/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import events from 'events';

type Idable = {
    id: string;
};

/**
 * This class keeps track of selected objects for the interface.
 * two types of events can be triggered here:
 * - selected.update.${objectType}
 * - selected.deselect.${objectType}
 *
 * The first one is triggered when the selection for an object type is added, removed or replaced.
 * The second one is triggered when the selection for an object type is deselected. deselectAll will trigger this event for all object types.
 *
 * Whenever a selection is added, removed or updated, all unrelated
 * selected object types should be automatically deselected (different object type).
 * Normally, this should not happen since selections are separated by section,
 * but we will add a global deselect method to be sure.
 * For instance, if you select a path and unrelated nodes were previously selected,
 * they will be deselected and the path nodes will be selected in their place.
 */
class SelectedObjectsManager {
    private _eventManager: events.EventEmitter;
    private _selectedCollectionByObjectType: { [objectType: string]: Idable[] }; // generic object always has the method id()

    constructor(eventManager: events.EventEmitter) {
        this._eventManager = eventManager;
        this._selectedCollectionByObjectType = {};
    }

    /**
     * Initialize the selection collection for an object type.
     * @param objectType The object type to initialize the selection collection for.
     */
    initObjectType(objectType: string) {
        if (!this._selectedCollectionByObjectType[objectType]) {
            this._selectedCollectionByObjectType[objectType] = [];
        }
    }

    /**
     * Add a selection to the selected objects.
     * Automatically deselect unrelated objects types,
     * but add to same object types selection.
     * @param objectType The object type of the object to be added to the selection.
     * @param objectContent The content of the selected object.
     */
    addToSelection(objectType: string, objectContent: Idable) {
        this.initObjectType(objectType);

        // Verify object has a proper id property
        if (objectContent.id === undefined || typeof objectContent.id === 'function') {
            console.error(
                'SelectedObjectsManager:addToSelection: Object must have a valid id property, not a function or undefined'
            );
            return;
        }

        // Ignore if already selected, but display an error:
        const isAlreadySelected = this.isSelected(objectType, objectContent.id);
        if (isAlreadySelected) {
            console.error(
                `SelectedObjectsManager:addToSelection: Object with id ${objectContent.id} of type ${objectType} is already selected. Ignoring.`
            );
            return;
        }
        this._selectedCollectionByObjectType[objectType] = [
            ...this._selectedCollectionByObjectType[objectType],
            objectContent
        ];
        this._eventManager.emit(`selected.update.${objectType}`);
    }

    /**
     * Remove an object from the selection. ignore if the object is not already in the selection.
     * @param objectType The object type of the object to be removed from the selection.
     * @param objectContent The content of the object to be removed from the selection.
     */
    removeFromSelection(objectType: string, objectContent: Idable) {
        this.initObjectType(objectType);
        const isSelected = this.isSelected(objectType, objectContent.id);
        if (!isSelected) {
            console.error(
                `SelectedObjectsManager:removeFromSelection: Object with id ${objectContent.id} of type ${objectType} is not selected. Ignoring.`
            );
            return;
        }
        this._selectedCollectionByObjectType[objectType] = this._selectedCollectionByObjectType[objectType].filter(
            (_object) => _object.id !== objectContent.id
        );
        this._eventManager.emit(`selected.update.${objectType}`);
    }

    /**
     * Set the selection for an object type. This will replace any selected objects of the same type
     * @param objectType The object type to set the selection for.
     * @param objectContents The contents of the objects to be selected.
     */
    setSelection(objectType: string, objectContents: Idable[]) {
        this.initObjectType(objectType);
        this._selectedCollectionByObjectType[objectType] = [...objectContents];
        this._eventManager.emit(`selected.update.${objectType}`);
    }

    /**
     * Alias of setSelection
     * @param objectType The object type to replace the selection for.
     * @param objectContents The contents of the objects to be selected.
     */
    replaceSelection(objectType: string, objectContents: Idable[]) {
        this.setSelection(objectType, objectContents);
    }

    /**
     * Deselect all objects of a given type
     * @param objectType The object type to deselect.
     */
    deselect(objectType: string) {
        this.setSelection(objectType, []);
        this._eventManager.emit(`selected.deselect.${objectType}`);
    }

    /**
     * Deselect all objects
     */
    deselectAll() {
        for (const objectType in this._selectedCollectionByObjectType) {
            this.deselect(objectType);
        }
    }

    /**
     * Check if an object type is selected.
     * @param objectType The object type to check if it is selected.
     * @param objectId The id of the object to check if it is selected.
     * @returns True if the object type is selected, false otherwise.
     */
    isSelected(objectType: string, objectId: string): boolean {
        if (!this._selectedCollectionByObjectType[objectType]) {
            console.error(`SelectedObjectsManager:isSelected: Object type ${objectType} is not initialized`);
            return false;
        }
        return this._selectedCollectionByObjectType[objectType].some((_object) => _object.id === objectId);
    }

    /**
     * Get the collection of selected objects for the object type. Use a copy of the array to avoid side-effects.
     * @param objectType The object type to get the selection for.
     * @returns The selection for the object type.
     */
    getSelection(objectType: string): Idable[] {
        return [...(this._selectedCollectionByObjectType[objectType] || [])];
    }

    /**
     * Get all the selections. Use a copy of the object to avoid side-effects.
     * @returns A dictionary of object types and their selected objects.
     */
    getSelections(): { [objectType: string]: Idable[] } {
        return { ...this._selectedCollectionByObjectType };
    }

    /**
     * Get the only selected object for a given type.
     * @param objectType The object type to get the only selected object for.
     * @returns The only selected object for the object type, or undefined if no object or more than one object is selected.
     */
    getSingleSelection(objectType: string): Idable | undefined {
        const selection = this.getSelection(objectType);
        return selection.length === 1 ? selection[0] : undefined;
    }
}

export default SelectedObjectsManager;
