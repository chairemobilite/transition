/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { asyncCallWithTimeout, isTimeout } from '../AsyncUtils';

test('isTimeout', () => {
    expect(isTimeout(undefined)).toBeFalsy();
    expect(isTimeout(null)).toBeFalsy();
    expect(isTimeout('PROMISE_TIMEOUT')).toBeFalsy();
    expect(isTimeout({ someObj: 'test' })).toBeFalsy();
    expect(isTimeout([1, 2, 3])).toBeFalsy();
    expect(isTimeout(new Error('Async call timeout limit reached'))).toBeFalsy();
    expect(isTimeout(new Error('Async call timeout limit reached', { cause: 'PROMISE_TIMEOUT' }))).toBeTruthy();
})

describe('asyncCallWithTimeout', () => {
    test('Promise returns first', async () => {
        const response = 'abc';
        const promise = async () => response;
        expect(await asyncCallWithTimeout(promise(), 3000)).toEqual(response);
    });

    test('Promise error', async () => {
        const exceptionError = 'Exception in promise';
        const promise = async () => {
            throw exceptionError;
        }

        let exception: any = undefined;
        try {
            await asyncCallWithTimeout(promise(), 2000);
        } catch(error) {
            exception = error;
        }

        expect(exception).toBeDefined();
        expect(isTimeout(exception)).toBeFalsy();
        expect(exception).toEqual(exceptionError);
    });

    test('Promise timeout', async () => {
        let exception: any = undefined;
        const promise = async () => new Promise((_resolve, _reject) => {
            // Never ending promise
        });
        try {
            await asyncCallWithTimeout(promise(), 2000);
        } catch(error) {
            exception = error;
        }
        expect(exception).toBeDefined();
        expect(isTimeout(exception)).toBeTruthy();
    });
});
