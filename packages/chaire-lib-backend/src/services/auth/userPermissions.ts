/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { AbilityBuilder, MongoAbility, createMongoAbility } from '@casl/ability';
import { UserAttributes } from '../users/user';

const roleMap: { [key: string]: ((builder: AbilityBuilder<MongoAbility>, user: UserAttributes) => void)[] } = {
    admin: [({ can }: AbilityBuilder<MongoAbility>) => can('manage', 'all')]
};

export const DEFAULT_ROLE_NAME = 'default';
const ADMIN_ROLE_NAME = 'admin';

/**
 * Add a function to define a role with the specific name. There can be more
 * than one such function for a given role, they will all be executed on after
 * the other.
 *
 * It is the responsability of the application defining roles to make sure there
 * are no conflicting rules for a role and that it behaves correctly.
 *
 * For applications using permissions, it is suggested to define a 'default'
 * role using the export constant `DEFAULT_ROLE_NAME`, otherwise the user will
 * have no permissions by default.
 *
 * @export
 * @param {string} roleName The name of the role to define. There are 2 special
 * cases: 'admin' and 'default'. Admin has all rights by default and cannot be
 * overwritten, while default means the fallback permissions when a user has no
 * role or if no ability defining function was defined for any of his roles.
 * @param {(builder: AbilityBuilder<Ability>, user: UserAttributes)=> void}
 * abilitiesFunction A function which will define the abilities for the user of
 * this role. Abilities can be anything used in the application. Common strings
 * are 'create', 'read', 'update', 'delete'. 'manage' is a wildcard and grants
 * all permissions. Any other permission type can be added.
 *
 * Example call to this function would be
 * ```
 * addRole('newRole', ({ can }, user) => {
 *     can(['read', 'update'], 'something', { user_id: user.id });
 * });
 * ```
 *
 * Note on permissions: When adding fields for a subject, like above, checking
 * permission on the whole subject also returns true. So here,
 * `permissions.can('read', 'something')` would return true, even if only the
 * subjects with the right user ID are allowed.
 */
export const addRole = (
    roleName: string,
    abilitiesFunction: (builder: AbilityBuilder<MongoAbility>, user: UserAttributes) => void
) => {
    if (roleMap[roleName]) {
        roleMap[roleName].push(abilitiesFunction);
    } else {
        roleMap[roleName] = [abilitiesFunction];
    }
};

/**
 * Remove all ability defining function for the role
 *
 * @export
 * @param {string} roleName The role to remove. Note that 'admin' role cannot be
 * removed.
 */
export const removeRole = (roleName: string) => {
    // Do not remove the admin role
    if (roleName !== ADMIN_ROLE_NAME) {
        delete roleMap[roleName];
    }
};

/**
 * Get a list of all available roles in the app. The roles are those that were
 * added using the 'addRole' function
 *
 * @export
 * @return {*}  An array of all available role names, excluding the default role
 * (authenticated user without any other role) and the admin role (user with the
 * is_admin flag)
 */
export const getAvailableRoles = (): string[] => {
    const roles = Object.keys(roleMap);
    return roles.filter((role) => role !== ADMIN_ROLE_NAME && role !== DEFAULT_ROLE_NAME);
};

const roleSpecificHomePages: { [key: string]: string } = {};

/**
 * Add a default home page for a specific user role
 *
 * @export
 * @param {string} roleName The name of the role to define. It must have been
 * first specified by a call to the `addRole` function. There are 2 special
 * cases: 'admin' and 'default'. Their default home page can be changed
 * @param {string | undefined} homePage Home page to link to by default for this
 * role
 */
export const addRoleHomePage = (roleName: string, homePage: string) => {
    if (roleName !== ADMIN_ROLE_NAME && roleName !== DEFAULT_ROLE_NAME && roleMap[roleName] === undefined) {
        throw `Setting home page for undefined role ${roleName}`;
    }
    roleSpecificHomePages[roleName] = homePage;
};

/**
 * Get the specific home page for a user, given its role permissions
 * @param user User details
 * @returns The home page if defined for the user, otherwise undefined
 */
export const getHomePage = (user: UserAttributes): string | undefined => {
    const userPermissions = user.permissions ? { ...user.permissions } : {};
    if (user.is_admin === true) {
        userPermissions[ADMIN_ROLE_NAME] = true;
    } else if (Object.keys(userPermissions).length === 0) {
        userPermissions[DEFAULT_ROLE_NAME] = true;
    }
    const permissionWithHomePage = Object.keys(userPermissions)
        .filter((key) => userPermissions[key] === true)
        .find((key) => roleSpecificHomePages[key] !== undefined);
    return permissionWithHomePage !== undefined ? roleSpecificHomePages[permissionWithHomePage] : undefined;
};

/**
 * @param user contains details about logged in user: its id, name, email, etc
 */
export default function defineAbilitiesFor(user: UserAttributes): MongoAbility {
    const builder: AbilityBuilder<MongoAbility> = new AbilityBuilder(createMongoAbility);

    const userPermissions = user.permissions || {};
    if (user.is_admin) {
        userPermissions[ADMIN_ROLE_NAME] = true;
    }

    let defaultFallback = true;
    if (userPermissions) {
        Object.keys(userPermissions)
            .filter((key) => userPermissions[key] === true)
            .forEach((key) => {
                const roleFunction = roleMap[key];
                if (roleFunction) {
                    defaultFallback = false;
                    roleFunction.forEach((defineAbilities) => defineAbilities(builder, user));
                }
            });
    }
    if (defaultFallback) {
        const defaultRoleFunction = roleMap[DEFAULT_ROLE_NAME];
        if (defaultRoleFunction) {
            defaultRoleFunction.forEach((defineAbilities) => defineAbilities(builder, user));
        }
    }

    return createMongoAbility(builder.rules);
}
