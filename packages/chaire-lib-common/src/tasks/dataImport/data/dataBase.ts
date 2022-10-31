/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _isEmpty from 'lodash.isempty';

export abstract class DataBase<T> {
    constructor() {
        /* nothing to do */
    }

    protected abstract getData(): T[];

    protected objectMatches(element: { [key: string]: any }, data: { [key: string]: any }): boolean {
        const dataKey = Object.keys(data);
        for (let i = 0, size = dataKey.length; i < size; i++) {
            const key = dataKey[i];
            if (!element[key]) {
                return false;
            }
            if (data[key]) {
                if (Array.isArray(element[key])) {
                    const values = element[key];
                    if (Array.isArray(data[key])) {
                        if (!data[key].some((value) => values.includes(value))) {
                            return false;
                        }
                    } else if (!values.includes(data[key])) {
                        return false;
                    }
                } else {
                    if (Array.isArray(data[key])) {
                        if (!data[key].includes(element[key])) {
                            return false;
                        }
                    } else if (element[key] !== data[key]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    /**
     * Query elements from the file where values correspond to the requested
     * parameters.
     *
     * @param data The data to query. If multiple keys are specified, all keys
     * and values should be present. An undefined value for a key means any
     * value for that key, but the key needs to be present. If the value is an
     * array, elements with any of the value in the array will be returned.
     * @param maxSize Specify the maximum size of the array to return if not all
     * elements are required.
     * TODO: accept regex or add a way to accept a "not" modifier
     */
    public query(data: { [key: string]: any }, maxSize = -1): T[] {
        return this._query(data, this.objectMatches, maxSize);
    }

    protected _query(
        data: { [key: string]: any },
        matchMethod: (element: T, data: { [key: string]: any }) => boolean,
        maxSize = -1
    ): T[] {
        const fileData = this.getData();

        const returnAll = _isEmpty(data);
        const matchingElements: any[] = [];
        let arraySize = 0;
        const checkMaxSize = maxSize > 0;
        for (let i = 0, dataSize = fileData.length; i < dataSize; i++) {
            const element = fileData[i];
            if (returnAll || matchMethod(element, data)) {
                matchingElements.push(element);
                arraySize++;
                if (checkMaxSize && arraySize >= maxSize) {
                    break;
                }
            }
        }
        return matchingElements;
    }

    public find(data: { [key: string]: any }): T | undefined {
        return this._find(data, this.objectMatches);
    }

    protected _find(
        data: { [key: string]: any },
        matchMethod: (element: T, data: { [key: string]: any }) => boolean
    ): T | undefined {
        const fileData: T[] = this.getData();

        for (let i = 0, size = fileData.length; i < size; i++) {
            const element = fileData[i];
            if (_isEmpty(data) || matchMethod(element, data)) {
                return element;
            }
        }
        return undefined;
    }

    /**
     * Query elements from the file where values correspond to the requested
     * parameters, with multiple OR queries.
     *
     * @param data An array of data to query. If multiple keys are specified, all keys
     * and values should be present. An undefined value for a key means any
     * value for that key, but the key needs to be present. If the value is an
     * array, elements with any of the value in the array will be returned.
     * @param maxSize Specify the maximum size of the array to return if not all
     * elements are required.
     * TODO: accept regex or add a way to accept a "not" modifier
     */
    public queryOr(data: { [key: string]: any }[], maxSize = -1): T[] {
        return this._queryOr(data, this.objectMatches, maxSize);
    }

    protected _queryOr(
        data: { [key: string]: any }[],
        matchMethod: (element: T, data: { [key: string]: any }) => boolean,
        maxSize = -1
    ): T[] {
        const fileData = this.getData();

        const returnAll = _isEmpty(data);
        const matchingElements: any[] = [];
        let arraySize = 0;
        const checkMaxSize = maxSize > 0;
        for (let i = 0, dataSize = fileData.length; i < dataSize; i++) {
            const element = fileData[i];
            if (returnAll || data.some((dataMatch) => matchMethod(element, dataMatch))) {
                matchingElements.push(element);
                arraySize++;
                if (checkMaxSize && arraySize >= maxSize) {
                    break;
                }
            }
        }
        return matchingElements;
    }
}
