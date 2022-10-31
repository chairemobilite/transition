/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Papa from 'papaparse';

export interface CsvFileAttributes {
    /**
     * The newline character to use. If not set, the function will try to
     * automatically detect the newline from the file
     *
     * @type {string}
     * @memberof CsvFileAttributes
     */
    newline?: string;
    /**
     * Whether the first line contains the headers for the next lines.
     *
     * @type {boolean}
     * @memberof CsvFileAttributes
     */
    header: boolean;
    skipEmptyLines: boolean | 'greedy' | undefined;
    /**
     * Maximum number of rows to read. If not set, the whole file will be read
     *
     * @type {number}
     * @memberof CsvFileAttributes
     */
    nbRows?: number;
}

/**
 * Wrapper around the papaparse file parser for CSV files. It transforms the
 * whole file reading into a promise which returns the status of the file read
 * or throws any error thrown in the callback.
 *
 * @param {any} input Either the file name, a stream or a browser File
 * @param {(object: { [key: string]: any }, rowNumber: number) => void}
 * rowCallback The callback function to call for each row of the file. If the
 * options.header is true, the object contains either an object with header's
 * row as keys, otherwise, it is an array, with the index of each
 * comme-separated element as key.
 * @param {Partial<CsvFileAttributes>} options Options for file read
 * @return {*}  {(Promise<'completed' | 'notfound'>)} 'completed' when the file
 * was read without error, 'notfound' if the file was not found.
 */
export const parseCsvFile = async (
    input: string | NodeJS.ReadableStream | any,
    rowCallback: (object: { [key: string]: any }, rowNumber: number) => void,
    options: Partial<CsvFileAttributes>
): Promise<'completed'> => {
    const attributes = {
        skipEmptyLines: options.skipEmptyLines || 'greedy',
        header: options.header === undefined ? true : options.header,
        newline: options.newline
    };
    if (options.nbRows && options.nbRows > 0) {
        attributes['preview'] = options.nbRows;
    } else {
        // Worker has no effect in node, and causes exceptions with preview in browser
        attributes['worker'] = true;
    }
    // FIXME when preview is set, the complete callback is not called, so we manually resolve the promise in step (see https://github.com/mholt/PapaParse/issues/618)
    const nbRows = options.nbRows && options.nbRows > 0 ? options.nbRows : 0;

    return new Promise((resolve, reject) => {
        let rowNumber = 0;
        Papa.parse(input, {
            ...attributes,
            step: (row) => {
                rowCallback(row.data, ++rowNumber);
                if (rowNumber === nbRows) {
                    resolve('completed');
                }
            },
            error: (error, file) => {
                console.error('error parsing file', error, file);
                if (error.row && error.message) {
                    reject(`error reading CSV file: ${file} on line ${error.row}: ${error.message}`);
                } else {
                    reject(error);
                }
            },
            complete: () => {
                resolve('completed');
            },
            transformHeader: (header) => {
                // Remove the BOM character if it's there
                if (header.charCodeAt(0) === 0xfeff) {
                    const newHeader = header.slice(1);
                    // If the header is quoted, remove quotes
                    if (
                        newHeader.length > 1 &&
                        newHeader.charAt(0) === '"' &&
                        newHeader.charAt(0) === newHeader.charAt(newHeader.length - 1)
                    ) {
                        return newHeader.substring(1, newHeader.length - 1);
                    }
                    return newHeader;
                }
                return header;
            }
        });
    });
};
