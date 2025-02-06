/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _merge from 'lodash/merge';
import _get from 'lodash/get';
import _set from 'lodash/set';
import _isNumber from 'lodash/isNumber';
import _cloneDeep from 'lodash/cloneDeep';
import EventEmitter from 'events';

import * as Status from '../utils/Status';
import { ObjectWithHistory } from '../utils/objects/ObjectWithHistory';
import { Saveable } from '../utils/objects/Saveable';
import { default as defaultPreferences, PreferencesModel } from './defaultPreferences.config';
import config from './shared/project.config';
import { _isBlank } from '../utils/LodashExtensions';
import { lineModesArray } from './lineModesDefaultValues';

interface PreferencesModelWithIdAndData extends PreferencesModel {
    id: string;
    data: { [key: string]: any };
}

const prefChangeEvent = 'change';

export class PreferencesClass extends ObjectWithHistory<PreferencesModelWithIdAndData> implements Saveable {
    private _default: Partial<PreferencesModel>;
    private _projectDefault: Partial<PreferencesModel>;
    private _runtimeServer: Partial<PreferencesModel>;
    private _eventEmitter: EventEmitter = new EventEmitter();
    protected static displayName = 'Preferences';

    constructor(attributes = {}, isNew = false) {
        const newAttributes = _cloneDeep(_merge({}, defaultPreferences, config.defaultPreferences, attributes));

        super(newAttributes, isNew);

        // TODO: ideally, do not let consumers directly access the fields, find a better way
        this._default = _cloneDeep(defaultPreferences);
        this._projectDefault = _cloneDeep(config.defaultPreferences || {});
        this._runtimeServer = {};
    }

    public get current() {
        return this._attributes;
    }

    // FIXME: Do the following functions need to be public?
    public getDefault() {
        return this._default;
    }

    public getProjectDefault() {
        return this._projectDefault;
    }

    public getFromDefault(path: string) {
        return _get(this.getDefault(), path);
    }

    public getFromProjectDefault(path: string) {
        return _get(this.getProjectDefault(), path);
    }

    public getFromProjectDefaultOrDefault(path: string) {
        const projectDefaultValue = this.getFromProjectDefault(path);
        if (!_isBlank(_get(this.getProjectDefault(), path))) {
            return projectDefaultValue;
        } else {
            const defaultValue = this.getFromDefault(path);
            return defaultValue;
        }
    }

    // TODO: extract mode related validations to external function (see Path.ts)
    public validate() {
        this._isValid = true;
        this._errors = [];
        if (this.getAttributes().defaultWalkingSpeedMetersPerSeconds < 2.0 / 3.6) {
            this._isValid = false;
            this._errors.push('main:preferences:errors:DefaultWalkingSpeedMustBeAtLeast2kph');
        } else if (this.getAttributes().defaultWalkingSpeedMetersPerSeconds > 7.0 / 3.6) {
            this._isValid = false;
            this._errors.push('main:preferences:errors:DefaultWalkingSpeedMustBeAtMost7kph');
        }
        for (let i = 0, count = lineModesArray.length; i < count; i++) {
            const mode = lineModesArray[i];
            const defaultAcceleration =
                this.getAttributes().transit.lines.lineModesDefaultValues[mode].defaultAcceleration;
            const defaultDeceleration =
                this.getAttributes().transit.lines.lineModesDefaultValues[mode].defaultDeceleration;
            const defaultRunningSpeedKmH =
                this.getAttributes().transit.lines.lineModesDefaultValues[mode].defaultRunningSpeedKmH;
            const defaultDwellTimeSeconds =
                this.getAttributes().transit.lines.lineModesDefaultValues[mode].defaultDwellTimeSeconds;
            const maxRunningSpeedKmH =
                this.getAttributes().transit.lines.lineModesDefaultValues[mode].maxRunningSpeedKmH;
            if (_isNumber(defaultRunningSpeedKmH) && (defaultRunningSpeedKmH <= 0 || defaultRunningSpeedKmH > 500)) {
                this.errors.push('transit:transitPath:errors:DefaultRunningSpeedIsInvalid');
                this._isValid = false;
            }
            if (_isNumber(defaultDwellTimeSeconds) && (defaultDwellTimeSeconds <= 0 || defaultDwellTimeSeconds > 600)) {
                if (mode !== 'transferable' || (mode === 'transferable' && defaultDwellTimeSeconds < 0)) {
                    this.errors.push('transit:transitPath:errors:DefaultDwellTimeIsInvalid');
                    this._isValid = false;
                }
            }
            if (!_isNumber(defaultAcceleration)) {
                this.errors.push('transit:transitPath:errors:DefaultAccelerationIsRequired');
                this._isValid = false;
            } else {
                if (defaultAcceleration < 0) {
                    this.errors.push('transit:transitPath:errors:DefaultAccelerationIsInvalid');
                    this._isValid = false;
                } else if (defaultAcceleration <= 0.3) {
                    this.errors.push('transit:transitPath:errors:DefaultAccelerationIsTooLow');
                    this._isValid = false;
                } else if (defaultAcceleration > 1.5 && mode !== 'transferable') {
                    this.errors.push('transit:transitPath:errors:DefaultAccelerationIsTooHigh');
                    this._isValid = false;
                }
            }
            if (!_isNumber(defaultDeceleration)) {
                this.errors.push('transit:transitPath:errors:DefaultDecelerationIsRequired');
                this._isValid = false;
            } else {
                if (defaultDeceleration < 0) {
                    this.errors.push('transit:transitPath:errors:DefaultDecelerationIsInvalid');
                    this._isValid = false;
                } else if (defaultDeceleration <= 0.3) {
                    this.errors.push('transit:transitPath:errors:DefaultDecelerationIsTooLow');
                    this._isValid = false;
                } else if (defaultDeceleration > 1.5 && mode !== 'transferable') {
                    this.errors.push('transit:transitPath:errors:DefaultDecelerationIsTooHigh');
                    this._isValid = false;
                }
            }
            if (_isNumber(defaultRunningSpeedKmH) && defaultRunningSpeedKmH > maxRunningSpeedKmH) {
                this.errors.push('transit:transitPath:errors:DefaultRunningSpeedIsTooHigh');
                this._isValid = false;
            }
        }
        return this._isValid;
    }

