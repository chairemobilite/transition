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
import Users from '../../services/users/users';
import { getConfirmEmailStrategy } from '../../config/auth/localLogin.config';
import { sendConfirmedByAdminEmail } from '../../services/auth/userEmailNotifications';

jest.mock('../../config/auth/localLogin.config', () => ({
    getConfirmEmailStrategy: jest.fn().mockReturnValue('confirmByAdmin')
}));
const mockGetConfirmEmailStrategy = getConfirmEmailStrategy as jest.MockedFunction<typeof getConfirmEmailStrategy>;

jest.mock('../../services/auth/userEmailNotifications', () => ({
    sendConfirmedByAdminEmail: jest.fn().mockResolvedValue(undefined)
}));
const mockSendConfirmedByAdminEmail = sendConfirmedByAdminEmail as jest.MockedFunction<typeof sendConfirmedByAdminEmail>;

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

describe('usersList route', () => {

    const getAllMatchingSpy = jest.spyOn(Users, 'getAllMatching');

    beforeEach(() => {
        getAllMatchingSpy.mockResolvedValue({
            totalCount: 1,
            users: [{
                id: 2,
                uuid: 'user-uuid',
                username: 'user',
                email: 'user@example.org',
                is_admin: false,
                is_confirmed: false,
                permissions: null,
                password: 'should not be returned',
                confirmation_token: 'should not be returned'
            }]
        });
    });

    it('Should return the users with their admin and confirmed flags, but not the other attributes', async () => {
        const response = await request(app).get('/api/admin/usersList?pageIndex=0&pageSize=10');

        expect(response.status).toBe(200);
        expect(response.body.totalCount).toEqual(1);
        expect(response.body.users).toEqual([{
            id: 2,
            uuid: 'user-uuid',
            username: 'user',
            email: 'user@example.org',
            is_admin: false,
            is_confirmed: false,
            permissions: null
        }]);
        expect(getAllMatchingSpy).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10, filter: {} });
    });

    it('Should convert the boolean filters and pass the text filters as is', async () => {
        const response = await request(app).get('/api/admin/usersList?pageIndex=1&pageSize=20&is_confirmed=false&is_admin=true&email=example');

        expect(response.status).toBe(200);
        expect(getAllMatchingSpy).toHaveBeenCalledWith({
            pageIndex: 1,
            pageSize: 20,
            filter: { is_confirmed: false, is_admin: true, email: 'example' }
        });
    });

    it('Should ignore boolean filters with invalid values', async () => {
        const response = await request(app).get('/api/admin/usersList?is_confirmed=maybe&is_admin=1');

        expect(response.status).toBe(200);
        expect(getAllMatchingSpy).toHaveBeenCalledWith({ pageIndex: 0, pageSize: undefined, filter: {} });
    });

    it('Should return 500 error if an error occurs', async () => {
        getAllMatchingSpy.mockRejectedValueOnce('An error occurred');

        const response = await request(app).get('/api/admin/usersList');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ status: 'Error' });
    });

});

describe('updateUserSetConfirmed route', () => {

    const updateAndSaveMock = jest.fn().mockResolvedValue(undefined);
    let userToConfirm: any;

    beforeEach(() => {
        userToConfirm = {
            id: 100,
            uuid: 'test-uuid',
            username: 'test-username',
            isConfirmed: false,
            updateAndSave: updateAndSaveMock
        };
        // Reset to drop any unused `mockResolvedValueOnce` left by previous tests
        getByUuidSpy.mockReset();
        getByUuidSpy.mockResolvedValue(userToConfirm);
        mockGetConfirmEmailStrategy.mockReturnValue('confirmByAdmin');
    });

    afterAll(() => {
        getByUuidSpy.mockResolvedValue(currentUserToEdit);
    });

    it('Should confirm the user, clear the confirmation token and send the confirmation email', async () => {
        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: true });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'success', uuid: userToConfirm.uuid });
        expect(getByUuidSpy).toHaveBeenCalledWith(userToConfirm.uuid);
        expect(updateAndSaveMock).toHaveBeenCalledWith({ is_confirmed: true, confirmation_token: null });
        expect(mockSendConfirmedByAdminEmail).toHaveBeenCalledWith(userToConfirm);
    });

    it('Should not send the confirmation email if the users confirm their own account', async () => {
        mockGetConfirmEmailStrategy.mockReturnValue('confirmByUser');

        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: true });

        expect(response.status).toBe(200);
        expect(updateAndSaveMock).toHaveBeenCalledWith({ is_confirmed: true, confirmation_token: null });
        expect(mockSendConfirmedByAdminEmail).not.toHaveBeenCalled();
    });

    it('Should not send the confirmation email again if the user was already confirmed', async () => {
        userToConfirm.isConfirmed = true;

        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: true });

        expect(response.status).toBe(200);
        expect(updateAndSaveMock).toHaveBeenCalledWith({ is_confirmed: true, confirmation_token: null });
        expect(mockSendConfirmedByAdminEmail).not.toHaveBeenCalled();
    });

    it('Should succeed even if the confirmation email cannot be sent', async () => {
        mockSendConfirmedByAdminEmail.mockRejectedValueOnce('Mail server error');

        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: true });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'success', uuid: userToConfirm.uuid });
        expect(updateAndSaveMock).toHaveBeenCalledWith({ is_confirmed: true, confirmation_token: null });
    });

    it('Should unconfirm the user without sending an email', async () => {
        userToConfirm.isConfirmed = true;

        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: false });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'success', uuid: userToConfirm.uuid });
        expect(updateAndSaveMock).toHaveBeenCalledWith({ is_confirmed: false });
        expect(mockSendConfirmedByAdminEmail).not.toHaveBeenCalled();
    });

    it('Should return 400 bad request if no uuid set', async () => {
        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ is_confirmed: true });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ status: 'BadRequest', message: 'Missing user uuid' });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSaveMock).not.toHaveBeenCalled();
    });

    it.each([
        ['missing', undefined],
        ['a string', 'true'],
        ['a number', 1]
    ])('Should return 400 bad request if the is_confirmed flag is %s', async (_description, flag) => {
        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: flag });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ status: 'BadRequest', message: 'Update is_confirmed flag, but flag not set' });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSaveMock).not.toHaveBeenCalled();
    });

    it('Should return 401 Unauthorized if the user tries to set the flag on himself', async () => {
        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: defaultBackendUser.uuid, is_confirmed: false });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ status: 'Unauthorized', message: 'Cannot set is_confirmed flag on oneself' });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSaveMock).not.toHaveBeenCalled();
    });

    it('Should return 401 unauthorized if the current user does not have the permissions', async () => {
        currentBackendUser = unauthorizedBackendUser;

        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: true });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ status: 'Unauthorized' });
        expect(getByUuidSpy).not.toHaveBeenCalled();
        expect(updateAndSaveMock).not.toHaveBeenCalled();
    });

    it('Should return 404 not found if user not found', async () => {
        getByUuidSpy.mockResolvedValueOnce(undefined);

        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: true });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ status: 'notFound', uuid: userToConfirm.uuid });
        expect(updateAndSaveMock).not.toHaveBeenCalled();
    });

    it('Should return 500 error if the user cannot be saved', async () => {
        updateAndSaveMock.mockRejectedValueOnce('An error occurred');

        const response = await request(app).post('/api/admin/updateUserSetConfirmed')
            .send({ uuid: userToConfirm.uuid, is_confirmed: true });

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ status: 'Error' });
        expect(mockSendConfirmedByAdminEmail).not.toHaveBeenCalled();
    });

});
