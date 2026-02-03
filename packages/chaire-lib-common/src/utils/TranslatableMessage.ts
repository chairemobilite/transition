/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * A message that can be translated using i18next, consisting of a translation
 * key and parameters to interpolate into the translated string.
 * @typedef {Object} TranslatableMessageWithParams
 * @property {string} text - The i18next translation key.
 * @property {Object.<string, string>} params - Vals to interpolate into the string.
 */
export type TranslatableMessageWithParams = {
    text: string;
    params: {
        [key: string]: string;
    };
};

/**
 * A translatable message for use with i18next. Either a plain translation key
 * or an object containing a key with interpolation parameters.
 * @typedef {string | TranslatableMessageWithParams} TranslatableMessage
 */
export type TranslatableMessage = string | TranslatableMessageWithParams;
