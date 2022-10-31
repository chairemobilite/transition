/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { BaseUser } from 'chaire-lib-common/lib/services/user/userType';
import isAuthorized, { deserializeRules } from './authorization';

export type UserPages = { path: string; permissions: Permission; title: string };

interface Permission {
    [subject: string]: string | string[];
}

export type PermUser = {
    isAuthorized: (permissions: Permission) => boolean;
    is_admin: boolean;
    pages: UserPages[];
};

export type FrontendUser = BaseUser & PermUser;

export const toFrontendUser = (user: BaseUser, pages: UserPages[] = []): FrontendUser => {
    const ability = deserializeRules(user);
    const authFunction = (permissions: { [subject: string]: string | string[] }) => isAuthorized(ability, permissions);
    const userPages = pages.filter((page) => authFunction(page.permissions));
    return {
        isAuthorized: authFunction,
        is_admin: authFunction({ all: 'manage' }),
        pages: userPages,
        ...user
    };
};
