/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import {
    exists,
    create,
    createMultiple,
    update,
    updateMultiple,
    deleteRecord,
    deleteMultiple,
    truncate,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { WeightDataSourceAttributes } from 'transition-common/lib/services/weights/WeightDataSource';

const tableName = 'tr_weight_data_sources';

const read = async (id: number): Promise<WeightDataSourceAttributes> => {
    try {
        const rows = await knex(tableName).select('*').where('id', id);

        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBWDS0006',
                'DatabaseCannotReadWeightDataSourceBecauseObjectDoesNotExist'
            );
        } else {
            const row = rows[0];
            // Convert null to undefined for optional fields
            return {
                id: row.id,
                name: row.name,
                description: row.description ?? undefined,
                weighting_model_id: row.weighting_model_id ?? undefined,
                max_access_time_seconds: row.max_access_time_seconds ?? undefined,
                max_bird_distance_meters: row.max_bird_distance_meters ?? undefined,
                created_at: row.created_at ?? undefined,
                updated_at: row.updated_at ?? undefined
            };
        }
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBWDS0007',
            'DatabaseCannotReadWeightDataSourceBecauseDatabaseError'
        );
    }
};

const collection = async (): Promise<WeightDataSourceAttributes[]> => {
    try {
        const response = await knex(tableName).select('*').orderBy('name', 'asc');
        // Convert null to undefined for optional fields
        return response.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description ?? undefined,
            weighting_model_id: row.weighting_model_id ?? undefined,
            max_access_time_seconds: row.max_access_time_seconds ?? undefined,
            max_bird_distance_meters: row.max_bird_distance_meters ?? undefined,
            created_at: row.created_at ?? undefined,
            updated_at: row.updated_at ?? undefined
        }));
    } catch (error) {
        throw new TrError(
            `cannot fetch weight data sources collection because of a database error (knex error: ${error})`,
            'DBWDS0001',
            'WeightDataSourcesCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: async (
        newObject: Omit<WeightDataSourceAttributes, 'id' | 'created_at' | 'updated_at'>,
        _options?: Parameters<typeof create>[4]
    ): Promise<number> => {
        try {
            const returningArray = await knex(tableName).insert(newObject).returning('id');
            return returningArray[0].id;
        } catch (error) {
            throw new TrError(
                `Cannot insert object in table ${tableName} database (knex error: ${error})`,
                'DBWDS0002',
                'DatabaseCannotCreateWeightDataSourceBecauseDatabaseError'
            );
        }
    },
    createMultiple: async (
        newObjects: Omit<WeightDataSourceAttributes, 'id' | 'created_at' | 'updated_at'>[],
        _options?: Parameters<typeof createMultiple>[4]
    ) => {
        try {
            const returningArray = await knex(tableName).insert(newObjects).returning('id');
            return returningArray;
        } catch (error) {
            throw new TrError(
                `Cannot insert objects in table ${tableName} database (knex error: ${error})`,
                'DBWDS0003',
                'DatabaseCannotCreateMultipleWeightDataSourcesBecauseDatabaseError'
            );
        }
    },
    update: async (
        id: number,
        updatedObject: Partial<Omit<WeightDataSourceAttributes, 'id' | 'created_at'>>,
        _options?: Parameters<typeof update>[5]
    ): Promise<number> => {
        try {
            await knex(tableName).where('id', id).update(updatedObject);
            return id;
        } catch (error) {
            throw new TrError(
                `Cannot update object with id ${id} from table ${tableName} (knex error: ${error})`,
                'DBWDS0004',
                'DatabaseCannotUpdateWeightDataSourceBecauseDatabaseError'
            );
        }
    },
    updateMultiple: async (
        updatedObjects: Array<Partial<WeightDataSourceAttributes> & { id: number }>,
        _options?: Parameters<typeof updateMultiple>[4]
    ) => {
        try {
            const promises = updatedObjects.map((obj) => {
                const { id, ...attributes } = obj;
                return knex(tableName).where('id', id).update(attributes);
            });
            await Promise.all(promises);
            return updatedObjects.map((obj) => ({ id: obj.id }));
        } catch (error) {
            throw new TrError(
                `Cannot update multiple objects in table ${tableName} (knex error: ${error})`,
                'DBWDS0005',
                'DatabaseCannotUpdateMultipleWeightDataSourcesBecauseDatabaseError'
            );
        }
    },
    delete: async (id: number, options?: Parameters<typeof deleteRecord>[3]) =>
        deleteRecord(knex, tableName, id, options),
    deleteMultiple: async (ids: number[], options?: Parameters<typeof deleteMultiple>[3]) =>
        deleteMultiple(knex, tableName, ids, options),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
