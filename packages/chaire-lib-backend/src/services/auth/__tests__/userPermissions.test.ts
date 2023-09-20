/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import { subject } from '@casl/ability';
import definePermissionsFor, { addRole, DEFAULT_ROLE_NAME, removeRole, getAvailableRoles, addRoleHomePage, getHomePage } from '../userPermissions';

const testGroup = 'testGroup';
const testGroup2 = 'testGroup2';
const testSubject = 'Test';
const otherTestSubject = 'Other';

const defaultUser = {
    id: 1,
    uuid: uuidV4(),
    username: 'foo',
    email: 'foo@bar.com',
    is_admin: false,
};

const adminUser = {
    id: 2,
    uuid: uuidV4(),
    username: 'foo',
    email: 'admin@bar.com',
    is_admin: true,
};

const withPermissionsUser1 = {
    id: 3,
    uuid: uuidV4(),
    username: 'foo',
    email: 'role1@bar.com',
    is_admin: false,
    permissions: { testGroup: true, testGroup2: false }
};

const withPermissionsUser2 = {
    id: 4,
    uuid: uuidV4(),
    username: 'foo',
    email: 'role2@bar.com',
    is_admin: false,
    permissions: { testGroup2: true }
};

const obj1 = {
    id: 1,
    user_id: defaultUser.id,
    data: 'this is data for normal user'
}

const obj2 = {
    id: 2,
    user_id: adminUser.id,
    data: 'this is data for admin user'
}

const objForUserWithPermission1 = {
    id: 3,
    user_id: withPermissionsUser1.id,
    data: 'this is data for user with group 1 and 3'
}

const objForUserWithPermission2 = {
    id: 4,
    user_id: withPermissionsUser2.id,
    data: 'this is data for user with group 2'
}

beforeEach(() => {
    removeRole(testGroup);
    removeRole(testGroup2);
})

