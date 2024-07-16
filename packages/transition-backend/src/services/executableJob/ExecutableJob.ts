/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import { EventEmitter } from 'events';
import path from 'path';

import Job, { JobAttributes, JobDataType, fileKey } from 'transition-common/lib/services/jobs/Job';
import jobsDbQueries from '../../models/db/jobs.db.queries';
import { directoryManager } from 'chaire-lib-backend/lib//utils/filesystem/directoryManager';
import { execJob } from '../../tasks/serverWorkerPool';
import Users from 'chaire-lib-backend/lib/services/users/users';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import clientEventManager from '../../utils/ClientEventManager';

export type InitialJobData<TData extends JobDataType> = {
    inputFiles?: {
        [Property in keyof TData[fileKey]]?: string | { filepath: string; renameTo: string };
    };
    hasOutputFiles?: boolean;
};

export class ExecutableJob<TData extends JobDataType> extends Job<TData> {
    static async enqueueRunningAndPendingJobs<TData extends JobDataType>(): Promise<boolean> {
        try {
            const runningAndPending = await jobsDbQueries.collection({
                statuses: ['inProgress', 'pending'],
                pageIndex: 0,
                pageSize: 0,
                // Statuses are sorted by their enum value, not alphabetically, pending < inProgress, descending returns inProgress first
                sort: [
                    { field: 'status', direction: 'desc' },
                    { field: 'created_at', direction: 'asc' }
                ]
            });
            console.log(`Enqueuing ${runningAndPending.jobs.length} in progress and pending jobs`);
            for (let i = 0; i < runningAndPending.jobs.length; i++) {
                const job = new ExecutableJob<TData>(runningAndPending.jobs[i] as JobAttributes<TData>);
                await job.enqueue();
            }

            return true;
        } catch (error) {
            console.error('Error resuming in progress and pending jobs:', error);
            return false;
        }
    }

    static async loadTask<TData extends JobDataType>(id: number): Promise<ExecutableJob<TData>> {
        const jobAttributes = await jobsDbQueries.read(id);
        return new ExecutableJob<TData>(jobAttributes as JobAttributes<TData>);
    }

    static async collection(options: {
        userId?: number;
        jobType?: string;
        pageIndex: number;
        pageSize: number;
        sort?: { field: keyof JobAttributes<JobDataType>; direction: 'asc' | 'desc' }[];
    }): Promise<Promise<{ jobs: ExecutableJob<JobDataType>[]; totalCount: number }>> {
        const { jobs, totalCount } = await jobsDbQueries.collection(options);
        return { jobs: jobs.map((attribs) => new ExecutableJob<JobDataType>(attribs)), totalCount };
    }

    static async createJob<TData extends JobDataType>(
        {
            inputFiles,
            hasOutputFiles,
            ...attributes
        }: Omit<JobAttributes<TData>, 'id' | 'status' | 'internal_data'> & InitialJobData<TData>,
        jobListener?: EventEmitter
    ): Promise<ExecutableJob<TData>> {
        const jobProgressEmitter =
            jobListener !== undefined ? jobListener : clientEventManager.getUserEventEmitter(attributes.user_id);
        // Check the disk usage if the job has output files
        if (hasOutputFiles) {
            const diskUsage = Users.getUserDiskUsage(attributes.user_id);
            if (diskUsage.remaining !== undefined && diskUsage.remaining <= 0) {
                throw 'UserDiskQuotaReached';
            }
        }

        // Initialize the job's input files
        const toCopy: {
            filePath: string;
            jobFileName: string;
        }[] = [];
        if (inputFiles) {
            const jobFiles: {
                [Property in keyof TData[fileKey]]?: string;
            } = {};
            Object.keys(inputFiles).forEach((inputFileKey: keyof TData[fileKey]) => {
                const inputFile = inputFiles[inputFileKey];
                if (inputFile === undefined) {
                    return;
                }
                const inputFilePath = typeof inputFile === 'string' ? inputFile : inputFile.filepath;
                if (fileManager.fileExistsAbsolute(inputFilePath)) {
                    const jobFileName =
                        typeof inputFile === 'string' ? path.parse(inputFilePath).base : inputFile.renameTo;
                    jobFiles[inputFileKey] = jobFileName;
                    toCopy.push({
                        filePath: inputFilePath,
                        jobFileName: jobFileName
                    });
                }
            });
            attributes.resources = { ...(attributes.resources || {}), files: jobFiles };
        }

        const id = await jobsDbQueries.create({ status: 'pending', internal_data: {}, ...attributes });
        jobProgressEmitter.emit('executableJob.updated', { id, name: attributes.name });
        const job = new ExecutableJob<TData>({ id, status: 'pending', internal_data: {}, ...attributes });
        toCopy.forEach(({ filePath, jobFileName }) =>
            fileManager.copyFileAbsolute(filePath, `${job.getJobFileDirectory()}/${jobFileName}`, true)
        );
        return job;
    }

