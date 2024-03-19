/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import passport from 'passport';
import localLogin from '../localLogin.config';
import { sendConfirmationEmail } from '../../../services/auth/userEmailNotifications';
import config from '../../server.config';

import { userAuthModel } from '../../../services/auth/userAuthModel';
import usersDbQueries from '../../../models/db/users.db.queries';
import tokensDbQueries from '../../../models/db/tokens.db.queries';

jest.mock('../../../models/db/users.db.queries', () => ({
    find: jest.fn(),
    create: jest.fn(),
    setLastLogin: jest.fn()
}));
jest.mock('../../../models/db/tokens.db.queries', () => ({
    getUserByToken: jest.fn()
}));
jest.mock('../../../models/db/tokens.db.queries', () => ({
    getUserByToken: jest.fn()
}));
const mockFind = usersDbQueries.find as jest.MockedFunction<typeof usersDbQueries.find>;
const mockCreate = usersDbQueries.create as jest.MockedFunction<typeof usersDbQueries.create>;
const mockFindToken = tokensDbQueries.getUserByToken as jest.MockedFunction<typeof tokensDbQueries.getUserByToken>
const mockSetLastLogin = usersDbQueries.setLastLogin as jest.MockedFunction<typeof usersDbQueries.setLastLogin>;

localLogin(passport, userAuthModel);

jest.mock('../../../services/auth/userEmailNotifications');
const mockedConfirmEmail = sendConfirmationEmail as jest.Mocked<typeof sendConfirmationEmail>;

const url = 'http://test.transition.city/';

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
const encryptedPwd = userAuthModel.encryptPassword(password);
const validUser = {
    id: 5,
    uuid: 'arbitrary',
    password: encryptedPwd,
    username: validUsername,
    is_confirmed: true,
    is_valid: true
};
const unconfirmedUser = {
    id: 6,
    uuid: 'arbitrary',
    password: encryptedPwd,
    username: unconfirmedUsername,
    is_confirmed: false,
    is_valid: false
};

const newUserId = 7;
const validToken = "thisisavalidtoken"

beforeEach(() => {
    logInFct.mockClear();
    mockFind.mockClear();
    mockFind.mockResolvedValue(undefined); // undefined by default
    mockCreate.mockClear();
    mockCreate.mockImplementation(async(attribs) => {
        return {
            id: newUserId,
            uuid: 'arbitrary',
            ...attribs
        }
    });
    process.env.HOST = url;
    mockSetLastLogin.mockClear();
})

test('Local login strategy, valid user', async () => {
    mockFind.mockResolvedValueOnce(validUser);
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
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ usernameOrEmail: validUsername }, false);
    expect(mockSetLastLogin).toHaveBeenCalledTimes(1);
});

test('Local login strategy, invalid password', async () => {
    mockFind.mockResolvedValueOnce(validUser);
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-login')({logIn: logInFct, body: {usernameOrEmail: validUsername, password: 'Not the same'}}, {end: jest.fn()}, (err, result) => {
            resolve({ result, err });
        });
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('PasswordsDontMatch');
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ usernameOrEmail: validUsername }, false);
    expect(mockSetLastLogin).not.toHaveBeenCalled();
});

test('Local login strategy, unknown user', async () => {
    mockFind.mockResolvedValueOnce(undefined);
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('local-login')({logIn: logInFct, body: {usernameOrEmail: 'unknown user', password}}, {end: jest.fn()}, (err, result) => {
            resolve({ result, err });
        });
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toEqual('UnknownUser');
    expect(authResult.result).toBeFalsy();
    expect(logInFct).not.toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ usernameOrEmail: 'unknown user' }, false);
    expect(mockSetLastLogin).not.toHaveBeenCalled();
});

test('Local login strategy, unconfirmed user', async () => {
    mockFind.mockResolvedValueOnce(unconfirmedUser);
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
    expect(logInFct).not.toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ usernameOrEmail: unconfirmedUsername }, false);
    expect(mockSetLastLogin).not.toHaveBeenCalled();
});

test('Local login strategy, unconfirmed user, wrong password', async () => {
    mockFind.mockResolvedValueOnce(unconfirmedUser);
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
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ usernameOrEmail: unconfirmedUsername }, false);
    expect(mockSetLastLogin).not.toHaveBeenCalled();
});

