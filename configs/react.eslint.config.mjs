/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import reactPlugin from 'eslint-plugin-react';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import baseConfig from './base.eslint.config.mjs';

// eslint-plugin-react's `version: 'detect'` setting uses context methods that
// were removed in eslint 10, so we resolve the react version ourselves, from
// the package being linted.
const reactVersion = createRequire(path.join(process.cwd(), 'package.json'))('react/package.json').version;

export default defineConfig([
    baseConfig,
    // Uses the recommended rules from eslint-plugin-react
    reactPlugin.configs.flat.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2020,
                ...globals.node
            }
        },
        rules: {
            // Frontend code runs in the browser, where localStorage is not node's experimental feature
            'n/no-unsupported-features/node-builtins': ['error', { ignores: ['localStorage'] }],
            'react/prop-types': 'error',
            'react/no-string-refs': 'error',
            'react/no-unescaped-entities': 'error',
            'react/display-name': 'error'
        },
        settings: {
            react: {
                // Regex for Component Factory to use, default to "createReactClass"
                createClass: 'createReactClass',
                // Pragma to use, default to "React"
                pragma: 'React',
                version: reactVersion
            }
        }
    }
]);
