/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import request from 'supertest';
import express, { RequestHandler } from 'express';
import router from '../admin.routes';
import { userAuthModel } from '../../services/auth/userAuthModel';

const defaultBackendUser = {
    id: 1,
    uuid: 'default-user',
    is_admin: false,
    is_authorized: true
};
const unauthorizedBackendUser = {
    ...defaultBackendUser,
    is_authorized: false
};
const adminBackendUser = {
    id: 1,
    uuid: 'admin-user',
    is_admin: true,
    is_authorized: true
};
// Current backend user to set in the request
let currentBackendUser = defaultBackendUser;

// Mock the authorization function, isAuthorized returns a function
jest.mock('../../services/auth/authorization', () => ({
    __esModule: true,
    default: jest.fn().mockReturnValue(jest.fn().mockImplementation((req, res, next) => {
        // If user is set not authorized, return a response
        if (currentBackendUser.is_authorized === false) {
            return res.status(401).json({ status: 'Unauthorized' });
        }
        // Set the user of the request to a mock user
        req.user = currentBackendUser;
        return next();
    })),
    isAdmin: jest.fn().mockImplementation((req, res, next) => {
        if (req.user.is_admin) {
            return next();
        } else {
            return res.status(401).json({ status: 'Unauthorized' });
        }
    }),
}));

// Spy on the getByUuid function
const updateAndSanitizeAttributesMock = jest.fn().mockResolvedValue(true);
const getByUuidSpy = jest.spyOn(userAuthModel, 'getByUuid');
const currentUserToEdit = {
    id: 100,
    uuid: 'test-uuid',
    username: 'test-username',
    updateAndSanitizeAttributes: updateAndSanitizeAttributesMock
} as any;
getByUuidSpy.mockResolvedValue(currentUserToEdit);

const app = express();
app.use(express.json() as RequestHandler);
app.use('/api/admin', router);

beforeEach(() => {
    currentBackendUser = defaultBackendUser;
    jest.clearAllMocks();
})

describe('updateUser route', () => {

    it('Should update attributes correctly when uuid is set and valid attributes', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
            permissions: { ['testPermission']: true }
        };
        const expectedAttributes = {
            permissions: attributes.permissions
        }

        // Call the route
        const response = await request(app).post('/api/admin/updateUser')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'success',
            uuid: currentUserToEdit.uuid
        });
        expect(getByUuidSpy).toHaveBeenCalledWith(currentUserToEdit.uuid);
        expect(updateAndSanitizeAttributesMock).toHaveBeenCalledWith(expectedAttributes);
    });

    it('Should not attempt to set the is_admin flag if set', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
            permissions: { ['testPermission']: true },
            is_admin: true
        };
        const expectedAttributes = {
            permissions: attributes.permissions
        }

        // Call the route
        const response = await request(app).post('/api/admin/updateUser')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'success',
            uuid: currentUserToEdit.uuid
        });
        expect(getByUuidSpy).toHaveBeenCalledWith(currentUserToEdit.uuid);
        expect(updateAndSanitizeAttributesMock).toHaveBeenCalledWith(expectedAttributes);
    });

    it('Should return 400 bad request if no uuid set', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            permissions: { ['testPermission']: true },
        };

        // Call the route
        const response = await request(app).post('/api/admin/updateUser')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            status: 'BadRequest',
            message: 'Missing user uuid'
        });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSanitizeAttributesMock).not.toHaveBeenCalled();
    });

    it('Should return 404 not found if user not found', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
            permissions: { ['testPermission']: true },
        };
        // Return undefined for the user
        getByUuidSpy.mockResolvedValueOnce(undefined);

        // Call the route
        const response = await request(app).post('/api/admin/updateUser')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            status: 'notFound',
            uuid: currentUserToEdit.uuid
        });
        expect(getByUuidSpy).toHaveBeenCalledWith(currentUserToEdit.uuid);
        expect(updateAndSanitizeAttributesMock).not.toHaveBeenCalled();
    });

    it('Should return 500 error if an error occurs', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
            permissions: { ['testPermission']: true },
        };
        const expectedAttributes = {
            permissions: attributes.permissions
        }
        // Throw an error while saving the data
        updateAndSanitizeAttributesMock.mockRejectedValueOnce('An error occurred');

        // Call the route
        const response = await request(app).post('/api/admin/updateUser')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            status: 'Error'
        });
        expect(getByUuidSpy).toHaveBeenCalledWith(currentUserToEdit.uuid);
        expect(updateAndSanitizeAttributesMock).toHaveBeenCalledWith(expectedAttributes);
    });

    it('Should return 401 unauthorized if the current backend is not authorized', async () => {
        // Set the unauthorized backend user
        currentBackendUser = unauthorizedBackendUser;

        // Prepare a valid request
        const attributes = {
            uuid: currentUserToEdit.uuid,
            permissions: { ['testPermission']: true }
        };

        // Call the route
        const response = await request(app).post('/api/admin/updateUser')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            status: 'Unauthorized'
        });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSanitizeAttributesMock).not.toHaveBeenCalled();
    });

});

