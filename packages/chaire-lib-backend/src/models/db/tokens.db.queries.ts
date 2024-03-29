/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from '../../config/shared/db.config';
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
                    throw new TrError(
                        `Could not match ${usernameOrEmail} in table ${tableName} database`,
                        'DBUTK0001',
                        'NoUserMatchError'
                    );
                }
                if (row.length < 1) {
                    throw new TrError(
                        `Could not match ${usernameOrEmail} in table ${tableName} database`,
                        'DBUTK0002',
                        'NoUserMatchError'
                    );
                } else {
                    return row[0].id;
                }
            });
        const row = await knex(tableName).where('user_id', user_id);
        if (row[0]) {
            return row[0].api_token;
        }
        const apiToken = randomUUID();
        const newObject: TokenAttributes = { user_id: user_id, api_token: apiToken };
        await knex(tableName).insert(newObject);
        return apiToken;
    } catch (error) {
        throw TrError.isTrError(error)
            ? error
            : new TrError(
                `Cannot add api_token to user ${usernameOrEmail} in table ${tableName} database (knex error: ${error})`,
                'DBUTK0003',
                'DatabaseCannotCreateBecauseDatabaseError'
            );
    }
};

const getById = async (user_id: number): Promise<TokenAttributes | undefined> => {
    try {
        const response = await knex(tableName).where({ user_id });
        if (response.length < 1) {
            throw new TrError(`No such id in ${tableName} table.`, 'DBUTK0004', 'DatabaseNoUserMatchesProvidedToken');
        }
        return response[0] as TokenAttributes;
    } catch (error) {
        throw TrError.isTrError(error)
            ? error
            : new TrError(`No such id in ${tableName} table.`, 'DBUTK0006', 'UnknownErrorFromDatabase');
    }
};

const getUserByToken = async (token: string) => {
    try {
        const user_id = await knex(tableName).where('api_token', token);
        if (user_id.length < 1) {
            throw new TrError(`No such id in ${tableName} table.`, 'DBUTK0004', 'DatabaseNoUserMatchesProvidedToken');
        }
        const user = (await knex(userTableName).where('id', user_id[0].user_id))[0];

        if (!user) {
            throw new TrError('Error, mismatch between user and user_id', 'DBUTK0005', 'DatabaseNoUserMatchesToken');
        }

        return user;
    } catch (error) {
        throw TrError.isTrError(error)
            ? error
            : new TrError(
                `Cannot get user in table ${tableName} database from token ${token}: (knex error: ${error})`,
                'DBUTK0003',
                'DatabaseCannotCreateBecauseDatabaseError'
            );
    }
};

export default {
    getOrCreate,
    update,
    getById,
    getUserByToken,
    exists: exists.bind(null, knex, tableName),
    delete: deleteRecord.bind(null, knex, tableName)
};
