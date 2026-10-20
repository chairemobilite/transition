/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import gtsConfig from './gts.eslint.config.mjs';

// Base eslint configuration for all typescript packages. Formatting is done
// with prettier-eslint, which runs prettier then `eslint --fix`, that's the way
// to go to have allman braces AND prettier formatting, so the prettier plugin
// is not used here.
export default defineConfig([
    // Dotfiles (like .prettierrc.js) were ignored by default by eslint before the flat config
    globalIgnores(['**/.*'], 'transition/dotfiles'),
    gtsConfig,
    // Uses the recommended rules from typescript-eslint
    tseslint.configs.recommended,
    {
        rules: {
            '@typescript-eslint/no-var-requires': 'warn',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-require-imports': 'warn',
            'arrow-parens': ['error', 'always'],
            'brace-style': ['error', '1tbs', { allowSingleLine: true }],
            'constructor-super': 'error',
            'n/no-missing-require': [
                'error',
                {
                    tryExtensions: ['.js', '.json', '.node', '.ts']
                }
            ],
            'n/no-unpublished-import': [
                'error',
                {
                    allowModules: ['@playwright/test']
                }
            ],
            indent: ['error', 4, { VariableDeclarator: 0 }],
            'linebreak-style': ['error', 'unix'],
            'no-dupe-keys': 'error',
            'no-empty': 'error',
            'no-empty-function': 'error',
            'no-unexpected-multiline': 'error',
            'no-constant-condition': 'error',
            'no-this-before-super': 'error',
            'no-import-assign': 'error',
            'no-irregular-whitespace': 'error',
            'no-trailing-spaces': 'error',
            'no-const-assign': 'error',
            'no-mixed-spaces-and-tabs': 'error',
            'no-useless-escape': 'error',
            'no-cond-assign': 'error',
            'no-dupe-else-if': 'error',
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { vars: 'all', args: 'after-used', argsIgnorePattern: '^_', ignoreRestSiblings: false }
            ],
            'object-curly-spacing': ['error', 'always'],
            semi: ['error', 'always'],
            quotes: ['error', 'single']
        }
    },
    {
        // The eslint configuration files are not part of the packages' code
        files: ['eslint.config.mjs'],
        rules: {
            'n/no-unpublished-import': 'off'
        }
    }
]);
