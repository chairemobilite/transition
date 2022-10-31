/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { parseJsonFile } from '../JsonFileReader';

const filePath = `${__dirname}/testFiles/test.json`;

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

test('Test reader', async () => {
    const result = await parseJsonFile(filePath, rowCallback);
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({
        title1: 'obj1.1',
        title2: 'obj1.2',
        bar: {
            subbar1: 3,
            subbar2: "2"
        }
    });
    expect(rows[1]).toEqual(expect.objectContaining({
        title1: 'obj2.1',
        title2: 'obj2.2',
        foo: ["arr1", "arr2"]
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([0, 1]);
});

test('Test reader, bad file format', async () => {
    // Third object has errors, the previous objects will have been parsed anyway, but none after
    await expect(parseJsonFile(`${__dirname}/testFiles/invalidJsonFormat.json`, rowCallback))
        .rejects
        .toThrow(expect.anything());
    
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({
        title1: 'obj1.1',
        title2: 'obj1.2',
        bar: {
            subbar1: 3,
            subbar2: "2"
        }
    });
    expect(rows[1]).toEqual(expect.objectContaining({
        title1: 'obj2.1',
        title2: 'obj2.2',
        foo: ["arr1", "arr2"]
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([0, 1]);
});

test('Test callback throws error', async () => {
    let nbCalls = 0;
    const errorString = 'error';
    await expect(parseJsonFile(filePath, () => {
        nbCalls++;
        throw new Error(errorString);
    }))
        .rejects
        .toThrow(errorString);
    expect(nbCalls).toEqual(1);
});

test('File does not exist', async () => {
    const result = await parseJsonFile(`${__dirname}/testFiles/non_existing.json`, rowCallback);
    expect(result).toEqual('notfound');
});

test('File not of json type', async () => {
    await expect(parseJsonFile(`${__dirname}/testFiles/test.csv`, rowCallback))
        .rejects
        .toThrow(expect.anything());
});

test('Test reader with filter', async () => {
    const result = await parseJsonFile(`${__dirname}/testFiles/testInnerJson.json`, rowCallback, { filter: { filter: 'level2Root' } });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(2);
    expect(rows[0]).toEqual({
        title1: 'obj1.1',
        title2: 'obj1.2',
        bar: {
            subbar1: 3,
            subbar2: "2"
        }
    });
    expect(rows[1]).toEqual(expect.objectContaining({
        title1: 'obj2.1',
        title2: 'obj2.2',
        foo: ["arr1", "arr2"]
    }));
    expect(rowNumbers.length).toEqual(2);
    expect(rowNumbers).toEqual([0, 1]);
});
