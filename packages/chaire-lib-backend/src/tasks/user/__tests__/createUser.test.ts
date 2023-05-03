/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import each from 'jest-each';

import { CreateUser } from '../createUser';
import config from '../../../config/server.config';
import { userAuthModel } from '../../../services/auth/userAuthModel';

jest.mock('../../../services/auth/userAuthModel', () => ({
    userAuthModel: {
        createAndSave: jest.fn(),
        fetchAll: jest.fn().mockResolvedValue([{ username: 'foo', email: 'foo@test.com' }, { username: 'bar', email: null }, { username: null, email: 'baz@test.com' }])
    }
}));
const mockCreateAndSave = userAuthModel.createAndSave as jest.MockedFunction<typeof userAuthModel.createAndSave>;

beforeEach(() => {
    mockCreateAndSave.mockClear();
});

each([
    ['Valid user with default extra params', {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        first_name: 'Bob',
        last_name: 'Baker'
    }, {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        firstName: 'Bob',
        lastName: 'Baker',
        is_admin: false,
        confirmationToken: undefined,
        preferences: {}
    }],
    ['Unconfirmed user, with preferences', {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        first_name: 'Bob',
        last_name: 'Baker',
        confirmed: false,
        prefs: '{"lang": "en"}'
    }, {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        firstName: 'Bob',
        lastName: 'Baker',
        is_admin: false,
        confirmationToken: expect.anything(),
        preferences: { lang: 'en' }
    }],
    ['Admin user', {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        admin: true
    }, {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        firstName: '',
        lastName: '',
        is_admin: true,
        confirmationToken: undefined,
        preferences: {}
    }],
    ['Random data in fields', {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        admin: 'gg',
        confirmed: 'some value'
    }, {
        username: 'test',
        email: 'test@test.org',
        password: '111111',
        firstName: '',
        lastName: '',
        is_admin: false,
        confirmationToken: undefined,
        preferences: {}
    }],
    ['Duplicate username', {
        username: 'foo',
        email: 'test@test.org',
        password: '111111'
    }],
    ['Duplicate email', {
        email: 'baz@test.com',
        password: '111111'
    }],
    ['Invalid email', {
        email: 'notAnEmail',
        password: '111111',
    }],
    ['Invalid username', {
        username: 'foo foo',
        email: 'test@test.org',
        password: '111111'
    }],
]).test('Create user with parameters: %s', async (_description, parameters, expectedAttributes = undefined) => {
    const createUser = new CreateUser();
    await createUser.run(parameters);

    if (expectedAttributes !== undefined) {
        expect(mockCreateAndSave).toHaveBeenCalledTimes(1);
        expect(mockCreateAndSave).toHaveBeenCalledWith(expectedAttributes);
    } else {
        expect(mockCreateAndSave).not.toHaveBeenCalled();
    }
});