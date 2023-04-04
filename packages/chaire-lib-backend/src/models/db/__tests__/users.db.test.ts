/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';
import each from 'jest-each';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../users.db.queries';
import { truncate } from '../default.db.queries';
import { UserAttributes } from '../../../services/users/user';

const testEmail = 'test@test.org';

const user = {
    id: 1,
    uuid: uuidV4(),
    username: 'test',
    email: testEmail.toLowerCase(),
    preferences: { lang: 'fr' },
    first_name: 'Toto'
};

const user2 = {
    id: 2,
    uuid: uuidV4(),
    username: 'test2',
    email: 'test@example.org',
    preferences: { lang: 'fr' },
    first_name: 'Toto',
    password_reset_token: 'sometokenforpasswordreset'
};

const userCaps = {
    id: 3,
    uuid: uuidV4(),
    username: 'testCaps',
    email: testEmail.toUpperCase(),
    preferences: { lang: 'fr' },
    first_name: 'Toto'
};

const userToInsert = {
    username: 'newUser',
    preferences: { lang: 'fr' },
    first_name: 'Foo',
    is_admin: true
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await truncate(knex, 'users');
    await knex('users').insert(user);
    await knex('users').insert(user2);
});

afterAll(async() => {
    await truncate(knex, 'users');
});

each([
    [{ first_name: user.first_name }, user],
    [{}, undefined],
    [{ first_name: 'other' }, undefined],
    [{ first_name: user2.first_name, username: user2.username }, user2],
    [{ usernameOrEmail: user2.email }, user2],
    [{ usernameOrEmail: user2.username }, user2],
    [{ password_reset_token: user2.password_reset_token }, user2],
    [{ username: user2.username, email: 'arbitrary' }, undefined],
    [{ usernameOrEmail: user2.email.toUpperCase() }, user2],
    [{ usernameOrEmail: userCaps.email }, user],
]).test('Find user by %s', async(data, expected) => {
    // find uses WhereILike which ignores case
    const user = await dbQueries.find(data);
    if (expected === undefined) {
        expect(user).toBeUndefined();
    } else {
        expect(user).toEqual(expect.objectContaining(expected));
    }
});

test('Find user with orWhere', async() => {
    // Find by username or email, but with other invalid
    const foundUser = await dbQueries.find({ username: 'arbitrary', email: user.email }, true);
    expect(foundUser).toEqual(expect.objectContaining(user));

    const foundUser2 = await dbQueries.find({ username: user.username, email: 'arbitrary' }, true);
    expect(foundUser2).toEqual(expect.objectContaining(user));

    const foundUser3 = await dbQueries.find({ username: 'arbitrary', email: 'arbitrary' }, true);
    expect(foundUser3).toBeUndefined;
});

each([
    [user.id, user],
    [user2.id, user2],
    [50, undefined]
]).test('Get user by %s', async(id, expected) => {
    const user = await dbQueries.getById(id);
    if (expected === undefined) {
        expect(user).toBeUndefined();
    } else {
        expect(user).toEqual(expect.objectContaining(expected));
    }
});

each([
    [user.uuid, user ],
    [user2.uuid, user2],
    ['arbitrary', undefined],
    [uuidV4(), undefined]
]).test('Find user uuid %s', async(uuid, expected) => {
    const user = await dbQueries.getByUuid(uuid);
    if (expected === undefined) {
        expect(user).toBeUndefined();
    } else {
        expect(user).toEqual(expect.objectContaining(expected));
    }
});

test('Create new user', async () => {
    const userAttributes = await dbQueries.create(userToInsert);
    expect(userAttributes.id).toBeDefined();
    expect(userAttributes.uuid).toBeDefined();
    expect(typeof userAttributes.id).toEqual('number');
});

test('Create new user with duplicate key', async () => {
    await expect(dbQueries.create(userToInsert))
        .rejects
        .toThrowError(expect.anything());
});

test('Create user with duplicate email, but in caps', async () => {
    await expect(dbQueries.create(userCaps))
        .rejects
        .toThrowError(expect.anything());
});

test('Update user', async () => {
    const newName = 'Newname';
    const { id, uuid, username, ...origUser } = await dbQueries.getById(user.id) as UserAttributes;
    const updatedAttributes = _cloneDeep(origUser);
    updatedAttributes.is_admin = true;
    updatedAttributes.first_name = newName;
    await dbQueries.update(user.id, updatedAttributes);
    const updatedUser = await dbQueries.getById(user.id) as UserAttributes;
    expect(updatedUser.is_admin).toEqual(true);
    expect(updatedUser.first_name).toEqual(newName);
});

