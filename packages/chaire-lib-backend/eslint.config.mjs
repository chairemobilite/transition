/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { defineConfig, globalIgnores } from 'eslint/config';
import baseConfig from '../../configs/base.eslint.config.mjs';

export default defineConfig([
    globalIgnores(['**/lib/', '**/__tests__/']),
    baseConfig,
    {
        rules: {
            // Tasks need to use process.exit(): throwing, as the rule suggests, keeps the process running
            'n/no-process-exit': 'off'
        }
    }
]);
