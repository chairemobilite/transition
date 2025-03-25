/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { test } from '@playwright/test';
import * as testHelpers from './testHelpers';
import * as loginTestHelpers from './loginTestHelpers';

const context = {
    page: null as any,
    title: '',
    widgetTestCounters: {}
};

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser);
});

// Login using all available methods
loginTestHelpers.startAndLoginAnonymously({ context, title: 'Transition', loginMethod: 'clickLoginButton' });
loginTestHelpers.logout({ context });
loginTestHelpers.startAndLoginAnonymously({ context, title: 'Transition', loginMethod: 'enterOnPasswordField', changeToEnglish: false });
loginTestHelpers.logout({ context });
loginTestHelpers.startAndLoginAnonymously({ context, title: 'Transition', loginMethod: 'enterOnUsernameField', changeToEnglish: false });
loginTestHelpers.logout({ context });