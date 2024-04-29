/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fetchMock from 'jest-fetch-mock';
import verifyAuthentication from '../verifyAuthentication';

const mockDispatch = jest.fn();

const loginCalled = { type: 'LOGIN' };
const logoutCalled = { type: 'LOGOUT' };

jest.mock('../../../actions/Auth', () => ({
    login: jest.fn().mockImplementation(() => loginCalled),
    logout: jest.fn().mockImplementation(() => logoutCalled)
}));

beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.doMock();
});

describe('verifyAuthentication', () => {
    test('Valid authenticated response', async() => {
        fetchMock.mockOnce(JSON.stringify({ user: { id: 1 } }));
        await verifyAuthentication(mockDispatch);
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(loginCalled);
    });

    test('Valid unauthenticated response', async () => {
        fetchMock.mockOnce(JSON.stringify({ status: 'Unauthenticated' }));
        await verifyAuthentication(mockDispatch);
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(logoutCalled);
    });

    test('Unauthenticated response', async() => {
        fetchMock.mockOnce(JSON.stringify({ status: 'Internal server error'}), {
            status: 401,
            statusText: "ok",
        });
        await verifyAuthentication(mockDispatch);
        expect(mockDispatch).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith(logoutCalled);
    });

    test('Other response code', async() => {
        fetchMock.mockOnce(JSON.stringify({ status: 'Internal server error'}), {
            status: 500,
            statusText: "ok",
        });
        await verifyAuthentication(mockDispatch);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('throw exception', async() => {
        fetchMock.mockRejectOnce(new Error('Some error occurred'));
        await verifyAuthentication(mockDispatch);
        expect(mockDispatch).not.toHaveBeenCalled();
    });
});