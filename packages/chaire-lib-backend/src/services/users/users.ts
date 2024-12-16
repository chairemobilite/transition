/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import bytes from 'bytes';
import { directoryManager } from '../../utils/filesystem/directoryManager';
import config from '../../config/server.config';
import usersDbQueries, { UserFilter } from '../../models/db/users.db.queries';
import { UserAttributes } from './user';

export default class Users {
    static getAllMatching = async (
        params: { filter?: UserFilter; pageIndex?: number; pageSize?: number } = {}
    ): Promise<{ users: UserAttributes[]; totalCount: number }> => {
        const pageIndex = params.pageIndex || 0;
        const pageSize = params.pageSize || -1;
        const filters = params.filter || {};

        const { users, totalCount } = await usersDbQueries.getList({ filters, pageIndex, pageSize });

        if (users.length === 0) {
            return { users: [], totalCount: typeof totalCount === 'number' ? totalCount : parseInt(totalCount) };
        }
        return { users, totalCount: typeof totalCount === 'number' ? totalCount : parseInt(totalCount) };
    };

    static getAdmins = async (): Promise<UserAttributes[]> => {
        const { users } = await usersDbQueries.getList({ filters: { is_admin: true } });
        if (users.length === 0) {
            return [];
        }
        return users;
    };

    /**
     * Get the user's allowed disk usage, in bytes. If the returned value is -1,
     * then there is no quota specified
     *
     * @param userId The ID of the user
     * @returns The maximum size, in bytes, allowed in the user's data
     * directory.
     */
    // TODO: The userId argument is unused. Either remove it or implement a use for it.
    static getUserQuota = (_userId: number): number => {
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
