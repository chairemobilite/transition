/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import 'chaire-lib-backend/lib/config/dotenv.config';

import { listTasks } from './listTasks';
import { select, number } from '@inquirer/prompts';
import path from 'path';

const run = async function () {
    const tasksFilePaths = listTasks();
    if (tasksFilePaths.length === 0) {
        console.log('There are no tasks to run');
        return;
    }

    const taskFilepath = await select({
        message: 'Select a task to run',
        choices: tasksFilePaths.map((taskFilePath) => {
            return {
                name: path.basename(taskFilePath, '.task.js'),
                value: taskFilePath
            };
        })
    });

    const memoryNeeded = await number({
        message: 'memoryNeeded (in Mb)',
        default: 4096
    });

    console.log(`yarn node --max-old-space-size=${memoryNeeded} ${taskFilepath}`);

    return;
};

run()
    .then(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    })
    .catch(() => {
        // eslint-disable-next-line no-process-exit
        process.exit();
    });
