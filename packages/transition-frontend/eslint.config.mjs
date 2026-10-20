/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { defineConfig, globalIgnores } from 'eslint/config';
import reactConfig from '../../configs/react.eslint.config.mjs';

export default defineConfig([
    globalIgnores([
        '**/lib/',
        '**/__tests__/',
        '**/jestSetup.ts',
        '**/playwright-report/',
        '**/playwright-example.config.ts',
        '**/playwright.config.ts',
        // The webpack file is not used yet, so it's ignored for now, but it should not be and it should be typescript
        '**/webpack.config.js'
    ]),
    reactConfig
]);
