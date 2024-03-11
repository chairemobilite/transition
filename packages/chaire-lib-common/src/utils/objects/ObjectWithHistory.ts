/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _isEqual from 'lodash/isEqual';

import config from '../../config/shared/project.config';
import { GenericObject, GenericAttributes } from './GenericObject';

/**
 * An object where change history is kept as fields are updated. This allows to
 * undo/redo operations. History is kept and the undo/redo functions are
 * available only if the object is in editing mode, ie after a call to the
 * `startEditing` method. Changes are automatically saved to history when done
 * using the `set` method. For changes done directly to the attributes or in any
 * other way, the `_updateHistory` protected method should be called directly.
 */
export class ObjectWithHistory<T extends GenericAttributes> extends GenericObject<T> {
    private history: T[] = [];
    private historyIndex: number;
    private isEditing: boolean;
    protected updateHistoryCallback: (() => void) | undefined;

    constructor(attributes: Partial<T>, isNew = true) {
        super(attributes, isNew);

        this.historyIndex = -1;
        this.isEditing = false;
        this.updateHistoryCallback = undefined;
    }

    protected _innerSet(path: string, value: unknown) {
        super._innerSet(path, value);
        this._updateHistory();
    }

    protected _innerSetData(path: string, value: unknown) {
        super._innerSetData(path, value);
        this._updateHistory();
    }

    static isObjectWithHistory(obj: unknown | undefined): obj is ObjectWithHistory<GenericAttributes> {
        return obj !== undefined && obj !== null && obj instanceof ObjectWithHistory;
    }

    canUndo() {
        return this.isEditing && this.historyIndex !== 0;
    }

    canRedo() {
        return this.isEditing && this.historyIndex !== this.history.length - 1;
    }

    undo() {
        if (this.isEditing && this.historyIndex > 0) {
            this._attributes = _cloneDeep(this.history[--this.historyIndex]);
        }
    }

    redo() {
        if (this.isEditing && this.historyIndex + 1 < this.history.length) {
            this._attributes = _cloneDeep(this.history[++this.historyIndex]);
        }
    }

    protected _updateHistory() {
        if (!this.isEditing) {
            return;
        }
        const undoCount = config.undoCount || 10;

        if (this.historyIndex + 1 < this.history.length) {
            this.history.splice(this.historyIndex + 1, this.history.length);
        }

        this.history.push(_cloneDeep(this._attributes));
        this.historyIndex++;

        while (this.history.length > undoCount) {
            this.history.shift();
            this.historyIndex--;
        }
        if (typeof this.updateHistoryCallback === 'function') {
            this.updateHistoryCallback();
        }
    }

    hasChanged(attribute?: string) {
        if (!this.isEditing) {
            return false;
        }
        if (attribute === undefined) {
            return this.isNew() || (!this.isNew() && !_isEqual(this._attributes, this.history[0]));
        } else {
            return this.history.length > 1 && !_isEqual(this._attributes[attribute], this.history[0][attribute]);
        }
    }

    startEditing() {
        //this.updateHistory();
        this.history = [_cloneDeep(this._attributes)];
        this.historyIndex = 0;
        this.isEditing = true;
    }

    stopEditing() {
        this.history = [];
        this.historyIndex = -1;
        this.isEditing = false;
    }

    cancelEditing() {
        if (!this.isEditing) {
            return;
        }
        this._attributes = _cloneDeep(this.history[0]);
        this.historyIndex = -1;
        this.isEditing = false;
    }
}
