/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import express from 'express';

import Users from '../services/users/users';
import isAuthorized, { UserSubject } from '../services/auth/authorization';
import { getAvailableRoles } from '../services/auth/userPermissions';
import { userAuthModel } from '../services/auth/userAuthModel';

const router = express.Router();

// All routes using this router need read and update permissions to Users
// TODO This is called admin routes, some routes may require more than simple User access, but user routes are under admin and may not require complete administration privileges. Re-think those routes.
router.use(isAuthorized({ [UserSubject]: ['read', 'update'] }));

router.get('/usersList', async (req, res) => {
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
    } catch (error) {
        return res.status(500).json({ status: 'Error' });
    }
});

router.post('/updateUser', async (req, res) => {
    try {
        const { uuid, ...rest } = req.body;

        if (!uuid) {
            res.status(404).json({ status: 'BadRequest', message: 'Missing user uuid' });
        }

        const user = await userAuthModel.getByUuid(uuid);
        if (user === undefined) {
            return res.status(404).json({
                status: 'notFound',
                uuid
            });
        }
        await user.updateAndSanitizeAttributes(rest);

        return res.status(200).json({
            status: 'success',
            uuid
        });
    } catch (error) {
        return res.status(500).json({ status: 'Error' });
    }
});

export default router;
