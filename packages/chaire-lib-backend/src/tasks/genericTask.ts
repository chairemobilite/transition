/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * Generic task type, with a single run method
 */
export type GenericTask = {
    run(argv: { [key: string]: unknown }): Promise<void>;
};
