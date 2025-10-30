/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from 'chaire-lib-common/lib/utils/TrError';
import workerpool, { Pool } from 'workerpool';

let pool: Pool | undefined = undefined;

export const startPool = () => {
    // TODO: Add a server preference for the maximum number of workers
    console.log('Starting worker pool');
    pool = workerpool.pool(__dirname + '/TransitionWorkerPool.js', { maxWorkers: 1 });
};

export const execJob = async (...parameters: Parameters<Pool['exec']>): Promise<ReturnType<Pool['exec']>> => {
    if (pool === undefined) {
        throw new TrError(`Error executing job '${parameters[0]}': No executor available`, 'EXECPOOL001');
    }
    return pool.exec(...parameters);
};
