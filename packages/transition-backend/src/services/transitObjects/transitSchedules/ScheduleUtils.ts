/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// This file contains utility functions for schedules that wrap the database
// calls for some functionalities.

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { WithTransaction } from 'chaire-lib-backend/lib/models/db/types.db';
import schedulesDbQueries from '../../../models/db/transitSchedules.db.queries';

export type DuplicateScheduleMappings = {
    /**
     * The mapping of original line IDs to new line IDs
     */
    lineIdMapping?: { [originalLineId: string]: string };
    /**
     * The mapping of original service IDs to new service IDs
     */
    serviceIdMapping?: { [originalServiceId: string]: string };
    /**
     * The mapping of original path IDs to new path IDs
     */
    pathIdMapping?: { [originalPathId: string]: string };
};

/**
 * Duplicate schedules with the mapping
 *
 * @param mappings The mapping of original objects to the new ones. There should
 * be at least a mapping of lines or services to allow duplication.
 * @param transaction The database transaction to use
 * @returns A status object a mapping of the previous service IDs to the new
 * ones
 */
export const duplicateSchedules = async (
    mappings: DuplicateScheduleMappings,
    { transaction }: WithTransaction = {}
): Promise<Status.Status<{ [originalScheduleId: number]: number }>> => {
    try {
        const result = await schedulesDbQueries.duplicateSchedule({ ...mappings, transaction });
        return Status.createOk(result);
    } catch (error) {
        console.log('An error occurred while duplicating schedules: ', error);
        return Status.createError('An error occurred while duplicating schedules');
    }
};
