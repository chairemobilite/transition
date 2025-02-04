/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { CliUser } from 'chaire-lib-common/lib/services/user/userType';
import { authReducer } from '../reducer';
import { AuthActionTypes } from '../types';

const testUser: CliUser = {
    id: 1,
    username: 'test',
    preferences: { },
    serializedPermissions: [],
    isAuthorized: jest.fn(),
    is_admin: false,
    pages: [],
    showUserInfo: true
}

test('Test a login status', () => {
    const action = {
        type: 'LOGIN' as any,
        user: testUser,
        isAuthenticated: true,
        login: true,
        register: false
    };

    const result =  {
        user: testUser,
        isAuthenticated: true,
        login: true,
        register: false
    };

    expect(authReducer({ isAuthenticated: false }, action)).toEqual(result);
});

test('Test a logout status', () => {
    const action = {
        type: AuthActionTypes.LOGOUT as const,
        user: null,
        isAuthenticated: false,
        register: false
    };

    const result =  {
        user: null,
        isAuthenticated: false,
        register: false
    };

    expect(authReducer({
        user: testUser,
        isAuthenticated: true,
        login: true,
        register: false
    }, action)).toEqual(result);
});

test('Test a forgot password status', () => {
    const initialState = {
        isAuthenticated: false
    };

    const action = {
        type: 'FORGOT' as any,
        forgot: true,
        emailExists: true,
        message: 'this is a message'
    };

    const result =  {
        isAuthenticated: false,
        forgot: true,
        emailExists: true,
        error: action.message
    };

    expect(authReducer(initialState, action)).toEqual(result);
});

test('Test a reset password status', () => {
    const initialState = {
        isAuthenticated: false
    };

    const action = {
        type: 'RESET' as any,
        status: 'this is a message'
    };

    const result =  {
        isAuthenticated: false,
        status: action.status
    };

    expect(authReducer(initialState, action)).toEqual(result);
});