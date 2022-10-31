/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import moment from 'moment';

import { JobsConstants } from 'transition-common/lib/api/jobs';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { JobAttributes, JobDataType } from 'transition-common/lib/services/jobs/Job';
import { ExecutableJob } from '../services/executableJob/ExecutableJob';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';

/**
 * Add routes specific to the executable jobs
 *
 * @export
 * @param {EventEmitter} socket The socket to register the routes to
 * @param {number} userId The ID of the connected user
 */
export default function(socket: EventEmitter, userId: number) {
    socket.on(
        JobsConstants.LIST_JOBS,
        async (
            parameters: { jobType?: string; pageIndex?: number; pageSize?: number },
            callback: (
                status: Status.Status<{
                    jobs: (JobAttributes<JobDataType> & { hasFiles: boolean })[];
                    totalCount: number;
                }>
            ) => void
        ) => {
            try {
                const { jobs, totalCount } = await ExecutableJob.collection({
                    userId,
                    jobType: parameters.jobType,
                    pageIndex: parameters.pageIndex || 0,
                    pageSize: parameters.pageSize || 0
                });
                callback(
                    Status.createOk({
                        jobs: jobs.map((job) => ({
                            ...job.attributes,
                            status: job.status,
                            hasFiles: directoryManager.isEmptyAbsolute(job.getJobFileDirectory()) === false
                        })),
                        totalCount
                    })
                );
            } catch (error) {
                console.error(error);
                callback(Status.createError('Error getting job list from server'));
            }
        }
    );

    socket.on(
        JobsConstants.GET_FILES,
        async (
            id: number,
            callback: (
                status: Status.Status<{
                    [fileName: string]: { url: string; downloadName: string };
                }>
            ) => void
        ) => {
            try {
                const job = await ExecutableJob.loadTask(id);
                const jobResourceFiles = job.attributes.resources?.files || {};
                const files = directoryManager.getFilesAbsolute(job.getJobFileDirectory());
                const jobFiles: {
                    [fileName: string]: { url: string; downloadName: string; title: string };
                } = {};
                Object.keys(jobResourceFiles).forEach((file) => {
                    if (jobResourceFiles[file] && files?.includes(jobResourceFiles[file] as string)) {
                        const fileName = jobResourceFiles[file] as string;
                        const match = fileName.match(/([^/]+)\.([^/]+)$/);
                        const formattedTime = moment(job.attributes.created_at || '').format('YYYYMMDD_HHmmss');
                        const downloadName =
                            match === null
                                ? `${fileName}_${formattedTime}`
                                : `${match[1]}_${formattedTime}.${match[2]}`;
                        jobFiles[file] = {
                            url: `/job/${id}/${jobResourceFiles[file] as string}`,
                            downloadName: downloadName,
                            title: `transit:jobs:${job.attributes.name}:files:${file}`
                        };
                    }
                });
                callback(Status.createOk(jobFiles));
            } catch (error) {
                console.error(error);
                callback(Status.createError('Error getting files from server for job'));
            }
        }
    );

    socket.on(JobsConstants.DELETE_JOB, async (id: number, callback: (status: Status.Status<boolean>) => void) => {
        try {
            const job = await ExecutableJob.loadTask(id);
            await job.delete(socket);
            callback(Status.createOk(true));
        } catch (error) {
            console.error(error);
            callback(Status.createError('Error deleting job from server'));
        }
    });

    socket.on(JobsConstants.CANCEL_JOB, async (id: number, callback: (status: Status.Status<boolean>) => void) => {
        try {
            const job = await ExecutableJob.loadTask(id);
            if (job.setCancelled()) {
                await job.save(socket);
            }
            callback(Status.createOk(true));
        } catch (error) {
            console.error(error);
            callback(Status.createError('Error cancelling job'));
        }
    });
}
