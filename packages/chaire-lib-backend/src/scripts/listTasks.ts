/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as glob from 'glob';

export const listTasks = (): string[] => {
    const tasksFilePaths = glob.sync(`${__dirname}/**/*.task.[j|t]s`);
    return tasksFilePaths;
};
