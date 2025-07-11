/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { TransitValidationMessage } from '../../services/transitRouting/TransitRoutingValidation';

export interface BatchValidationResultAttributes {
    id?: number;
    job_id: number;
    trip_index: number;
    valid: boolean;
    data: TransitValidationMessage | { valid: true };
    created_at?: Date;
    updated_at?: Date;
}

const tableName = 'tr_batch_validation_results';

const collection = () => {
    return knex(tableName);
};

const create = async (attributes: Omit<BatchValidationResultAttributes, 'id' | 'created_at' | 'updated_at'>) => {
    const id = await collection()
        .insert({
            job_id: attributes.job_id,
            trip_index: attributes.trip_index,
            valid: attributes.valid,
            data: attributes.data
        })
        .returning('id');
    return { id: id[0] };
};

const deleteForJob = async (jobId: number, fromIndex?: number) => {
    const query = collection().where('job_id', jobId);
    
    if (fromIndex !== undefined) {
        query.andWhere('trip_index', '>=', fromIndex);
    }
    
    return await query.delete();
};

const countResults = async (jobId: number) => {
    const count = await collection().where('job_id', jobId).count('id as count');
    return parseInt(count[0].count as string);
};

const countValidResults = async (jobId: number) => {
    const count = await collection().where('job_id', jobId).where('valid', true).count('id as count');
    return parseInt(count[0].count as string);
};

const countInvalidResults = async (jobId: number) => {
    const count = await collection().where('job_id', jobId).where('valid', false).count('id as count');
    return parseInt(count[0].count as string);
};

const getResults = async (jobId: number, options: { limit?: number; offset?: number } = {}) => {
    const query = collection().where('job_id', jobId).orderBy('trip_index', 'asc');
    
    if (options.limit !== undefined) {
        query.limit(options.limit);
    }
    
    if (options.offset !== undefined) {
        query.offset(options.offset);
    }
    
    return await query.select('*');
};

const streamResults = (jobId: number) => {
    return collection().where('job_id', jobId).orderBy('trip_index', 'asc').stream();
};

export default {
    create,
    deleteForJob,
    countResults,
    countValidResults,
    countInvalidResults,
    getResults,
    streamResults
};
