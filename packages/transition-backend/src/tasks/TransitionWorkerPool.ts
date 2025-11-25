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
import { JobDataType, JobStatus } from 'transition-common/lib/services/jobs/Job';
import Users from 'chaire-lib-backend/lib/services/users/users';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { EvolutionaryTransitNetworkDesignJob, EvolutionaryTransitNetworkDesignJobType } from '../services/networkDesign/transitNetworkDesign/evolutionary/types';
import { runEvolutionaryTransitNetworkDesignJob } from '../services/networkDesign/transitNetworkDesign/evolutionary/EvolutionaryTransitNetworkDesignJob';


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

const isDiskSpaceSufficient = (task: ExecutableJob<JobDataType>) => {
    const diskUsage = Users.getUserDiskUsage(task.attributes.user_id);
    if (diskUsage.remaining !== undefined && diskUsage.remaining <= 0) {
        return false;
    }
    return true;
};

const getTaskCancelledFct = (task: ExecutableJob<JobDataType>) => {
    let currentStatus: JobStatus | undefined = task.status;
    let errorCount = 0;
    // Poll cancellation every 5 seconds
    const intervalObj = setInterval(() => {
        ExecutableJob.getJobStatus(task.attributes.id)
            .then((status) => {
                currentStatus = status;
                errorCount = 0; // reset error count on success
                // Cancel polling whenever status is not in progress anymore
                if (currentStatus !== 'inProgress') {
                    clearInterval(intervalObj);
                }
            })
            .catch((error) => {
                console.error('Error polling job status for cancellation: ', error);
                errorCount += 1;
                // If there's an error, set to undefined and stop after a few errors to avoid cancelling jobs by mistake because of transient errors
                if (errorCount >= 3) {
                    currentStatus = undefined;
                    clearInterval(intervalObj);
                }
            });
    }, 5000);
    // TODO Consider different callbacks for paused and cancelled, or at least
    // some way for the job executor to know which one it is (deleted, cancelled
    // or paused)
    return () => currentStatus === 'cancelled' || currentStatus === 'paused' || currentStatus === undefined;
};

const wrapBatchRoute = async (task: ExecutableJob<BatchRouteJobType>): Promise<boolean> => {
    if (!task.hasInputFile()) {
        throw new TrError('Invalid input file', 'TRJOB0002', 'transit:transitRouting:errors:InvalidInputFile');
    }
    const { files, errors, warnings, ...result } = await batchRoute(task, {
        progressEmitter: newProgressEmitter(task),
        isCancelled: getTaskCancelledFct(task)
    });
    // FIXME Consider uniformizing the way resources and results are saved in
    // the task, either documenting it is the task's responsibility, or doing it
    // in a wrapper function. But it should be avoided to count on each wrapper
    // refreshing the task. Revisit when merging the evolutionary transit
    // network design job, which does it differently
    await task.refresh(); // Refresh the task to make sure we have the latest version before saving results, in case it was updated while the batch was running
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
    if (!task.hasInputFile()) {
        throw new TrError('Invalid input file', 'TRJOB0003', 'transit:transitRouting:errors:InvalidInputFile');
    }
    const { files, errors, warnings, ...result } = await batchAccessibilityMap(
        task,
        newProgressEmitter(task),
        getTaskCancelledFct(task)
    );
    // FIXME Consider uniformizing the way resources and results are saved in
    // the task, either documenting it is the task's responsibility, or doing it
    // in a wrapper function. But it should be avoided to count on each wrapper
    // refreshing the task. Revisit when merging the evolutionary transit
    // network design job, which does it differently
    await task.refresh(); // Refresh the task to make sure we have the latest version before saving results, in case it was updated while the batch was running
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

const wrapEvolutionaryTransitNetworkDesign = async (task: EvolutionaryTransitNetworkDesignJob): Promise<boolean> => {
    // TODO Validate input files like other tasks
    const { errors, warnings, status } = await runEvolutionaryTransitNetworkDesignJob(task, {
        progressEmitter: newProgressEmitter(task),
        isCancelled: getTaskCancelledFct(task)
    });
    // TODO Handle results here
    if (errors.length > 0 || warnings.length > 0) {
        task.attributes.statusMessages = {
            errors: errors,
            warnings: warnings
        };
    }
    return status === 'success';
};

// Exported for unit tests
export const wrapTaskExecution = async (id: number) => {
    // Load task from database and execute only if it is pending, or resume tasks in progress
    const task = await ExecutableJob.loadTask(id);
    if (task.status !== 'pending' && task.status !== 'inProgress') {
        return;
    }
    const taskListener = taskUpdateListener();
    // Execute the right function for this task
    try {
        if (!isDiskSpaceSufficient(task)) {
            console.log(
                `Pausing job ${task.attributes.id} (${task.attributes.name}) because user disk quota is reached`
            );
            // Disk space is insufficient, pause the job so the user can clean up and resume
            task.setPaused();
            task.attributes.statusMessages = {
                errors: ['transit:transitRouting:errors:UserDiskQuotaReached']
            };
            await task.save(taskListener);
            return;
        }
        // Set the status to in progress
        task.setInProgress();
        await task.save(taskListener);
        let taskResultStatus = true;
        switch (task.attributes.name) {
        case 'batchRoute':
            taskResultStatus = await wrapBatchRoute(task as ExecutableJob<BatchRouteJobType>);
            break;
        case 'batchAccessMap':
            taskResultStatus = await wrapBatchAccessMap(task as ExecutableJob<BatchAccessMapJobType>);
            break;
        case 'evolutionaryTransitNetworkDesign':
            taskResultStatus = await wrapEvolutionaryTransitNetworkDesign(
                    task as EvolutionaryTransitNetworkDesignJob
            );
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

// Graceful shutdown handler
const shutdown = async (code: number | undefined) => {
    console.log('Worker received a shutdown request with code ', code);
    // TODO Implement proper shutdown of the tasks, like killing ongoing trRouting processes to avoid defunct (if this callback is called in case of dramatic termination)
};

const run = async () => {
    // Prepare socket routes to be able to use them
    prepareSocketRoutes();
    await OSRMProcessManager.configureAllOsrmServers(false);

    // create a worker and register public functions
    workerpool.worker(
        {
            task: wrapTaskExecution
        },
        { onTerminate: shutdown }
    );
};

run();

export default workerpool;
