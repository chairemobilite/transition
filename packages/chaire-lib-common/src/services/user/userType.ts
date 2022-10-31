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
