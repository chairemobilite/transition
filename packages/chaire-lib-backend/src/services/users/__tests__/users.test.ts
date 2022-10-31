/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'knex';
import mockKnex from 'mock-knex';
import each from 'jest-each';
import { DirectoryManager } from '../../../utils/filesystem/directoryManager';
import config from '../../../config/server.config';

import Users from '../users';

jest.mock('../../../config/shared/db.config', () => {
    const connection = knex({ client: 'pg', debug: false});
    mockKnex.mock(connection, 'knex@0.10');
    return connection;
});

const tracker = mockKnex.getTracker();
tracker.install();

// Create 10 users, half are admins
const allUsers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => ({
    id,
    username: 'test' + id,
    is_admin: id % 2 === 0
}));

const queryFct = jest.fn().mockImplementation((query) => {
    // Just return all the uers all the time, we are testing the queries after all, not the results
    if (query.sql.includes('count')) {
        query.response([{
            count: allUsers.length
        }])
    } else {
        query.response(allUsers)
    }

});

tracker.on('query', queryFct);

beforeEach(() => {
    queryFct.mockClear();
});

describe('Get all matching', () => {
    test('Get all users', async() => {
        const users = await Users.getAllMatching();
        expect(queryFct).toHaveBeenCalledTimes(2);
        expect(queryFct).toHaveBeenCalledWith(expect.objectContaining({ sql: expect.stringContaining('select count(*)') }), expect.anything());
        expect(users.totalCount).toEqual(allUsers.length);
        expect(users.users.map(userModel => userModel.attributes)).toEqual(allUsers);
    });

    test('Get first page, no index', async() => {
        await Users.getAllMatching({ pageSize: 5 });
        expect(queryFct).toHaveBeenCalledTimes(2);
        const countCall = queryFct.mock.calls[0];
        const userCall = queryFct.mock.calls[1];

        expect(countCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('select count(*)') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('limit') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('where') }));

        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('limit'), bindings: [ 5 ]}));
        expect(userCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('where') }));
        expect(userCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset') }));
    });

    test('Get first page, with index', async() => {
        await Users.getAllMatching({ pageSize: 5 });
        expect(queryFct).toHaveBeenCalledTimes(2);
        const countCall = queryFct.mock.calls[0];
        const userCall = queryFct.mock.calls[1];

        expect(countCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('select count(*)') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('limit') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('where') }));

        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('limit'), bindings: [ 5 ]}));
        expect(userCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('where') }));
        expect(userCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset') }));
    });

    test('Get second page', async() => {
        await Users.getAllMatching({ pageSize: 5, pageIndex: 1 });
        expect(queryFct).toHaveBeenCalledTimes(2);
        const countCall = queryFct.mock.calls[0];
        const userCall = queryFct.mock.calls[1];

        expect(countCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('select count(*)') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('limit') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('where') }));

        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('limit'), bindings: [ 5, 5 ]}));
        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('offset'), bindings: [ 5, 5 ]}));
        expect(userCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('where') }));
    });

    test('Search with filter', async() => {
        await Users.getAllMatching({ filter: { username: 'a' } });
        expect(queryFct).toHaveBeenCalledTimes(2);
        const countCall = queryFct.mock.calls[0];
        const userCall = queryFct.mock.calls[1];

        expect(countCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('select count(*)') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('limit') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset') }));
        expect(countCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('where') }));

        expect(userCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('limit')}));
        expect(userCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset')}));
        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('where'), bindings: [ '%a%' ] }));
    });

    test('Search with filter and paging', async() => {
        await Users.getAllMatching({ filter: { username: 'a'}, pageSize: 3, pageIndex: 2 });
        expect(queryFct).toHaveBeenCalledTimes(2);
        const countCall = queryFct.mock.calls[0];
        const userCall = queryFct.mock.calls[1];

        expect(countCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('select count(*)') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('limit') }));
        expect(countCall[0]).not.toEqual(expect.objectContaining({ sql: expect.stringContaining('offset') }));
        expect(countCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('where "username"'), bindings: [ '%a%' ] }));

        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('limit'), bindings: [ '%a%', 3, 6 ]}));
        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('offset')}));
        expect(userCall[0]).toEqual(expect.objectContaining({ sql: expect.stringContaining('where'), bindings: [ '%a%', 3, 6 ] }));
    });
});

describe('Get admins', () => {
    test('Test get admins', async () => {
        tracker.on('query', (query) => {
            query.response([{
                id: 1,
                username: 'admin1',
                email: 'admin1@test.com',
                is_admin: true
            },
            {
                id: 2,
                username: 'admin2',
                email: 'admin2@test.com',
                is_admin: true
            }]);
        });
        const admins = await Users.getAdmins();
        expect(admins.length).toEqual(2);
        expect(admins[0].get('username')).toEqual('admin1');
        expect(admins[1].get('username')).toEqual('admin2');
    });
    
    test('Test get admins, none found', async () => {
        tracker.on('query', (query) => {
            query.response(null);
        });
        const admins = await Users.getAdmins();
        expect(admins.length).toEqual(0);
    });
});

describe('User quota and disk space', () => {
    let defaultUserQuota = config.userDiskQuota;
    afterAll(() => {
        config.userDiskQuota = defaultUserQuota;
    });
    
    const mockGetDirectorySize = jest.fn().mockReturnValue(1);
    const userId = 1;
    DirectoryManager.prototype.getDirectorySizeAbsolute = mockGetDirectorySize;

    each([
        ['Default quota, smaller', undefined, 1 * 1024 * 1024 * 1024, 0],
        ['Quota in bytes, smaller', '100', 14, 100 - 14],
        ['Quota in bytes, equal', '100', 100, 0],
        ['Quota in bytes, bigger', '100', 101, 0],
        ['Quota in kilobytes, smaller', '2kb', 2047, 1],
        ['Quota in kilobytes, equal', '2kb', 2048, 0],
        ['Quota in kilobytes, bigger', '2kb', 2049, 0],
        ['Quota in mbytes, smaller', '3MB', 100, (3 * 1024 * 1024) - 100],
        ['Invalid quota string', 'bla', 1, 0],
    ]).test('Disk usage: %s', (_description, configQuota: string | undefined, currentDirSize: number, remaining) => {
        if (configQuota !== undefined) {
            config.userDiskQuota = configQuota;
        } else {
            config.userDiskQuota = defaultUserQuota;
        }
        mockGetDirectorySize.mockReturnValueOnce(currentDirSize);
        expect(Users.getUserDiskUsage(userId)).toEqual({ used: currentDirSize, remaining });
    });

    each([
        ['Use default quota', undefined, 1 * 1024 * 1024 * 1024],
        ['Quota in bytes', '100', 100],
        ['Quota in kilobytes', '2kb', 2 * 1024],
        ['Quota in mbytes', '3MB', (3 * 1024 * 1024)],
        ['Quota in gbytes', '3gB', (3 * 1024 * 1024 * 1024)],
        ['Quota with invalid suffix', '100something', 100],
        ['Invalid quota string', 'bla', 0],
    ]).test('User quota: %s', (_description, configQuota: string | undefined, expected: number) => {
        if (configQuota !== undefined) {
            config.userDiskQuota = configQuota;
        } else {
            config.userDiskQuota = defaultUserQuota;
        }
        expect(Users.getUserQuota(userId)).toEqual(expected);
    });

});
