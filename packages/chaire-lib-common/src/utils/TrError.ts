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
