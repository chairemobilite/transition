/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import js from '@eslint/js';
import nodePlugin from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

// Flat config version of the gts (Google TypeScript Style) eslint configuration
export default defineConfig([
    js.configs.recommended,
    // The packages are CommonJS, except for the .mjs files, like the eslint config files
    nodePlugin.configs['flat/recommended-script'],
    {
        files: ['**/*.mjs'],
        ...nodePlugin.configs['flat/recommended-module']
    },
    {
        rules: {
            'block-scoped-var': 'error',
            eqeqeq: 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'eol-last': 'error',
            'prefer-arrow-callback': 'error',
            'no-trailing-spaces': 'error',
            quotes: ['error', 'single', { avoidEscape: true }],
            'no-restricted-properties': [
                'error',
                {
                    object: 'describe',
                    property: 'only'
                },
                {
                    object: 'it',
                    property: 'only'
                }
            ]
        }
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        extends: [tseslint.configs.recommended],
        rules: {
            '@typescript-eslint/ban-ts-comment': 'error',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            '@typescript-eslint/no-var-requires': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            'n/no-missing-import': 'off',
            'n/no-unsupported-features/es-syntax': 'off',
            'n/no-missing-require': 'off',
            'n/hashbang': 'off',
            'no-dupe-class-members': 'off',
            'require-atomic-updates': 'off'
        }
    }
]);
