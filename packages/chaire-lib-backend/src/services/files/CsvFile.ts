/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { parseCsvFile as parse, CsvFileAttributes } from 'chaire-lib-common/lib/utils/files/CsvFile';

/**
 * Wrapper around the papaparse file parser for CSV files. It transforms the
 * whole file reading into a promise which returns the status of the file read
 * or throws any error thrown in the callback.
 *
 * @param {string} filePath The path of the file to read
 * @param {(object: { [key: string]: any }, rowNumber: number) => void}
 * rowCallback The callback function to call for each row of the file. If the
 * options.header is true, the object contains either an object with header's
 * row as keys, otherwise, it is an array, with the index of each
 * comma-separated element as key. The rowNumber is the current row number, with
 * first row being 1.
 * @param {Partial<CsvFileAttributes>} options Options for file read
 * @return {*}  {(Promise<'completed' | 'notfound'>)} 'completed' when the file
 * was read without error, 'notfound' if the file was not found.
 */
export const parseCsvFile = async (
    filePath: string,
    rowCallback: (object: { [key: string]: any }, rowNumber: number) => void,
    options: Partial<CsvFileAttributes>
): Promise<'completed' | 'notfound'> => {
    console.log(`parsing csv file ${filePath}...`);
    return new Promise((resolve, reject) => {
        if (fs.existsSync(filePath)) {
            const readStream = fs.createReadStream(filePath);
            parse(readStream, rowCallback, options)
                .then((result) => {
                    console.log(`CSV file ${filePath} parsed`);
                    resolve(result);
                })
                .catch((error) => {
                    reject(error);
                });
        } else {
            console.log(`CSV file ${filePath} not found, ignoring...`);
            resolve('notfound');
        }
    });
};
