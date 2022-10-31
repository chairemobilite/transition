/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { parseCsvFile } from '../CsvFile';

const filePath = `${__dirname}/test.csv`;

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

test('Test with headers', async () => {
    const result = await parseCsvFile(fs.createReadStream(filePath), rowCallback, { header: true });
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
    const result = await parseCsvFile(fs.createReadStream(filePath), rowCallback, { header: false });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(3);
    expect(rows[0]).toEqual(['title1', 'title2', 'title 3', ' title4']);
    expect(rows[1]).toEqual(['row1.1', 'row 1.2', '', 'other']);
    expect(rows[2]).toEqual(['row2.1', 'row2.2', 'row2.3', 'row2.4', 'row2.5']);
});

test('Callback return error', async() => {
    const errorToThrow = 'Custom error in test';
    const throwErrorCallback = (_row: any, _rowNumber: number) => {
        throw errorToThrow;
    }
    let thrownError: any = false;
    try {
        await parseCsvFile(fs.createReadStream(filePath), throwErrorCallback, { header: true });
    } catch (err) {
        thrownError = err;
    }
    expect(thrownError).toEqual(errorToThrow);
});

test('Test with headers and file with other line breaks', async () => {
    const otherFile = `${__dirname}/testrn.csv`;
    const result = await parseCsvFile(fs.createReadStream(otherFile), rowCallback, { header: true });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({
        title1: 'value1',
        title2: 'value2',
    });
    expect(rows[1]).toEqual(expect.objectContaining({
        title1: 'value2.1',
        title2: 'value2.2',
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([1, 2]);
});

test('Test with bom characters', async () => {
    const otherFile = `${__dirname}/test_bom.csv`;
    const result = await parseCsvFile(fs.createReadStream(otherFile), rowCallback, { header: true });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({
        col1: 'abcdef',
        col2: '1234',
    });
    expect(rows[1]).toEqual(expect.objectContaining({
        col1: 'ghijkl',
        col2: '5678',
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([1, 2]);
});

test('Test with semi-colons, quotes and bom characters', async () => {
    const otherFile = `${__dirname}/semi_quotes_bom.csv`;
    const result = await parseCsvFile(fs.createReadStream(otherFile), rowCallback, { header: true });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({
        title1: 'row1.1',
        title2: 'row 1.2',
        'title 3': '',
        'title4': 'other'
    });
    expect(rows[1]).toEqual(expect.objectContaining({
        title1: 'row2.1',
        title2: 'row2.2',
        'title 3': 'row2.3',
        'title4': 'row2.4'
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([1, 2]);
});

test('Test with nbRows', async () => {
    
    // Nb Rows and headers
    const result = await parseCsvFile(fs.createReadStream(filePath), rowCallback, { header: true, nbRows: 1 });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(1);
    expect(rows[0]).toEqual({
        title1: 'row1.1',
        title2: 'row 1.2',
        'title 3': '',
        ' title4': 'other'
    });

    // Nb rows and no headers
    rows = [];
    const result2 = await parseCsvFile(fs.createReadStream(filePath), rowCallback, { header: false, nbRows: 1 });
    expect(result2).toEqual('completed');
    expect(rows.length).toEqual(1);
    expect(rows[0]).toEqual(['title1', 'title2', 'title 3', ' title4']);

    // Nb rows higher than actual row count
    rows = [];
    const result3 = await parseCsvFile(fs.createReadStream(filePath), rowCallback, { header: true, nbRows: 5 });
    expect(result3).toEqual('completed');
    expect(rows.length).toEqual(2);
});