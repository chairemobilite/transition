/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { createMongoAbility, MongoAbility } from '@casl/ability';
import { unpackRules } from '@casl/ability/extra';
import { BaseUser } from 'chaire-lib-common/lib/services/user/userType';

export const deserializeRules = (user: BaseUser) => {
    if (!user.serializedPermissions) {
        return createMongoAbility();
    }
    const rules = unpackRules(user.serializedPermissions);
    return createMongoAbility(rules);
};

/**
 * Verify client authorization for a user
 *
 * @param {{ [key: string ]: string}} permissions An object with the permissions
 * to verify, the keys are the subject types and the values are the permissions
 * to authorize. For example, to get the method to validate if a user can 'read'
 * or 'update' subject of type 'Users', the permissions to send would be {Users:
 * ['read', 'update'] }
 */
const isAuthorized = (ability: MongoAbility, permissions: { [subject: string]: string | string[] }): boolean => {
    // Check if the user has required permission, admin is a special case [for now]
    const permissionSubjects = Object.keys(permissions);
    for (let i = 0; i < permissionSubjects.length; i++) {
        const subject = permissionSubjects[i];
        const perms =
            typeof permissions[subject] === 'string'
                ? ([permissions[subject]] as string[])
                : (permissions[subject] as string[]);
        const cant = perms.find((perm) => !ability.can(perm, subject));
        if (cant) {
            return false;
        }
    }
    return true;
};

export default isAuthorized;
