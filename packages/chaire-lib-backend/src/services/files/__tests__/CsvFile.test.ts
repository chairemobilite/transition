/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { parseCsvFile } from '../CsvFile';

const filePath = `${__dirname}/testFiles/test.csv`;

let rows: any[] = [];
let rowNumbers: number[] = [];
const rowCallback = (row: any, rowNumber: number) => {
    rows.push(row);
    rowNumbers.push(rowNumber);
}

beforeEach(() => {
    rows = [];
    rowNumbers = [];
})

/** Test only the API of this parse function. The variety of inputs have been
 * tested in the chaire-lib package */

test('Test with headers', async () => {
    const result = await parseCsvFile(filePath, rowCallback, { header: true });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({
        title1: 'row1.1',
        title2: 'row 1.2',
        'title 3': '',
        ' title4': 'other'
    });
    expect(rows[1]).toEqual(expect.objectContaining({
        title1: 'row2.1',
        title2: 'row2.2',
        'title 3': 'row2.3',
        ' title4': 'row2.4'
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([1, 2]);
});

test('Test without headers', async () => {
    const result = await parseCsvFile(filePath, rowCallback, { header: false });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(3);
    expect(rows[0]).toEqual(['title1', 'title2', 'title 3', ' title4']);
    expect(rows[1]).toEqual(['row1.1', 'row 1.2', '', 'other']);
    expect(rows[2]).toEqual(['row2.1', 'row2.2', 'row2.3', 'row2.4', 'row2.5']);
});

test('File does not exist', async () => {
    const result = await parseCsvFile(`${__dirname}/testFiles/non_existing.csv`, rowCallback, { header: true });
    expect(result).toEqual('notfound');
});

test('Callback return error', async() => {
    const errorToThrow = 'Custom error in test';
    const throwErrorCallback = (_row: any, _rowNumber: number) => {
        throw errorToThrow;
    }
    let thrownError: any = false;
    try {
        await parseCsvFile(filePath, throwErrorCallback, { header: true });
    } catch (err) {
        thrownError = err;
    }
    expect(thrownError).toEqual(errorToThrow);
});
