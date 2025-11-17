/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/**
 * Optional parameters for TrRouting batch job configuration.
 * These parameters control TrRouting instance behavior.
 */
export type TrRoutingBatchJobParameters = {
    /**
     * Custom cache directory path for TrRouting capnp cache files.
     * If provided, TrRouting will load and use cache files from this directory.
     * This is useful for pre-generated cache files or when you want to control
     * cache location independently of the default project cache directory.
     *
     * Example: '/path/to/custom/cache/directory'
     */
    cacheDirectoryPath?: string;
};
