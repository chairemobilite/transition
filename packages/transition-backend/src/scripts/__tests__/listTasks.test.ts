/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { listTasks } from '../listTasks';
import { listTasks as listLibTasks } from 'chaire-lib-backend/lib/scripts/listTasks';

const tasks = [
    'cache/recreateCache.task.ts'
];

const libTasks = listLibTasks();

test('Test list tasks', () => {
    const allTasks = listTasks();
    expect(allTasks).toEqual(
        expect.arrayContaining(libTasks)
    );
    expect(allTasks).toEqual(
        expect.arrayContaining(tasks.map((task) => expect.stringContaining(task)))
    );
});
