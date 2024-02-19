/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from '../../config/shared/db.config';
import { validate as uuidValidate } from 'uuid';

import {
    exists,
    update,
    deleteRecord,
} from './default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';


import { randomUUID } from 'crypto';
import { TokenAttributes } from '../../services/tokens/token';

const tableName = 'tokens';
const userTableName = 'users'

const attributesCleaner = function (attributes: TokenAttributes): { id: number, api_token: string } {
    const { id, api_token } = attributes;
    const _attributes: any = {
        number: id,
        string: api_token
    };

    return _attributes;
};

const attributesParser = (dbAttributes: {
    id: number;
    api_token: string;
}): TokenAttributes => ({
    id: dbAttributes.id,
    api_token: dbAttributes.api_token
});

const getOrCreate = async (usernameOrEmail: string): Promise<string> => {
    try {
        const id = await knex(userTableName).where(function() {
            this.where('username', usernameOrEmail ).orWhere('email', usernameOrEmail)
          })
        .then(async (row) => {
            if (row === undefined) {
                throw("An error has occured: No username or email to this name.")
            }
            if (row.length < 1) {
                throw("An error has occured: No match found")
            } else {
                return row[0].id
            }
        })
        const apiToken = randomUUID()
        const newObject: TokenAttributes = {id: id, api_token: apiToken}
        const row = await knex(tableName).where('id', id)
        if (row[0]) {
            return row[0].api_token
        }
            await knex(tableName).insert(newObject)
        return apiToken
    } catch (error) {
        throw new TrError(
            `Cannot add api_token to user ${usernameOrEmail} in table ${tableName} database (knex error: ${error})`,
            'ERRORCODE',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

const getById = async (id: number): Promise<TokenAttributes | undefined> => {
    try {
        const response = await knex(tableName).where({ id });
        if (response.length === 1) {
            return response[0] as TokenAttributes;
        }
        return undefined;
    } catch (error) {
        console.error(`cannot get token by ID ${id} (knex error: ${error})`);
        return undefined;
    }
};

const read = async (id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                '!!What is this string!!',
                'DatabaseCannotReadTokenBecauseIdIsMissingOrInvalid'
            );
        }
        const response = await knex.raw(`
      SELECT
        *
      FROM ${tableName}
      WHERE id = '${id}';
    `);
        const rows = response?.rows;
        if (rows && rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                '!!What is this string!!',
                'DatabaseCannotReadTokenBecauseObjectDoesNotExist'
            );
        }
        return attributesParser(rows[0]);
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQZONE0003',
            'DatabaseCannotReadTokenBecauseDatabaseError'
        );
    }
};

const match = async(token: string) => {
    try {
        const response = await knex(tableName).where("api_token", token );
        if (response.length > 0) {
            return true;
        }
        return false;
    } catch (error) {
        console.error(`cannot get token ${token} (knex error: ${error})`);
        return false;
    }
}

const getUserByToken = async (token: string) => {
    try {
        const id = await knex(tableName).where('api_token',token)[0].id;
    
        if (!id) {
            throw(`No such id in ${tableName} table.`);
        }

        const user = await knex(userTableName).where('id', id)[0]

        if (!user) {
            throw('Error, mismatch between user and id')
        }

        return user;
    } catch (error) {
        console.error(`cannot get user with token: ${token} (knex error: ${error})`);
        return false;
    }
}

export default {
    getOrCreate,
    update,
    getById,
    getUserByToken,
    match,
    exists: exists.bind(null, knex, tableName),
    read,
    delete: deleteRecord.bind(null, knex, tableName),
};
