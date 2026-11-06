/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express, { type Response, type Request } from 'express';

import Users from '../services/users/users';
import isAuthorized, { UserSubject, isAdmin } from '../services/auth/authorization';
import { getAvailableRoles } from '../services/auth/userPermissions';
import { userAuthModel } from '../services/auth/userAuthModel';
import { sendConfirmedByAdminEmail } from '../services/auth/userEmailNotifications';
import { getConfirmEmailStrategy } from '../config/auth/localLogin.config';
import type { UserAttributes } from '../services/users/user';

const router = express.Router();

// Boolean flags the user list can be filtered by. They are received as 'true'
// or 'false' strings in the query string.
const booleanUserFilters = ['is_admin', 'is_confirmed'];

// All routes using this router need read and update permissions to Users
// TODO This is called admin routes, some routes may require more than simple User access, but user routes are under admin and may not require complete administration privileges. Re-think those routes.
router.use(isAuthorized({ [UserSubject]: ['read', 'update'] }));

router.get('/usersList', async (req: Request, res: Response) => {
    try {
        const { pageIndex, pageSize, ...filters } = req.query;
        const page = typeof pageIndex === 'string' ? parseInt(pageIndex) || 0 : 0;
        const queryPageSize = typeof pageSize === 'string' ? parseInt(pageSize) : undefined;

        const actualFilters: { [key: string]: string | boolean } = {};
        Object.keys(filters).forEach((key) => {
            const value = filters[key];
            if (typeof value !== 'string') {
                return;
            }
            if (!booleanUserFilters.includes(key)) {
                actualFilters[key] = value;
            } else if (value === 'true' || value === 'false') {
                actualFilters[key] = value === 'true';
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
            users: response.users.map(({ username, email, is_admin, is_confirmed, id, uuid, permissions }) => ({
                username,
                email,
                is_admin,
                is_confirmed,
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

// Confirm or unconfirm a user account. Confirming does the same as following
// the confirmation link sent by email, so it requires the same permissions as
// the `/verify` auth route, ie those of this router.
router.post('/updateUserSetConfirmed', async (req: Request, res: Response) => {
    const { uuid, is_confirmed } = req.body;

    if (!uuid) {
        return res.status(400).json({ status: 'BadRequest', message: 'Missing user uuid' });
    }
    if (typeof is_confirmed !== 'boolean') {
        return res.status(400).json({ status: 'BadRequest', message: 'Update is_confirmed flag, but flag not set' });
    }
    if ((req.user as UserAttributes)?.uuid === uuid) {
        // A user should not be able to unconfirm himself and get locked out
        return res.status(401).json({ status: 'Unauthorized', message: 'Cannot set is_confirmed flag on oneself' });
    }

    try {
        const user = await userAuthModel.getByUuid(uuid);
        if (user === undefined) {
            return res.status(404).json({ status: 'notFound', uuid });
        }
        const wasConfirmed = user.isConfirmed;
        // Clear the confirmation token when confirming, so the link sent by email is not valid anymore
        await user.updateAndSave(
            is_confirmed ? { is_confirmed: true, confirmation_token: null } : { is_confirmed: false }
        );
        if (is_confirmed && !wasConfirmed && getConfirmEmailStrategy() === 'confirmByAdmin') {
            try {
                await sendConfirmedByAdminEmail(user);
            } catch {
                // The error is logged by the email function. The account is
                // confirmed, so the request is still successful.
            }
        }
        return res.status(200).json({ status: 'success', uuid });
    } catch (error) {
        console.error('Error setting the is_confirmed flag: ', error);
        return res.status(500).json({ status: 'Error' });
    }
});

export default router;
