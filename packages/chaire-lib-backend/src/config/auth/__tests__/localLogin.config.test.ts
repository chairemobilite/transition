/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'knex';
import mockKnex from 'mock-knex';
import passport from 'passport';
import localLogin from '../localLogin.config';
import { sendConfirmationEmail } from '../../../services/auth/userEmailNotifications';
import config from '../../server.config';

import User from '../../../services/auth/user';

// Mock DB and email notifications module
jest.mock('../../../config/shared/db.config', () => {
    const connection = knex({ client: 'pg', debug: false});
    mockKnex.mock(connection, 'knex@0.10');
    return connection;
});

localLogin(passport);

jest.mock('../../../services/auth/userEmailNotifications');
const mockedConfirmEmail = sendConfirmationEmail as jest.Mocked<typeof sendConfirmationEmail>;

const url = 'http://test.transition.city/';

const tracker = mockKnex.getTracker();
tracker.install();

// req.logIn needs to be set and is called by passport when successful
const logInFct = jest.fn().mockImplementation((_a, _b, callback) => {
    callback();
});

// Initialize various user data
const validUsername = 'test';
const unconfirmedUsername = 'unconfirmed';
const newUsername = 'newUser';
const newUserEmail = 'newUser@transition.city';
const password = 'testtest';
const encryptedPwd = User.encryptPassword(password);
const validUser = {
    id: 5,
    password: encryptedPwd,
    username: validUsername,
    is_confirmed: true,
    is_valid: true
};
const unconfirmedUser = {
    id: 6,
    password: encryptedPwd,
    username: unconfirmedUsername,
    is_confirmed: false,
    is_valid: false
};

let insertedUser: any = null;
const newUserId = 7;
// Query results
tracker.on('query', (query) => {
    if (query.bindings.includes(validUsername)) {
        query.response([validUser]);
    } else if (query.bindings.includes(unconfirmedUsername)) {
        query.response([unconfirmedUser]);
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
})

test('Local login strategy, valid user', async () => {
    const req = {logIn: logInFct, body: {usernameOrEmail: validUsername, password}};
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-login')(req, {end: jest.fn()}, (err, result) => {
            // TODO Upon successful authentication, this ends up being called with both undefined values. Figure out how to receive the successful user, like the real auth code path does
            resolve({ result, err });
        });
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toBeUndefined();
    expect(authResult.result).toBeUndefined();
    expect(logInFct).toHaveBeenCalledTimes(1);
    expect(logInFct).toHaveBeenCalledWith({ id: validUser.id, username: validUser.username, email: undefined, firstName: undefined, lastName: undefined, preferences: {}, serializedPermissions: []}, expect.anything(), expect.anything());
});

test('Local login strategy, invalid password', async () => {
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-login')({logIn: logInFct, body: {usernameOrEmail: validUsername, password: 'Not the same'}}, {end: jest.fn()}, (err, result) => {
            resolve({ result, err });
        });
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('PasswordsDontMatch');
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
});

test('Local login strategy, unknown user', async () => {
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-login')({logIn: logInFct, body: {usernameOrEmail: 'unknown user', password}}, {end: jest.fn()}, (err, result) => {
            resolve({ result, err });
        });
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('UnknownUser');
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
});

test('Local login strategy, unconfirmed user', async () => {
    const endFct = jest.fn().mockImplementation()
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-login')(
            {
                logIn: logInFct,
                body: {usernameOrEmail: unconfirmedUsername, password}
            }, {
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
            }, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('Unauthorized');
    expect(endFct).toHaveBeenCalledTimes(1);
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
});

test('Local login strategy, unconfirmed user, wrong password', async () => {
    const endFct = jest.fn().mockImplementation()
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-login')(
            {
                logIn: logInFct,
                body: {usernameOrEmail: unconfirmedUsername, password: 'wrong password'}
            }, {
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
            }, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('PasswordsDontMatch');
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
});

