/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/* eslint-disable node/no-unpublished-require */
const baseConfig = require('../../tests/jest.config.base');

module.exports = {
    ...baseConfig,
    setupFilesAfterEnv: [
        ...baseConfig.setupFilesAfterEnv,
        '@testing-library/jest-dom/extend-expect',
        './jestSetup.ts'
    ],
    testEnvironment: 'jsdom',
    snapshotSerializers: ['enzyme-to-json/serializer']
};
