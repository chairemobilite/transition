/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import events from 'events';

// This manager keeps track of selected objects for the interface.
// The selected object names must be known in advance (at construct)
// TODO: The selected object manager is more the application state than a manager. It could be part of the application state or context instead
class SelectedObjectsManager {
    private _eventManager: events.EventEmitter;
    private _selectedObjects: { [key: string]: unknown | undefined };

    constructor(eventManager: events.EventEmitter, selectedObjectsNames: string[] = []) {
        this._eventManager = eventManager;
        this._selectedObjects = {};
        selectedObjectsNames.forEach((selectedObjectName) => {
            this._selectedObjects[selectedObjectName] = undefined;
        });
    }

    deselect(selectedObjectName: string) {
        this._selectedObjects[selectedObjectName] = undefined;
        this._eventManager.emit(`selected.deselect.${selectedObjectName}`);
    }

    isSelected(selectedObjectName: string): boolean {
        return this._selectedObjects[selectedObjectName] !== undefined;
    }

    get(selectedObjectName: string): unknown {
        return this._selectedObjects[selectedObjectName];
    }

    set(selectedObjectName: string, objectContent: unknown) {
        this._selectedObjects[selectedObjectName] = objectContent;
        this.refresh(selectedObjectName);
    }

    update(selectedObjectName: string, objectContent: unknown) {
        // alias
        this.set(selectedObjectName, objectContent);
    }

    select(selectedObjectName: string, objectContent: unknown, autodeselect = false) {
        // alias
        this.set(selectedObjectName, objectContent);
        if (autodeselect) {
            this._eventManager.emit(`selected.deselect.${selectedObjectName}`);
        }
    }

    validate(
        selectedObjectName: string,
        objectContent: unknown // if object can be validated (in form, for instance), update and validate here
    ) {
        if (typeof (objectContent as any).validate === 'function') {
            (objectContent as any).validate();
        }
        this.set(selectedObjectName, objectContent);
    }

    updateAndValidate(selectedObjectName: string, objectContent: unknown) {
        // alias
        this.validate(selectedObjectName, objectContent);
    }

    refresh(selectedObjectName: string) {
        this._eventManager.emit(`selected.update.${selectedObjectName}`);
    }

    getSelectedObjects(): string[] {
        const selectedObjectNames: string[] = [];
        for (const key of Object.keys(this._selectedObjects)) {
            if (this._selectedObjects[key]) {
                selectedObjectNames.push(key);
            }
        }
        return selectedObjectNames;
    }
}

export default SelectedObjectsManager;
