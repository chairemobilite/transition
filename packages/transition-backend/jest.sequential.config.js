/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/* eslint-disable node/no-unpublished-require */
const baseConfig = require('../../../jest.config.base');

// There is capnp cache tests to run in this package, the rust server should be started by the following commands:
// `cd /services/json2capnp`
// `cargo run 2000 ../../projects/test/test_cache/test`

// Run the db and integration tests
module.exports = {
    ...baseConfig,
    'testRegex': ['(/__tests__/.*(db\\.test)\\.(jsx?|tsx?))$','(/__tests__/.*(integration\\.test)\\.(jsx?|tsx?))$']
};
