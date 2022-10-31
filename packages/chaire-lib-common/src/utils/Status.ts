/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/* Collection of status objects to properly type json objects */

export interface StatusError {
    status: 'error';
    error: unknown;
}

export interface StatusResult<T> {
    status: 'ok';
    result: T;
}

export type Status<T> = StatusResult<T> | StatusError;

// Function to easy creation of status objects
export function createError(error: unknown): StatusError {
    return { status: 'error', error: error };
}

export function createOk<T>(result: T): StatusResult<T> {
    return { status: 'ok', result: result };
}

// Type guards
export function isStatusError<T>(status: Status<T>): status is StatusError {
    return status.status === 'error';
}

export function isStatusOk<T>(status: Status<T>): status is StatusResult<T> {
    return status.status === 'ok';
}

// Losely inspired by Rust
export function unwrap<T>(status: Status<T>): T {
    if (isStatusOk(status)) {
        return status.result;
    } else if (isStatusError(status)) {
        throw status.error;
    } else {
        // We did not receive a Status object
        throw 'Invalid Status object';
    }
}
