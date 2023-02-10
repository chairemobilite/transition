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

const stringifyDataSourceIds = function (dataSourceIds: string[]): string[] {
    if (dataSourceIds && !Array.isArray(dataSourceIds)) {
        dataSourceIds = [dataSourceIds];
    }
    return dataSourceIds
        ? dataSourceIds.map((dataSourceId) => {
            return `'${dataSourceId}'`;
        })
        : [];
};

const exists = async (knex: Knex, tableName: string, id: string): Promise<boolean> => {
    if (!uuidValidate(id)) {
        throw new TrError(
            `Cannot verify if the object exists in ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
            'DBQEX0001',
            'DatabaseCannotVerifyIfObjectExistsBecauseIdIsMissingOrInvalid'
        );
    }
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

const create = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: T) => U) | undefined,
    newObject: T,
    returning: string | string[] = 'id'
): Promise<string | { [key: string]: unknown }> => {
    try {
        const _newObject = parser ? parser(newObject) : newObject;

        const returningArray = await knex(tableName).insert(_newObject).returning(returning);
        return typeof returning === 'string' ? returningArray[0][returning] : returningArray[0];
    } catch (error) {
        throw new TrError(
            `Cannot insert object with id ${newObject.id} in table ${tableName} database (knex error: ${error})`,
            'DBQCR0001',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

const createMultiple = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: T) => U) | undefined,
    newObjects: T[],
    _returning: string[] = ['id'] // TODO Use this or remove?
): Promise<{ [key: string]: any }[]> => {
    try {
        const _newObjects =
            typeof parser === 'function'
                ? newObjects.map((newObject) => {
                    const _newObject = parser(newObject);
                    return _newObject;
                })
                : newObjects;

        const chunkSize = 250;

        return await knex.batchInsert(tableName, _newObjects as any, chunkSize).returning(_returning);
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
        ).export();
    }
};

const read = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: U) => Partial<T>) | undefined,
    query = '*',
    id: string
): Promise<Partial<T>> => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQRD0001',
                'DatabaseCannotReadBecauseIdIsMissingOrInvalid'
            );
        }
        const rows = await knex(tableName).select(knex.raw(query)).where('id', id);

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

const update = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: Partial<T>) => U) | undefined,
    id: string,
    attributes: Partial<T>,
    returning = 'id'
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

        const returningArray = await knex(tableName).update(_attributes).where('id', id).returning(returning);
        return returningArray[0][returning];
    } catch (error) {
        throw new TrError(
            `Cannot update object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQUP0002',
            'DatabaseCannotUpdateBecauseDatabaseError'
        );
    }
};

const updateMultiple = async <T extends GenericAttributes, U>(
    knex: Knex,
    tableName: string,
    parser: ((arg: Partial<T>) => U) | undefined,
    attributeCollection: Partial<T>[],
    returning = 'id'
): Promise<string[][]> => {
    const _attributeCollection: any[] = parser
        ? attributeCollection.map((attribute) => parser(attribute))
        : attributeCollection;

    try {
        return (await knex.transaction(async (trx) => {
            const queries = _attributeCollection.map((attributes: any) => {
                //console.log(attributes);
                return knex(tableName)
                    .update(attributes)
                    .where('id', attributes.id)
                    .returning(returning)
                    .transacting(trx);
            });
            const returningArray = await Promise.all(queries);
            return returningArray;
        })) as string[][];
    } catch (error) {
        throw new TrError(
            `Cannot update multiple objects from table ${tableName} (knex error: ${error})`,
            'DBQUP0003',
            'DatabaseCannotUpdateBecauseDatabaseError'
        );
    }
};

const deleteRecord = async (knex: Knex, tableName: string, id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot verify if object exists in table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQDL0001',
                'ObjectCannotDeleteBecauseIdIsMissingOrInvalid'
            );
        }
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

const deleteMultiple = function (knex: Knex, tableName: string, ids: string[]): Promise<string[]> {
    return new Promise((resolve, reject) => {
        return knex(tableName)
            .whereIn('id', ids)
            .del()
            .then(() => {
                //const numberOfDeletedObjects = parseInt(response);
                resolve(ids);
            })
            .catch((error) => {
                reject(
                    new TrError(
                        `Cannot delete objects with ids ${ids} from table ${tableName} (knex error: ${error})`,
                        'DBQDLM0001',
                        'ObjectsCannotDeleteBecauseDatabaseError'
                    )
                );
            });
    });
};

const deleteForDataSourceId = async (knex: Knex, tableName: string, dataSourceId: string): Promise<string> => {
    try {
        await knex(tableName).where('data_source_id', dataSourceId).del();
        return dataSourceId;
    } catch (error) {
        throw new TrError(
            `Cannot delete objects with data_source_id ${dataSourceId} from table ${tableName} (knex error: ${error})`,
            'DBQDLM0002',
            'ObjectsCannotDeleteBecauseDatabaseError'
        );
    }
};

const truncate = async (knex: Knex, tableName: string): Promise<string> => {
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

const destroy = function (
    knex: Knex,
    callback: () => void = () => {
        /* nothing to do */
    }
) {
    knex.destroy(callback);
};

export {
    exists,
    create,
    createMultiple,
    read,
    update,
    updateMultiple,
    deleteRecord,
    deleteMultiple,
    deleteForDataSourceId,
    truncate,
    destroy,
    stringifyDataSourceIds
};
