/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validate as uuidValidate } from 'uuid';
import { Knex } from 'knex';
import { GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';

import TrError from 'chaire-lib-common/lib/utils/TrError';

// TODO Move these to a generic class, so we can use identical types for U and T in generic methods.

/**
 * Helper function to wrap the data source IDs in '' to be used in database
 * queries.
 *
 * FIXME Mostly called in the context of raw queries with a 'IN' where
 * statement. See if we can use a regular `whereIn` instead and remove the need
 * for this function.
 *
 * @param dataSourceIds An array of data source IDs to stringify
 * @returns A DB-ready array of data source id strings
 */
export const stringifyDataSourceIds = function (dataSourceIds: string[]): string[] {
    if (dataSourceIds && !Array.isArray(dataSourceIds)) {
        dataSourceIds = [dataSourceIds];
    }
    return dataSourceIds
        ? dataSourceIds.map((dataSourceId) => {
            return `'${dataSourceId}'`;
        })
        : [];
};

/**
 * Check whether a record with the given id exists in the table
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param id The ID of the object
 * @param {Object} options Additional options parameter.
 * @param {Knex.Transaction} [options.transaction] - transaction that this query
 * is part of
 * @returns Whether an object with the given ID exists in the table
 */
export const exists = async (
    knex: Knex,
    tableName: string,
    id: string,
    options: {
        transaction?: Knex.Transaction;
    } = {}
): Promise<boolean> => {
    if (!uuidValidate(id)) {
        throw new TrError(
            `Cannot verify if the object exists in ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
            'DBQEX0001',
            'DatabaseCannotVerifyIfObjectExistsBecauseIdIsMissingOrInvalid'
        );
    }
    try {
        const query = knex(tableName).count('*').where('id', id);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const rows = await query;

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

/**
 * Insert a new record in a table
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param parser A parser function which converts an object's attributes to db
 * fields
 * @param newObject The new object's attributes
 * @param options Additional options parameter. `returning` specifies which
 * field's or fields' values to return after insert. `transaction` is an
 * optional transaction of which this insert is part of.
 * @returns The requested `returning` field values.
 */
export const create = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: T) => U) | undefined,
    newObject: T,
    options: {
        returning?: string | string[];
        transaction?: Knex.Transaction;
    } = { returning: 'id' }
): Promise<string | { [key: string]: unknown }> => {
    try {
        const returning = options.returning || 'id';
        const _newObject = parser ? parser(newObject) : newObject;

        const query = knex(tableName).insert(_newObject).returning(returning);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const returningArray = await query;
        return typeof returning === 'string' ? returningArray[0][returning] : returningArray[0];
    } catch (error) {
        throw new TrError(
            `Cannot insert object with id ${newObject.id} in table ${tableName} database (knex error: ${error})`,
            'DBQCR0001',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

/**
 * Inset multiple records in a table
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param parser A parser function which converts an object's attributes to db
 * fields
 * @param newObjects An array of objects to insert
 * @param options Additional options parameter. `returning` specifies which
 * field's or fields' values to return after insert. `transaction` is an
 * optional transaction of which this insert is part of.
 * @returns An array with the requested `returning` field values for all
 * records.
 */
export const createMultiple = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: T) => U) | undefined,
    newObjects: T[],
    options: {
        returning?: string | string[];
        transaction?: Knex.Transaction;
    } = {}
): Promise<{ [key: string]: any }[]> => {
    try {
        const returning = options.returning || 'id';
        const _newObjects =
            typeof parser === 'function'
                ? newObjects.map((newObject) => {
                    const _newObject = parser(newObject);
                    return _newObject;
                })
                : newObjects;

        const chunkSize = 250;

        const query = knex.batchInsert(tableName, _newObjects as any, chunkSize).returning(returning);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        return await query;
        /*return await knex.transaction(async (tr) => {
            // TODO batchInsert does not accept newObjects with casting to any. Figure out how to correctly type it
            return await knex.batchInsert(tableName, _newObjects as any, chunkSize).transacting(tr);
        }); */
    } catch (error) {
        console.error(error);
        throw new TrError(
            `Cannot insert objects in table ${tableName} database (knex error: ${error})`,
            'DBQCR0002',
            'DatabaseCannotCreateMultipleBecauseDatabaseError'
        );
    }
};

/**
 * Read an object from the database. This function throws an error if the object
 * does not exist.
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param parser A parser function which converts the database fields to  an
 * object's attributes
 * @param select The raw select fields to query. Defaults to `*` to read all
 * fields in the table
 * @param id The ID of the object to read
 * @param {Object} options Additional options parameter.
 * @param {Knex.Transaction} [options.transaction] - transaction that this query
 * is part of
 * @returns The object attributes obtained after the `parser` function was run
 * on the read record.
 */
export const read = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: U) => Partial<T>) | undefined,
    select = '*',
    id: string,
    options: {
        transaction?: Knex.Transaction;
    } = {}
): Promise<Partial<T>> => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQRD0001',
                'DatabaseCannotReadBecauseIdIsMissingOrInvalid'
            );
        }
        const query = knex(tableName).select(knex.raw(select)).where('id', id);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const rows = await query;

        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRD0002',
                'DatabaseCannotReadBecauseObjectDoesNotExist'
            );
        } else {
            const _newObject = parser ? parser(rows[0] as unknown as U) : (rows[0] as T);
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

/**
 * Update a single record in a table
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param parser A parser function which converts an object's attributes to db
 * fields
 * @param id The ID of the record to update
 * @param attributes A subset of the object's attributes to update
 * @param options Additional options parameter. `returning` specifies which
 * field's or fields' values to return after update. `transaction` is an
 * optional transaction of which this update is part of.
 * @returns The requested `returning` field. Defaults to the ID of the object
 */
export const update = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: Partial<T>) => U) | undefined,
    id: string,
    attributes: Partial<T>,
    options: {
        returning?: string;
        transaction?: Knex.Transaction;
    } = {}
): Promise<string> => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot update object with id ${id} from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQUP0001',
                'DatabaseCannotUpdateBecauseIdIsMissingOrInvalid'
            );
        }
        const _attributes = parser ? parser(attributes) : attributes;

        const returning = options.returning || 'id';
        const query = knex(tableName).update(_attributes).where('id', id).returning(returning);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const returningArray = await query;

        return returningArray[0][returning];
    } catch (error) {
        throw new TrError(
            `Cannot update object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQUP0002',
            'DatabaseCannotUpdateBecauseDatabaseError'
        );
    }
};

/**
 * Update multiple records in the database
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param parser A parser function which converts an object's attributes to db
 * fields
 * @param attributeCollection An array of object attributes to update. Each
 * object's attributes in the collection need to have an ID attribute.
 * @param options Additional options parameter. `returning` specifies which
 * field's or fields' values to return after update. `transaction` is an
 * optional transaction of which this update is part of.
 * @returns The requested `returning` fields for each object. Defaults to the
 * IDs of the object
 */
export const updateMultiple = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: Partial<T>) => U) | undefined,
    attributeCollection: Partial<T>[],
    options: {
        returning?: string | string[];
        transaction?: Knex.Transaction;
    } = {}
): Promise<string[][]> => {
    const _attributeCollection: any[] = parser
        ? attributeCollection.map((attribute) => parser(attribute))
        : attributeCollection;

    try {
        const returning = options.returning || 'id';
        // Nested function to require a transaction around the updates
        const updateMultipleTransaction = async (trx: Knex.Transaction) => {
            const queries = _attributeCollection.map((attributes: any, index) => {
                if (!attributes.id) {
                    throw `Object attributes at index ${index} does not have an ID.`;
                }
                //console.log(attributes);
                return knex(tableName)
                    .update(attributes)
                    .where('id', attributes.id)
                    .returning(returning)
                    .transacting(trx);
            });
            const returningArray = await Promise.all(queries);
            return returningArray as string[][];
        };
        // Since updates are done individually, they need to be part of a
        // transaction. If one did not come with the options, create one.
        return await (options.transaction !== undefined
            ? updateMultipleTransaction(options.transaction)
            : knex.transaction(updateMultipleTransaction));
    } catch (error) {
        throw new TrError(
            `Cannot update multiple objects from table ${tableName} (knex error: ${error})`,
            'DBQUP0003',
            'DatabaseCannotUpdateBecauseDatabaseError'
        );
    }
};

