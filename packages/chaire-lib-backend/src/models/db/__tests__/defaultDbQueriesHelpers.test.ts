/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { dataSourceIdsToArray, validateSampleSize } from '../default.db.queries';

describe('dataSourceIdsToArray', () => {
    const id1 = uuidV4();
    const id2 = uuidV4();

    test.each([
        ['undefined', undefined, []],
        ['null', null, []],
        ['empty array', [], []],
        ['array', [id1, id2], [id1, id2]],
        ['single id', id1, [id1]]
    ])('Valid: %s', (_title, dataSourceIds, expected) => {
        expect(dataSourceIdsToArray(dataSourceIds)).toEqual(expected);
    });

    test.each([
        ['single id not a uuid', 'id1'],
        ['empty string', ''],
        ['SQL after a uuid', `${id1}'); DROP TABLE users; --`],
        ['one invalid id in array', [id1, 'id2']],
        ['null in array', [id1, null]],
        ['number', 1],
        ['object', { id: id1 }],
        ['array in array', [[id1]]]
    ])('Invalid: %s', (_title, dataSourceIds) => {
        expect(() => dataSourceIdsToArray(dataSourceIds as unknown as string[])).toThrow(TrError);
    });
});

describe('validateSampleSize', () => {
    test.each([
        ['undefined', undefined, undefined],
        ['null', null, undefined],
        ['zero', 0, 0],
        ['positive integer', 10, 10]
    ])('Valid: %s', (_title, sampleSize, expected) => {
        expect(validateSampleSize(sampleSize)).toEqual(expected);
    });

    test.each([
        ['negative', -1],
        ['decimal', 1.5],
        ['NaN', NaN],
        ['infinity', Infinity],
        ['numeric string', '10'],
        ['SQL in string', '1; DROP TABLE users'],
        ['object', { value: 10 }],
        ['array', [10]]
    ])('Invalid: %s', (_title, sampleSize) => {
        expect(() => validateSampleSize(sampleSize)).toThrow(TrError);
    });
});