describe('Test default permissions', () => {

    test('Default user', () => {
        const permissions = definePermissionsFor(defaultUser);

        // By default, a user has no permissions on any object
        expect(permissions.can('read', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeFalsy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeFalsy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
    });

    test('Admin user', () => {
        const permissions = definePermissionsFor(adminUser);

        // By default, a user has no permissions on any object
        expect(permissions.can('read', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeTruthy();

        // Test other types than crud
        expect(permissions.can('validate', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
    });

    test('User with roles', () => {
        const permissions = definePermissionsFor(withPermissionsUser1);

        // By default, a user has no permissions on any object
        expect(permissions.can('read', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeFalsy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeFalsy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
    });
});

describe('Test with group permissions', () => {

    beforeEach(() => {
        // Add permissions for roles
        // Group1 can read, create and sing Test data, update and delete their own data 
        addRole(testGroup, ({ can }, user) => {
            can(['read', 'create', 'sing'], testSubject);
            can(['update', 'delete'], testSubject, { user_id: user.id});
        });

        // Group1 can also read other Test data
        addRole(testGroup, ({ can }, _user) => {
            can(['read'], otherTestSubject);
        });

        // Group2 can manage any Test data
        addRole(testGroup2, ({ can }, _user) => {
            can('manage', testSubject);
        });
    }); 

    test('Default user, still no permissions', () => {
        const permissions = definePermissionsFor(defaultUser);

        // By default, a user has no permissions on any object
        expect(permissions.can('read', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('sing', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('dig', subject(testSubject, obj1))).toBeFalsy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeFalsy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
    });

    test('Admin user, all permissions', () => {
        const permissions = definePermissionsFor(adminUser);

        // By default, a user has no permissions on any object
        expect(permissions.can('read', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('sing', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('dig', subject(testSubject, obj1))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeTruthy();

        // Test other subjects
        expect(permissions.can('read', subject(otherTestSubject, { ...objForUserWithPermission1 }))).toBeTruthy();
        expect(permissions.can('update', subject(otherTestSubject, { ...objForUserWithPermission1 }))).toBeTruthy();
        expect(permissions.can('delete', subject(otherTestSubject, { ...objForUserWithPermission1}))).toBeTruthy();
        expect(permissions.can('create', subject(otherTestSubject, { ...objForUserWithPermission1}))).toBeTruthy();
    });

    test('User with roles 1', () => {
        const permissions = definePermissionsFor(withPermissionsUser1);

        // Group1 can read and create Test data, update and delete their own data
        expect(permissions.can('read', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('read', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('create', testSubject)).toBeTruthy();
        expect(permissions.can('sing', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('dig', subject(testSubject, obj1))).toBeFalsy();

        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        // Careful, this is truthy, not falsy...
        expect(permissions.can('update', testSubject)).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission2))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission2))).toBeFalsy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeFalsy();

        // Group1 can also read other Test data
        const otherObj1 = { ...obj1 };
        expect(permissions.can('read', subject(otherTestSubject, otherObj1))).toBeTruthy();
        expect(permissions.can('read', otherTestSubject)).toBeTruthy();
        expect(permissions.can('update', subject(otherTestSubject, otherObj1))).toBeFalsy();
        expect(permissions.can('delete', subject(otherTestSubject, otherObj1))).toBeFalsy();
        expect(permissions.can('create', subject(otherTestSubject, otherObj1))).toBeFalsy();

    });

    test('User with roles 2', () => {
        const permissions = definePermissionsFor(withPermissionsUser2);

        // Group 2 can manage any test data, but not the other test data
        expect(permissions.can('read', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeTruthy();

        // Test other subjects
        expect(permissions.can('read', subject(otherTestSubject, { ...objForUserWithPermission1 }))).toBeFalsy();
        expect(permissions.can('update', subject(otherTestSubject, { ...objForUserWithPermission1 }))).toBeFalsy();
        expect(permissions.can('delete', subject(otherTestSubject, { ...objForUserWithPermission1 }))).toBeFalsy();
        expect(permissions.can('create', subject(otherTestSubject, { ...objForUserWithPermission1 }))).toBeFalsy();

    });
});

describe('Test default role', () => {

    beforeEach(() => {
        // Add permissions for the default roles (no group in user's permissions object)
        addRole(DEFAULT_ROLE_NAME, ({ can }, user) => {
            can(['read', 'create'], testSubject);
        });

    }); 

    test('Default user, can read and create test subjects', () => {
        const permissions = definePermissionsFor(defaultUser);

        // By default, a user has no permissions on any object
        expect(permissions.can('read', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
    });

    test('User with roles 1, no permissions', () => {
        const permissions = definePermissionsFor(withPermissionsUser1);

        // No permissions were defined for this specific role, fallback to default
        expect(permissions.can('read', subject(testSubject, obj1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj1))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, obj2))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, obj2))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, obj2))).toBeTruthy();

        expect(permissions.can('read', subject(testSubject, objForUserWithPermission1))).toBeTruthy();
        expect(permissions.can('update', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('delete', subject(testSubject, objForUserWithPermission1))).toBeFalsy();
        expect(permissions.can('create', subject(testSubject, objForUserWithPermission1))).toBeTruthy();

    });

});

test('Test get roles', () => {

    let roles = getAvailableRoles()
    expect(roles.length).toEqual(0);
    
    // Add a role definition
    const roleName = 'test';
    addRole(roleName, ({ can }, user) => {
        can(['read', 'create'], testSubject);
    });
    // Add a role definition
    const roleName2 = 'test2';
    addRole(roleName2, ({ can }, user) => {
        can(['read', 'create'], testSubject);
    });

    roles = getAvailableRoles()
    expect(roles.length).toEqual(2);
    expect(roles).toContain(roleName);
    expect(roles).toContain(roleName2);

    // Remove a role
    removeRole(roleName);

    roles = getAvailableRoles()
    expect(roles.length).toEqual(1);
    expect(roles).toContain(roleName2);

    // Remove admin and default, admin should remain
    removeRole('admin');
    removeRole(DEFAULT_ROLE_NAME);

    roles = getAvailableRoles()
    expect(roles.length).toEqual(1);
    expect(roles).toContain(roleName2);

});

describe('home page for user', () => {

    const defaultHomePage = '/Default';
    const adminHomePage = '/admin';

    beforeEach(() => {
        // Add permissions for the default roles (no group in user's permissions object)
        addRoleHomePage(DEFAULT_ROLE_NAME, defaultHomePage);
        addRoleHomePage('admin', adminHomePage);
        // Group2 can manage any Test data
        addRole(testGroup2, ({ can }, _user) => {
            can('manage', testSubject);
        });
    }); 

    test('getHomePage for users', () => {
        expect(getHomePage(defaultUser)).toEqual(defaultHomePage);
        expect(getHomePage(adminUser)).toEqual(adminHomePage);
        expect(getHomePage(withPermissionsUser1)).toBeUndefined();
        expect(getHomePage(withPermissionsUser2)).toBeUndefined();

        // Add home page for test group 2
        const group2Page = 'group2';
        addRoleHomePage(testGroup2, group2Page);
        expect(getHomePage(defaultUser)).toEqual(defaultHomePage);
        expect(getHomePage(adminUser)).toEqual(adminHomePage);
        expect(getHomePage(withPermissionsUser1)).toBeUndefined();
        expect(getHomePage(withPermissionsUser2)).toEqual(group2Page);

        // Copy a user and add it to multiple groups
        const newUser = _cloneDeep(withPermissionsUser1);
        newUser.permissions = { [testGroup]: true, [testGroup2]: true, 'testGroup3': true } as any;
        expect(getHomePage(newUser)).toEqual(group2Page);
    });

    test('Add home page for undefined role', () => {
        expect(() => addRoleHomePage('testGroup3', 'page')).toThrowError('Setting home page for undefined role testGroup3');
    })

});