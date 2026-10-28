/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import gtsConfig from './gts.eslint.config.mjs';

// Base eslint configuration for all typescript packages. The `format` scripts
// run prettier then `eslint --fix`, that's the way to go to have allman braces
// AND prettier formatting, so the prettier plugin is not used here.
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
            // Imports used only as types must use `import type`, or the
            // inline `type` modifier when mixed with values. This makes it
            // explicit that the module is not needed at runtime, which lets
            // `n/no-unpublished-import` accept type-only devDependencies.
            '@typescript-eslint/consistent-type-imports': [
                'error',
                {
                    fixStyle: 'inline-type-imports'
                }
            ],
            // `import { type A, type B }` must be `import type { A, B }`:
            // `n/no-unpublished-import` only ignores the latter, and the
            // former is kept as a side-effect import by `verbatimModuleSyntax`
            '@typescript-eslint/no-import-type-side-effects': 'error',
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
                    allowModules: ['@playwright/test'],
                    // Packages imported only with `import type` are not
                    // needed at runtime, so they can be devDependencies
                    ignoreTypeImport: true
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
