/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from '../TrError';

describe('TrError.getLocalizedMessage', () => {
    test.each([
        ['null', null],
        ['undefined', undefined],
        ['a string', 'plain error'],
        ['a number', 42],
        ['a plain Error', new Error('boom')],
        ['a TrError without a localizedMessage', new TrError('technical', 'CODE')],
        ['a TrError with empty-string localizedMessage', new TrError('technical', 'CODE', '')]
    ])('Returns undefined for %s', (_label, value) => {
        expect(TrError.getLocalizedMessage(value)).toBeUndefined();
    });

    test('Returns the localized string of a TrError carrying a string localizedMessage', () => {
        const err = new TrError('technical', 'CODE', 'some:translation:key');
        expect(TrError.getLocalizedMessage(err)).toEqual('some:translation:key');
    });

    test('Returns the localized object of a TrError carrying a parameterized localizedMessage', () => {
        const err = new TrError('technical', 'CODE', {
            text: 'some:translation:key',
            params: { foo: 'bar' }
        });
        expect(TrError.getLocalizedMessage(err)).toEqual({
            text: 'some:translation:key',
            params: { foo: 'bar' }
        });
    });
});
