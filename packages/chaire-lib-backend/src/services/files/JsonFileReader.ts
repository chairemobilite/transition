/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import type { Duplex } from 'stream';
import { chain, none } from 'stream-chain';
import { parser as jsonParser } from 'stream-json';
import type jsonFilter from 'stream-json/filters/filter-base.js';
import { pick as jsonPick } from 'stream-json/filters/pick.js';
import { streamArray as jsonStreamArray } from 'stream-json/streamers/stream-array.js';

export interface JsonReaderOptions {
    /**
     * The filter for elements in the json file to parse (for example, to read
     * features of a feature collection, the filter can be {filter: 'features'})
     *
     * @type {jsonFilter}
     * @memberof JsonReaderOptions
     */
    filter?: jsonFilter.FilterBaseOptions;
}

export type FileReaderCallback = (object: { [key: string]: any }, rowNumber: number) => void;

/**
 * Wrapper around the parser for JSON files. It transforms the whole file
 * reading into a promise which returns the status of the file read or throws
 * any error thrown in the callback. If there are errors in the data read, the
 * parsing stops at the error and the promise is rejected. The callback may
 * already have been called for rows before the error, depending on how the file
 * was split in chunks when read, but never for rows after it.
 *
 * @param {string} filePath The path of the file to read
 * @param {FileReaderCallback} rowCallback The callback function to call for
 * each object of the file.
 * @return {*}  {(Promise<'completed' | 'notfound'>)} 'completed' when the file
 * was read without error, 'notfound' if the file was not found.
 */
export const parseJsonFile = async (
    filePath: string,
    rowCallback: FileReaderCallback,
    options: JsonReaderOptions = {}
): Promise<'completed' | 'notfound'> => {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(filePath)) {
            const readStream = fs.createReadStream(filePath);
            const pipelineArray: unknown[] = [readStream, jsonParser(), jsonStreamArray()];
            if (options.filter) {
                pipelineArray.splice(2, 0, jsonPick(options.filter));
            }
            const pipeline = chain(pipelineArray as [any]);

            pipeline.on('data', (data) => {
                try {
                    rowCallback(data.value, data.key);
                } catch (error) {
                    if (typeof (pipeline.streams[0] as any).close === 'function') {
                        (pipeline.streams[0] as any).close();
                    }
                    pipeline.streams[0].destroy();
                    pipeline.destroy();
                    reject(error);
                }
            });

            pipeline.on('end', () => {
                resolve('completed');
            });

            pipeline.on('error', (e) => {
                console.error(e);
                reject(e);
            });
        } else {
            console.log(`JSON file ${filePath} not found, ignoring...`);
            resolve('notfound');
        }
    });
};

/**
 * Create a stream that parses JSON text and emits each element of the array
 * at `arrayPath`. For example, `features` streams the features of a GeoJSON
 * feature collection and `elements` the elements of an Overpass API response.
 * Pipe a text stream into it, like a file read stream or a response body.
 * `null` elements are skipped.
 *
 * @param {string} arrayPath The path of the array in the JSON document, with
 * the fields of nested objects separated by dots
 * @return {*}  {Duplex} A duplex stream that emits the array's elements in
 * object mode
 */
export const createJsonArrayStream = (arrayPath: string): Duplex => {
    const streams = [
        jsonParser(),
        jsonPick({ filter: arrayPath }),
        jsonStreamArray(),
        // Emit the element itself instead of its index and value, `none` skips
        // null elements
        (data: { key: number; value: unknown }) => (data.value === null ? none : data.value)
    ];
    return chain(streams as [any]);
};
