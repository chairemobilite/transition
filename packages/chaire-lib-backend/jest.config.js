/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/* eslint-disable node/no-unpublished-require */
const baseConfig = require('../../../jest.config.base');

// Ignore db.queries.test files
module.exports = {
    ...baseConfig,
    'testPathIgnorePatterns': ['(/__tests__/.*(db\\.test)\\.(jsx?|tsx?))$', '(/__tests__/.*(integration\\.test)\\.(jsx?|tsx?))$'],
};

