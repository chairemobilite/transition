/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import knex from '../../../config/shared/db.config';
import { TokenAttributes } from '../../../services/auth/token';
import { UserAttributes } from '../../../services/users/user';
import { Knex } from 'knex';
import tokensDbQueries from '../tokens.db.queries';
import { randomUUID } from 'crypto';
import crypto from 'crypto';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const now = new Date()

const user: Partial<UserAttributes> = {
    id: 1,
    username: 'testname',
    email: 'test@transition.city',
    is_valid: true
}

const badUser: Partial<UserAttributes> = {
    id: 2,
    username: 'testname2',
    email: 'test2@transition.city',
    is_valid: true
}

const expiredTokenUser: Partial<UserAttributes> = {
    id: 3,
    username: 'testname3',
    email: 'test3@transition.city',
    is_valid: true
}

const user2: Partial<UserAttributes> = {
    id: 4,
    username: 'testname4',
    email: 'test4@transition.city',
    is_valid: true
}

const validToken: TokenAttributes = {
    user_id: 1,
    api_token: randomUUID(),
    creation_date: now,
    expiry_date:  new Date((new Date()).setDate(now.getDate() + tokensDbQueries.defaultTokenLifespanDays)),
};

const badToken: TokenAttributes = {
    user_id: 2,
    api_token: randomUUID(),
    creation_date: new Date(),
    expiry_date:  new Date(1659633411001) ,
}

const expiredToken: TokenAttributes = {
    user_id: 3,
    api_token: randomUUID(),
    creation_date: now,
    expiry_date:  new Date(0),
}

const validToken2: TokenAttributes = {
    user_id: 4,
    api_token: randomUUID(),
    creation_date: now,
    expiry_date:  new Date((new Date()).setDate(now.getDate() + tokensDbQueries.defaultTokenLifespanDays)),
};



const truncate = async (knex: Knex, tableName: string) => {
    try {
        await knex.raw(`TRUNCATE TABLE ${tableName} CASCADE`);
    } catch (error) {
        throw `Could not truncate test databas: ${error}`;
    }
};

const createToken = async (knex: Knex, tableName: string, tokenRow) => {
    try {
        const newObject: TokenAttributes = { 
            user_id: tokenRow.user_id, 
            api_token: tokenRow.api_token,
            creation_date: tokenRow.creation_date,
            expiry_date: tokenRow.expiry_date, 
        };
        const test = await knex(tableName).insert(newObject);

    } catch (error) {
        throw `Could not add token to tokens table: ${error}`;
    }
};

const createUser = async (knex: Knex, tableName: string = 'users', user: UserAttributes) => {
    try {
        const newUser: Partial<UserAttributes> = user
        await knex(tableName).insert(newUser)
    } catch (error) {
        throw `Could not add user to users table: ${error}`
    }
}



describe(`Tokens Database: Token exists in Tokens table`, () => {

    beforeAll(async () => {
        jest.setTimeout(10000);
        await truncate(knex, 'tokens');
        await truncate(knex, 'users');
        await createUser(knex, 'users', user as UserAttributes);
        await createToken(knex, 'tokens', validToken);
    });
    
    afterAll(async() => {
        await truncate(knex, 'tokens');
        await truncate(knex, 'users')
    });

    test('Should return api token', async () => {
        const testToken = await tokensDbQueries.getOrCreate(user.email as string)
        expect(testToken).toEqual(validToken.api_token)
    });

    test('Should return a user when token is in database', async() => {
        const query = await tokensDbQueries.getUserByToken(validToken.api_token as string)
        expect(query.email).toBe(user.email);
        expect(query.id).toBe(user.id);
        expect(query.username).toBe(user.username);

    });

    test('Should return an token when user_id is in database', async() => {
        const query = await tokensDbQueries.getById(user.id as number) as TokenAttributes 
        expect(query.api_token).toBe(validToken.api_token);
        expect(query.user_id).toBe(validToken.user_id);


    });

    test('Should return an error when user not in database', async() => {
        
        await expect(tokensDbQueries.getOrCreate(badUser.email as string)).rejects.toThrowError(TrError);

    });

    test('Should return an error when api_token not in database', async() => {

        await expect(tokensDbQueries.getUserByToken(badToken.api_token as string)).rejects.toThrowError(TrError);

    });

    test('Should return an error when user_id not in database', async() => {
        await expect(tokensDbQueries.getById(badUser.id as number)).rejects.toThrowError(TrError);

    });

});

