/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// stream-json only exposes its subpaths through the `exports` field of its
// package.json, which TypeScript's `moduleResolution: node` does not read.
// Point the subpaths used here to their type declarations. Node.js finds the
// actual files through `exports`.
//
// TODO: Delete this file when chaire-lib-backend uses a module resolution that
// reads `exports` (TypeScript 6 deprecates `moduleResolution: node`, and
// TypeScript 7 removes it). The steps:
// 1. In packages/chaire-lib-backend/tsconfig.json, set `"module": "node20"` and
//    `"moduleResolution": "node16"`. The compiled code stays CommonJS, as the
//    package.json has no `"type": "module"`.
// 2. ts-jest then warns on every test file with TS151002, as it only supports
//    these module kinds with `isolatedModules: true`. Either remove
//    `"isolatedModules": false` from the tsconfig.json, but ts-jest then stops
//    type checking the tests, or add `diagnostics: { ignoreCodes: [151002] }`
//    to the ts-jest options in packages/chaire-lib-backend/jest.config.js.
declare module 'stream-json/filters/filter-base.js' {
    export * from 'stream-json/src/filters/filter-base.js';
    export { default } from 'stream-json/src/filters/filter-base.js';
}

declare module 'stream-json/filters/pick.js' {
    export * from 'stream-json/src/filters/pick.js';
    export { default } from 'stream-json/src/filters/pick.js';
}

declare module 'stream-json/streamers/stream-array.js' {
    export * from 'stream-json/src/streamers/stream-array.js';
    export { default } from 'stream-json/src/streamers/stream-array.js';
}
