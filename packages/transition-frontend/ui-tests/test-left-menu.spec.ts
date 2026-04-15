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

// Click on a few sections of the left menu to check that the panel switching
// works properly.
//
// FIXME Some sections like Routing and Accessibility map have a full loading
// panel until all data is loaded, so we cannot check the title.  Despite a 30
// seconds timeout, the tests were still timing out with a loading panel in the
// CI, so we are skipping the title check for those sections for now. Anyway, we
// are not really testing anything here.
testHelpers.clickLeftMenuTest({ context, section: 'nodes', expectedRightPanelTitle: 'Stop nodes' });
testHelpers.clickLeftMenuTest({ context, section: 'preferences', expectedRightPanelTitle: 'Preferences' });
testHelpers.clickLeftMenuTest({ context, section: 'agencies', expectedRightPanelTitle: 'Agencies' });

testHelpers.logoutTest({ context });