test('Local signup strategy, auto-signon username and email', async () => {
    mockFind.mockResolvedValueOnce(undefined);
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
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ username: newUsername, email: newUserEmail }, true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        username: newUsername,
        email: newUserEmail,
        google_id: null,
        facebook_id: null,
        generated_password: null,
        password: expect.anything(),
        first_name: '',
        last_name: '',
        is_admin: false,
        is_valid: true,
        is_test: false,
        is_confirmed: true,
        confirmation_token: null,
        preferences: null
    });
    expect(mockSetLastLogin).toHaveBeenCalledTimes(1);
});

test('Local signup strategy, auto-signon user exists', async () => {
    mockFind.mockResolvedValueOnce(validUser);
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
    expect(mockedConfirmEmail).not.toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ username: validUsername, email: newUserEmail }, true);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockSetLastLogin).not.toHaveBeenCalled();

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
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ username: newUsername, email: newUserEmail }, true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        username: newUsername,
        email: newUserEmail,
        google_id: null,
        facebook_id: null,
        generated_password: null,
        password: expect.anything(),
        first_name: '',
        last_name: '',
        is_admin: false,
        is_valid: true,
        is_test: false,
        is_confirmed: false,
        confirmation_token: expect.anything(),
        preferences: null
    });
    const insertedUser: any = mockCreate.mock.calls[0][0];

    expect(mockedConfirmEmail).toHaveBeenCalledTimes(1);
    expect(mockedConfirmEmail).toHaveBeenCalledWith(expect.objectContaining({ _attributes: expect.objectContaining(insertedUser) }),
        {
            strategy: 'confirmByUser',
            confirmUrl: `${url}verify/${insertedUser.confirmation_token}`
        });
    expect(mockSetLastLogin).not.toHaveBeenCalled();
    
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

    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ username: newUsername, email: newUserEmail }, true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        username: newUsername,
        email: newUserEmail,
        google_id: null,
        facebook_id: null,
        generated_password: null,
        password: expect.anything(),
        first_name: '',
        last_name: '',
        is_admin: false,
        is_valid: true,
        is_test: false,
        is_confirmed: false,
        confirmation_token: expect.anything(),
        preferences: null
    });
    const insertedUser: any = mockCreate.mock.calls[0][0];

    expect(mockedConfirmEmail).toHaveBeenCalledTimes(2);
    expect(mockedConfirmEmail).toHaveBeenLastCalledWith(expect.objectContaining({ _attributes: expect.objectContaining(insertedUser) }),
        {
            strategy: 'confirmByAdmin',
            confirmUrl: `${url}verify/${insertedUser.confirmation_token}`
        });
    expect(mockSetLastLogin).not.toHaveBeenCalled();
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
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ username: newUsername, email: newUserEmail }, true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        username: newUsername,
        email: newUserEmail,
        google_id: null,
        facebook_id: null,
        generated_password: null,
        password: expect.anything(),
        first_name: '',
        last_name: '',
        is_admin: false,
        is_valid: true,
        is_test: false,
        is_confirmed: false,
        confirmation_token: expect.anything(),
        preferences: null
    });
    const insertedUser: any = mockCreate.mock.calls[0][0];

    expect(mockedConfirmEmail).toHaveBeenCalledTimes(3);
    expect(mockedConfirmEmail).toHaveBeenLastCalledWith(expect.objectContaining({ _attributes: expect.objectContaining(insertedUser) }),
        {
            strategy: 'confirmByAdmin',
            confirmUrl: `${urlWithoutSlash}/verify/${insertedUser.confirmation_token}`
        });

});

test('Bearer-Strategy', async () => {
    mockFindToken.mockResolvedValueOnce(validToken);
    const endFct = jest.fn();

    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('bearer-strategy')(
            {
                logIn: logInFct, 
                headers: {authorization: `Bearer ${validToken}`},
            },
            {   
                setHeader: jest.fn(),
                end: endFct.mockImplementation((message) => (
                    console.log(message),
                    resolve({ result: null, err: message })
                    ))
            }, (err, result) => {
                resolve({ result, err });
            }
            );
    });
    const authResult: any = await authPromise;
    expect(authResult.err).toBeUndefined();
    expect(authResult.result).toBeUndefined();
    expect(logInFct).toHaveBeenCalledTimes(1);
    expect(logInFct).toHaveBeenCalledWith(validToken, expect.anything(), expect.anything());
    expect(mockFindToken).toHaveBeenCalledTimes(1);
    expect(mockFindToken).toHaveBeenCalledWith(validToken);
});