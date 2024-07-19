/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import { truncate, destroy } from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { OdTripRouteResult } from '../../services/transitRouting/types';

const tableName = 'tr_batch_route_results';

type TripJobResult = {
    jobId: number;
    tripIndex: number;
    data: OdTripRouteResult;
};

const create = async (result: TripJobResult): Promise<void> => {
    try {
        await knex(tableName).insert({
            job_id: result.jobId,
            trip_index: result.tripIndex,
            data: result.data
        });
    } catch (error) {
        throw new TrError(
            `Cannot insert result ${result.tripIndex} for job ${result.jobId} in table ${tableName} database (knex error: ${error})`,
            'DBBRR0001',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

const attributesParser = ({
    job_id,
    trip_index,
    data
}: {
    job_id: number;
    trip_index: number;
    data: {
        uuid: string;
        internalId: string;
        origin?: GeoJSON.Point;
        destination?: GeoJSON.Point;
        results?: any;
    };
}): TripJobResult => ({
    jobId: job_id,
    tripIndex: trip_index,
    data
});

/**
 * Get a paginated collection results for a job
 *
 * @param jobId The ID of the job for which to get the results
 * @param options Query options: `pageIndex` and `pageSize` allow paging the
 * query. To return all rows, pageSize can be set to 0.
 * @returns
 */
const collection = async (
    jobId: number,
    options: {
        pageIndex: number;
        pageSize: number;
    } = { pageIndex: 0, pageSize: 0 }
): Promise<{ totalCount: number; tripResults: TripJobResult[] }> => {
    try {
        // Get the total count for that query
        const countResult = await knex.count().from(tableName).where('job_id', jobId);

        const totalCount: number =
            countResult.length === 1
                ? typeof countResult[0].count === 'string'
                    ? parseInt(countResult[0].count)
                    : countResult[0].count
                : 0;
        if (totalCount === 0) {
            return { tripResults: [], totalCount };
        }

        const resultsQuery = knex.select().from(tableName).where('job_id', jobId);
        resultsQuery.orderBy('trip_index');
        if (options.pageSize > 0) {
            resultsQuery.limit(options.pageSize).offset(options.pageIndex * options.pageSize);
        }
        const response = await resultsQuery;
        return { tripResults: response.map(attributesParser), totalCount };
    } catch (error) {
        throw new TrError(
            `cannot fetch batch route results collection because of a database error (knex error: ${error})`,
            'DBBRR0002',
            'TransitTaskResultCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

/**
 * Get a stream of results
 * FIXME Should this replace the collection call?
 *
 * @param jobId The ID of the job for which to get the results
 * @returns
 */
const streamResults = (jobId: number) => {
    try {
        const resultsQuery = knex.select().from(tableName).where('job_id', jobId).orderBy('trip_index');

        // TODO Try to pipe the attributeParser in the stream
        return resultsQuery.stream();
    } catch (error) {
        throw new TrError(
            `cannot fetch batch route results stream because of a database error (knex error: ${error})`,
            'DBBRR0002',
            'TransitTaskResultCouldNotBeStreamedBecauseDatabaseError'
        );
    }
};

/**
 * Count the results for a specific job
 *
 * @param jobId The ID of the job for which to count the results
 * @returns The number of results for the job
 */
const countResults = async (jobId: number) => {
    try {
        const countResult = await knex.count().from(tableName).where('job_id', jobId);

        return countResult.length === 1
            ? typeof countResult[0].count === 'string'
                ? parseInt(countResult[0].count)
                : countResult[0].count
            : 0;
    } catch (error) {
        throw new TrError(
            `cannot count results for job because of a database error (knex error: ${error})`,
            'DBBRR0002',
            'TransitTaskResultCouldNotBeCountedBecauseDatabaseError'
        );
    }
};

/**
 * Delete the results for a specific job
 *
 * @param jobId The ID of the job for which to delete
 * @param tripIndex The index of the trip result from which to delete the
 * results. If specified, only the results with indexes greater or equal to this
 * index will be deleted.
 */
const deleteForJob = async (jobId: number, tripIndex?: number): Promise<void> => {
    try {
        const deleteQuery = knex(tableName).delete().where('job_id', jobId);
        if (tripIndex !== undefined) {
            deleteQuery.andWhere('trip_index', '>=', tripIndex);
        }
        await deleteQuery;
    } catch (error) {
        throw new TrError(
            `Cannot delete results for job ${jobId} in table ${tableName} database (knex error: ${error})`,
            'DBBRR0003',
            'DatabaseCannotDeleteBecauseDatabaseError'
        );
    }
};

export default {
    create,
    collection,
    streamResults,
    countResults,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    deleteForJob,
    resultParser: attributesParser
};