describe('updateUserSetAdmin route', () => {

    beforeEach(() => {
        currentBackendUser = adminBackendUser;
    })

    it('Should set the is_admin flag to false', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
            is_admin: false
        };
        const expectedAttributes = {
            is_admin: false
        }

        // Call the route
        const response = await request(app).post('/api/admin/updateUserSetAdmin')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'success',
            uuid: currentUserToEdit.uuid
        });
        expect(getByUuidSpy).toHaveBeenCalledWith(currentUserToEdit.uuid);
        expect(updateAndSanitizeAttributesMock).toHaveBeenCalledWith(expectedAttributes);
    });

    it('Should set the is_admin flag to true, and only this flag', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
            is_admin: true,
            permissions: { ['testPermission']: true }
        };
        const expectedAttributes = {
            is_admin: true
        }

        // Call the route
        const response = await request(app).post('/api/admin/updateUserSetAdmin')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: 'success',
            uuid: currentUserToEdit.uuid
        });
        expect(getByUuidSpy).toHaveBeenCalledWith(currentUserToEdit.uuid);
        expect(updateAndSanitizeAttributesMock).toHaveBeenCalledWith(expectedAttributes);
    });

    it('Should return 400 bad request if no uuid set', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            is_admin: true,
        };

        // Call the route
        const response = await request(app).post('/api/admin/updateUserSetAdmin')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            status: 'BadRequest',
            message: 'Missing user uuid'
        });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSanitizeAttributesMock).not.toHaveBeenCalled();
    });

    it('Should return 400 bad request if no is_admin flag is set', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
        };

        // Call the route
        const response = await request(app).post('/api/admin/updateUserSetAdmin')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            status: 'BadRequest',
            message: 'Update is_admin flag, but flag not set'
        });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSanitizeAttributesMock).not.toHaveBeenCalled();
    });

    it('Should return 401 Unauthorized if the user tries to set admin flag to himself', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: adminBackendUser.uuid,
            is_admin: true
        };
        // Return undefined for the user
        getByUuidSpy.mockResolvedValueOnce(undefined);

        // Call the route
        const response = await request(app).post('/api/admin/updateUserSetAdmin')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            status: 'Unauthorized',
            message: 'Cannot set is_admin flag on oneself'
        });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSanitizeAttributesMock).not.toHaveBeenCalled();
    });

    it('Should return 401 unauthorized if the user is not admin', async () => {
        // Prepare attributes and expected attributes
        const attributes = {
            uuid: currentUserToEdit.uuid,
            permissions: { ['testPermission']: true },
        };
        // Set the backend user to a non-admin user
        currentBackendUser = defaultBackendUser;

        // Call the route
        const response = await request(app).post('/api/admin/updateUserSetAdmin')
            .send(attributes);

        // Validate the response
        expect(response.status).toBe(401);
        expect(response.body).toEqual({
            status: 'Unauthorized'
        });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSanitizeAttributesMock).not.toHaveBeenCalled();
    });

});
