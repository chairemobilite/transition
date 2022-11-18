/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import '../config/dotenv.config';

// Just make sure the config is initialized in the task, so tasks that are in common workspaces can have the right config
import '../config/server.config';
import Inspector from 'inspector-api';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { fileManager } from '../utils/filesystem/fileManager';

import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';

async function profilingWrapper(
    task: GenericTask,
    fileManager: any,
    argv: { [key: string]: unknown },
    profileFile: unknown
) {
    // See if profiling is enabled for this task
    const inspector = new Inspector();
    try {
        await inspector.profiler.enable();
        await inspector.profiler.start();
        await task.run(argv);
        const profile = await inspector.profiler.stop();
        if (profileFile) {
            fileManager.writeFileAbsolute(profileFile, JSON.stringify(profile));
            console.log('Saved profiling data to %s', profileFile);
        }
    } catch (error) {
        const profile = await inspector.profiler.stop();
        if (profileFile) {
            fileManager.writeFileAbsolute(profileFile, JSON.stringify(profile));
            console.log('Saved profiling data to %s', profileFile);
        }
        throw error;
    }
}

async function taskWrapper(task: GenericTask) {
    // TODO Add a way for tasks to advertise their required arguments and automatically warn the user if arguments are missing (or mispelled?)
    const argv = yargs(hideBin(process.argv)).argv;

    const doProfile = argv.profile;
    const profileFile = doProfile ? (argv.to ? argv.to : __dirname + '/profilingData.json') : null;
    delete argv.profile;
    delete argv.to;

    try {
        await (doProfile ? profilingWrapper(task, fileManager, argv, profileFile) : task.run(argv));
        console.log('Task complete');
    } catch (error) {
        console.error('task did not complete correctly', error);
    }
}

export default taskWrapper;