/**
 * Delete a single record by ID from a table
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param id The ID of the record to delete
 * @param options Additional options parameter. `transaction` is an optional
 * transaction of which this delete is part of.
 * @returns The ID of the deleted object
 */
export const deleteRecord = async (
    knex: Knex,
    tableName: string,
    id: string,
    options: {
        transaction?: Knex.Transaction;
    } = {}
) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot verify if object exists in table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQDL0001',
                'ObjectCannotDeleteBecauseIdIsMissingOrInvalid'
            );
        }
        const query = knex(tableName).where('id', id).del();
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query;
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
 * Delete multiple records by ID from a table
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param ids An array of record IDs to delete
 * @param options Additional options parameter. `transaction` is an optional
 * transaction of which this delete is part of.
 * @returns The array of deleted IDs
 */
export const deleteMultiple = async (
    knex: Knex,
    tableName: string,
    ids: string[],
    options: {
        transaction?: Knex.Transaction;
    } = {}
): Promise<string[]> => {
    try {
        const query = knex(tableName).whereIn('id', ids).del();
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query;
        return ids;
    } catch (error) {
        throw new TrError(
            `Cannot delete objects with ids ${ids} from table ${tableName} (knex error: ${error})`,
            'DBQDLM0001',
            'ObjectsCannotDeleteBecauseDatabaseError'
        );
    }
};

