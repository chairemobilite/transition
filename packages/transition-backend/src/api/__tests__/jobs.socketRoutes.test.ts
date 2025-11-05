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
import { execJob } from '../../tasks/serverWorkerPool';
import jobsDbQueries from '../../models/db/jobs.db.queries';
import { JobAttributes } from 'transition-common/lib/services/jobs/Job';

const userId = 2;
const socketStub = new EventEmitter();
jobsRoutes(socketStub, userId);

jest.mock('../../models/db/jobs.db.queries', () => {
    return {
        collection: jest.fn().mockResolvedValue({ jobs: [], totalCount: 0 }),
        read: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
});
const mockedCollection = jobsDbQueries.collection as jest.MockedFunction<typeof jobsDbQueries.collection>;
const mockedRead = jobsDbQueries.read as jest.MockedFunction<typeof jobsDbQueries.read>;
const mockedUpdate = jobsDbQueries.update as jest.MockedFunction<typeof jobsDbQueries.update>;
const mockedDelete = jobsDbQueries.delete as jest.MockedFunction<typeof jobsDbQueries.delete>;

jest.mock('../../tasks/serverWorkerPool', () => (
    { execJob: jest.fn() }
));
const mockedPool = execJob as jest.MockedFunction<typeof execJob>;

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
};

beforeEach(() => {
    jest.clearAllMocks();
});

const defaultJobAttributes: JobAttributes<TestJobType> = {
    id: 4,
    name: 'test' as const,
    user_id: 3,
    status: 'inProgress',
    internal_data: {},
    data: { parameters: { foo: 'bar' } },
    resources: { files: { testFile: 'file.csv', testFile2: 'noExtension', testFile3: 'doesNotExist.csv' } },
    created_at: '2022-08-08 13:21:34',
    updated_at: '2022-08-08 13:26:14'
};

describe('Jobs list', () => {

    test('List jobs properly', (done) => {
        const jobs = [{id: 1, user_id: userId, name: 'test', status: 'pending' as const, internal_data: {}, data: {}}];
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
        ...defaultJobAttributes,
        status: 'completed',
        internal_data: {},
        data: { parameters: { foo: 'bar' } },
        resources: { files: { testFile: 'file.csv', testFile2: 'noExtension', testFile3: 'doesNotExist.csv' } },
    };

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

describe('Job pause', () => {

    test('Pause job successfully', (done) => {
        mockedRead.mockResolvedValue(defaultJobAttributes);
        mockedUpdate.mockResolvedValue(defaultJobAttributes.id);
        socketStub.emit('executableJobs.pause', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(true);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            done();
        });
    });

    test('Pause job with error', (done) => {
        mockedRead.mockRejectedValueOnce('error');
        socketStub.emit('executableJobs.pause', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            done();
        });
    });

});

describe('Job resume', () => {

    test('Resume job successfully', (done) => {
        const pausedJobAttributes = { ...defaultJobAttributes, status: 'paused' as const };
        mockedRead.mockResolvedValue(pausedJobAttributes);
        mockedUpdate.mockResolvedValue(pausedJobAttributes.id);
        socketStub.emit('executableJobs.resume', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(true);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            expect(mockedPool).toHaveBeenCalledTimes(1);
            done();
        });
    });

    test('Resume job with error', (done) => {
        mockedRead.mockRejectedValueOnce('error');
        socketStub.emit('executableJobs.resume', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            expect(mockedPool).not.toHaveBeenCalled();
            done();
        });
    });

});

describe('Job delete', () => {

    test('Delete job successfully', (done) => {
        mockedRead.mockResolvedValue(defaultJobAttributes);
        mockedDelete.mockResolvedValue(defaultJobAttributes.id);
        socketStub.emit('executableJobs.delete', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(true);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            expect(mockedDelete).toHaveBeenCalledTimes(1);
            expect(mockedDelete).toHaveBeenCalledWith(defaultJobAttributes.id);
            done();
        });
    });

    test('Delete job with error', (done) => {
        mockedRead.mockRejectedValueOnce('error');
        socketStub.emit('executableJobs.delete', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            expect(mockedDelete).not.toHaveBeenCalled();
            done();
        });
    });

});

describe('Job cancel', () => {

    test('Cancel job successfully', (done) => {
        mockedRead.mockResolvedValue(defaultJobAttributes);
        mockedUpdate.mockResolvedValue(defaultJobAttributes.id);
        socketStub.emit('executableJobs.cancel', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(true);
            expect(Status.unwrap(status)).toEqual(true);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            done();
        });
    });

    test('Cancel job with error', (done) => {
        mockedRead.mockRejectedValueOnce('error');
        socketStub.emit('executableJobs.cancel', defaultJobAttributes.id, async (status) => {
            expect(Status.isStatusOk(status)).toEqual(false);
            expect(mockedRead).toHaveBeenCalledTimes(1);
            expect(mockedRead).toHaveBeenCalledWith(defaultJobAttributes.id);
            done();
        });
    });

});
