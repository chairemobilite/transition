/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { NextFunction, Request, Response } from 'express';
import isAuthorized, { isAdmin, isLoggedIn, serializePermissions } from '../authorization';
import { addRole } from '../userPermissions';

let mockRequest: Partial<Request>;
let mockResponse: Partial<Response>;
let nextFunction: NextFunction = jest.fn();
let mockUser = { id: 3, uuid: 'arbitrary', username: 'notAdmin', is_admin: false };
let mockAdmin = { id: 4, uuid: 'arbitrary', username: 'admin', is_admin: true };

beforeEach(() => {
    mockRequest = {};
    mockResponse = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
    };
    (nextFunction as any).mockClear();
});

describe('isAuthorized', () => {
    test('Unauthorized', async () => {
        isAuthorized({})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });

    test('Normal user, no permission requested', async () => {
        mockRequest.user = mockUser;
        isAuthorized({})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    test('Admin user, no permission requested', async () => {
        mockRequest.user = mockAdmin;
        isAuthorized({})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    test('Admin user, admin permission requested', async () => {
        mockRequest.user = mockAdmin;
        isAuthorized({'all': 'manage'})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    test('Normal user, admin permission requested', async () => {
        mockRequest.user = mockUser;
        isAuthorized({'all': 'manage'})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });

    test('Admin user, arbitrary permissions requested', async () => {
        mockRequest.user = mockAdmin;
        isAuthorized({'testSubject': 'read'})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(1);

        isAuthorized({'testSubject': ['read', 'update']})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(2);
    });

    test('Normal user, arbitrary permissions requested', async () => {
        mockRequest.user = mockUser;
        isAuthorized({'testSubject': 'read'})(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });
});

describe('isAdmin', () => {
    test('Unauthorized', async () => {
        isAdmin(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });

    test('Normal user', async () => {
        mockRequest.user = mockUser;
        isAdmin(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });

    test('Admin user', async () => {
        mockRequest.user = mockAdmin;
        isAdmin(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(1);
    });

});

describe('isLoggedIn', () => {
    test('Unauthorized', async () => {
        isLoggedIn(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(nextFunction).not.toHaveBeenCalled();
    });

    test('Normal user', async () => {
        mockRequest.user = mockUser;
        isLoggedIn(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    test('Admin user', async () => {
        mockRequest.user = mockAdmin;
        isLoggedIn(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(mockResponse.status).not.toHaveBeenCalled();
        expect(nextFunction).toHaveBeenCalledTimes(1);
    });

});

describe('serializePermissions', () => {
    test('logged in user', () => {
        const permissions = serializePermissions(mockUser);
        expect(permissions).toEqual([]);
    });

    test('logged in user', () => {
        const permissions = serializePermissions(mockAdmin);
        expect(permissions).toEqual([ ['manage', 'all'] ]);
    });

    test('with role', () => {
        const roleName = 'test';
        // Add a role
        addRole(roleName, ({ can }) => {
            can(['read', 'update'], 'testObject');
            can(['read'], 'other test object');
        });
        const user = Object.assign({ permissions: { [roleName]: true } }, mockUser);
        const permissions = serializePermissions(user);
        expect(permissions).toEqual([ [ 'read,update', 'testObject' ], [ 'read', 'other test object' ] ]);
    })
});
