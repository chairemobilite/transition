/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';
import _set from 'lodash.set';
import _get from 'lodash.get';
import _isEqual from 'lodash.isequal';
import _camelCase from 'lodash.camelcase';
import _upperFirst from 'lodash.upperfirst';
import _merge from 'lodash.merge';

export interface GenericAttributes {
    id: string;
    data: { [key: string]: unknown };
    is_frozen?: boolean | null | undefined; // TODO, remove null | undefined here, but first make sure we do not check for null or undefined elsewhere in the code
    // TODO: Potentially common attributes like the ones below could be part of a separate interface implemented by attributes classes
    integer_id?: number;
    internal_id?: string;
    shortname?: string;
    name?: string;
    description?: string;
    color?: string;
    created_at?: string | null;
    updated_at?: string | null;
}

/**
 * Parent class for all object classes. The attributes field corresponds to the
 * fields in the database, while the data is a special field for object that
 * contains a json string, so any additional field should be in data.
 */
export class GenericObject<T extends GenericAttributes> {
    protected static displayName: string;

    protected _attributes: T;
    protected _isValid = false;
    protected _errors: string[] = [];
    // FIXME tahini: public just because of Saveable which sets it. Needs to be better managed but needed a quick fix
    public _wasFrozen: boolean;
    private _deleted = false;
    private _isNew: boolean;

    constructor(attributes: Partial<T>, isNew = true) {
        this._attributes = this._prepareAttributes(attributes);

        this._isNew = isNew;
        this._wasFrozen = false;
    }

    get id(): string {
        return this._attributes.id;
    }

    get uuid(): string {
        return this._attributes.id;
    }

    get isValid(): boolean {
        return this._isValid;
    }

    get attributes(): T {
        return this._attributes;
    }

    // TODO: Should use getErrors instead
    get errors(): string[] {
        return this._errors;
    }

    // TODO: Should not be set directly
    set errors(errors) {
        this._errors = errors;
    }

    mergeAttributes(updatedAttributes: Partial<T>): void {
        _merge(this._attributes, _cloneDeep(updatedAttributes));
    }

    protected _prepareAttributes(attributes: Partial<T>): T {
        const { data, id, is_frozen, ...attribs } = attributes;
        const newAttribs = {
            ..._cloneDeep(attribs),
            id: id ? id : uuidV4(),
            data: data ? _cloneDeep(data) : {},
            is_frozen: is_frozen ? true : false
        } as Partial<T>;
        return newAttribs as T;
    }

    getAttributes(): T {
        return this._attributes;
    }

    /**
     * Resets all attributes
     *
     * TODO, this results in a complete erasure of the attributes, this may not
     * be the intended result, so it should be removed. If necessary a new
     * setMultiple method could be added
     * @param {Partial<T>} attributes
     * @memberof GenericObject
     * @deprecated If the intention is to set all attributes, consider creating
     * a new objects instead. Otherwise, set each attribute independently.
     */
    setAttributes(attributes: Partial<T>) {
        this._attributes = this._prepareAttributes(attributes);
        this._wasFrozen = this._attributes.is_frozen === true;
    }

    wasFrozen(): boolean {
        return this._wasFrozen;
    }

    isFrozen(): boolean {
        return this.get('is_frozen') === true;
    }

    protected _innerSet(path: string, value: unknown) {
        _set(this._attributes, path, value);
    }

    set(path: string, value: unknown) {
        const oldValue = _get(this._attributes, path);
        if (!_isEqual(oldValue, value)) {
            this._innerSet(path, value);
        }
    }

    protected _innerSetData(path: string, value: unknown) {
        _set(this._attributes.data, path, value);
    }

    setData(path: string, value: unknown) {
        const oldValue = _get(this._attributes.data, path);
        if (!_isEqual(oldValue, value)) {
            this._innerSetData(path, value);
        }
    }

