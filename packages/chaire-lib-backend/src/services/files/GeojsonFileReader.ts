/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { parseJsonFile } from './JsonFileReader';

/**
 * Wrapper around the parser for a geojson file that contains a geojson
 * collection of features. It calls the `rowCallback` for every feature in the
 * file. It transforms the whole file reading into a promise which returns the
 * status of the file read or throws any error thrown in the callback. If there
 * are errors in the data read, the callback will have been called for each
 * parsed row before the error, but the parsing will stop at the error and the
 * promise will be rejected.
 *
 * @param {string} filePath The path of the file to read
 * @param {(object: { [key: string]: any }, rowNumber: number) => void}
 * rowCallback The callback function to call for each feature of the file.
 * @return {*}  {(Promise<'completed' | 'notfound'>)} 'completed' when the file
 * was read without error, 'notfound' if the file was not found.
 */
export const parseGeojsonFileFeatures = async (
    filePath: string,
    rowCallback: (object: { [key: string]: any }, rowNumber: number) => void
): Promise<'completed' | 'notfound'> => {
    return parseJsonFile(filePath, rowCallback, { filter: { filter: 'features' } });
};
