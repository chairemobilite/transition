import { ErrorMessage } from 'chaire-lib-common/lib/utils/TrError';

/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export type JobDataType = {
    name: string;
    data: { [key: string]: unknown };
    files: { [fileTitle: string]: boolean };
};

export type JobNameKey = 'name';
export type JobDataKey = 'data';
export type fileKey = 'files';

/**
 * Possible statuses for a job
 *
 * - 'pending': The job is created and waiting to be executed, it may be a new
 *   or resumed job. Next possible statuses: 'inProgress', 'cancelled', 'paused'
 * - 'inProgress': The job is currently being executed. Next possible statuses:
 *   'completed', 'failed', 'cancelled', 'paused'
 * - 'paused': The job has been temporarily paused and can be resumed manually.
 *   Next possible statuses: 'cancelled', 'pending'
 * - 'completed': The job has been successfully completed. This is a terminal
 *   state.
 * - 'failed': The job has encountered an error and did not complete
 *   successfully. This is a terminal state.
 * - 'cancelled': The job has been cancelled manually before completion. This
 *   is a terminal state.
 *
 * Here's a state diagram of the job statuses and their possible transitions.
 * States marked with '*' are terminal.
 *
 *
 *                          +-----------+
 *                          | completed*|
 *                          +-----------+
 *                                ^
 *                                |
 *                                |
 * +-----------+            +-----------+             +-----------+
 * |  pending  |-----run--->|inProgress |--onError--->|  failed*  |
 * +-----------+            +-----------+             +-----------+
 *  |  ^  |                       |  |
 *  |  |  |                       |  |
 *  |  |  pause                pause |
 *  |  |  |                       |  |
 *  |  |  |     +-----------+     |  |
 *  |  |  |---->|  paused   |<----|  cancel
 *  |  -resume- +-----------+        |
 *  |                 |              |
 *  |                 |              |
 *  |                 cancel         |
 *  cancel            |              |
 *  |           +-----v-----+        |
 *  |---------->| cancelled*|<-------|
 *              +-----------+
 */
export type JobStatus = 'pending' | 'inProgress' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface JobAttributes<TData extends JobDataType> {
    id: number;
    user_id: number;
    name: TData[JobNameKey];
    status: JobStatus;
    statusMessages?: { errors?: ErrorMessage[]; warnings?: ErrorMessage[]; infos?: ErrorMessage[] };
    /**
     * Data internal to the job management, that is not relevant to the users
     */
    internal_data: {
        checkpoint?: number;
    };
    data: {
        [Property in keyof TData[JobDataKey]]: TData[JobDataKey][Property];
    };
    /**
     * This field contains resources used by this job on the system, like files.
     * These can be deleted independently and should be deleted when the job is
     * deleted.
     */
    resources?: {
        files: { [Property in keyof TData[fileKey]]?: string };
    };
    created_at?: string;
    updated_at?: string;
}

/**
 * Generic job class to describe a long lasting operation whose parameters and
 * results can be saved to the database, in the data field. The generic allows
 * to type the name and data to match and makes sure the data attributes set
 * match the job's name. Typically, some class will handle a certain job type
 * details and can act upon a job, show the result to the user, etc.
 *
 * This class is read-only and meant to be used for example to show the user the
 * status and result of jobs.
 *
 * Here's an example usage of this class, with a test job:
 * ```
 * type TestJobType = {
 *     name: 'test';
 *     data: {
 *         parameters: {
 *             foo: string
 *         };
 *     },
 *     files: {
 *         testFile: boolean;
 *     }
 * }
 *
 * const mainJobObj = new Job<TestJobType>({ name: 'test', data: { parameters: { foo: 'bar' }}, user_id: 3 }, true);
 *
 * ```
 */
export class Job<TData extends JobDataType> {
    private _attributes: Omit<JobAttributes<TData>, 'status'>;
    private _status: JobStatus;
    protected static displayName = 'Job';

    constructor(attributes: JobAttributes<TData>) {
        const { status, ...rest } = attributes;
        this._attributes = rest;
        this._status = status;
    }

    toString() {
        return this._attributes.name;
    }

    /** Returns the numeric id */
    get id(): number {
        return this._attributes.id;
    }

    /** Get the attributes without the status. To get the status, use the status
     * getter instead */
    get attributes(): Omit<JobAttributes<TData>, 'status'> {
        return this._attributes;
    }

    get status() {
        return this._status;
    }

    protected set status(status: JobStatus) {
        this._status = status;
    }
}

export default Job;
