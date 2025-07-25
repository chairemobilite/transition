/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// This file is meant as the entry point of the worker pool, to be run in workers directly
import workerpool from 'workerpool';
import { EventEmitter } from 'events';

import { batchRoute } from '../services/transitRouting/TrRoutingBatch';
import { batchAccessibilityMap } from '../services/transitRouting/TrAccessibilityMapBatch';
import prepareSocketRoutes from '../scripts/prepareProcessRoutes';
import OSRMProcessManager from 'chaire-lib-backend/lib/utils/processManagers/OSRMProcessManager';
import { ExecutableJob } from '../services/executableJob/ExecutableJob';
import { BatchRouteJobType } from '../services/transitRouting/BatchRoutingJob';
import { BatchAccessMapJobType } from '../services/transitRouting/BatchAccessibilityMapJob';
import { JobDataType } from 'transition-common/lib/services/jobs/Job';
import Users from 'chaire-lib-backend/lib/services/users/users';
import TrError from 'chaire-lib-common/lib/utils/TrError';

prepareSocketRoutes();

function newProgressEmitter(task: ExecutableJob<JobDataType>) {
    const eventEmitter = new EventEmitter();
    eventEmitter.on('progress', (progressData: { name: string; customText?: string; progress: number }) => {
        workerpool.workerEmit({
            event: 'progress',
            data: progressData
        });
    });
    eventEmitter.on('checkpoint', (checkpoint: number) => {
        console.log('Task received checkpoint ', checkpoint);
        // Refresh the task before saving the checkpoint
        task.refresh()
            .then(() => {
                // Add checkpoint, then save the task
                task.attributes.internal_data.checkpoint = checkpoint;
                task.save().catch(() => console.error('Error saving task after checkpoint'));
            })
            .catch(() => console.error('Error refreshing task before saving checkpoint')); // This will catch deleted jobs
    });
    return eventEmitter;
}

function taskUpdateListener() {
    const eventEmitter = new EventEmitter();
    eventEmitter.on('executableJob.updated', (data: unknown) => {
        workerpool.workerEmit({
            event: 'executableJob.updated',
            data
        });
    });
    return eventEmitter;
}

const assertDiskUsage = (task: ExecutableJob<JobDataType>) => {
    const diskUsage = Users.getUserDiskUsage(task.attributes.user_id);
    if (diskUsage.remaining !== undefined && diskUsage.remaining <= 0) {
        throw new TrError(
            'Maximum allowed disk space reached',
            'TRJOB0001',
            'transit:transitRouting:errors:UserDiskQuotaReached'
        );
    }
};

const getTaskCancelledFct = (task: ExecutableJob<JobDataType>) => {
    let refreshError = false;
    // Poll cancellation every 5 seconds
    const intervalObj = setInterval(() => {
        task.refresh()
            .then(() => {
                // Cancel polling whenever status is not in progress anymore
                if (task.status !== 'inProgress') {
                    clearInterval(intervalObj);
                }
            })
            .catch(() => (refreshError = true)); // This will catch deleted jobs
    }, 5000);
    return () => refreshError || task.status === 'cancelled';
};

const wrapBatchRoute = async (task: ExecutableJob<BatchRouteJobType>): Promise<boolean> => {
    const absoluteUserDir = task.getJobFileDirectory();
    const inputFileName = task.attributes.resources?.files.input;
    if (inputFileName === undefined) {
        throw 'InvalidInputFile';
    }
    const { files, errors, warnings, ...result } = await batchRoute(
        task.attributes.data.parameters.demandAttributes,
        task.attributes.data.parameters.transitRoutingAttributes,
        {
            jobId: task.attributes.id,
            absoluteBaseDirectory: absoluteUserDir,
            inputFileName,
            progressEmitter: newProgressEmitter(task),
            isCancelled: getTaskCancelledFct(task),
            currentCheckpoint: task.attributes.internal_data.checkpoint
        }
    );
    task.attributes.data.results = result;
    task.attributes.resources = { files };
    // Set status messages if there are errors or warnings
    if (errors.length > 0 || warnings.length > 0) {
        task.attributes.statusMessages = {
            errors: errors,
            warnings: warnings
        };
    }
    return result.completed;
};

const wrapBatchAccessMap = async (task: ExecutableJob<BatchAccessMapJobType>): Promise<boolean> => {
    const absoluteUserDir = task.getJobFileDirectory();
    const { files, errors, warnings, ...result } = await batchAccessibilityMap(
        task.attributes.data.parameters.batchAccessMapAttributes,
        task.attributes.data.parameters.accessMapAttributes,
        absoluteUserDir,
        newProgressEmitter(task),
        getTaskCancelledFct(task)
    );
    task.attributes.data.results = result;
    task.attributes.resources = { files };
    // Set status messages if there are errors or warnings
    if (errors.length > 0 || warnings.length > 0) {
        task.attributes.statusMessages = {
            errors: errors,
            warnings: warnings
        };
    }
    return result.completed;
};

// Exported for unit tests
export const wrapTaskExecution = async (id: number) => {
    // Load task from database and execute only if it is pending, or resume tasks in progress
    const task = await ExecutableJob.loadTask(id);
    if (task.status !== 'pending' && task.status !== 'inProgress') {
        return;
    }
    const taskListener = taskUpdateListener();
    // Set the status to in progress
    task.setInProgress();
    await task.save(taskListener);
    // Execute the right function for this task
    try {
        assertDiskUsage(task);
        let taskResultStatus = true;
        switch (task.attributes.name) {
        case 'batchRoute':
            taskResultStatus = await wrapBatchRoute(task as ExecutableJob<BatchRouteJobType>);
            break;
        case 'batchAccessMap':
            taskResultStatus = await wrapBatchAccessMap(task as ExecutableJob<BatchAccessMapJobType>);
            break;
        default:
            console.log(`Unknown task ${task.attributes.name}`);
            taskResultStatus = false;
        }
        if (taskResultStatus) {
            task.setCompleted();
        } else {
            task.setFailed();
        }
    } catch (error) {
        console.error(
            `Setting job ${task.attributes.id} (${task.attributes.name}) as failed because of an error: ${error}`
        );
        if (TrError.isTrError(error)) {
            task.attributes.statusMessages = {
                errors: [error.export().localizedMessage]
            };
        } else {
            task.attributes.statusMessages = {
                errors: ['transit:transitRouting:errors:TransitBatchRouteCannotBeCalculatedBecauseError']
            };
        }
        task.setFailed();
    }
    await task.save(taskListener);
};

const run = async () => {
    // Prepare socket routes to be able to use them
    prepareSocketRoutes();
    await OSRMProcessManager.configureAllOsrmServers(false);

    // create a worker and register public functions
    workerpool.worker({
        task: wrapTaskExecution
    });
};

run();

export default workerpool;