describe(`Tokens Database: Token does not exist in Tokens table`, () => {

    beforeAll(async () => {
        jest.setTimeout(10000);
        await truncate(knex, 'tokens');
        await truncate(knex, 'users');
        await createUser(knex, 'users', user as UserAttributes);
    });
    
    afterAll(async() => {
        await truncate(knex, 'tokens');
        await truncate(knex, 'users')
    });

    test('Should create api tokens in database', async() => {
        jest.spyOn(crypto, 'randomUUID').mockImplementation(() => (validToken.api_token) as `${string}-${string}-${string}-${string}-${string}`)
        
        const query1 = await knex('tokens');
        await tokensDbQueries.getOrCreate(user.email as string)
        const query2 = await knex('tokens');
        expect(query2.length).toBeGreaterThan(query1.length)
        expect(query2[0].api_token).toEqual(validToken.api_token)
    });
});

describe(`Tokens Database: Expiry`, () => {

    beforeEach(async () => {
        jest.setTimeout(10000);
        await truncate(knex, 'tokens');
        await truncate(knex, 'users');
        jest.spyOn(crypto, 'randomUUID').mockImplementation(() => (expiredToken.api_token) as `${string}-${string}-${string}-${string}-${string}`)
        await createUser(knex, 'users', expiredTokenUser as UserAttributes);
        await createToken(knex, 'tokens', expiredToken);
        jest.mock('../../../config/server.config', () => ({
            tokenLifespanDays: 1
        }));
    });
    
    afterAll(async() => {
        await truncate(knex, 'tokens');
        await truncate(knex, 'users')
    });

    test('Should return new token expired', async() => {
        jest.spyOn(crypto, 'randomUUID').mockImplementation(() => (validToken.api_token) as `${string}-${string}-${string}-${string}-${string}`)
        const query = await tokensDbQueries.getOrCreate(expiredTokenUser.email as string)
        expect(query).toEqual(validToken.api_token)
    });

    test('Should throw when trying to get user by id if token is expired', async() => {
        await expect(tokensDbQueries.getUserByToken(expiredToken.api_token as string)).rejects.toThrowError (TrError)
    });


});
describe(`Tokens Database: Cleanup`, () => {

    beforeEach(async () => {
        jest.setTimeout(10000);
        await truncate(knex, 'tokens');
        await truncate(knex, 'users');
        jest.spyOn(crypto, 'randomUUID').mockImplementation(() => (expiredToken.api_token) as `${string}-${string}-${string}-${string}-${string}`)
        await createUser(knex, 'users', expiredTokenUser as UserAttributes);
        await createToken(knex, 'tokens', expiredToken);
        jest.mock('../../../config/server.config', () => ({
            tokenLifespanDays: 1
        }));
    });
    
    afterAll(async() => {
        await truncate(knex, 'tokens');
        await truncate(knex, 'users')
    });

    test('Should remove all expired rows with expired token', async() => {
        await createUser(knex, 'users', user as UserAttributes);
        await createUser(knex, 'users', user2 as UserAttributes);
        await createToken(knex, 'tokens', validToken);
        await createToken(knex, 'tokens', validToken2);
        const query1 = await knex('tokens');
        await tokensDbQueries.cleanExpiredApiTokens()
        const query2 = await knex('tokens');
        const query3 = await knex('tokens').where('expiry_date','<',new Date());
        expect(query1.length).toEqual(3)
        expect(query2.length).toEqual(2)
        expect(query3.length).toEqual(0)
    });
});