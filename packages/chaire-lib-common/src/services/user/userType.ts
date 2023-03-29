/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { PackRule } from '@casl/ability/extra';

export interface BaseUser {
    id: number;
    username: string;
    email?: string;
    preferences: { [key: string]: any };
    firstName?: string;
    lastName?: string;
    serializedPermissions: PackRule<any>[];
    homePage?: string;
}

export type UserPages = { path: string; permissions: UserPermissions; title: string };

export type UserPermissions = {
    [subject: string]: string | string[];
};

export type PermUser = {
    isAuthorized: (permissions: UserPermissions) => boolean;
    is_admin: boolean;
    pages: UserPages[];
    showUserInfo: boolean;
};

/**
 * User type suitable for client-side code, ie with limited internal and
 * confidential data, but with all appropriate data to validation user
 * permissions as required.
 */
export type CliUser = BaseUser & PermUser;
