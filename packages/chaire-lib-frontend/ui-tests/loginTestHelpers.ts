/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import * as testHelpers from './testHelpers';

/**
 * Test the login page, change to the right language, and login to the test account.
 * @param {Object} options - The options for the test.
 * @param {string} options.title - The title of the page.
 */
export const startAndLoginAnonymously = ({
    context,
    title
}: { title: string} & testHelpers.CommonTestParameters) => {
    testHelpers.hasTitleTest({ context, title });
    testHelpers.hasUrlTest({ context, expectedUrl: '/login' });
    testHelpers.isLanguageTest({ context, expectedLanguage: 'fr' });
    testHelpers.switchLanguageTest({ context, languageToSwitch: 'en' });
    testHelpers.isLanguageTest({ context, expectedLanguage: 'en' });
    testHelpers.loginTest({ context });
};

export const logout = ({ context }: testHelpers.CommonTestParameters) => {
    testHelpers.logoutTest({ context });
};
