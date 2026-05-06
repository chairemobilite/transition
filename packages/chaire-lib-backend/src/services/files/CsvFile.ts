/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import path from 'path';
import { parseCsvFile as parse, CsvFileAttributes } from 'chaire-lib-common/lib/utils/files/CsvFile';

/**
 * Detect symptoms of CSV-parser line-ending confusion in a parsed row. If a
 * header key or first-column value contains an embedded `\r` or `\n`, the
 * parser has almost certainly misread the file's line endings (e.g. on
 * `\r\r\n` / CRCRLF input). Returns a description of the problem, or `null`
 * if the row looks healthy. See chairemobilite/transition#1909.
 */
const detectMalformedRow = (row: { [key: string]: any } | any[]): string | null => {
    if (Array.isArray(row)) {
        // header: false: any newline in any cell signals corruption.
        for (let i = 0; i < row.length; i++) {
            const cell = row[i];
            if (typeof cell === 'string' && /[\r\n]/.test(cell)) {
                return `field at column ${i} contains an embedded newline character: ${JSON.stringify(cell.slice(0, 40))}`;
            }
        }
        return null;
    }
    // header: true: check the keys, and the first column's value. We avoid
    // checking later columns to leave room for legitimate RFC 4180 multiline
    // quoted text; GTFS first columns are always IDs that never contain
    // newlines, so a newline there is unambiguous corruption.
    const keys = Object.keys(row);
    for (const key of keys) {
        if (/[\r\n]/.test(key)) {
            return `header column name contains an embedded newline character: ${JSON.stringify(key.slice(0, 40))}`;
        }
    }
    if (keys.length > 0) {
        const firstValue = row[keys[0]];
        if (typeof firstValue === 'string' && /[\r\n]/.test(firstValue)) {
            return `value of "${keys[0]}" contains an embedded newline character: ${JSON.stringify(firstValue.slice(0, 40))}`;
        }
    }
    return null;
};

const buildMalformedCsvError = (filePath: string, detail: string): Error => {
    const fileName = path.basename(filePath);
    return new Error(
        `CSV file "${fileName}" has malformed line endings (${detail}). ` +
            `Try normalizing them with \`dos2unix ${fileName}\`.`
    );
};

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
            // Sanity-check the first few rows for parser line-ending
            // confusion. After the check window, the wrapper falls away.
            // Three rows is enough to catch CRCRLF in `header: false` mode,
            // where row 1 ends up as an empty cell `[""]` between the two
            // CRs and the corruption only shows up on row 2.
            const ROWS_TO_CHECK_FOR_CORRUPTION = 3;
            let rowsCheckedForCorruption = 0;
            const wrappedCallback = (row: any, rowNumber: number) => {
                if (rowsCheckedForCorruption < ROWS_TO_CHECK_FOR_CORRUPTION) {
                    rowsCheckedForCorruption++;
                    const problem = detectMalformedRow(row);
                    if (problem !== null) {
                        throw buildMalformedCsvError(filePath, problem);
                    }
                }
                rowCallback(row, rowNumber);
            };
            parse(readStream, wrappedCallback, options)
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
