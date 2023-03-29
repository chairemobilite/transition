/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { toCliUser } from '../user';

const baseUser = {
    id: 1,
    username: 'test',
    preferences: {  },
    serializedPermissions: []
}

const testSubject = 'test';

test('No permissions', () => {
    const cliUser = toCliUser(baseUser);
    expect(cliUser.isAuthorized({ [testSubject]: 'read' })).toBeFalsy();
    expect(cliUser.isAuthorized({ all: 'read' })).toBeFalsy();
    expect(cliUser.isAuthorized({ [testSubject]: ['read','update'] })).toBeFalsy();
    expect(cliUser.is_admin).toBeFalsy();
});

test('Admin permissions', () => {
    const user = Object.assign({}, baseUser, { serializedPermissions: [ ['manage', 'all'] ] });
    const cliUser = toCliUser(user);
    expect(cliUser.isAuthorized({ [testSubject]: 'read' })).toBeTruthy();
    expect(cliUser.isAuthorized({ all: 'read' })).toBeTruthy();
    expect(cliUser.isAuthorized({ [testSubject]: ['read','update'] })).toBeTruthy();
    expect(cliUser.is_admin).toBeTruthy();
});

test('Some permissions', () => {
    let serializedPermissions = [ [ 'read', testSubject ], [ 'read', 'other test object' ] ];
    let user = Object.assign({}, baseUser, { serializedPermissions });
    let cliUser = toCliUser(user);
    expect(cliUser.isAuthorized({ [testSubject]: 'read' })).toBeTruthy();
    expect(cliUser.isAuthorized({ all: 'read' })).toBeFalsy();
    expect(cliUser.isAuthorized({ [testSubject]: ['read','update'] })).toBeFalsy();
    expect(cliUser.is_admin).toBeFalsy();

    serializedPermissions = [ [ 'read,update', testSubject ], [ 'read', 'other test object' ] ];
    user = Object.assign({}, baseUser, { serializedPermissions });
    cliUser = toCliUser(user);
    expect(cliUser.isAuthorized({ [testSubject]: 'read' })).toBeTruthy();
    expect(cliUser.isAuthorized({ all: 'read' })).toBeFalsy();
    expect(cliUser.isAuthorized({ [testSubject]: ['read','update'] })).toBeTruthy();
    expect(cliUser.is_admin).toBeFalsy();
});

test('Some permissions and home pages', () => {
    const pages = [
        { path: '/test', permissions: { [testSubject]: ['update'] }, title: 'page1' } as any,
        { path: '/test/page', permissions: { 'other test object': ['read'] }, title: 'page2' } as any,
        { path: '/foo', permissions: { 'foo': ['read'] }, title: 'foo' } as any,
    ];

    // User with only one permission on pages
    let serializedPermissions = [ [ 'read', testSubject ], [ 'read', 'other test object' ] ];
    let user = Object.assign({}, baseUser, { serializedPermissions });
    let cliUser = toCliUser(user, pages);
    expect(cliUser.pages.length).toEqual(1);
    expect(cliUser.pages[0]).toEqual(pages[1]);

    // User with 2 permissions on pages
    serializedPermissions = [ [ 'read,update', testSubject ], [ 'read', 'other test object' ] ];
    user = Object.assign({}, baseUser, { serializedPermissions });
    cliUser = toCliUser(user, pages);
    expect(cliUser.pages.length).toEqual(2);
    expect(cliUser.pages[0]).toEqual(pages[0]);
    expect(cliUser.pages[1]).toEqual(pages[1]);

    // Admin user
    user = Object.assign({}, baseUser, { serializedPermissions: [ ['manage', 'all'] ] });
    cliUser = toCliUser(user, pages);
    expect(cliUser.pages.length).toEqual(3);
    expect(cliUser.pages[0]).toEqual(pages[0]);
    expect(cliUser.pages[1]).toEqual(pages[1]);
    expect(cliUser.pages[2]).toEqual(pages[2]);

    // No permissions
    user = Object.assign({}, baseUser, { serializedPermissions: [] });
    cliUser = toCliUser(user, pages);
    expect(cliUser.pages.length).toEqual(0);
});