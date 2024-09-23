/*
 * Copyright 2024, Polytechnique Montreal and contributors
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

loginTestHelpers.startAndLoginAnonymously({ context, title: 'Transition' });

// Click all the sections in the left menu and check that the right panel becomes the correct one. 
testHelpers.clickLeftMenuTest({ context, section: 'nodes' });
testHelpers.clickLeftMenuTest({ context, section: 'services' });
testHelpers.clickLeftMenuTest({ context, section: 'scenarios' });
testHelpers.clickLeftMenuTest({ context, section: 'routing' });
testHelpers.clickLeftMenuTest({ context, section: 'accessibilityMap' });
testHelpers.clickLeftMenuTest({ context, section: 'batchCalculation' });
testHelpers.clickLeftMenuTest({ context, section: 'gtfsImport' });
testHelpers.clickLeftMenuTest({ context, section: 'gtfsExport' });
testHelpers.clickLeftMenuTest({ context, section: 'preferences' });
testHelpers.clickLeftMenuTest({ context, section: 'agencies' });

loginTestHelpers.logout({ context });
