/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BaseUser, CliUser, UserPages, UserPermissions } from 'chaire-lib-common/lib/services/user/userType';
import isAuthorized, { deserializeRules } from './authorization';

export const toCliUser = (user: BaseUser, pages: UserPages[] = [], showUserInfoPerm?: UserPermissions): CliUser => {
    const ability = deserializeRules(user);
    const authFunction = (permissions: UserPermissions) => isAuthorized(ability, permissions);
    const userPages = pages.filter((page) => authFunction(page.permissions));
    return {
        isAuthorized: authFunction,
        is_admin: authFunction({ all: 'manage' }),
        pages: userPages,
        showUserInfo: showUserInfoPerm !== undefined ? authFunction(showUserInfoPerm) : true,
        ...user
    };
};
