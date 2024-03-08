/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from '../../config/shared/db.config';
import { validate as uuidValidate } from 'uuid';

import { exists, update, deleteRecord } from './default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { randomUUID } from 'crypto';
import { TokenAttributes } from '../../services/auth/token';

const tableName = 'tokens';
const userTableName = 'users';

const attributesCleaner = function (attributes: TokenAttributes): { user_id: number; api_token: string } {
    const { user_id, api_token } = attributes;
    const _attributes: any = {
        number: user_id,
        string: api_token
    };

    return _attributes;
};

const attributesParser = (dbAttributes: { user_id: number; api_token: string }): TokenAttributes => ({
    user_id: dbAttributes.user_id,
    api_token: dbAttributes.api_token
});

const getOrCreate = async (usernameOrEmail: string): Promise<string> => {
    try {
        const user_id = await knex(userTableName)
            .where(function () {
                this.where('username', usernameOrEmail).orWhere('email', usernameOrEmail);
            })
            .then(async (row) => {
                if (row === undefined) {
                    throw 'An error has occured: No username or email to this name.';
                }
                if (row.length < 1) {
                    throw 'An error has occured: No match found';
                } else {
                    return row[0].id;
                }
            });
        const apiToken = randomUUID();
        const newObject: TokenAttributes = { user_id: user_id, api_token: apiToken };
        const row = await knex(tableName).where('user_id', user_id);
        if (row[0]) {
            return row[0].api_token;
        }
        await knex(tableName).insert(newObject);
        return apiToken;
    } catch (error) {
        throw new TrError(
            `Cannot add api_token to user ${usernameOrEmail} in table ${tableName} database (knex error: ${error})`,
            'ERRORCODE',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

const getById = async (user_id: number): Promise<TokenAttributes | undefined> => {
    try {
        const response = await knex(tableName).where({ user_id });
        if (response.length === 1) {
            return response[0] as TokenAttributes;
        }
        return undefined;
    } catch (error) {
        console.error(`cannot get token by ID ${user_id} (knex error: ${error})`);
        return undefined;
    }
};


const match = async (token: string) => {
    try {
        const response = await knex(tableName).where('api_token', token);
        if (response.length > 0) {
            return true;
        }
        return false;
    } catch (error) {
        console.error(`cannot get token ${token} (knex error: ${error})`);
    }
};

const getUserByToken = async (token: string) => {
    try {
        const user_id = (await knex(tableName).where('api_token', token))[0].user_id;
        if (!user_id) {
            throw `No such id in ${tableName} table.`;
        }
        const user = (await knex(userTableName).where('id', user_id))[0];

        if (!user) {
            throw 'Error, mismatch between user and user_id';
        }

        return user;
    } catch (error) {
        console.error(`cannot get user with token: ${token} (knex error: ${error})`);
        return false;
    }
};



export default {
    getOrCreate,
    update,
    getById,
    getUserByToken,
    match,
    exists: exists.bind(null, knex, tableName),
    delete: deleteRecord.bind(null, knex, tableName),
};
