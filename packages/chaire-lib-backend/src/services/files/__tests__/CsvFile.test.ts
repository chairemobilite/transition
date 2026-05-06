/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseCsvFile, MalformedCsvError } from '../CsvFile';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const filePath = `${__dirname}/testFiles/test.csv`;

let rows: any[] = [];
let rowNumbers: number[] = [];
const rowCallback = (row: any, rowNumber: number) => {
    rows.push(row);
    rowNumbers.push(rowNumber);
};

beforeEach(() => {
    rows = [];
    rowNumbers = [];
});

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

test('Test without headers', async () => {
    const result = await parseCsvFile(filePath, rowCallback, { header: false });
    expect(result).toEqual('completed');
    expect(rows.length).toEqual(3);
    expect(rows[0]).toEqual(['title1', 'title2', 'title 3', 'title4']);
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
    };
    let thrownError: any = false;
    try {
        await parseCsvFile(filePath, throwErrorCallback, { header: true });
    } catch (err) {
        thrownError = err;
    }
    expect(thrownError).toEqual(errorToThrow);
});

describe('Detection of CSV-parser line-ending corruption (issue #1909)', () => {
    // Fixtures are generated at runtime: \r\r\n bytes are easy to mangle
    // by editors or Git autocrlf, which is the very condition under test.
    const tmpDir = path.join(os.tmpdir(), `transition-csvfile-test-${process.pid}`);
    const writeFixture = (name: string, content: string): string => {
        const p = path.join(tmpDir, name);
        fs.writeFileSync(p, content);
        return p;
    };

    beforeAll(() => {
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const HEADER = 'stop_id,stop_name,stop_lat,stop_lon';
    const ROW1 = '1,Station A,45.5,-73.5';
    const ROW2 = '2,Station B,45.6,-73.6';

    /* --------------- cases the detection MUST flag --------------- */

    test.each([
        ['CRCRLF (\\r\\r\\n) -- the issue case', '\r\r\n'],
        ['triple-CR + LF (\\r\\r\\r\\n)', '\r\r\r\n']
    ])('Rejects with a clear error: %s', async (_label, sep) => {
        const fixture = writeFixture(`bad-${sep.length}.csv`, [HEADER, ROW1, ROW2].join(sep) + sep);
        let thrownError: any = undefined;
        try {
            await parseCsvFile(fixture, () => undefined, { header: true });
        } catch (err) {
            thrownError = err;
        }
        expect(thrownError).toBeInstanceOf(MalformedCsvError);
        expect(thrownError).toBeInstanceOf(TrError);
        expect(TrError.isTrError(thrownError)).toBe(true);
        // Technical message goes to logs
        expect(thrownError.message).toMatch(/malformed line endings/i);
        expect(thrownError.message).toMatch(new RegExp(path.basename(fixture)));
        expect(thrownError.message).toMatch(/dos2unix/);
        // No localized message by default: the parser is domain-agnostic;
        // callers opt in by supplying `malformedCsvLocalizedMessage`.
        expect((thrownError as TrError).export().localizedMessage).toEqual('');
    });

    test('Threads a caller-supplied localized message through to the thrown error', async () => {
        const fixture = writeFixture('bad-with-locale.csv', [HEADER, ROW1, ROW2].join('\r\r\n') + '\r\r\n');
        let thrownError: any = undefined;
        try {
            await parseCsvFile(fixture, () => undefined, {
                header: true,
                malformedCsvLocalizedMessage: (fileName) => ({
                    text: 'some:domain:errors:MalformedCsvFile',
                    params: { fileName }
                })
            });
        } catch (err) {
            thrownError = err;
        }
        expect(thrownError).toBeInstanceOf(MalformedCsvError);
        expect((thrownError as TrError).export().localizedMessage).toEqual({
            text: 'some:domain:errors:MalformedCsvFile',
            params: { fileName: path.basename(fixture) }
        });
    });

    // Both cases share the same assertion shape; only the fixture content,
    // filename, and `header` option differ. LF inside the header (in
    // header:true mode) and CRCRLF in header:false mode are different
    // mechanisms that produce the same symptom: a parsed row whose value
    // contains an embedded newline character.
    test.each([
        [
            'embedded LF in header (header:true)',
            'broken-header.csv',
            'stop_id,stop\nname\r\n1,Station A\r\n',
            { header: true } as const
        ],
        [
            'CRCRLF with header:false',
            'crcrlf-no-header.csv',
            [HEADER, ROW1, ROW2].join('\r\r\n') + '\r\r\n',
            { header: false } as const
        ]
    ])('Rejects with /embedded newline/ error: %s', async (_label, fileName, content, opts) => {
        const fixture = writeFixture(fileName, content);
        let thrownError: any = undefined;
        try {
            await parseCsvFile(fixture, () => undefined, opts);
        } catch (err) {
            thrownError = err;
        }
        expect(thrownError).toBeInstanceOf(Error);
        expect(thrownError.message).toMatch(/embedded newline/i);
    });

    /* --------------- cases the detection MUST NOT flag --------------- */

    test.each([
        ['plain LF', '\n'],
        ['CRLF', '\r\n'],
        ['CR-only (old Mac)', '\r']
    ])('Accepts a well-formed file with %s line endings', async (_label, sep) => {
        const fixture = writeFixture(`good-${_label}.csv`, [HEADER, ROW1, ROW2].join(sep) + sep);
        const rows: any[] = [];
        const result = await parseCsvFile(fixture, (row) => rows.push(row), { header: true });
        expect(result).toEqual('completed');
        expect(rows.length).toEqual(2);
        expect(rows[0]).toEqual({
            stop_id: '1',
            stop_name: 'Station A',
            stop_lat: '45.5',
            stop_lon: '-73.5'
        });
    });

    test('Accepts a file with a legitimate multiline quoted field (does not false-positive)', async () => {
        // Per RFC 4180 a quoted field may contain newlines; we only check
        // the first column, where here the value is "1".
        const fixture = writeFixture(
            'multiline-quoted.csv',
            `${HEADER}\r\n1,"Line one\nLine two",45.5,-73.5\r\n2,Station B,45.6,-73.6\r\n`
        );
        const rows: any[] = [];
        const result = await parseCsvFile(fixture, (row) => rows.push(row), { header: true });
        expect(result).toEqual('completed');
        expect(rows.length).toEqual(2);
        expect(rows[0].stop_name).toEqual('Line one\nLine two');
    });

    test('Accepts an empty file (no rows -> no first-row check, no error)', async () => {
        const fixture = writeFixture('empty.csv', '');
        const rows: any[] = [];
        const result = await parseCsvFile(fixture, (row) => rows.push(row), { header: true });
        expect(result).toEqual('completed');
        expect(rows.length).toEqual(0);
    });
});
