/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from '../../config/shared/db.config';
import _cloneDeep from 'lodash.clonedeep';

import TrError from 'chaire-lib-common/lib/utils/TrError';

import { UserAttributes } from '../../services/users/user';

const tableName = 'users';

const attributesCleaner = function (attributes: Partial<UserAttributes>): { [key: string]: any } {
    const _attributes: any = _cloneDeep(attributes);
    if (_attributes.email) {
        _attributes.email = _attributes.email.toLowerCase();
    }
    return _attributes;
};

const create = async (newObject: Partial<UserAttributes>): Promise<UserAttributes> => {
    try {
        newObject = attributesCleaner(newObject);
        const returning = await knex(tableName).insert(newObject).returning('id');
        // Fetch newly inserted user, to get all values that may have been auto-filled at insert
        const userAttributes = await getById(returning[0].id);
        if (userAttributes === undefined) {
            throw 'Cannot fetch user recently inserted';
        }
        return userAttributes;
    } catch (error) {
        throw new TrError(
            `Cannot insert user ${newObject.username} in table ${tableName} database (knex error: ${error})`,
            'DBQCR0001',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

const getByUuid = async (uuid: string): Promise<UserAttributes | undefined> => {
    try {
        const response = await knex(tableName).where({ uuid });
        if (response.length === 1) {
            return response[0] as UserAttributes;
        }
        return undefined;
    } catch (error) {
        console.error(`cannot get user by uuid ${uuid} (knex error: ${error})`);
        return undefined;
    }
};

const getById = async (id: number): Promise<UserAttributes | undefined> => {
    try {
        const response = await knex(tableName).where({ id });
        if (response.length === 1) {
            return response[0] as UserAttributes;
        }
        return undefined;
    } catch (error) {
        console.error(`cannot get user by ID ${id} (knex error: ${error})`);
        return undefined;
    }
};

const find = async (
    whereData: Partial<UserAttributes> & { usernameOrEmail?: string },
    orWhere = false
): Promise<UserAttributes | undefined> => {
    try {
        if (Object.keys(whereData).length === 0) {
            console.error('Find user in DB: no filter specified!');
            return undefined;
        }
        const query = knex(tableName);
        if (whereData.usernameOrEmail !== undefined) {
            query.whereILike('email', whereData.usernameOrEmail);
            query.orWhere('username', whereData.usernameOrEmail);
            delete whereData.usernameOrEmail;
        }
        Object.keys(whereData).forEach((key) => {
            orWhere ? query.orWhere(key, whereData[key]) : query.andWhere(key, whereData[key]);
        });

        const response = await query.limit(1);
        if (response.length === 1) {
            return response[0] as UserAttributes;
        }
        return undefined;
    } catch (error) {
        console.error(`cannot search for user for data ${whereData} (knex error: ${error})`);
        return undefined;
    }
};

const update = async (
    id: number,
    attributes: Partial<Omit<UserAttributes, 'id' | 'uuid' | 'username'>>,
    returning = 'id'
): Promise<string> => {
    try {
        attributes = attributesCleaner(attributes);
        const returningArray = await knex(tableName).update(attributes).where('id', id).returning(returning);
        return returningArray[0];
    } catch (error) {
        throw new TrError(
            `Cannot update object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQUP0002',
            'DatabaseCannotUpdateBecauseDatabaseError'
        );
    }
};

const collection = async (): Promise<UserAttributes[]> => {
    try {
        const response = await knex(tableName).select();
        return response;
    } catch (error) {
        throw new TrError(
            `cannot fetch users collection because of a database error (knex error: ${error})`,
            'TAGQGC0002',
            'TransitAgencyCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

export type UserFilter = {
    email?: string;
    username?: string;
    is_admin?: boolean;
};

// Even if it is typed, in reality, this data comes from the universe and can be anything. Make sure we don't inject sql
const sanitizeOrderDirection = (order: string): string => {
    if (order.toLowerCase() === 'asc') {
        return 'asc';
    } else if (order.toLowerCase() === 'desc') {
        return 'desc';
    } else {
        throw new TrError(`Invalid sort order for interview query: ${order}`, 'DBINTO0001', 'InvalidSortOrder');
    }
};

const getRawFilter = (filters: UserFilter): [string, string[]] | undefined => {
    const rawFilters: string[] = [];
    const bindings: string[] = [];
    ['email', 'username'].forEach((field) => {
        if (filters[field] !== undefined) {
            rawFilters.push(`${field} ILIKE ?`);
            bindings.push(`%${filters[field]}%`);
        }
    });
    if (filters.is_admin !== undefined) {
        rawFilters.push(`is_admin IS ${filters.is_admin === true ? 'TRUE' : 'NOT TRUE'}`);
    }
    return rawFilters.length === 0 ? undefined : [rawFilters.join(' AND '), bindings];
};

/**
 * Get a paginated list of interviews, for validation or admin purposes, with
 * possible filters
 *
 * @param {({ filters: { [key: string]: { value: string | boolean | number, op:
 * keyof OperatorSigns } }; pageIndex: number; pageSize: number })} params
 * pageIndex is the index of the page to get, for the given filter. The first
 * one has index 0. pageSize is the maximum of entries in a page. To get the
 * entire list, use a value of -1
 * @return {*}  {Promise<{ interviews: InterviewAttributes[]; totalCount: number
 * }>} Return the page of interviews and the total number of interviews
 * corresponding to the query
 */
const getList = async (params: {
    filters: UserFilter;
    pageIndex?: number;
    pageSize?: number;
    sort?: { field: string; order?: 'asc' | 'desc' }[];
}): Promise<{
    users: UserAttributes[];
    totalCount: number;
}> => {
    try {
        const whereClause = getRawFilter(params.filters);
        // Get the total count for that query and filter
        const countResultQuery = knex.count('id').from(tableName);
        if (whereClause !== undefined) {
            countResultQuery.whereRaw(whereClause[0], whereClause[1]);
        }

        const countResult = await countResultQuery;

        const totalCount: number =
            countResult.length === 1
                ? typeof countResult[0].count === 'string'
                    ? parseInt(countResult[0].count)
                    : countResult[0].count
                : 0;

        if (totalCount === 0) {
            return { users: [], totalCount };
        }

        const sortFields = params.sort || [];

        const usersQuery = knex.from(tableName);
        if (whereClause !== undefined) {
            usersQuery.whereRaw(whereClause[0], whereClause[1]);
        }
        // Add sort fields
        sortFields.forEach((field) => {
            const order = field.order === undefined ? 'asc' : sanitizeOrderDirection(field.order);
            usersQuery.orderBy(field.field, order);
        });
        usersQuery.orderBy('id');
        // Add pagination
        if (params.pageSize !== undefined && params.pageSize > 0) {
            const index = params.pageIndex === undefined ? 0 : Math.max(0, params.pageIndex);
            usersQuery.limit(params.pageSize).offset(index * params.pageSize);
        }
        const users = await usersQuery;

        return { users, totalCount };
    } catch (error) {
        throw new TrError(
            `Cannot get users list in table ${tableName} (knex error: ${error})`,
            'DBQCR0003',
            'DatabaseCannotListBecauseDatabaseError'
        );
    }
};

export default {
    create,
    find,
    update,
    getById,
    getByUuid,
    collection,
    getList
};
