/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import passport from 'passport';
import { TestUtils } from 'chaire-lib-common/lib/test';

import passwordlessLogin from '../passwordless.config';
import { sendEmail } from '../../../services/auth/userEmailNotifications';
import usersDbQueries from '../../../models/db/users.db.queries';
import { userAuthModel } from '../../../services/auth/userAuthModel';

process.env.MAGIC_LINK_SECRET_KEY = 'SOMEARBITRARYSTRINGFORASECRETKEY';

passwordlessLogin(passport, userAuthModel);

jest.mock('../../../services/auth/userEmailNotifications');
const mockedSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const url = 'http://test.transition.city/';

// req.logIn needs to be set and is called by passport when successful
const logInFct = jest.fn().mockImplementation((_a, _b, callback) => {
    callback();
});

jest.mock('../../../models/db/users.db.queries', () => ({
    find: jest.fn().mockResolvedValue(undefined),
    create: jest.fn()
}));
const mockFind = usersDbQueries.find as jest.MockedFunction<typeof usersDbQueries.find>;
const mockCreate = usersDbQueries.create as jest.MockedFunction<typeof usersDbQueries.create>;

// Initialize various user data
const newUserEmail = 'newUser@transition.city';
const existingUserEmail = 'existingUser@transition.city';
const existingUser = {
    id: 5,
    uuid: 'arbitrary',
    password: null,
    username: existingUserEmail,
    email: existingUserEmail,
    is_confirmed: true,
    is_valid: true
};

const newUserId = 7;

beforeEach(() => {
    logInFct.mockClear();
    process.env.HOST = url;
    mockedSendEmail.mockClear();
    mockFind.mockClear();
    mockCreate.mockClear();
    mockCreate.mockImplementation(async (attribs) => {
        return {
            id: newUserId,
            uuid: 'arbitrary',
            ...attribs
        }
    });
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

    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ usernameOrEmail: newUserEmail }, false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        username: newUserEmail,
        email: newUserEmail,
        google_id: null,
        facebook_id: null,
        generated_password: null,
        password: null,
        first_name: '',
        last_name: '',
        is_admin: false,
        is_valid: true,
        is_test: false,
        is_confirmed: true,
        confirmation_token: null,
        preferences: null
    });

    expect(logInFct).toHaveBeenCalledWith({ id: newUserId, username: newUserEmail, email: newUserEmail, firstName: '', lastName: '', preferences: {}, serializedPermissions: []}, expect.anything(), expect.anything());
});

describe('Complete send/verify flow for existing user', () => {

    let verifyUrl: string | undefined;

    test('User enters email', async () => {
        mockFind.mockResolvedValueOnce(existingUser);
        mockFind.mockResolvedValueOnce(existingUser);
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

        expect(mockFind).toHaveBeenCalledTimes(2);
        expect(mockFind).toHaveBeenCalledWith({ usernameOrEmail: existingUserEmail }, false);
        expect(mockFind).toHaveBeenCalledWith({ email: existingUserEmail }, false);

        expect(mockedSendEmail).toHaveBeenCalledTimes(1);
        expect(mockedSendEmail).toHaveBeenLastCalledWith({
            toUser: { email: existingUserEmail, displayName: '', id: existingUser.id, lang: null },
            mailText: ['customServer:magicLinkEmailText', 'server:magicLinkEmailText'],
            mailSubject: ['customServer:magicLinkEmailSubject', 'server:magicLinkEmailSubject']
        }, { magicLinkUrl: { url: expect.stringContaining('/magic/verify') } });
        verifyUrl = mockedSendEmail.mock.calls[0][1].magicLinkUrl.url;
    });
    
    test('Verify link url', async () => {
        mockFind.mockResolvedValueOnce(existingUser);
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

        expect(mockFind).toHaveBeenCalledTimes(1);
        expect(mockFind).toHaveBeenCalledWith({ email: existingUserEmail }, false);

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
                end: endFct.mockImplementation((message) => resolve({ result: null, err: message })),
                setHeader: jest.fn()
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

