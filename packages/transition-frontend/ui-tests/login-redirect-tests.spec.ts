/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { test } from '@playwright/test';
import * as testHelpers from './testHelpers';
import * as languageTestHelpers from './languageTestHelpers';

// An unauthenticated user opening a protected URL is sent to the login page, then must end up back on
// the originally requested URL after logging in instead of on the home page.
const context = {
    page: null as any,
    widgetTestCounters: {}
};

// A protected route distinct from the home page (/dashboard), so landing on it
// after login can only come from the preserved referrer, not the default fallback.
const protectedUrl = '/verify/playwrightReferrerToken';

// The tests share a single page and must run in order (navigate -> login -> assert).
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser);
});

// Unauthenticated start lands on the login page; switch to english for stable labels.
testHelpers.hasUrlTest({ context, expectedUrl: '/login' });
languageTestHelpers.switchFromFrenchToEnglish({ context });

// Requesting a protected URL while logged out redirects to the login page.
testHelpers.goToUrlTest({ context, url: protectedUrl });
testHelpers.hasUrlTest({ context, expectedUrl: '/login' });

// After logging in, the user is redirected back to the originally requested URL.
testHelpers.loginTest({ context, loginMethod: 'clickLoginButton' });
testHelpers.hasUrlTest({ context, expectedUrl: protectedUrl });

testHelpers.logoutTest({ context });
