/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import each from 'jest-each';
import { v4 as uuidV4 } from 'uuid';
import { DirectoryManager } from '../../../utils/filesystem/directoryManager';
import { serverConfig } from '../../../config/config';
import usersDbQueries from '../../../models/db/users.db.queries';

import Users from '../users';

jest.mock('../../../models/db/users.db.queries', () => ({
    getList: jest.fn()
}));
const mockGetList = usersDbQueries.getList as jest.MockedFunction<typeof usersDbQueries.getList>;

// Create 10 users, half are admins
const allUsers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => ({
    id,
    uuid: uuidV4(),
    username: 'test' + id,
    is_admin: id % 2 === 0
}));

beforeEach(() => {
    mockGetList.mockClear();
    mockGetList.mockResolvedValue({ users: allUsers, totalCount: allUsers.length });
});

describe('Get all matching', () => {

    test('Get all users', async() => {
        const users = await Users.getAllMatching();
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: {}, pageIndex: 0, pageSize: -1 });
        expect(users.totalCount).toEqual(allUsers.length);
        expect(users.users).toEqual(allUsers);
    });

    test('Get first page, no index', async() => {
        await Users.getAllMatching({ pageSize: 5 });
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: {}, pageIndex: 0, pageSize: 5 });
    });

    test('Get first page, with index', async() => {
        await Users.getAllMatching({ pageIndex: 0, pageSize: 5 });
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: {}, pageIndex: 0, pageSize: 5 });
    });

    test('Get second page', async() => {
        await Users.getAllMatching({ pageSize: 5, pageIndex: 1 });
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: {}, pageIndex: 1, pageSize: 5 });
    });

    test('Search with filter', async() => {
        await Users.getAllMatching({ filter: { username: 'a' } });
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: { username: 'a' }, pageIndex: 0, pageSize: -1 });
    });

    test('Search with filter and paging', async() => {
        await Users.getAllMatching({ filter: { username: 'a'}, pageSize: 3, pageIndex: 2 });
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: {username: 'a'}, pageIndex: 2, pageSize: 3 });
    });
});

describe('Get admins', () => {
    test('Test get admins', async () => {
        const adminUsers = [{
            id: 1,
            uuid: uuidV4(),
            username: 'admin1',
            email: 'admin1@test.com',
            is_admin: true
        },
        {
            id: 2,
            uuid: uuidV4(),
            username: 'admin2',
            email: 'admin2@test.com',
            is_admin: true
        }];
        mockGetList.mockResolvedValue({ users: adminUsers, totalCount: adminUsers.length });
        const admins = await Users.getAdmins();
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: { is_admin: true } });
        expect(admins[0].username).toEqual('admin1');
        expect(admins[1].username).toEqual('admin2');
    });
    
    test('Test get admins, none found', async () => {
        mockGetList.mockResolvedValue({ users: [], totalCount: 0 });
        const admins = await Users.getAdmins();
        expect(admins.length).toEqual(0);
        expect(mockGetList).toHaveBeenCalledTimes(1);
        expect(mockGetList).toHaveBeenCalledWith({ filters: { is_admin: true } });
    });
});

describe('User quota and disk space', () => {
    let defaultUserQuota = serverConfig.userDiskQuota;
    afterAll(() => {
        serverConfig.userDiskQuota = defaultUserQuota;
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
            serverConfig.userDiskQuota = configQuota;
        } else {
            serverConfig.userDiskQuota = defaultUserQuota;
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
            serverConfig.userDiskQuota = configQuota;
        } else {
            serverConfig.userDiskQuota = defaultUserQuota;
        }
        expect(Users.getUserQuota(userId)).toEqual(expected);
    });

});
