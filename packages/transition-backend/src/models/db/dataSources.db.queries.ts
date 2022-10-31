/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import {
    exists,
    read,
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

import { DataSourceAttributes, DataSourceType } from 'transition-common/lib/services/dataSource/DataSource';

const tableName = 'tr_data_sources';

const collection = async (type?: DataSourceType): Promise<DataSourceAttributes[]> => {
    try {
        const response = await knex.raw(`
        SELECT 
          *
        FROM ${tableName}
        ${type !== undefined ? `WHERE type = '${type}'` : ''}
        ORDER BY name;
      `);
        const collection = response.rows;
        if (collection) {
            return collection;
        }
        throw new TrError(
            'cannot fetch data sources collection because database did not return a valid array',
            'DBQDSC0001',
            'DataSourceCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch data sources collection because of a database error (knex error: ${error})`,
            'DBQDSC0002',
            'DataSourceCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read: read.bind(null, knex, tableName, undefined, '*'),
    create: (newObject: DataSourceAttributes, returning?: string) => {
        return create(knex, tableName, undefined, newObject, returning);
    },
    createMultiple: (newObjects: DataSourceAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, undefined, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<DataSourceAttributes>, returning?: string) => {
        return update(knex, tableName, undefined, id, updatedObject, returning);
    },
    updateMultiple: (updatedObjects: Partial<DataSourceAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, undefined, updatedObjects, returning);
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