/**
 * If the table has a `data_source_id` field, this deletes all records
 * associated with a given data source ID.
 *
 * @param knex The database configuration object
 * @param tableName The name of the table on which to execute the operation
 * @param dataSourceId The ID of the datasource for which to delete records
 * @param options Additional options parameter. `transaction` is an optional
 * transaction of which this delete is part of.
 * @returns
 */
export const deleteForDataSourceId = async (
    knex: Knex,
    tableName: string,
    dataSourceId: string,
    options: {
        transaction?: Knex.Transaction;
    } = {}
): Promise<string> => {
    try {
        const query = knex(tableName).where('data_source_id', dataSourceId).del();
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query;
        return dataSourceId;
    } catch (error) {
        throw new TrError(
            `Cannot delete objects with data_source_id ${dataSourceId} from table ${tableName} (knex error: ${error})`,
            'DBQDLM0002',
            'ObjectsCannotDeleteBecauseDatabaseError'
        );
    }
};

/**
 * Empties a database table
 *
 * FIXME Shoud we keep this method only for sequential tests purposes? It should
 * not be used in production. See
 * https://github.com/chairemobilite/transition/issues/938
 *
 * @param knex The database configuration object
 * @param tableName The name of the table to empty
 */
export const truncate = async (knex: Knex, tableName: string): Promise<string> => {
    try {
        await knex.raw(`TRUNCATE TABLE ${tableName} CASCADE`);
        return tableName;
    } catch (error) {
        console.log(error);
        throw new TrError(
            `Cannot truncate table ${tableName} (knex error: ${error})`,
            'DBQTR0001',
            'TableCannotTruncateBecauseDatabaseError'
        );
    }
};

/**
 * FIXME Unclear what this does and likely dangerous in production. Some unit
 * tests call it, others don't and seem to work fine anyway. Remove? See
 * https://github.com/chairemobilite/transition/issues/938
 *
 * @param knex The database configuration object
 * @param callback Callback to call after the destroy
 */
export const destroy = function (
    knex: Knex,
    callback: () => void = () => {
        /* nothing to do */
    }
) {
    knex.destroy(callback);
};
