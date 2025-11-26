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
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { execJob } from '../../tasks/serverWorkerPool';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import clientEventManager from '../../utils/ClientEventManager';
import TrError from 'chaire-lib-common/lib/utils/TrError';

export type InitialJobData<TData extends JobDataType> = {
    inputFiles?: {
        [Property in keyof TData[fileKey]]?: string | { filepath: string; renameTo: string };
    };
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
        parentId?: number;
    }): Promise<{ jobs: ExecutableJob<JobDataType>[]; totalCount: number }> {
        const { jobs, totalCount } = await jobsDbQueries.collection(options);
        return { jobs: jobs.map((attribs) => new ExecutableJob<JobDataType>(attribs)), totalCount };
    }

    protected static async createJobInternal<TData extends JobDataType>(
        {
            inputFiles,
            ...attributes
        }: Omit<JobAttributes<TData>, 'id' | 'status' | 'internal_data'> & InitialJobData<TData>,
        jobListener?: EventEmitter
    ): Promise<ExecutableJob<TData>> {
        const jobProgressEmitter =
            jobListener !== undefined ? jobListener : clientEventManager.getUserEventEmitter(attributes.user_id);

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

    static async createJob<TData extends JobDataType>(
        // TODO We should split the JobAttributes type and have one that exclude the "internal" field like those omitted here
        jobData: Omit<JobAttributes<TData>, 'id' | 'status' | 'internal_data' | 'parentJobId'> & InitialJobData<TData>,
        jobListener?: EventEmitter
    ): Promise<ExecutableJob<TData>> {
        if ('parentJobId' in jobData) {
            throw new Error('createJob should not be called with a parentJobId. Use createChildJob instead.');
        }
        return ExecutableJob.createJobInternal(jobData, jobListener);
    }

    /**
     * Create a new job as a child of an existing job
     * @param jobData The new child job's data
     * @param jobListener A listener to listen to a job's progress
     * @returns The new ExecutableJob object
     */
    async createChildJob<TData extends JobDataType>(
        // TODO We should split the JobAttributes type and have one that exclude the "internal" field like those omitted here
        jobData: Omit<JobAttributes<TData>, 'id' | 'status' | 'internal_data' | 'parentJobId' | 'user_id'> &
            InitialJobData<TData>,
        jobListener?: EventEmitter
    ): Promise<ExecutableJob<TData>> {
        // FIXME If files are shared between parent and child, we may want to handle that here instead of the job's creator?
        return ExecutableJob.createJobInternal(
            {
                ...jobData,
                user_id: this.attributes.user_id,
                parentJobId: this.attributes.id
            },
            jobListener
        );
    }

    protected constructor(attributes: JobAttributes<TData>) {
        super(attributes);
    }
    /**
     * Get the list of child jobs
     */
    async getChildren(): Promise<{ jobs: ExecutableJob<JobDataType>[]; totalCount: number }> {
        return ExecutableJob.collection({ pageSize: 0, pageIndex: 0, parentId: this.attributes.id });
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
        const jobProgressEmitter =
            progressEmitter !== undefined
                ? progressEmitter
                : clientEventManager.getUserEventEmitter(this.attributes.user_id);
        await this.save();
        //TODO TEMPORARY SKIP ENQUEUE CHILD JOB (ONES WITH DEFINED PARENT ID)
        //WE HAVE NOT YET IMPLEMENT A SYNCHRONISATION/NOTIFICATION MECANISM BETWEEN CHILD AND PARENT
        //SO FOR NOW THE PARENT WOULD NEED TO RUN THE JOB MANUALLY
        if (this.attributes.parentJobId === null || this.attributes.parentJobId === undefined) {
            execJob('task', [this.attributes.id], {
                on: function (payload) {
                    jobProgressEmitter.emit(payload.event, payload.data);
                }
            });
        } else {
            console.warn(`NOT IMPLEMENTED: SKIPPING ENQUEUING CHILD JOB ${this.attributes.id}`);
        }
    }
    /**
     * Register an output file that will be created by this job
     * This must be called before getWriteStream() or getFileName() for that file key
     *
     * @param fileKey - The key for this file (must be in the job type's files definition)
     * @param filename - The filename to use (just the name, not a path)
     * @throws If the file key is already registered with a different filename
     */
    registerOutputFile(fileKey: keyof TData['files'], filename: string): void {
        // Ensure resources exists with proper structure
        if (!this.attributes.resources) {
            this.attributes.resources = { files: {} };
        }

        // Check if already registered with different name
        const existing = this.attributes.resources.files[fileKey];
        if (existing !== undefined && existing !== filename) {
            throw new TrError(
                `File key '${String(fileKey)}' already registered with filename '${existing}'`,
                'TREJB0005'
            );
        }

        // Register the filename
        this.attributes.resources.files[fileKey] = filename;
    }

    /**
     * Does the job have a file attribute of the specified key
     */
    hasFile(file: keyof TData['files']): boolean {
        const fileName = this.getFileName(file);
        if (fileName === undefined) {
            return false;
        }
        return true;
    }

    /** Return the filename associated with the specified key */
    getFileName = (file: keyof TData['files']): string | undefined => {
        const jobFiles = this.attributes.resources?.files;
        if (jobFiles === undefined) {
            return undefined;
        }
        const fileName = jobFiles[file];
        return fileName;
    };

    /**
     * Return the full absolute path of the file associated with the specified key
     * Will throw if the file is not defined or does not exist
     */
    getFilePath = (file: keyof TData['files']): string => {
        const fileName = this.getFileName(file);
        const files = directoryManager.getFilesAbsolute(this.getJobFileDirectory());
        if (fileName === undefined || files === null || !files.includes(fileName)) {
            //TODO Define an TrError to throw
            throw 'File not available';
        }
        const filePath = path.join(this.getJobFileDirectory(), fileName);
        if (!fs.existsSync(filePath)) {
            //TODO Define an TrError to throw
            throw 'File does not exist';
        }
        return filePath;
    };

    /** Check if the job has a input file specified */
    hasInputFile(): boolean {
        return this.hasFile('input');
    }

    /** Return input filename */
    getInputFileName(): string {
        const inputFileName = this.getFileName('input');
        if (inputFileName === undefined) {
            throw new TrError('Invalid input file', 'TREJB0001', 'transit:transitRouting:errors:InvalidInputFile');
        }
        return inputFileName;
    }

    /**
     * Return the full absolute path of the input file
     * Will throw if the file is not defined or does not exist
     */
    getInputFilePath(): string {
        try {
            return this.getFilePath('input');
        } catch {
            // TODO We keep this error for the moment, as it's propagated and translated in the UI.
            throw 'InputFileUnavailable';
        }
    }

    /**
     * Check if a file exists for this job
     * @param file - The file key to check
     * @returns boolean indicating if the file exists
     */
    fileExists(file: keyof TData['files']): boolean {
        const fileName = this.getFileName(file);
        if (fileName === undefined) {
            return false;
        }
        const filePath = path.join(this.getJobFileDirectory(), fileName);
        return fs.existsSync(filePath);
    }

    /**
     * Get a read stream for a file associated with this job
     * @param file - The file key from the job's files definition
     * @returns A readable stream for the file
     * @throws {TrError} If the file is not defined or does not exist
     */
    getReadStream(file: keyof TData['files']): fs.ReadStream {
        const fileName = this.getFileName(file);
        if (fileName === undefined) {
            throw new TrError(
                `File '${String(file)}' is not defined for this job`,
                'TREJB0002',
                'transit:transitRouting:errors:FileNotDefined'
            );
        }
        const filePath = path.join(this.getJobFileDirectory(), fileName);
        if (!fs.existsSync(filePath)) {
            throw new TrError(
                `File '${String(file)}' does not exist at path: ${filePath}`,
                'TREJB0003',
                'transit:transitRouting:errors:FileDoesNotExist'
            );
        }
        return fs.createReadStream(filePath);
    }

    /**
     * Get a write stream for a file associated with this job
     * Creates the file in the job's directory using the filename stored in resources
     * @param file - The file key from the job's files definition
     * @param options - Optional fs.WriteStream options
     * @returns A writable stream for the file
     * @throws {TrError} If the file is not defined in the job's resources
     */
    getWriteStream(file: keyof TData['files'], options?: Parameters<typeof fs.createWriteStream>[1]): fs.WriteStream {
        const fileName = this.getFileName(file);
        if (fileName === undefined) {
            throw new TrError(
                `File '${String(file)}' is not defined for this job`,
                'TREJB0002',
                'transit:transitRouting:errors:FileNotDefined'
            );
        }

        // Ensure the directory exists
        const directory = this.getJobFileDirectory();
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // We cannot use getFilePath as it checks if the file exist
        const filePath = path.join(directory, fileName);
        return fs.createWriteStream(filePath, options);
    }

    setCancelled(): boolean {
        if (this.status === 'pending' || this.status === 'inProgress' || this.status === 'paused') {
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

    /**
     * Set the status to 'paused' for pending or in progress job. The caller
     * needs to save the task after setting the status.
     *
     * @returns Whether the task has successfully be put to paused.
     */
    setPaused(): boolean {
        if (this.status === 'inProgress' || this.status === 'pending') {
            this.status = 'paused';
            return true;
        }
        return false;
    }

    /**
     * Resume a paused job and enqueue it again. Callers do not need to save the
     * job, as it has been saved before enqueuing.
     *
     * @param progressEmitter Optional event emitter to use for job progress
     * events
     * @returns Whether the task was successfully resumed. It will return
     * `false` if the task was not paused
     */
    async resume(progressEmitter?: EventEmitter): Promise<boolean> {
        if (this.status === 'paused') {
            // Resuming a paused job puts it back to a pending. If it was started
            // before and checkpointing is activated, the job should restart where it
            // was
            this.status = 'pending';
            // Enqueue the job again
            // FIXME If the job was paused while in progress and resumed shortly after, the job may still be running in the worker. We should have a way to make sure the worker is aware of state change. See issue #1558
            await this.enqueue(progressEmitter);
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
        } catch {
            // The job doesn't exist in the database, it probably has been deleted
            throw 'Job deleted';
        }
    }

    async save(jobListener?: EventEmitter): Promise<number> {
        const jobProgressEmitter =
            jobListener !== undefined ? jobListener : clientEventManager.getUserEventEmitter(this.attributes.user_id);
        const { resources, data, internal_data, statusMessages } = this.attributes;
        const updatedId = await jobsDbQueries.update(this.attributes.id, {
            status: this.status,
            resources,
            data,
            internal_data,
            statusMessages
        });
        jobProgressEmitter.emit('executableJob.updated', { id: updatedId, name: this.attributes.name });
        return updatedId;
    }

    async delete(jobListener?: EventEmitter): Promise<number> {
        const jobProgressEmitter =
            jobListener !== undefined ? jobListener : clientEventManager.getUserEventEmitter(this.attributes.user_id);
        // First delete all child jobs
        const children = await this.getChildren();
        await Promise.all(children.jobs.map((child) => child.delete(jobProgressEmitter)));
        // TODO We have a race here, if a different thread call createChildJob when we are at this point, a new child
        // could be added. With the ON DELETE RESTRICT, that would be make the delete call bellow to fail.
        // Node does not have good synchronisation mecanism to solve this. One thing that could be done
        // is setting a new status 'deleting' on the job at the begginning and prohibit child creation if we are in this
        // status.

        // Delete resources used by this task
        const fileDirectory = this.getJobFileDirectory();
        if (directoryManager.directoryExistsAbsolute(fileDirectory)) {
            directoryManager.deleteDirectoryAbsolute(fileDirectory);
        }
        const id = await jobsDbQueries.delete(this.attributes.id);

        jobProgressEmitter.emit('executableJob.updated', { id: this.attributes.id, name: this.attributes.name });
        return id;
    }
}
