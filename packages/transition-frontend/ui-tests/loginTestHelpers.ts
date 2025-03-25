/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import * as testHelpers from './testHelpers';
import * as languageTestHelpers from './languageTestHelpers';

/**
 * Test the login page, change to the right language, and login to the test account.
 * @param {Object} options - The options for the test.
 * @param {string} options.title - The title of the page.
 * @param {testHelpers.LoginMethods} options.loginMethod - The method used to log in. By default, presses the login button.
 * @param {boolean} options.changeToEnglish - Whether to change the language to english or not. Used in tests that require multiple logins, as the page will still be in english after the first.
 */
export const startAndLoginAnonymously = ({
    context,
    title,
    loginMethod = 'clickLoginButton',
    changeToEnglish = true
}: { title: string, loginMethod?: testHelpers.LoginMethods, changeToEnglish?: boolean } & testHelpers.CommonTestParameters) => {
    testHelpers.hasTitleTest({ context, title });
    testHelpers.hasUrlTest({ context, expectedUrl: '/login' });
    // For consistency we want to test everything in english, so the language switching is included in the login function.
    if (changeToEnglish) {
        languageTestHelpers.switchFromFrenchToEnglish({ context });
    }
    testHelpers.loginTest({ context, loginMethod });
};
