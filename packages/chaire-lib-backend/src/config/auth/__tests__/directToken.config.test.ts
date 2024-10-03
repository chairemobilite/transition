/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import passport from 'passport';
import each from 'jest-each';

import directTokenLogin from '../directToken.config';
import usersDbQueries from '../../../models/db/users.db.queries';
import { userAuthModel } from '../../../services/auth/userAuthModel';
import config from '../../server.config';

// req.logIn needs to be set and is called by passport when successful
const logInFct = jest.fn().mockImplementation((_a, _b, callback) => {
    callback();
});

jest.mock('../../../models/db/users.db.queries', () => ({
    find: jest.fn().mockResolvedValue(undefined),
    create: jest.fn(),
    setLastLogin: jest.fn()
}));
const mockFind = usersDbQueries.find as jest.MockedFunction<typeof usersDbQueries.find>;
const mockCreate = usersDbQueries.create as jest.MockedFunction<typeof usersDbQueries.create>;
const mockSetLastLogin = usersDbQueries.setLastLogin as jest.MockedFunction<typeof usersDbQueries.setLastLogin>;

const newUserId = 7;

beforeEach(() => {
    logInFct.mockClear();
    mockFind.mockClear();
    mockCreate.mockClear();
    mockCreate.mockImplementation(async (attribs) => {
        return {
            id: newUserId,
            uuid: 'arbitrary',
            ...attribs
        }
    });
    mockSetLastLogin.mockClear();
});

test('regex', () => {
    expect('abcdef'.match(/[a-z]+/gi)).not.toBeNull();
})

each([
    ['undefined format', '1234-1234', undefined, true],
    ['undefined format, no token', '', undefined, false],
    ['simple regex, matching token', 'abdefg', /^[a-z]+$/gi, true],
    ['simple regex, partly matching token at start, invalid', 'abcdefg87', /^[a-z]+$/gi, false],
    ['simple regex, partly matching token at end, invalid', '87abcdefg', /^[a-z]+$/gi, false],
    ['simple regex, unmatching token', '', /^[a-z]+$/gi, false],
    ['dash-separate hex regex, matching token', '1234ad-34DF-cafe-beef-c0701234ae34', /^[0-9A-F]{6}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/gi, true],
    ['dash-separate hex regex, unmatching token', '1234AD-34df-test-hexi-c0701234ae34', /^[0-9A-F]{6}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/gi, false],
    ['dash-separate hex regex, empty token', '', /^[0-9A-F]{6}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/gi, false],
    ['invalid regex, missing bracket', 'testToken', '/^[a-z+$/i', false],
    ['regex as string, valid token', 'abdefg', '^[a-z]+$', true],
    ['regex as string, invalid token', 'abcdefg87', '^[a-z]+$', false],
    ['simple string, valid token', 'testToken', 'testToken', true],
    ['simple string, invalid token', 'differentToken', 'testToken', false],
]).test('test with various token formats: %s', async(_title, token, tokenFormat, expectedResult) => {
    config.auth = {
        directToken: {
            tokenFormat: tokenFormat
        }
    };
    directTokenLogin(passport, userAuthModel)
    const endFct = jest.fn();
    const authPromise = new Promise((resolve, reject) => {
        const res = { 
            end: endFct.mockImplementation((message) => resolve({ result: null, err: message })),
            json: jest.fn().mockImplementation((json) => resolve({ result: json, err: null })),
            setHeader: jest.fn()
        };
        passport.authenticate('direct-token')(
            {
                logIn: logInFct,
                query: { access_token: token },
                res
            }, res, (err, result) => {
                resolve({ result, err });
            }
        );
    });
    const authResult: any = await authPromise;

    // Verify results
    if (expectedResult === true) {
        expect(logInFct).toHaveBeenCalledTimes(1);
        expect(logInFct).toHaveBeenCalledWith(expect.objectContaining({ email: undefined, username: token }), expect.anything(), expect.anything());
        expect(authResult.err).toBeUndefined();
        expect(authResult.result).toBeUndefined();
    } else {
        expect(logInFct).not.toHaveBeenCalled();
        expect(authResult.err).toBeDefined();
    }
    
});

test('Complete flow with valid token', async() => {
    config.auth = {
        directToken: {
            tokenFormat: undefined as any
        }
    };
    directTokenLogin(passport, userAuthModel)
    const endFct = jest.fn();
    const token = 'testtoken';
    const authPromise = new Promise((resolve, reject) => {
        passport.authenticate('direct-token')(
            {
                logIn: logInFct,
                query: { access_token: token }
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
    expect(mockFind).toHaveBeenCalledTimes(1);
    expect(mockFind).toHaveBeenCalledWith({ username: token }, false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
        username: token,
        email: null,
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
    expect(logInFct).toHaveBeenCalledTimes(1);
    expect(logInFct).toHaveBeenCalledWith(expect.objectContaining({ email: undefined, username: token }), expect.anything(), expect.anything());
});
