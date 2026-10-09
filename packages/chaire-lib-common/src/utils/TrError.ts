/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TranslatableMessage } from './TranslatableMessage';

export default class TrError extends Error {
    private code: string;
    private localizedMessage: TranslatableMessage;

    static isTrError(error: any): error is TrError {
        return error.code && typeof error.getCode === 'function' && typeof error.export === 'function';
    }

    /**
     * If `error` is a `TrError` carrying a non-empty `localizedMessage`,
     * return that message. Otherwise return `undefined`. Useful when surfacing
     * a caught error to the user: callers can use `??` to fall back to a
     * domain-specific generic message when the thrown error doesn't carry its
     * own localized text.
     */
    static getLocalizedMessage(error: unknown): TranslatableMessage | undefined {
        if (error === null || typeof error !== 'object') {
            return undefined;
        }
        if (!TrError.isTrError(error)) {
            return undefined;
        }
        const localized = error.export().localizedMessage;
        if (localized === '' || localized === undefined || localized === null) {
            return undefined;
        }
        return localized;
    }

    constructor(message: string, code: string, localizedError: TranslatableMessage = '') {
        super(message);

        // see https://medium.com/@xjamundx/custom-javascript-errors-in-es6-aa891b173f87
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TrError);
        }

        this.code = code;
        this.localizedMessage = localizedError;
    }

    getCode() {
        return this.code;
    }

    export() {
        return {
            localizedMessage: this.localizedMessage,
            error: this.message,
            errorCode: this.code
        };
    }

    toString() {
        return this.message + ' (' + this.code + ')';
    }
}
