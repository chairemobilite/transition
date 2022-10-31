/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _merge from 'lodash.merge';
import _get from 'lodash.get';
import _isNumber from 'lodash.isnumber';
import _cloneDeep from 'lodash.clonedeep';
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

export class PreferencesClass extends ObjectWithHistory<PreferencesModelWithIdAndData> implements Saveable {
    private _default: Partial<PreferencesModel>;
    private _projectDefault: Partial<PreferencesModel>;
    private _runtimeServer: Partial<PreferencesModel>;
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
            const defaultAcceleration = this.getAttributes().transit.lines.lineModesDefaultValues[mode]
                .defaultAcceleration;
            const defaultDeceleration = this.getAttributes().transit.lines.lineModesDefaultValues[mode]
                .defaultDeceleration;
            const defaultRunningSpeedKmH = this.getAttributes().transit.lines.lineModesDefaultValues[mode]
                .defaultRunningSpeedKmH;
            const defaultDwellTimeSeconds = this.getAttributes().transit.lines.lineModesDefaultValues[mode]
                .defaultDwellTimeSeconds;
            const maxRunningSpeedKmH = this.getAttributes().transit.lines.lineModesDefaultValues[mode]
                .maxRunningSpeedKmH;
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

    public resetPathToDefault(path: string) {
        const projectDefaultOrDefaultValue = this.getFromProjectDefaultOrDefault(path);
        this.set(path, projectDefaultOrDefaultValue);
        return projectDefaultOrDefaultValue;
    }

    public update(
        socket: any,
        eventManager: any,
        valuesByPath: Partial<PreferencesModelWithIdAndData>
    ): Promise<PreferencesModelWithIdAndData> {
        return new Promise((resolve) => {
            socket.emit('preferences.update', valuesByPath, (_response) => {
                this._attributes = _cloneDeep(_merge({}, this._attributes, valuesByPath));
                eventManager.emit('preferences.updated');
                resolve(this._attributes);
            });
        });
    }

    public save(socket: any, eventManager?: any): Promise<PreferencesModel> {
        return new Promise((resolve) => {
            socket.emit('preferences.update', this._attributes, (response) => {
                resolve(response);
            });
        });
    }

    // Not implemented for Preferences, we should never delete the preferences object.
    public delete(socket: any): Promise<any> {
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
        _merge(this._runtimeServer, _cloneDeep(valuesByPath));
        _merge(this._attributes, _cloneDeep(this._runtimeServer));
    }

    public load(socket: any, eventManager: any): Promise<PreferencesModel> {
        return new Promise((resolve) => {
            socket.emit('preferences.read', (response) => {
                if (response.preferences) {
                    this._attributes = _cloneDeep(
                        _merge({}, this._default, this._projectDefault, response.preferences)
                    );
                }
                // ignore if fetching user preferences fails
                eventManager.emit('preferences.loaded');
                resolve(this._attributes);
            });
        });
    }

    // TODO: type this:
    public get(path: string, defaultValue: unknown = undefined): any {
        return super.get(path, defaultValue);
    }
}

// singleton:
const instance = new PreferencesClass();
export default instance;
