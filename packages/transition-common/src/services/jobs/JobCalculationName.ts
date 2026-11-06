/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import slugify from 'slugify';
import _get from 'lodash/get';

import type { JobAttributes, JobDataType } from './Job';

/** Maximum length of the calculation name slug added to the job file names */
export const CALCULATION_NAME_SLUG_MAX_LENGTH = 20;

/** Path of the user-defined calculation name in the data of each job type supporting it */
const calculationNamePathByJobType: { [jobType: string]: string } = {
    batchRoute: 'parameters.transitRoutingAttributes.calculationName',
    batchAccessMap: 'parameters.batchAccessMapAttributes.calculationName'
};

/**
 * Get the user-defined calculation name of a job
 *
 * @param {Pick<JobAttributes<JobDataType>, 'name' | 'data'>} job The job
 * attributes
 * @returns {string | undefined} The trimmed calculation name, or undefined if
 * the job type does not support it or the name is blank
 */
export const getJobCalculationName = (job: Pick<JobAttributes<JobDataType>, 'name' | 'data'>): string | undefined => {
    const path = calculationNamePathByJobType[job.name];
    const calculationName = path === undefined ? undefined : _get(job.data, path);
    return typeof calculationName === 'string' && calculationName.trim() !== '' ? calculationName.trim() : undefined;
};

/**
 * Convert a calculation name to a slug that can be used in a file name
 *
 * @param {string} calculationName The calculation name
 * @returns {string} The slug, at most {@link CALCULATION_NAME_SLUG_MAX_LENGTH}
 * characters long, without trailing separators. It may be empty if the name
 * contains only invalid characters.
 */
export const toCalculationNameSlug = (calculationName: string): string =>
    slugify(calculationName, { replacement: '_', remove: /[/^*=;:#$%?&|[\]{}+~.()'"!\\@<>,`]/g })
        .substring(0, CALCULATION_NAME_SLUG_MAX_LENGTH)
        .replace(/[_-]+$/, '');
