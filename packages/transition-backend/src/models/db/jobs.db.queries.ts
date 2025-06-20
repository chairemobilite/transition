/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import { truncate, destroy } from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { Knex } from 'knex';
import { JobAttributes, JobDataType, JobStatus } from 'transition-common/lib/services/jobs/Job';

const tableName = 'tr_jobs';

// Convert the db fields to the attributes used in the Job class. We need to map
// status_messages field to the statusMessages property and change nulls to
// undefined
const attributesParser = <U extends JobDataType>({
    resources,
    updated_at,
    status_messages,
    ...rest
}: Omit<JobAttributes<U>, 'statusMessages'> & {
    status_messages: JobAttributes<U>['statusMessages'];
}): JobAttributes<U> => ({
        resources: resources || undefined,
        updated_at: updated_at || undefined,
        statusMessages: status_messages || undefined,
        ...rest
    });

// Convert application attributes to the db fields. The statusMessages property
// is mapped to the status_messages field
const attributesCleaner = <U extends JobDataType>(
    attributes: Partial<JobAttributes<U>>
): Omit<JobAttributes<U>, 'statusMessages'> & { status_messages: JobAttributes<U>['statusMessages'] } => {
    const { statusMessages, ...rest } = attributes;
    const _attributes: any = {
        status_messages: statusMessages,
        ...rest
    };

    return _attributes;
};

/**
 * Get a paginated collection of jobs
 *
 * @param options Query options: userId is the ID of the user for which to get
 * the job data. `jobType` is the title of the jobs to fetch. `pageIndex` and
 * `pageSize` allow paging the query. To return all rows, pageSize can be set to
 * 0. `sort` allow to specify a field and sort direction.
 * @returns
 */
const collection = async (
    options: {
        userId?: number;
        jobType?: string;
        statuses?: JobStatus[];
        pageIndex: number;
        pageSize: number;
        sort?: { field: keyof JobAttributes<JobDataType>; direction: 'asc' | 'desc' }[];
    } = { pageIndex: 0, pageSize: 0 }
): Promise<{ jobs: JobAttributes<JobDataType>[]; totalCount: number }> => {
    try {
        const addWhere = (query: Knex.QueryBuilder) => {
            if (options.userId !== undefined) {
                query.where('user_id', options.userId);
            }
            if (options.jobType !== undefined) {
                query.where('name', options.jobType);
            }
            if (options.statuses !== undefined) {
                const statuses = options.statuses;
                if (statuses.length === 1) {
                    query.where('status', options.statuses[0]);
                } else if (statuses.length > 1) {
                    query.whereIn('status', statuses);
                }
            }
        };
        const sorts = options.sort || [{ field: 'created_at', direction: 'desc' }];

        // Get the total count for that query
        const countQuery = knex.count('id').from(tableName);
        addWhere(countQuery);
        const countResult = await countQuery;
        const totalCount: number =
            countResult.length === 1
                ? typeof countResult[0].count === 'string'
                    ? parseInt(countResult[0].count)
                    : countResult[0].count
                : 0;
        if (totalCount === 0) {
            return { jobs: [], totalCount };
        }

        const jobsQuery = knex.select().from(tableName);
        sorts.forEach((sort) => jobsQuery.orderBy(sort.field, sort.direction));
        addWhere(jobsQuery);
        if (options.pageSize > 0) {
            jobsQuery.limit(options.pageSize).offset(options.pageIndex * options.pageSize);
        }
        const response = await jobsQuery;
        return { jobs: response.map(attributesParser), totalCount };
    } catch (error) {
        throw new TrError(
            `cannot fetch jobs collection because of a database error (knex error: ${error})`,
            'TTASKDB0001',
            'TransitTaskCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const exists = async (id: number): Promise<boolean> => {
    try {
        const rows = await knex(tableName).count('*').where('id', id);

        const count = rows.length > 0 ? rows[0].count : 0;
        if (count) {
            return (typeof count === 'string' ? parseInt(count) : count) >= 1;
        } else {
            throw new TrError(
                `Cannot verify if the object with id ${id} exists in ${tableName} (knex did not return a count)`,
                'DBQEX0002',
                'DatabaseCannotVerifyIfObjectExistsBecauseDatabaseError'
            );
        }
    } catch (error) {
        throw new TrError(
            `Cannot verify if the object with id ${id} exists in ${tableName} (knex error: ${error})`,
            'DBQEX0003',
            'DatabaseCannotVerifyIfObjectExistsBecauseDatabaseError'
        );
    }
};

const read = async (id: number): Promise<JobAttributes<JobDataType>> => {
    try {
        const rows = await knex(tableName).select('*').where('id', id);

        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRD0002',
                'DatabaseCannotReadBecauseObjectDoesNotExist'
            );
        } else {
            const _newObject = attributesParser(
                rows[0] as typeof attributesParser extends (arg: infer T) => any ? T : never
            );
            return _newObject;
        }
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQRD0003',
            'DatabaseCannotReadBecauseDatabaseError'
        );
    }
};

const create = async (job: Omit<JobAttributes<JobDataType>, 'id'>): Promise<number> => {
    try {
        const returningArray = await knex(tableName).insert(attributesCleaner(job)).returning('id');
        return returningArray[0].id;
    } catch (error) {
        throw new TrError(
            `Cannot insert object in table ${tableName} database (knex error: ${error})`,
            'DBQCR0001',
            'DatabaseCannotCreateJobBecauseDatabaseError'
        );
    }
};

/**
 * Update a job. Most properties should be immutable, only status, data,
 * internal_data and resources can be updated
 * @param id ID of the object to update
 * @param attributes The attributes to update
 * @returns The ID of the updated object
 */
const update = async (
    id: number,
    attributes: Partial<
        Pick<JobAttributes<JobDataType>, 'status' | 'data' | 'resources' | 'internal_data' | 'statusMessages'>
    >
): Promise<number> => {
    try {
        const returningArray = await knex(tableName)
            .update(attributesCleaner(attributes))
            .where('id', id)
            .returning('id');
        return returningArray[0].id;
    } catch (error) {
        throw new TrError(
            `Cannot update object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQUP0002',
            'DatabaseCannotUpdateJobBecauseDatabaseError'
        );
    }
};

const deleteRecord = async (id: number) => {
    try {
        await knex(tableName).where('id', id).del();
        return id;
    } catch (error) {
        throw new TrError(
            `Cannot delete object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQDL0002',
            'ObjectCannotDeleteBecauseDatabaseError'
        );
    }
};

/**
 * Only the job class should directly call these functions. Jobs use
 * resources on the system, that may need to be initialized/deleted. The Job
 * class should handle that.
 *
 * These functions only handle the corresponding database records.
 * */
export default {
    exists,
    read,
    create,
    update,
    delete: deleteRecord,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