test('Update converts new emails to lowercase', async () => {
    const newEmail = 'EMAIL@EMAIL.ORG';
    const { id, uuid, username, ...origUser } = await dbQueries.getById(user.id) as UserAttributes;
    const updatedAttributes = _cloneDeep(origUser);
    updatedAttributes.email = newEmail;
    await dbQueries.update(user.id, updatedAttributes);
    const updatedUser = await dbQueries.getById(user.id) as UserAttributes;
    expect(updatedUser.email).toEqual(newEmail.toLowerCase());
});

test('Collection', async () => {
    const collection = await dbQueries.collection();
    expect(collection.length).toEqual(3);
    const dbUser = collection.find((u) => u.id === user2.id);
    expect(dbUser).toBeDefined();
    expect(dbUser).toEqual(expect.objectContaining(user2));
});

describe('list users', () => {

    const nbUsers = 3;

    test('Get the complete list', async () => {
        const { users, totalCount } = await dbQueries.getList({ filters: {}, pageIndex: 0, pageSize: -1 });
        expect(totalCount).toEqual(nbUsers);
        expect(users.length).toEqual(totalCount);

        // Without page index and size parameters
        const { users: noParamUsers, totalCount: totalCountNoParam } = await dbQueries.getList({ filters: {} });
        expect(totalCountNoParam).toEqual(nbUsers);
        expect(noParamUsers.length).toEqual(totalCount);
    });

    test('Get paginated users list', async () => {
        // 2 pages
        const pageSize = 2;
        // First page, should have 2 elements
        const { users: page1, totalCount: totalCount1 } = await dbQueries.getList({ filters: {}, pageIndex: 0, pageSize });
        expect(totalCount1).toEqual(nbUsers);
        expect(page1.length).toEqual(pageSize);
        // Second page, should have 1 element
        const { users: page2, totalCount: totalCount2 } = await dbQueries.getList({ filters: {}, pageIndex: 1, pageSize });
        expect(totalCount2).toEqual(nbUsers);
        expect(page2.length).toEqual(1);
        const inOtherPage = page2.find((user) => page1.find((user2) => user2.id === user.id) !== undefined);
        expect(inOtherPage).toBeUndefined();
        // There is no third page
        const { users: page3, totalCount: totalCount3 } = await dbQueries.getList({ filters: {}, pageIndex: 2, pageSize });
        expect(totalCount3).toEqual(nbUsers);
        expect(page3.length).toEqual(0);

        // Omit pageIndex, should be the 0th page
        const { users: pageNoIndex, totalCount: totalCountNoIndex } = await dbQueries.getList({ filters: {}, pageSize });
        expect(totalCountNoIndex).toEqual(nbUsers);
        expect(pageNoIndex.length).toEqual(pageSize);
        expect(pageNoIndex).toEqual(page1);
    });

    test('Get users list with email filter', async () => {
        // Use 'test' string, should return 1 user as one email is modified before
        const { users: testUsers, totalCount: totalCountTest } = await dbQueries.getList({ filters: { email: 'test' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountTest).toEqual(1);
        expect(testUsers.length).toEqual(1);
        
        // Use 'TEST' string, should return 1 user as it is case insensitive
        const { users: capsUsers, totalCount: totalCountCaps } = await dbQueries.getList({ filters: { email: 'TEST' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountCaps).toEqual(1);
        expect(capsUsers.length).toEqual(1);
        expect(capsUsers).toEqual(testUsers);

        // Use 'example.com' string, should return 1 user
        const { users: testOrgUsers, totalCount: totalCountTestOrg } = await dbQueries.getList({ filters: { email: 'example.org' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountTestOrg).toEqual(1);
        expect(testOrgUsers.length).toEqual(1);

        // Use 'foo' string, should return nothing
        const { users: fooUsers, totalCount: totalCountFoo } = await dbQueries.getList({ filters: { email: 'foo' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountFoo).toEqual(0);
        expect(fooUsers.length).toEqual(0);
    });

    test('Get users list with username filter', async () => {
        // Use 'test' string, should return 2 users
        const { users: testUsers, totalCount: totalCountTest } = await dbQueries.getList({ filters: { username: 'test' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountTest).toEqual(2);
        expect(testUsers.length).toEqual(2);

        // Use 'newUser' string, should return 1 user
        const { users: testOrgUsers, totalCount: totalCountTestOrg } = await dbQueries.getList({ filters: { username: 'newUser' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountTestOrg).toEqual(1);
        expect(testOrgUsers.length).toEqual(1);

        // Use 'foo' string, should return nothing
        const { users: fooUsers, totalCount: totalCountFoo } = await dbQueries.getList({ filters: { username: 'foo' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountFoo).toEqual(0);
        expect(fooUsers.length).toEqual(0);
    });

    test('Get users list with username and email filter', async () => {
        // Use 'test' string for both email and username, should return 1 user
        const { users: testUsers, totalCount: totalCountTest } = await dbQueries.getList({ filters: { username: 'test', email: 'test' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountTest).toEqual(1);
        expect(testUsers.length).toEqual(1);

        // Use 'test' for username and '.org' for email, should return 2 users
        const { users: testOrgUsers, totalCount: totalCountTestOrg } = await dbQueries.getList({ filters: { username: 'test', email: '.org' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountTestOrg).toEqual(2);
        expect(testOrgUsers.length).toEqual(2);

        // Use 'test' string for username and 'foo' for email, should return nothing
        const { users: fooUsers, totalCount: totalCountFoo } = await dbQueries.getList({ filters: { username: 'test', email: 'foo' }, pageIndex: 0, pageSize: -1 });
        expect(totalCountFoo).toEqual(0);
        expect(fooUsers.length).toEqual(0);
    });

    test('Test various filters', async () => {
        // is_admin is true
        const { users: adminUsers, totalCount: totalCountAdmin } = await dbQueries.getList({ filters: { is_admin: true }, pageIndex: 0, pageSize: -1 });
        expect(totalCountAdmin).toEqual(2);
        expect(adminUsers.length).toEqual(2);

        // is_admin is false
        const { users: notAdminUsers, totalCount: totalCountNotAdmin } = await dbQueries.getList({ filters: { is_admin: false }, pageIndex: 0, pageSize: -1 });
        expect(totalCountNotAdmin).toEqual(1);
        expect(notAdminUsers.length).toEqual(1);
    });

    test('Combine filter and paging', async () => {
        const pageSize = 1;
        const filters = { username: 'test', email: 'test' };
        // Use 'test' string for both email and username, should return 1 user, but paginated
        const { users: filterPage1, totalCount: totalCountTest } = await dbQueries.getList({ filters, pageIndex: 0, pageSize });
        expect(totalCountTest).toEqual(1);
        expect(filterPage1.length).toEqual(pageSize);

        // Second page
        const { users: filterPage2, totalCount: totalCount2 } = await dbQueries.getList({ filters, pageIndex: 1, pageSize });
        expect(totalCount2).toEqual(1);
        expect(filterPage2.length).toEqual(0);
        const inOtherPage = filterPage2.find((user) => filterPage1.find((user2) => user2.id === user.id) !== undefined);
        expect(inOtherPage).toBeUndefined();

        // There is no third page
        const { users: filterPage3, totalCount: totalCount3 } = await dbQueries.getList({ filters, pageIndex: 2, pageSize });
        expect(totalCount3).toEqual(1);
        expect(filterPage3.length).toEqual(0);
    });

    test('Page index, but page size is -1, should return all', async () => {
        const pageIndex = 3;
        const { users: page, totalCount: totalCount } = await dbQueries.getList({ filters: {}, pageIndex, pageSize: -1 });
        expect(totalCount).toEqual(nbUsers);
        expect(page.length).toEqual(nbUsers);
    });

    test('Sort data', async () => {
        // Sort by email ascending
        const { users: pageAsc, totalCount: totalCount } = await dbQueries.getList({
            filters: {},
            pageIndex: 0,
            pageSize: -1,
            sort: [{ field: 'email' }]
        });
        expect(totalCount).toEqual(nbUsers);
        expect(pageAsc.length).toEqual(nbUsers);

        // Sort by email response descending
        const { users: pageDesc, totalCount: totalCountDesc } = await dbQueries.getList({
            filters: {},
            pageIndex: 0,
            pageSize: -1,
            sort: [{ field: 'email', order: 'desc' }] });
        expect(totalCountDesc).toEqual(nbUsers);
        expect(pageDesc.length).toEqual(nbUsers);
        // Make sure both pages are reverse order from the other
        for (let i = 0; i < nbUsers; i++) {
            expect(pageAsc[i]).toEqual(pageDesc[nbUsers - 1 - i]);
        }
    });

    // Parameters for list come from external, we cannot guarantee the types
    test('inject bad data', async() => {
        // Add invalid order by, should throw an error
        await expect(dbQueries.getList({
            filters: {},
            pageIndex: 0,
            pageSize: -1,
            sort: [ { field: 'email', order: 'desc; select * from users' as any } ]
        }))
            .rejects
            .toThrowError('Cannot get users list in table users (knex error: Invalid sort order for interview query: desc; select * from users (DBINTO0001))');

        // Inject bad where value, should be escaped and return 0
        const { users: page, totalCount: totalCount } = await dbQueries.getList({ filters: { email: 'test\'; delete from users;' }, pageIndex: 0, pageSize: -1 });
        expect(totalCount).toEqual(0);
        expect(page.length).toEqual(0);
    });

});
