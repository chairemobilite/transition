/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from '../../config/shared/db.config';
import { validate as uuidValidate } from 'uuid';

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
} from './default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { DataSourceAttributes, DataSourceType } from 'chaire-lib-common/lib/services/dataSource/DataSource';

const tableName = 'tr_data_sources';

const collection = async (
    options: { type?: DataSourceType; userId?: number } = {}
): Promise<DataSourceAttributes[]> => {
    try {
        const query = knex(tableName);
        if (options.type !== undefined) {
            query.where('type', options.type);
        }
        if (options.userId !== undefined) {
            query.where((builder) => {
                builder.where('owner', options.userId);
                builder.orWhereNull('owner');
            });
        }
        query.orderBy('name');
        const collection = await query;
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

/**
 * Find a single data source by its name or shortname
 *
 * @param name Name or shortname of the data source to find
 * @returns The data source attributes if found or undefined otherwise
 */
const findByName = async (name: string, userId?: number): Promise<DataSourceAttributes | undefined> => {
    try {
        const query = knex(tableName);
        query.where((builder) => {
            builder.where('name', name);
            builder.orWhere('shortname', name);
        });
        if (userId !== undefined) {
            query.andWhere('owner', userId);
        }
        const dataSources = await query;
        return dataSources.length > 0 ? dataSources[0] : undefined;
    } catch (error) {
        throw new TrError(
            `cannot query data sources by name of a database error (knex error: ${error})`,
            'DBQDSC0003',
            'DataSourceCouldNotQueryByNameBecauseDatabaseError'
        );
    }
};

const read = async (id: string, userId?: number): Promise<DataSourceAttributes> => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQDSC0004',
                'DatabaseCannotReadDataSourceBecauseIdIsMissingOrInvalid'
            );
        }
        const query = knex(tableName).where('id', id);
        if (userId !== undefined) {
            query.andWhere('owner', userId);
        }
        const rows = await query;

        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRD0002',
                'DatabaseCannotReadDataSourceBecauseObjectDoesNotExist'
            );
        } else {
            return rows[0];
        }
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQRD0003',
            'DatabaseCannotReadDataSourceBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
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
    collection,
    findByName
};
