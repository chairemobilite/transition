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
import type { TokenAttributes } from '../../services/auth/token';
import config from '../../config/server.config';

const tableName = 'tokens';
const userTableName = 'users';
// Verify if config is number, else return default value
const defaultTokenLifespanDays: number = isNaN(Number(config.tokenLifespanDays))
    ? 10
    : Number(config.tokenLifespanDays);

/**
 * Get the API token of a user, or create one if the user does not have one or
 * if it is expired.
 *
 * @param userId The ID of the user to get the token for. The user must already
 * be authenticated, the token is not for a user looked up from the username or
 * email, which could match another user than the one authenticated.
 * @returns The API token of the user
 */
const getOrCreate = async (userId: number): Promise<string> => {
    try {
        const now = new Date();
        const row = await knex(tableName).where('user_id', userId);
        if (row[0]) {
            if (row[0].expiry_date < now) {
                // Wait for the deletion, the new token is for the same user
                await deleteToken(userId);
            } else {
                return row[0].api_token;
            }
        }
        const apiToken = randomUUID();
        const tokenExpiryDate = new Date(now.setDate(now.getDate() + defaultTokenLifespanDays));
        const newObject: TokenAttributes = {
            user_id: userId,
            api_token: apiToken,
            expiry_date: tokenExpiryDate,
            created_at: new Date()
        };
        await knex(tableName).insert(newObject);
        return apiToken;
    } catch (error) {
        throw TrError.isTrError(error)
            ? error
            : new TrError(
                `Cannot add api_token to user ${userId} in table ${tableName} database (knex error: ${error})`,
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
        const userToken = await knex(tableName).where('api_token', token);
        if (userToken.length < 1) {
            throw new TrError(`No such id in ${tableName} table.`, 'DBUTK0004', 'DatabaseNoUserMatchesProvidedToken');
        }

        if (userToken[0].expiry_date < new Date()) {
            throw new TrError('Error, Token expired', 'DBUTK0006', 'DatabaseTokenExpired');
        }

        const user = (await knex(userTableName).where('id', userToken[0].user_id))[0];

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

const deleteToken = async (userId: number) => {
    try {
        await knex(tableName).where('user_id', userId).del();
    } catch (error) {
        throw TrError.isTrError(error)
            ? error
            : new TrError(
                `Cannot delete token in table ${tableName} database: (knex error: ${error})`,
                'DBUTK0003',
                'DatabaseCannotCreateBecauseDatabaseError'
            );
    }
};

async function cleanExpiredApiTokens() {
    try {
        await knex.raw(`DELETE FROM ${tableName} WHERE expiry_date < NOW()`);
    } catch (error) {
        throw new TrError(
            `Cannot cleanup expired tokens from table ${tableName} (knex error: ${error})`,
            'DatabaseCleanupDatabaseApiTokensTokenBecauseDatabaseError'
        );
    }
}

export default {
    getOrCreate,
    update,
    getById,
    getUserByToken,
    exists: exists.bind(null, knex, tableName),
    delete: deleteRecord.bind(null, knex, tableName),
    deleteToken,
    cleanExpiredApiTokens,
    defaultTokenLifespanDays
};
