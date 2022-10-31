/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { chain } from 'stream-chain';
import { parser as jsonParser } from 'stream-json';
import jsonFilter from 'stream-json/filters/FilterBase';
import { pick as jsonPick } from 'stream-json/filters/Pick';
import { streamArray as jsonStreamArray } from 'stream-json/streamers/StreamArray';

export interface JsonReaderOptions {
    /**
     * The filter for elements in the json file to parse (for example, to read
     * features of a feature collection, the filter can be {filter: 'features'})
     *
     * @type {jsonFilter}
     * @memberof JsonReaderOptions
     */
    filter?: jsonFilter.FilterOptions;
}

export type FileReaderCallback = (object: { [key: string]: any }, rowNumber: number) => void;

/**
 * Wrapper around the parser for JSON files. It transforms the whole file
 * reading into a promise which returns the status of the file read or throws
 * any error thrown in the callback. If there are errors in the data read, the
 * callback will have been called for each parsed row before the error, but the
 * parsing will stop at the error and the promise will be rejected.
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
            const pipelineArray = [readStream, jsonParser(), jsonStreamArray()];
            if (options.filter) {
                pipelineArray.splice(2, 0, jsonPick(options.filter));
            }
            const pipeline = chain(pipelineArray);

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
