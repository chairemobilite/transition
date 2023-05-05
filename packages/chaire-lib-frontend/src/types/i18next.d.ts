/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'i18next';

// Since t functions can now return null by default, this needs to be set to avoid getting compilation errors with the null value
// See https://www.i18next.com/overview/typescript#argument-of-type-defaulttfuncreturn-is-not-assignable-to-parameter-of-type-xyz
declare module 'i18next' {
    interface CustomTypeOptions {
        returnNull: false;
    }
}