    /**
     * Clone this object. If deleteSpecifics is true, it removes all object's
     * ids and individual attributes like creation dates, but also fields that
     * contain links to children objects (like objects of different types that
     * have a foreign key to the current object). Implementers need to make sure
     * any such fields are removed.
     *
     * @protected
     * @param {boolean} [deleteSpecifics=true] If true, no ID or children
     * object's IDs will be copied, otherwise, it is a complete copy of the
     * attributes, including all children fields.
     * @param {boolean} [isNew=true] Whether the cloned object should be new or
     * not
     * @return {*}  {Partial<T>}
     * @memberof GenericObject
     */
    clone(deleteSpecifics = true, isNew = true): GenericObject<GenericAttributes> {
        return new (<any>this.constructor)(this.getClonedAttributes(deleteSpecifics), isNew);
    }

    duplicate(deleteId = true, isNew = true): GenericObject<GenericAttributes> {
        return this.clone(deleteId, isNew);
    }

    validate(): boolean {
        this._isValid = true;
        this._errors = [];
        return true;
    }

    getErrors(): string[] {
        return this._errors;
    }

    isDeleted(): boolean {
        return this._deleted;
    }

    setDeleted(): void {
        this._deleted = true;
    }

    isNew(): boolean {
        return this._isNew;
    }

    setNew(isNew = false): void {
        this._isNew = isNew;
    }

    /**
     * Clone this object's attribute. If deleteSpecifics is true, it removes all
     * object's ids and individual attributes like creation dates, but also
     * fields that contain links to children objects (like objects of different
     * types that have a foreign key to the current object). Implementers need
     * to make sure any such fields are removed.
     *
     * @protected
     * @param {boolean} [deleteSpecifics=true] If true, no ID or children
     * object's IDs will be copied, otherwise, it is a complete copy of the
     * attributes, including all children fields.
     * @return {*}  {Partial<T>}
     * @memberof GenericObject
     */
    getClonedAttributes(deleteSpecifics = true): Partial<T> {
        const clonedAttributes = _cloneDeep(this._attributes) as Partial<T>;
        if (deleteSpecifics) {
            delete clonedAttributes.id;
            if (clonedAttributes.integer_id) {
                delete clonedAttributes.integer_id;
            }
            if (clonedAttributes.created_at) {
                delete clonedAttributes.created_at;
            }
            if (clonedAttributes.updated_at) {
                delete clonedAttributes.updated_at;
            }
        }
        return clonedAttributes;
    }

    getId(): string {
        return this._attributes.id;
    }

    getShortenedId(): string {
        return this._attributes.id.substring(0, 7);
    }

    get(path: string, defaultValue: unknown = undefined): unknown {
        const value = this._attributes[path] ? this._attributes[path] : _get(this._attributes, path);
        if (defaultValue === undefined && value !== undefined) {
            return value;
        }
        return value === null || value === undefined || value === '' ? defaultValue : value;
    }

    getData(path: string, defaultValue: unknown = undefined): unknown {
        const value = this._attributes.data[path] ? this._attributes.data[path] : _get(this._attributes.data, path);
        if (defaultValue === undefined && value !== undefined) {
            return value;
        }
        return value === null || value === undefined || value === '' ? defaultValue : value;
    }

    getSingularName(): string {
        return (<any>this.constructor).displayName
            ? _camelCase((<any>this.constructor).displayName)
            : _camelCase(this.constructor.name);
    }

    // override for special case like agency/agencies.
    // A pluralize library would be too slow and overkill for this simple purpose
    getPluralName(): string {
        return (<any>this.constructor).displayName
            ? _camelCase((<any>this.constructor).displayName) + 's'
            : _camelCase(this.constructor.name) + 's';
    }

    getDisplayName(): string {
        return (<any>this.constructor).displayName ? (<any>this.constructor).displayName : this.constructor.name;
    }

    getCapitalizedSingularName(): string {
        return (<any>this.constructor).displayName
            ? _upperFirst(_camelCase((<any>this.constructor).displayName))
            : _upperFirst(_camelCase(this.constructor.name));
    }

    // override for special case like agency/agencies.
    // A pluralize library would be too slow and overkill for this simple purpose
    getCapitalizedPluralName(): string {
        return (<any>this.constructor).displayName
            ? _upperFirst(_camelCase((<any>this.constructor).displayName)) + 's'
            : _upperFirst(_camelCase(this.constructor.name)) + 's';
    }
}
