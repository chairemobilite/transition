/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import workerpool, { Pool } from 'workerpool';

let pool: Pool | undefined = undefined;

function isMainThread(): boolean {
    return workerpool.isMainThread;
}

export const startPool = () => {
    if (!isMainThread()) {
        throw new TrError('startPool cannot be called from a worker thread', 'STARTPOOL0001');
    }
    // TODO: Add a server preference for the maximum number of workers
    console.log('Starting worker pool');
    pool = workerpool.pool(__dirname + '/TransitionWorkerPool.js', { maxWorkers: 1 });
};

export const execJob = async (...parameters: Parameters<Pool['exec']>): Promise<ReturnType<Pool['exec']>> => {
    if (!isMainThread()) {
        // FIXME If this happens, it means that a worker is trying to use the
        // pool. This could happen when we implement dependent jobs. We should
        // have a way to tell the main thread to execute the job. Or when we do
        // support this, maybe we'll have changed the implementation of the
        // queue, so for now, just throw an error.
        throw new TrError('execJob cannot be called from a worker thread', 'EXECPOOL0002');
    }
    if (pool === undefined) {
        throw new TrError(`Error executing job '${parameters[0]}': No executor available`, 'EXECPOOL001');
    }
    return pool.exec(...parameters);
};

export const terminatePool = async () => {
    if (pool !== undefined) {
        console.log('Terminating worker pool');
        // Forcing termination to avoid waiting for long running tasks
        // TODO Implement proper abort mechanism for the tasks, so they can be cleanly stopped
        await pool.terminate(true);
        console.log('Terminated worker pool');
        pool = undefined;
    }
};
