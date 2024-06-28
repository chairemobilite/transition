/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import '../config/dotenv.config';

// Just make sure the config is initialized in the task, so tasks that are in common workspaces can have the right config
import '../config/server.config';
// The inspector feature does not have a version, it says "(none yet)" so eslint complained, disabling this rule
// eslint-disable-next-line n/no-unsupported-features/node-builtins
import Inspector from 'inspector';
import moment from 'moment';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { fileManager } from '../utils/filesystem/fileManager';

import { GenericTask } from 'chaire-lib-common/lib/tasks/genericTask';

// INIT_CWD is the directory from which the script was run (usually root of the
// repo), while PWD would be the chaire-lib-backend directory if run with `yarn
// start`
const workingDir = process.env.INIT_CWD || process.env.PWD;

const inpectorPost = async (inspector: Inspector.Session, message: string): Promise<unknown> => {
    return new Promise((resolve, reject) => {
        inspector.post(message, {}, (err: Error | null, params: unknown) =>
            err === null ? resolve(params) : reject(err)
        );
    });
};

async function profilingWrapper(
    task: GenericTask,
    fileManager: any,
    argv: { [key: string]: unknown },
    profileFile: unknown
) {
    const inspector = new Inspector.Session();
    inspector.connect();

    try {
        await inpectorPost(inspector, 'Profiler.enable');
        await inpectorPost(inspector, 'Profiler.start');
        await task.run(argv);
    } finally {
        const profile = ((await inpectorPost(inspector, 'Profiler.stop')) as Inspector.Profiler.StopReturnType).profile;
        if (profileFile) {
            fileManager.writeFileAbsolute(profileFile, JSON.stringify(profile));
            console.log('Saved profiling data to %s', profileFile);
        }
        await inpectorPost(inspector, 'Profiler.disable');
    }
}

async function taskWrapper(task: GenericTask) {
    // TODO Add a way for tasks to advertise their required arguments and automatically warn the user if arguments are missing (or mispelled?)
    const argv = yargs(hideBin(process.argv)).argv;

    const doProfile = argv.profile;
    const profileFile = doProfile
        ? argv.to
            ? argv.to
            : `${workingDir}/profilingData_${moment().format('YYYYMMDD_HHmmss')}.cpuprofile`
        : null;
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
