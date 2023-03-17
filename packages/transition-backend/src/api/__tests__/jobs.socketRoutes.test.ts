/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { DirectoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import jobsRoutes from '../jobs.socketRoutes';
import jobsDbQueries from '../../models/db/jobs.db.queries';
import { JobAttributes } from 'transition-common/lib/services/jobs/Job';

const userId = 2;
const socketStub = new EventEmitter();
jobsRoutes(socketStub, userId);

jest.mock('../../models/db/jobs.db.queries', () => {
    return {
        collection: jest.fn().mockResolvedValue({ jobs: [], totalCount: 0 }),
        read: jest.fn()
    }
});
const mockedCollection = jobsDbQueries.collection as jest.MockedFunction<typeof jobsDbQueries.collection>;
const mockedRead = jobsDbQueries.read as jest.MockedFunction<typeof jobsDbQueries.read>;

type TestJobType = {
    name: 'test';
    data: {
        parameters: {
            foo: string
        };
        results?: number;
    },
    files: {
        testFile: boolean;
        testFile2: boolean;
        testFile3: boolean;
    }
}

describe('Jobs list', () => {

    beforeEach(() => {
        mockedCollection.mockClear();
    });

    test('List jobs properly', (done) => {
        const jobs = [{id: 1, user_id: userId, name: 'test', status: 'pending' as const, data: {}}];
        mockedCollection.mockResolvedValueOnce({ jobs, totalCount: 1 });
        socketStub.emit('executableJobs.list', {}, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ jobs: [ { ...jobs[0], hasFiles: false }], totalCount: 1 });
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(mockedCollection).toHaveBeenCalledWith({ userId, pageIndex: 0, pageSize: 0 });
            done();
        });
    });

    test('List jobs for a specific job type and paginations', (done) => {
        socketStub.emit('executableJobs.list', { jobType: 'accessMap', pageIndex: 3, pageSize: 5 }, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(mockedCollection).toHaveBeenCalledWith({ userId, jobType: 'accessMap', pageIndex: 3, pageSize: 5 });
            done();
        });
    });

    test('List jobs with error', (done) => {
        mockedCollection.mockRejectedValueOnce('error');
        socketStub.emit('executableJobs.list', { jobType: 'accessMap' }, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(mockedCollection).toHaveBeenCalledTimes(1);
            expect(mockedCollection).toHaveBeenCalledWith({ userId, jobType: 'accessMap', pageIndex: 0, pageSize: 0 });
            done();
        });
    });

});

describe('Job files', () => {

    const mockGetFiles = jest.fn().mockReturnValue([ 'file.csv', 'noExtension', 'other.csv']);
    DirectoryManager.prototype.getFilesAbsolute = mockGetFiles;
    
    const jobAttributes: JobAttributes<TestJobType> = {
        id: 4,
        name: 'test' as const,
        user_id: 3,
        status: 'completed',
        data: { parameters: { foo: 'bar' } },
        resources: { files: { testFile: 'file.csv', testFile2: 'noExtension', testFile3: 'doesNotExist.csv' } },
        created_at: '2022-08-08 13:21:34',
        updated_at: '2022-08-08 13:26:14'
    };

    beforeEach(() => {
        mockedRead.mockClear();
    });

    test('Get job files properly', (done) => {
        mockedRead.mockResolvedValue(jobAttributes);
        socketStub.emit('executableJobs.getFiles', jobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual({ 
                testFile: { 
                    url: `/job/${jobAttributes.id}/file.csv`, 
                    downloadName: `file_20220808_132134.csv`,
                    title: { text: `transit:jobs:test:files:testFile`, fileName: `file.csv` }
                }, 
                testFile2: { 
                    url: `/job/${jobAttributes.id}/noExtension`, 
                    downloadName: `noExtension_20220808_132134`,
                    title: { text: `transit:jobs:test:files:testFile2`, fileName: `noExtension` }
                } 
            });
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(jobAttributes.id);
            done();
        });
    });

    test('Get job files with error', (done) => {
        mockedRead.mockRejectedValueOnce('error');
        socketStub.emit('executableJobs.getFiles', jobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(jobAttributes.id);
            done();
        });
    });

});
