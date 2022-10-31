/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import bytes from 'bytes';
import UserModel from '../auth/user';
import { directoryManager } from '../../utils/filesystem/directoryManager';
import config from '../../config/server.config';

export default class Users {
    static getBaseQuery(filters: { [key: string]: string }): UserModel {
        const baseQuery: UserModel = UserModel.where({});
        for (const key in filters) {
            switch (key) {
            case 'email':
                baseQuery.where('email', 'LIKE', `%${filters[key]}%`);
                break;
            case 'username':
                baseQuery.where('username', 'LIKE', `%${filters[key]}%`);
                break;
            }
        }
        return baseQuery;
    }

    static getAllMatching = async (
        params: { filter?: { [key: string]: string }; pageIndex?: number; pageSize?: number } = {}
    ): Promise<{ users: any[]; totalCount: number }> => {
        const pageIndex = params.pageIndex || 0;
        const pageSize = params.pageSize || -1;
        const filters = params.filter || {};

        const totalCount = await Users.getBaseQuery(filters).count();
        if (totalCount === 0) {
            return { users: [], totalCount };
        }
        const users =
            pageSize !== -1
                ? await Users.getBaseQuery(filters)
                    .query()
                    .limit(pageSize)
                    .offset(pageIndex * pageSize)
                : await Users.getBaseQuery(filters).fetchAll({ require: false });
        if (users.length === 0) {
            return { users: [], totalCount: typeof totalCount === 'number' ? totalCount : parseInt(totalCount) };
        }
        return { users, totalCount: typeof totalCount === 'number' ? totalCount : parseInt(totalCount) };
    };

    static getAdmins = async (): Promise<UserModel[]> => {
        const users = await UserModel.where<UserModel>({ is_admin: true }).fetchAll({ require: false });
        if (users.length === 0) {
            return [];
        }
        const userModels: UserModel[] = [];
        users.map((user) => userModels.push(user));
        return userModels;
    };

    /**
     * Get the user's allowed disk usage, in bytes. If the returned value is -1,
     * then there is no quota specified
     *
     * @param userId The ID of the user
     * @returns The maximum size, in bytes, allowed in the user's data
     * directory.
     */
    static getUserQuota = (userId: number): number => {
        const quota = bytes.parse(config.userDiskQuota);
        return quota === null ? 0 : quota;
    };

    /**
     * Get the user's current disk data usage
     *
     * @param userId The ID of the user
     * @returns An object, where `used` is the size in bytes currently used in
     * the user's data directory, and `remaining`, if defined, is the number of
     * bytes remaining on the user's quota. If `undefined`, the user has no
     * quota
     */
    static getUserDiskUsage = (userId: number): { used: number; remaining?: number } => {
        const absoluteUserDir = `${directoryManager.userDataDirectory}/${userId}`;
        const directorySize = directoryManager.getDirectorySizeAbsolute(absoluteUserDir);
        const userQuota = Users.getUserQuota(userId);
        return {
            used: directorySize,
            remaining: userQuota === -1 ? undefined : Math.max(userQuota - directorySize, 0)
        };
    };
}
