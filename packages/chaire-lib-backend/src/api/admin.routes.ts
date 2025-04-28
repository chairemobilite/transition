/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express, { Response, Request } from 'express';

import Users from '../services/users/users';
import isAuthorized, { UserSubject, isAdmin } from '../services/auth/authorization';
import { getAvailableRoles } from '../services/auth/userPermissions';
import { userAuthModel } from '../services/auth/userAuthModel';
import { UserAttributes } from '../services/users/user';

const router = express.Router();

// All routes using this router need read and update permissions to Users
// TODO This is called admin routes, some routes may require more than simple User access, but user routes are under admin and may not require complete administration privileges. Re-think those routes.
router.use(isAuthorized({ [UserSubject]: ['read', 'update'] }));

router.get('/usersList', async (req: Request, res: Response) => {
    try {
        const { pageIndex, pageSize, ...filters } = req.query;
        const page = typeof pageIndex === 'string' ? parseInt(pageIndex) || 0 : 0;
        const queryPageSize = typeof pageSize === 'string' ? parseInt(pageSize) : undefined;

        const actualFilters: { [key: string]: string } = {};
        Object.keys(filters).forEach((key) => {
            if (typeof filters[key] === 'string') {
                actualFilters[key] = filters[key] as string;
            }
        });
        const response = await Users.getAllMatching({
            pageIndex: page,
            pageSize: Number.isNaN(queryPageSize) ? undefined : queryPageSize,
            filter: actualFilters
        });
        return res.status(200).json({
            status: 'success',
            totalCount: response.totalCount,
            roles: getAvailableRoles(),
            users: response.users.map(({ username, email, is_admin, id, uuid, permissions }) => ({
                username,
                email,
                is_admin,
                id,
                uuid,
                permissions
            }))
        });
    } catch {
        return res.status(500).json({ status: 'Error' });
    }
});

const updateUserRequest = async (res: Response, uuid: string, userAttributes: { [key: string]: unknown }) => {
    try {
        if (!uuid) {
            return res.status(400).json({ status: 'BadRequest', message: 'Missing user uuid' });
        }

        const user = await userAuthModel.getByUuid(uuid);
        if (user === undefined) {
            return res.status(404).json({
                status: 'notFound',
                uuid
            });
        }

        await user.updateAndSanitizeAttributes(userAttributes);

        return res.status(200).json({
            status: 'success',
            uuid
        });
    } catch {
        return res.status(500).json({ status: 'Error' });
    }
};

router.post('/updateUser', async (req: Request, res: Response) => {
    // Cannot update the is_admin attribute with this route
    const { uuid, is_admin, ...rest } = req.body;
    if (is_admin !== undefined) {
        console.error('Attempted to set the is_admin attribute with the updateUser route. The attribute is ignored.');
    }
    await updateUserRequest(res, uuid, rest);
});

// This route adds the `isAdmin` authorization middleware to validate that the
// current user is an admin, as this route is only used to set the administrator
// flag on users.
router.post('/updateUserSetAdmin', isAdmin, async (req: Request, res: Response) => {
    const { uuid, is_admin } = req.body;

    if (is_admin === undefined) {
        res.status(400).json({ status: 'BadRequest', message: 'Update is_admin flag, but flag not set' });
    } else if ((req.user as UserAttributes)?.uuid === uuid) {
        // A user should not be able to set the is_admin flag on himself
        res.status(401).json({ status: 'Unauthorized', message: 'Cannot set is_admin flag on oneself' });
    } else {
        await updateUserRequest(res, uuid, { is_admin });
    }
});

export default router;