    protected constructor(attributes: JobAttributes<TData>) {
        super(attributes);
    }

    /**
     * Get the absolute path to the directory which should contain job data
     * @returns Absolute directory where to store job data
     */
    getJobFileDirectory(): string {
        const userId = this.attributes.user_id;
        return `${directoryManager.userDataDirectory}/${userId !== undefined ? userId : 'no_user'}/${
            this.attributes.id
        }/`;
    }

    async enqueue(progressEmitter?: EventEmitter): Promise<any> {
        // TODO Handle the cancellation
        const jobProgressEmitter =
            progressEmitter !== undefined
                ? progressEmitter
                : clientEventManager.getUserEventEmitter(this.attributes.user_id);
        await this.save();
        execJob('task', [this.attributes.id], {
            on: function (payload) {
                jobProgressEmitter.emit(payload.event, payload.data);
            }
        });
    }

    getFilePath = (fileName: keyof TData['files']): string | undefined => {
        const jobFiles = this.attributes.resources?.files;
        if (jobFiles === undefined) {
            return undefined;
        }
        const file = jobFiles[fileName];
        const files = directoryManager.getFilesAbsolute(this.getJobFileDirectory());
        if (file === undefined || files === null || !files.includes(file)) {
            return undefined;
        }
        const filePath = path.join(this.getJobFileDirectory(), file);
        if (!fs.existsSync(filePath)) {
            return undefined;
        }
        return filePath;
    };

    setCancelled(): boolean {
        if (this.status === 'pending' || this.status === 'inProgress') {
            this.status = 'cancelled';
            return true;
        }
        return false;
    }

    setInProgress(): boolean {
        if (this.status === 'pending') {
            this.status = 'inProgress';
            return true;
        }
        return false;
    }

    setCompleted(): boolean {
        if (this.status === 'inProgress') {
            this.status = 'completed';
            return true;
        }
        return false;
    }

    setFailed(): boolean {
        if (this.status === 'inProgress') {
            this.status = 'failed';
            return true;
        }
        return false;
    }

    async refresh(): Promise<void> {
        try {
            const attributes = (await jobsDbQueries.read(this.attributes.id)) as JobAttributes<TData>;
            this.status = attributes.status;
            this.attributes.data = attributes.data;
            this.attributes.resources = attributes.resources;
        } catch (error) {
            // The job doesn't exist in the database, it probably has been deleted
            throw 'Job deleted';
        }
    }

    async save(jobListener?: EventEmitter): Promise<number> {
        const jobProgressEmitter =
            jobListener !== undefined ? jobListener : clientEventManager.getUserEventEmitter(this.attributes.user_id);
        const { resources, data, internal_data } = this.attributes;
        console.log('Updating job with checkpoint', internal_data.checkpoint);
        const updatedId = await jobsDbQueries.update(this.attributes.id, {
            status: this.status,
            resources,
            data,
            internal_data
        });
        console.log('Updated job with checkpoint', internal_data.checkpoint);
        jobProgressEmitter.emit('executableJob.updated', { id: updatedId, name: this.attributes.name });
        return updatedId;
    }

    async delete(jobListener?: EventEmitter): Promise<number> {
        const jobProgressEmitter =
            jobListener !== undefined ? jobListener : clientEventManager.getUserEventEmitter(this.attributes.user_id);
        // Delete resources used by this task
        const fileDirectory = this.getJobFileDirectory();
        if (directoryManager.directoryExistsAbsolute(fileDirectory)) {
            directoryManager.deleteDirectoryAbsolute(fileDirectory);
        }
        const id = await jobsDbQueries.delete(this.attributes.id);
        jobProgressEmitter.emit('executableJob.updated', { id, name: this.attributes.name });
        return id;
    }
}
