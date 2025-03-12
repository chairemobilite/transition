/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _isObject from 'lodash/isObject';
import _isEmpty from 'lodash/isEmpty';
import _isFinite from 'lodash/isFinite';
import _isDate from 'lodash/isDate';
import _isString from 'lodash/isString';

const _isBlank = function (value) {
    return (
        value === undefined ||
        value === null ||
        (_isString(value) && value.trim() === '') ||
        value.toString().length === 0 ||
        (_isObject(value) && _isEmpty(value) && typeof value !== 'function' && !_isDate(value))
    );
};

const _emptyStringToNull = function (str) {
    if (str === '') {
        return null;
    }
    return str;
};

const _toInteger = function (
    value: number | string | null | undefined,
    defaultValue: number | null = null
): number | null {
    const number =
        typeof value === 'string' ? parseInt(value) : value === null || value === undefined ? null : Math.trunc(value);
    return _isFinite(number) && Number.isInteger(number)
        ? number
        : defaultValue === null
            ? null
            : Math.trunc(defaultValue);
};

const _toFloat = function (
    value: number | string | null | undefined,
    defaultValue: number | null = null
): number | null {
    const number = typeof value === 'string' ? parseFloat(value) : value === null || value === undefined ? null : value;
    return _isFinite(number) ? number : defaultValue;
};

const _toBool = function (
    value: string | boolean | null | undefined,
    defaultValue: boolean | null = null
): boolean | null {
    if (value === 'true' || value === true) {
        return true;
    } else if (value === 'false' || value === false) {
        return false;
    }
    return defaultValue;
};

// split array in any number of slices:
// Thanks to https://stackoverflow.com/a/8189268
const _chunkify = function (a: unknown[], n = 2, balanced = true): unknown[][] {
    const len = a.length;
    const initialN = n;
    if (n < 2 || len === 0) {
        return [a];
    }

    const out: unknown[][] = [];
    let i = 0;
    let size = 0;

    if (len % n === 0) {
        size = Math.floor(len / n);
        while (i < len) {
            out.push(a.slice(i, (i += size)));
        }
    } else if (balanced) {
        while (i < len) {
            size = Math.ceil((len - i) / n--);
            out.push(a.slice(i, (i += size)));
        }
    } else {
        n--;
        size = Math.floor(len / n);
        if (len % size === 0) {
            size--;
        }
        while (i < size * n) {
            out.push(a.slice(i, (i += size)));
        }
        out.push(a.slice(size * n));
    }

    while (initialN - out.length > 0) {
        out.push([]);
    }

    return out;
};

// returns true for trueish values, false for falseish values and null otherwise. Will accept upper and lowercase values as same
const _booleish = function (value: unknown): boolean | null {
    const lowercaseValue =
        typeof value === 'string' ? value.toLowerCase() : Array.isArray(value) ? '' : String(value).toLowerCase();
    return ['y', 'yes', 'true', 't', '1', 'on'].includes(lowercaseValue)
        ? true
        : ['n', 'no', 'false', 'f', '0', 'off'].includes(lowercaseValue)
            ? false
            : null;
};

/**
 * Remove all undefined or null fields from an object. This is useful to convert
 * a database object, with null values to application objects, where undefined
 * values should be preferred instead.
 *
 * The object is modified itself is modified
 *
 * @template T The type of the object
 * @param {T} obj The object whose fields to delete if they are null or
 * undefined
 * @return {*}  {T} The object itself
 */
const _removeBlankFields = <T>(obj: T): T => {
    for (const field in obj) {
        if (obj[field] === null || obj[field] === undefined) {
            delete obj[field];
        }
    }
    return obj;
};

/**
 * Return a string that starts with str, but that is not contained in
 * otherStrings array, adding numeric suffixes to the string
 *
 * @param str The string to make unique
 * @param otherStrings A string array containing the values that should not be
 * identical to the returned string
 * @return {*}  {string} A unique string that has no duplicate in the
 * otherStrings array
 */
const _makeStringUnique = (str: string, otherStrings: string[]): string => {
    let sameString = otherStrings.find((other) => other === str);
    if (!sameString) {
        return str;
    }
    let suffixNumber = 0;
    while (sameString) {
        suffixNumber++;
        sameString = otherStrings.find((other) => other === `${str}-${suffixNumber}`);
    }
    return `${str}-${suffixNumber}`;
};

const _isEmail = (maybeEmail: string): boolean => {
    return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(
        maybeEmail
    );
};

export {
    _isBlank,
    _emptyStringToNull,
    _chunkify,
    _toInteger,
    _toFloat,
    _toBool,
    _booleish,
    _removeBlankFields,
    _makeStringUnique,
    _isEmail
};
