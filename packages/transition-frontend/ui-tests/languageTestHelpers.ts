/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import * as testHelpers from './testHelpers';

/**
 * Check that the language is in french, and then change it to english.
 * @param {Object} options - The options for the test.
 */
export const switchFromFrenchToEnglish = ({ context }): void => {
    testHelpers.isLanguageTest({ context, expectedLanguage: 'fr' });
    testHelpers.switchLanguageTest({ context, languageToSwitch: 'en' });
    testHelpers.isLanguageTest({ context, expectedLanguage: 'en' });
};
