/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import path from 'path';

import Job, { JobAttributes, JobDataType } from 'transition-common/lib/services/jobs/Job';
import jobsDbQueries from '../../models/db/jobs.db.queries';
import { directoryManager } from 'chaire-lib-backend/lib//utils/filesystem/directoryManager';
import { execJob } from '../../tasks/serverWorkerPool';
import Users from 'chaire-lib-backend/lib/services/users/users';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

export type InitialJobData = {
    inputFiles?: string[];
    hasOutputFiles?: boolean;
};

export class ExecutableJob<TData extends JobDataType> extends Job<TData> {
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
        { inputFiles, hasOutputFiles, ...attributes }: Omit<JobAttributes<TData>, 'id' | 'status'> & InitialJobData,
        jobListener?: EventEmitter
    ): Promise<ExecutableJob<TData>> {
        // Check the disk usage if the job has output files
        if (hasOutputFiles) {
            const diskUsage = Users.getUserDiskUsage(attributes.user_id);
            if (diskUsage.remaining !== undefined && diskUsage.remaining <= 0) {
                throw 'UserDiskQuotaReached';
            }
        }

        const id = await jobsDbQueries.create({ status: 'pending', ...attributes });
        jobListener?.emit('executableJob.updated', { id, name: attributes.name });
        const job = new ExecutableJob<TData>({ id, status: 'pending', ...attributes });
        if (inputFiles) {
            inputFiles.forEach((inputFile) => {
                const parsedInput = path.parse(inputFile);
                fileManager.copyFileAbsolute(
                    inputFile,
                    `${job.getJobFileDirectory()}/${parsedInput.name}${parsedInput.ext}`,
                    true
                );
            });
        }
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

    async enqueue(progressEmitter: EventEmitter): Promise<any> {
        // TODO Handle the cancellation
        await this.save();
        return execJob('task', [this.attributes.id], {
            on: function (payload) {
                progressEmitter.emit(payload.event, payload.data);
            }
        });
    }

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
        const { resources, data } = this.attributes;
        const updatedId = await jobsDbQueries.update(this.attributes.id, { status: this.status, resources, data });
        jobListener?.emit('executableJob.updated', { id: updatedId, name: this.attributes.name });
        return updatedId;
    }

    async delete(jobListener?: EventEmitter): Promise<number> {
        // Delete resources used by this task
        const fileDirectory = this.getJobFileDirectory();
        if (directoryManager.directoryExistsAbsolute(fileDirectory)) {
            directoryManager.deleteDirectoryAbsolute(fileDirectory);
        }
        const id = await jobsDbQueries.delete(this.attributes.id);
        jobListener?.emit('executableJob.updated', { id, name: this.attributes.name });
        return id;
    }
}
