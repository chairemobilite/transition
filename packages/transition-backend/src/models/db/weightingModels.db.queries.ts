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

import { WeightingModelAttributes } from 'transition-common/lib/services/weights/WeightingModel';

const tableName = 'tr_weighting_models';

const read = async (id: number): Promise<WeightingModelAttributes> => {
    try {
        const rows = await knex(tableName).select('*').where('id', id);

        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBWM0006',
                'DatabaseCannotReadWeightingModelBecauseObjectDoesNotExist'
            );
        } else {
            const row = rows[0];
            // Convert null to undefined for optional fields
            return {
                id: row.id,
                name: row.name,
                calculation: row.calculation ?? undefined,
                notes: row.notes ?? undefined,
                references: row.references ?? undefined
            };
        }
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBWM0007',
            'DatabaseCannotReadWeightingModelBecauseDatabaseError'
        );
    }
};

const collection = async (): Promise<WeightingModelAttributes[]> => {
    try {
        const response = await knex(tableName).select('*').orderBy('name', 'asc');
        // Convert null to undefined for optional fields
        return response.map((row) => ({
            id: row.id,
            name: row.name,
            calculation: row.calculation ?? undefined,
            notes: row.notes ?? undefined,
            references: row.references ?? undefined
        }));
    } catch (error) {
        throw new TrError(
            `cannot fetch weighting models collection because of a database error (knex error: ${error})`,
            'DBWM0001',
            'WeightingModelsCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: async (
        newObject: Omit<WeightingModelAttributes, 'id'>,
        _options?: Parameters<typeof create>[4]
    ): Promise<number> => {
        try {
            const returningArray = await knex(tableName).insert(newObject).returning('id');
            return returningArray[0].id;
        } catch (error) {
            throw new TrError(
                `Cannot insert object in table ${tableName} database (knex error: ${error})`,
                'DBWM0002',
                'DatabaseCannotCreateWeightingModelBecauseDatabaseError'
            );
        }
    },
    createMultiple: async (
        newObjects: Omit<WeightingModelAttributes, 'id'>[],
        _options?: Parameters<typeof createMultiple>[4]
    ) => {
        try {
            const returningArray = await knex(tableName).insert(newObjects).returning('id');
            return returningArray;
        } catch (error) {
            throw new TrError(
                `Cannot insert objects in table ${tableName} database (knex error: ${error})`,
                'DBWM0003',
                'DatabaseCannotCreateMultipleWeightingModelsBecauseDatabaseError'
            );
        }
    },
    update: async (
        id: number,
        updatedObject: Partial<WeightingModelAttributes>,
        _options?: Parameters<typeof update>[5]
    ): Promise<number> => {
        try {
            await knex(tableName).where('id', id).update(updatedObject);
            return id;
        } catch (error) {
            throw new TrError(
                `Cannot update object with id ${id} from table ${tableName} (knex error: ${error})`,
                'DBWM0004',
                'DatabaseCannotUpdateWeightingModelBecauseDatabaseError'
            );
        }
    },
    updateMultiple: async (
        updatedObjects: Array<Partial<WeightingModelAttributes> & { id: number }>,
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
                'DBWM0005',
                'DatabaseCannotUpdateMultipleWeightingModelsBecauseDatabaseError'
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
