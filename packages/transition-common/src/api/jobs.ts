/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export class JobsConstants {
    /**
     * Socket route name to list jobs for a user
     *
     * @static
     * @memberof JobsConstants
     */
    static readonly LIST_JOBS = 'executableJobs.list';
    /**
     * Socket route name to delete an individual job: expected parameter: id of the job
     *
     * @static
     * @memberof JobsConstants
     */
    static readonly DELETE_JOB = 'executableJobs.delete';
    /**
     * Socket route name to cancel an individual job: expected parameter: id of the job
     *
     * @static
     * @memberof JobsConstants
     */
    static readonly CANCEL_JOB = 'executableJobs.cancel';
    /**
     * Socket route name to pause an individual job: expected parameter: id of the job
     *
     * @static
     * @memberof JobsConstants
     */
    static readonly PAUSE_JOB = 'executableJobs.pause';
    /**
     * Socket route name to resume an individual job: expected parameter: id of the job
     *
     * @static
     * @memberof JobsConstants
     */
    static readonly RESUME_JOB = 'executableJobs.resume';
    /**
     * Socket route name to get the files for an individual job: expected parameter: id of the job
     *
     * @static
     * @memberof JobsConstants
     */
    static readonly GET_FILES = 'executableJobs.getFiles';
}
