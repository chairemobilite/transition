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

// Try to import a zip file that is not a valid gtfs.
testHelpers.pickGtfsFeed({ context, fileName: 'invalid-gtfs.zip', valid: false });

testHelpers.pickGtfsFeed({ context, fileName: 'gtfs.zip', valid: true });

testHelpers.importGtfsFeed({ context });

loginTestHelpers.logout({ context });