    /**
     * FIXME: Used for preferences edit form
     * @param path Dot-separated path to the preference to reset
     * @returns The new preferences value
     */
    public resetPathToDefault(path: string) {
        const projectDefaultOrDefaultValue = this.getFromProjectDefaultOrDefault(path);
        this.set(path, projectDefaultOrDefaultValue);
        return projectDefaultOrDefaultValue;
    }

    private async updateFromSocket(
        socket: EventEmitter,
        valuesByPath: Partial<PreferencesModelWithIdAndData>
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            socket.emit('preferences.update', valuesByPath, (response: Status.Status<unknown>) => {
                if (Status.isStatusOk(response)) {
                    resolve(true);
                } else {
                    reject(response.error);
                }
            });
        });
    }

    private async updateFromFetch(valuesByPath: Partial<PreferencesModelWithIdAndData>): Promise<boolean> {
        const response = await fetch('/update_user_preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ valuesByPath })
        });
        if (response.status === 200) {
            const jsonResponse = (await response.json()) as Status.Status<unknown>;
            if (Status.isStatusOk(jsonResponse)) {
                return true;
            } else {
                throw jsonResponse.error;
            }
        } else {
            throw 'Invalid response returned from server';
        }
    }

    /**
     * Update preferences value and save to the server
     * @param valuesByPath An object where the keys are the dot-separated path
     * to the preferences to update and the value is the new value of the
     * preference.
     * @param socket Optional, an socket event emitter to use to save the data.
     * If undefined, a post to the server will be done
     * @returns The complete preferences object
     */
    public async update(
        valuesByPath: Partial<PreferencesModelWithIdAndData>,
        socket?: EventEmitter
    ): Promise<PreferencesModelWithIdAndData> {
        try {
            const _valuesByPath = _cloneDeep(valuesByPath);
            if (socket) {
                await this.updateFromSocket(socket, _valuesByPath);
            } else {
                await this.updateFromFetch(_valuesByPath);
            }
            if (Object.keys(_valuesByPath).length > 0) {
                for (const path in _valuesByPath) {
                    _set(this._attributes, path, _valuesByPath[path]);
                }
            }
            this._eventEmitter.emit(prefChangeEvent, _valuesByPath);
        } catch {
            console.error('Error loading preferences from server');
        }
        return this._attributes;
    }

    /**
     * Save the whole preferences object to the server
     * FIXME: Used for preferences edit form
     */
    public async save(socket?: EventEmitter, eventManager?: EventEmitter): Promise<PreferencesModel> {
        try {
            if (socket) {
                await this.updateFromSocket(socket, this.attributes);
            } else {
                await this.updateFromFetch(this.attributes);
            }
            eventManager?.emit('preferences.updated');
            this._eventEmitter.emit(prefChangeEvent, this._attributes);
        } catch {
            console.error('Error loading preferences from server');
        }
        return this._attributes;
    }

    // Not implemented for Preferences, we should never delete the preferences object.
    public delete(_socket: any): Promise<any> {
        return new Promise((resolve) => {
            resolve(null);
        });
    }

    /**
     * Update the preferences with server-specific values. Those values are for server data and cannot be overriden by client.
     * This should be called only from the server-side
     *
     * FIXME: Make sure only server can call this function or refactor preferences to avoid this in client.
     * TODO: If we keep this: test
     *
     * @param {*} valuesByPath The values to update
     */
    public updateServerPrefs(valuesByPath: Partial<PreferencesModel>): void {
        const _valuesByPath = _cloneDeep(valuesByPath);
        if (Object.keys(_valuesByPath).length > 0) {
            for (const path in _valuesByPath) {
                _set(this._runtimeServer, path, _valuesByPath[path]);
            }
        }
        _merge(this._attributes, _cloneDeep(this._runtimeServer));
    }

    private async loadFromSocket(socket: EventEmitter): Promise<Partial<PreferencesModel>> {
        return new Promise((resolve, reject) => {
            socket.emit('preferences.read', (response: Status.Status<Partial<PreferencesModel>>) => {
                if (Status.isStatusOk(response)) {
                    resolve(Status.unwrap(response));
                } else {
                    reject(response.error || 'Error loading preferences with socket');
                }
            });
        });
    }

    private async loadFromFetch(): Promise<Partial<PreferencesModel>> {
        const response = await fetch('/load_user_preferences', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.status === 200) {
            const jsonResponse = (await response.json()) as Status.Status<Partial<PreferencesModel>>;
            if (Status.isStatusOk(jsonResponse)) {
                return Status.unwrap(jsonResponse);
            } else {
                throw jsonResponse.error;
            }
        } else {
            throw 'Invalid response returned from server';
        }
    }

    /**
     * Load preferences from server
     * @param socket Optional, an socket event emitter to use to load the data.
     * If undefined, a get from the server will be done
     * @returns The complete preferences object
     */
    public async load(socket?: EventEmitter): Promise<PreferencesModel> {
        try {
            const preferencesFromServer = socket ? await this.loadFromSocket(socket) : await this.loadFromFetch();
            this._attributes = _cloneDeep(
                _merge({}, this._default, this._projectDefault, preferencesFromServer)
            ) as PreferencesModelWithIdAndData;
            this._eventEmitter.emit(prefChangeEvent, this._attributes);
        } catch {
            console.error('Error loading preferences from server');
        }
        return this._attributes;
    }

    // TODO: type this:
    public get(path: string, defaultValue: unknown = undefined): any {
        // FIXME This is for the deck.gl migration, the colors now have a new
        // format (hexadecimal instead of rgba). Remove this `if` block after a
        // while
        const value = super.get(path, defaultValue);
        if (path.toLocaleLowerCase().includes('color')) {
            if (typeof value === 'string' && value.startsWith('rgba')) {
                // Convert rgba to hex
                const rgba = value.split(',');
                const r = parseInt(rgba[0].split('(')[1], 10);
                const g = parseInt(rgba[1], 10);
                const b = parseInt(rgba[2], 10);
                const a = parseFloat(rgba[3].split(')')[0]);
                const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
                const alphaHex = Math.round(a * 255)
                    .toString(16)
                    .padStart(2, '0');
                return `${hex}${alphaHex}`;
            }
        }
        return value;
    }

    /**
     * Add a listener for preferences changes
     *
     * @param callback The function to call when there are changes to the
     * current preferences. The listener will send as parameter the preferences
     * values that have changed
     */
    public addChangeListener(callback: (preferences: Partial<PreferencesModelWithIdAndData>) => void) {
        this._eventEmitter.on(prefChangeEvent, callback);
    }

    /**
     * Remove a listener for preferences changes
     *
     * @param callback The previously added callback
     */
    public removeChangeListener(callback: (preferences: Partial<PreferencesModelWithIdAndData>) => void) {
        this._eventEmitter.off(prefChangeEvent, callback);
    }
}

// singleton:
const instance = new PreferencesClass();
export default instance;
