/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import workerpool, { WorkerPool } from 'workerpool';

let pool: WorkerPool | undefined = undefined;

export const startPool = () => {
    // TODO: Add a server preference for the maximum number of workers
    pool = workerpool.pool(__dirname + '/TransitionWorkerPool.js', { maxWorkers: 1 });
};

export const execJob = async (
    ...parameters: Parameters<WorkerPool['exec']>
): Promise<ReturnType<WorkerPool['exec']>> => {
    if (pool === undefined) {
        throw new TrError(`Error executing job '${parameters[0]}': No executor available`, 'EXECPOOL001');
    }
    return pool.exec(...parameters);
};
