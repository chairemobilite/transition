/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'knex';
import mockKnex from 'mock-knex';
import passport from 'passport';
import { TestUtils } from 'chaire-lib-common/lib/test';

import passwordlessLogin from '../passwordless.config';
import { sendEmail } from '../../../services/auth/userEmailNotifications';

process.env.MAGIC_LINK_SECRET_KEY = 'SOMEARBITRARYSTRINGFORASECRETKEY';
// Mock DB and email notifications module
jest.mock('../../../config/shared/db.config', () => {
    const connection = knex({ client: 'pg', debug: false});
    mockKnex.mock(connection, 'knex@0.10');
    return connection;
});

passwordlessLogin(passport);

jest.mock('../../../services/auth/userEmailNotifications');
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const url = 'http://test.transition.city/';

const tracker = mockKnex.getTracker();
tracker.install();

// req.logIn needs to be set and is called by passport when successful
const logInFct = jest.fn().mockImplementation((_a, _b, callback) => {
    callback();
});

// Initialize various user data
const newUserEmail = 'newUser@transition.city';
const existingUserEmail = 'existingUser@transition.city';
const existingUser = {
    id: 5,
    password: null,
    username: existingUserEmail,
    email: existingUserEmail,
    is_confirmed: true,
    is_valid: true
};

let insertedUser: any = null;
const newUserId = 7;
// Query results
tracker.on('query', (query) => {
    if (query.bindings.includes(existingUserEmail)) {
        query.response([existingUser]);
    } else if (query.method === 'insert') {
        insertedUser = {
            id: newUserId,
            confirmation_token: query.bindings[0],
            email: query.bindings[1],
            facebook_id: query.bindings[2],
            first_name: query.bindings[3],
            generated_password: query.bindings[4],
            google_id: query.bindings[5],
            is_admin: query.bindings[6],
            is_confirmed: query.bindings[7],
            is_test: query.bindings[8],
            is_valid: query.bindings[9],
            last_name: query.bindings[10],
            password: query.bindings[11],
            username: query.bindings[12]
        };
        query.response([insertedUser]);
    } else {
        query.response(null);
    }

});

beforeEach(() => {
    logInFct.mockClear();
    insertedUser = null;
    process.env.HOST = url;
    mockedSendEmail.mockClear();
});

test('Passwordless login, first entry, direct access', async () => {
    const endFct = jest.fn();
    const authPromise = new Promise((resolve, reject) => {
        const res = { end: endFct.mockImplementation((message) => resolve({ result: null, err: message })) };
        passport.authenticate('passwordless-enter-login')(
            {
                logIn: logInFct,
                body: { destination: newUserEmail },
                res
            }, res, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    await authPromise;
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(logInFct).toHaveBeenCalledTimes(1);
    expect(insertedUser).not.toBeNull();
    expect(insertedUser.email).toEqual(newUserEmail);
    expect(insertedUser.username).toEqual(newUserEmail);
    expect(logInFct).toHaveBeenCalledWith({ id: insertedUser.id, username: newUserEmail, email: newUserEmail, firstName: '', lastName: '', preferences: {}, serializedPermissions: []}, expect.anything(), expect.anything());
});

describe('Complete send/verify flow for existing user', () => {

    let verifyUrl: string | undefined;

    test('User enters email', async () => {
        const endFct = jest.fn();
        const authPromise = new Promise((resolve, reject) => {
            const res = { 
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message })),
                json: jest.fn().mockImplementation((json) => resolve({ result: json, err: null }))
            };
            passport.authenticate('passwordless-enter-login')(
                {
                    logIn: logInFct,
                    body: { destination: existingUserEmail },
                    res
                }, res, (err, result) => {
                    resolve({ result, err });
                }
            );
        });
        await authPromise;
        // The send magic email has been sent but nothing waits for it, just flush all promises
        await TestUtils.flushPromises();
        expect(mockedSendEmail).toHaveBeenCalledTimes(1);
        expect(mockedSendEmail).toHaveBeenLastCalledWith({
            toUser: expect.objectContaining({ attributes: expect.objectContaining({ email: existingUserEmail, username: existingUserEmail })}),
            mailText: ['customServer:magicLinkEmailText', 'server:magicLinkEmailText'],
            mailSubject: ['customServer:magicLinkEmailSubject', 'server:magicLinkEmailSubject']
        }, { magicLinkUrl: { url: expect.stringContaining('/magic/verify') } });
        verifyUrl = mockedSendEmail.mock.calls[0][1].magicLinkUrl.url;
    });
    
    test('Verify link url', async () => {
        const endFct = jest.fn();
        expect(verifyUrl).toBeDefined();
        const indexOfToken = verifyUrl?.indexOf('token=');
        expect(indexOfToken).toBeDefined();
        const token = verifyUrl?.substring(indexOfToken as number + 'token='.length);
        const authPromise = new Promise((resolve, reject) => {
            passport.authenticate('passwordless-login')(
                {
                    logIn: logInFct,
                    query: {token }
                }, {
                    end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
                }, (err, result) => {
                    resolve({ result, err });
                }
            );
        });
        const authResult: any = await authPromise;
        expect(authResult.err).toBeUndefined();
        expect(authResult.result).toBeUndefined();
        expect(logInFct).toHaveBeenCalledTimes(1);
        expect(logInFct).toHaveBeenCalledWith({ id: existingUser.id, username: existingUser.username, email: existingUser.email, firstName: undefined, lastName: undefined, preferences: {}, serializedPermissions: []}, expect.anything(), expect.anything());
    });
});

test('Verify invalid token', async () => {
    const endFct = jest.fn();
    const token = 'justsomerandomtokenthat-should-not-be-validated';
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('passwordless-login')(
            {
                logIn: logInFct,
                query: {token }
            }, {
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
            }, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toBeDefined();
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
});

