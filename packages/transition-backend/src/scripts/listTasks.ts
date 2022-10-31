/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import glob from 'glob';
import { listTasks as listLibTasks } from 'chaire-lib-backend/lib/scripts/listTasks';

export const listTasks = (): string[] => {
    const tasksFilePaths = glob.sync(`${__dirname}/**/*.task.[j|t]s`, {
        ignore: `${__dirname}/**/listTasks.task.[j|t]s`
    });
    tasksFilePaths.push(...listLibTasks());
    return tasksFilePaths;
};
