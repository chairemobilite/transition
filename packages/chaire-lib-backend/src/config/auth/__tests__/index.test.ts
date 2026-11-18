/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import configurePassport from '../index';
import localLogin from '../localLogin.config';
import config from '../../server.config';
import { userAuthModel } from '../../../services/auth/userAuthModel';

jest.mock('../localLogin.config', () => ({
    __esModule: true,
    default: jest.fn()
}));
const mockedLocalLogin = localLogin as jest.MockedFunction<typeof localLogin>;

jest.mock('../../../models/db/users.db.queries', () => ({
    find: jest.fn(),
    create: jest.fn(),
    setLastLogin: jest.fn()
}));

// The configuration type does not allow an undefined `auth`
const configValues: Record<string, unknown> = config;
const originalAuth = config.auth;

beforeEach(() => {
    mockedLocalLogin.mockClear();
});

afterEach(() => {
    config.auth = originalAuth;
});

describe('Local login configuration', () => {

    test('No login method configured: local login is available', () => {
        configValues.auth = undefined;
        configurePassport(userAuthModel);
        expect(mockedLocalLogin).toHaveBeenCalledTimes(1);
    });

    test('Local login configured: local login is available', () => {
        config.auth = { localLogin: { allowRegistration: false } };
        configurePassport(userAuthModel);
        expect(mockedLocalLogin).toHaveBeenCalledTimes(1);
    });

    test('Other login methods only: local login is not available', () => {
        config.auth = { anonymous: false };
        configurePassport(userAuthModel);
        expect(mockedLocalLogin).not.toHaveBeenCalled();
    });

});
