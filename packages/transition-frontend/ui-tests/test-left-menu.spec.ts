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
    widgetTestCounters: {}
};

// Configure the tests to run in serial mode (one after the other)
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
    context.page = await testHelpers.initializeTestPage(browser);
});

loginTestHelpers.startAndLoginAnonymously({ context, title: 'Transition' });

// Click on a few sections of the left menu to check that the panel switching works properly.
testHelpers.clickLeftMenuTest({ context, section: 'routing' });
testHelpers.clickLeftMenuTest({ context, section: 'preferences' });
testHelpers.clickLeftMenuTest({ context, section: 'agencies' });

testHelpers.logoutTest({ context });
