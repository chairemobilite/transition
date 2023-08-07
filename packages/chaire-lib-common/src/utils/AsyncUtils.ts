/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

const causeTimeout = 'PROMISE_TIMEOUT';
export const isTimeout = (error: unknown) => error && (error as any).cause && (error as any).cause === causeTimeout;

/**
 * Call an async function with a maximum time limit (in milliseconds) for the timeout
 * Taken from https://javascript.plainenglish.io/how-to-add-a-timeout-limit-to-asynchronous-javascript-functions-3676d89c186d
 * @param {Promise<T>} asyncPromise An asynchronous promise to resolve
 * @param {number} timeLimit Time limit to attempt function in milliseconds
 * @returns {<T> | undefined} Resolved promise for async function call, or an error if time limit reached
 */
export const asyncCallWithTimeout = async <T>(asyncPromise: Promise<T>, timeLimit: number): Promise<T> => {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error('Async call timeout limit reached', { cause: causeTimeout }));
        }, timeLimit);
    });

    return Promise.race([asyncPromise, timeoutPromise])
        .then((result) => {
            clearTimeout(timeoutHandle);
            return result;
        })
        .catch((error) => {
            if (!isTimeout(error)) {
                // Error in promise, not because of timeout
                clearTimeout(timeoutHandle);
            }
            throw error;
        });
};