test('Local signup strategy, auto-signon username and email', async () => {
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-signup')({logIn: logInFct, body: {username: newUsername, email: newUserEmail, password}}, {end: jest.fn()}, (err, result) => {
            resolve({ result, err });
        });
    });
    const authResult: any = await authPromise;

    expect(logInFct).toHaveBeenCalledTimes(1);
    expect(logInFct).toHaveBeenCalledWith({
        id: newUserId,
        email: newUserEmail,
        username: newUsername,
        firstName: '',
        lastName: '',
        preferences: {},
        serializedPermissions: []
    }, expect.anything(), expect.anything());
    expect(authResult.result).toBeFalsy();
    expect(mockedConfirmEmail).not.toHaveBeenCalled();
});

test('Local signup strategy, auto-signon user exists', async () => {
    const endFct = jest.fn();
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-signup')(
            {
                logIn: logInFct,
                body: {username: validUsername, email: newUserEmail, password}
            }, {
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
            }, (err, result) => {
                // TODO Upon signup, both result and err are undefined. WHY?
                resolve({ result, err });
        });
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('UserExists');
    expect(authResult.result).toBeFalsy();
    expect(endFct).not.toHaveBeenCalled();
    expect(logInFct).not.toHaveBeenCalled();
    expect(insertedUser).toBeNull();
    expect(mockedConfirmEmail).not.toHaveBeenCalled();

});

test('Local signup strategy, with email confirmation by user', async () => {
    const endFct = jest.fn();
    config.auth = { localLogin: { confirmEmail: true }};
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-signup')(
            {
                logIn: logInFct,
                body: {username: newUsername, email: newUserEmail, password}
            }, {
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
            }, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('Unauthorized');
    expect(endFct).toHaveBeenCalledTimes(1);
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
    expect(insertedUser).not.toBeNull();
    expect(insertedUser.confirmation_token).not.toBeNull();

    expect(mockedConfirmEmail).toHaveBeenCalledTimes(1);
    expect(mockedConfirmEmail).toHaveBeenCalledWith(expect.objectContaining({attributes: insertedUser}),
        {
            strategy: 'confirmByUser',
            confirmUrl: `${url}verify/${insertedUser.confirmation_token}`
        });
});

test('Local signup strategy, with email confirmation by admin', async () => {
    const endFct = jest.fn();
    config.auth = { localLogin: { 
        confirmEmail: true,
        confirmEmailStrategy: 'confirmByAdmin'
    }};
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-signup')(
            {
                logIn: logInFct,
                body: {username: newUsername, email: newUserEmail, password}
            }, {
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
            }, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('Unauthorized');
    expect(endFct).toHaveBeenCalledTimes(1);
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
    expect(insertedUser).not.toBeNull();
    expect(insertedUser.confirmation_token).not.toBeNull();

    expect(mockedConfirmEmail).toHaveBeenCalledTimes(2);
    expect(mockedConfirmEmail).toHaveBeenLastCalledWith(expect.objectContaining({attributes: insertedUser}),
        {
            strategy: 'confirmByAdmin',
            confirmUrl: `${url}verify/${insertedUser.confirmation_token}`
        });
});

test('Local signup strategy, with email confirmation by admin, urls without ending slash', async () => {
    const urlWithoutSlash = 'https://test.transition';
    process.env.HOST = urlWithoutSlash;
    const endFct = jest.fn();
    config.auth = { localLogin: { 
        confirmEmail: true,
        confirmEmailStrategy: 'confirmByAdmin'
    }};
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-signup')(
            {
                logIn: logInFct,
                body: {username: newUsername, email: newUserEmail, password}
            }, {
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message }))
            }, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    await authPromise;

    expect(mockedConfirmEmail).toHaveBeenCalledTimes(3);
    expect(mockedConfirmEmail).toHaveBeenLastCalledWith(expect.objectContaining({attributes: insertedUser}),
        {
            strategy: 'confirmByAdmin',
            confirmUrl: `${urlWithoutSlash}/verify/${insertedUser.confirmation_token}`
        });

});
