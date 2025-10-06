/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _set from 'lodash/set';
import _get from 'lodash/get';
import _isEqual from 'lodash/isEqual';

/**
 * Base class for objects that contain a set of attributes. This base class
 * contains the objects' attributes and allows to get/set specific attributes
 * with type safety. It has methods to validate the object and get the errors.
 * It also has methods to get the singular and plural names of the object, based
 * on the class name or a static displayName property.
 *
 * It replaces the {@link GenericObject} class, as this one does not have any
 * assumptions on the fields that the object should have. As object classes move
 * to numeric IDs instead of string UUIDs, this class is more flexible and they
 * should extend it instead.
 */
export abstract class BaseObject<T extends Record<string, unknown>> {
    private _attributes: T;
    // Cache the results of the validation. Reset whenever attributes are changed.
    private _isValid: boolean | undefined = undefined;
    private _errors: string[] = [];

    constructor(attributes: Partial<T>) {
        this._attributes = this._prepareAttributes(_cloneDeep(attributes));
    }

    /**
     * Indicates if the object is valid or not.
     *
     * @readonly
     * @type {boolean}
     * @memberof BaseObject
     */
    isValid(): boolean {
        // Cache the validation result
        if (this._isValid === undefined) {
            const [isValid, errors] = this._validate();
            this._errors = errors;
            this._isValid = isValid;
        }
        return this._isValid;
    }

    private resetValidation(): void {
        this._isValid = undefined;
        this._errors = [];
    }

    /**
     * The readonly attributes of the object. They should not be modified
     * directly.
     *
     * @readonly
     * @type {Readonly<T>}
     * @memberof BaseObject
     */
    get attributes(): Readonly<T> {
        return this._attributes;
    }

    /**
     * Merge new attributes with the existing ones. It does not do a deep merge
     * of the attributes, so if any attribute field is an object, it should be
     * merged manually before calling this method.
     *
     * @param updatedAttributes A partial set of attributes to merge with the
     * existing ones.
     */
    mergeAttributes(updatedAttributes: Partial<T>): void {
        this.resetValidation(); // Reset validation results
        Object.assign(this._attributes, _cloneDeep(updatedAttributes));
    }

    /**
     * Prepares the attributes of the object. This method is called by the
     * constructor, who receives a partial set of attributes. This is where any
     * attribute should be initialized to a default value if necessary. This
     * function receives a clone copy of the attributes, so it is safe to modify
     * them directly.
     *
     * @param attributes The initial attributes passed to the constructor
     */
    protected abstract _prepareAttributes(attributes: Partial<T>): T;

    /**
     * Sets the value of an attribute, with type safety.
     * @param path The path of the attribute to set.
     * @param value The value of the attribute to set.
     */
    set<K extends keyof T>(path: K, value: T[K]): void {
        const oldValue = path in this._attributes ? this._attributes[path] : _get(this._attributes, path);
        if (!_isEqual(oldValue, value)) {
            this.resetValidation(); // Reset validation results
            _set(this._attributes, path, value);
        }
    }

    /**
     * Abstract method to validate the object. Implementers should return a
     * tuple with a boolean indicating if the object is valid and an array of
     * strings with the errors. The first element of the tuple should be true if
     * the object is valid and false if it is not. The second element should be
     * an array of strings with the errors. If the object is valid, the array
     * should be empty. If the object is not valid, the array should contain the
     * errors.  The method should be called before saving the object to the
     * database.
     *
     * @returns {[boolean, string[]]} A tuple with a boolean indicating if the
     * object is valid and an array of strings with the errors.
     */
    protected abstract _validate(): [boolean, string[]];

    /**
     * @returns {string[]} An array of strings with the errors. If the object is
     * valid, the array is empty.
     */
    getErrors(): string[] {
        // Cache the validation result
        if (this._isValid === undefined) {
            const [isValid, errors] = this._validate();
            this._errors = errors;
            this._isValid = isValid;
        }
        return this._errors;
    }

    /**
     * Get the value of an attribute, with type safety
     *
     * @param path The path of the attribute to get.
     * @param defaultValue The default value to return if the attributes is
     * undefined, null or a blank string.
     * @returns The value of the attributes, or the default value or undefined
     * if not found.
     */
    get<K extends keyof T>(path: K, defaultValue: T[K] | undefined = undefined): T[K] | undefined {
        const value = this._attributes[path] ? this._attributes[path] : _get(this._attributes, path);
        if (defaultValue === undefined && value !== undefined) {
            return value;
        }
        // Empty string values are considered as not set, so return the default value
        return value === null || value === undefined || value === '' ? defaultValue : value;
    }
}
