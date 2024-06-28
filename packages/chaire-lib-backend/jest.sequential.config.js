/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/* eslint-disable n/no-unpublished-require */
const baseConfig = require('../../tests/jest.config.base');

// Run the db and integration tests
module.exports = {
    ...baseConfig,
    'testRegex': ['(/__tests__/.*(db\\.test)\\.(jsx?|tsx?))$','(/__tests__/.*(integration\\.test)\\.(jsx?|tsx?))$']
};
