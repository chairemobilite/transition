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
        // Tasks need to use process.exit(): throwing, as the rule suggests, keeps the process running
        files: ['src/scripts/**/*.task.ts'],
        rules: {
            'n/no-process-exit': 'off'
        }
    }
]);
