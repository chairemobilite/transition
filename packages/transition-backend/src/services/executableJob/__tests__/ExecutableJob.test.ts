/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { EventEmitter } from 'events';
import each from 'jest-each';
import fs from 'fs';
import { TestUtils } from 'chaire-lib-common/lib/test';
import { JobAttributes } from 'transition-common/lib/services/jobs/Job';
import { execJob } from '../../../tasks/serverWorkerPool';
import { ExecutableJob } from '../ExecutableJob';
import jobsDbQueries from '../../../models/db/jobs.db.queries'
import { JobStatus } from 'transition-common/lib/services/jobs/Job';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

const progressEmitter = new EventEmitter();

// Mock job type
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
    }
}

type TestChildJobType = Omit<TestJobType, 'name'> & {
    name: 'testChild';
}

const newJobAttributes: Omit<JobAttributes<TestJobType>, 'id' | 'status' | 'internal_data'> = {
    name: 'test' as const,
    user_id: 3,
    data: { parameters: { foo: 'bar' } },
    resources: { files: { testFile: 'path/to/file' } }
} as JobAttributes<TestJobType>;

const jobAttributes: JobAttributes<TestJobType> = {
    ...newJobAttributes,
    id: 2,
    status: 'pending',
    internal_data: {}
};

const jobAttributesChild1: JobAttributes<TestChildJobType> = {
    ...newJobAttributes,
    name: 'testChild' as const,
    id: 3,
    status: 'pending',
    parentJobId: 2,
    internal_data: {}
};

const jobAttributesChild2: JobAttributes<TestChildJobType> = {
    ...newJobAttributes,
    name: 'testChild' as const,
    id: 4,
    status: 'pending',
    parentJobId: 2,
    internal_data: {}
};


// Mock db queries
jest.mock('../../../models/db/jobs.db.queries', () => {
    return {
        read: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(2),
        delete: jest.fn().mockResolvedValue(2),
        collection: jest.fn()
    }
});
const mockedJobRead = jobsDbQueries.read as jest.MockedFunction<typeof jobsDbQueries.read>;
mockedJobRead.mockResolvedValue(_cloneDeep(jobAttributes));
const mockedJobCreate = jobsDbQueries.create as jest.MockedFunction<typeof jobsDbQueries.create>;
const mockedJobUpdate = jobsDbQueries.update as jest.MockedFunction<typeof jobsDbQueries.update>;
const mockedJobDelete = jobsDbQueries.delete as jest.MockedFunction<typeof jobsDbQueries.delete>;
const mockedJobCollection = jobsDbQueries.collection as jest.MockedFunction<typeof jobsDbQueries.collection>;

jest.mock('../../../tasks/serverWorkerPool', () => (
    { execJob: jest.fn() }
));
const mockedPool = execJob as jest.MockedFunction<typeof execJob>;

jest.mock('chaire-lib-backend/lib/utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn().mockReturnValue(true),
        copyFileAbsolute: jest.fn()
    }
}));
const mockedFileExists = fileManager.fileExistsAbsolute as jest.MockedFunction<typeof fileManager.fileExistsAbsolute>;
const mockedCopyFile = fileManager.copyFileAbsolute as jest.MockedFunction<typeof fileManager.copyFileAbsolute>;

beforeEach(() => {
    mockedJobRead.mockClear();
    mockedJobCreate.mockClear();
    mockedJobUpdate.mockClear();
    mockedJobDelete.mockClear();
    mockedJobCollection.mockClear();
    mockedPool.mockClear();
    mockedFileExists.mockClear();
    mockedCopyFile.mockClear();
});

test('Test create job', async () => {
    mockedJobCreate.mockResolvedValueOnce(jobAttributes.id);
    const jobObj = await ExecutableJob.createJob(newJobAttributes);
    expect(mockedJobCreate).toHaveBeenCalledTimes(1);
    expect(mockedJobCreate).toHaveBeenCalledWith({ status: 'pending', internal_data: {}, ...newJobAttributes });
    expect(jobObj.attributes).toEqual({ id: jobAttributes.id, internal_data: {}, ...newJobAttributes });
    expect(jobObj.status).toEqual('pending');

    // Create with listener
    const listener = new EventEmitter();
    const jobUpdatedListener = jest.fn();
    listener.on('executableJob.updated', jobUpdatedListener);
    mockedJobCreate.mockResolvedValueOnce(jobAttributes.id);
    await ExecutableJob.createJob(newJobAttributes, listener);
    expect(jobUpdatedListener).toHaveBeenCalledTimes(1);
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobObj.attributes.id, name: jobObj.attributes.name });
});

test('Test create job with input files', async () => {
    const filename = 'blabla.csv';
    const absoluteFilePath = `/path/to/file/${filename}`;
    const renameTo = 'myCoolFile.csv';
    const attributes = _cloneDeep(newJobAttributes) as any;
    attributes.inputFiles = { testFile: absoluteFilePath, testFile2: { filepath: absoluteFilePath, renameTo } };

    mockedJobCreate.mockResolvedValueOnce(jobAttributes.id);
    const jobObj = await ExecutableJob.createJob(attributes);
    expect(mockedJobCreate).toHaveBeenCalledTimes(1);
    expect(mockedJobCreate).toHaveBeenCalledWith({ status: 'pending', internal_data: {}, ...newJobAttributes, resources: { files: { testFile: filename, testFile2: renameTo } } });
    expect(jobObj.attributes).toEqual(expect.objectContaining({ id: jobAttributes.id, internal_data: {}, ...newJobAttributes, resources: { files: { testFile: filename, testFile2: renameTo } } }));
    expect(jobObj.status).toEqual('pending');

    expect(mockedFileExists).toHaveBeenCalledTimes(2);
    expect(mockedFileExists).toHaveBeenNthCalledWith(1, absoluteFilePath);
    expect(mockedFileExists).toHaveBeenNthCalledWith(2, absoluteFilePath);
    expect(mockedCopyFile).toHaveBeenCalledTimes(2);
    expect(mockedCopyFile).toHaveBeenNthCalledWith(1, absoluteFilePath, `${jobObj.getJobFileDirectory()}/${filename}`, true);
    expect(mockedCopyFile).toHaveBeenNthCalledWith(2, absoluteFilePath, `${jobObj.getJobFileDirectory()}/${renameTo}`, true);
});


test('Test load job', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    expect(mockedJobRead).toHaveBeenCalledTimes(1);
    expect(mockedJobRead).toHaveBeenCalledWith(jobAttributes.id);
    expect(jobObj.attributes).toEqual(expect.objectContaining({ id: jobAttributes.id, ...newJobAttributes }));
    expect(jobObj.status).toEqual('pending');
});

describe('Test resume running and pending', () => {
    test('No data', async () => {
        mockedJobCollection.mockResolvedValueOnce({ jobs: [], totalCount: 0 })
        expect(await ExecutableJob.enqueueRunningAndPendingJobs()).toEqual(true);
        expect(mockedJobCollection).toHaveBeenCalledWith(expect.objectContaining({
            statuses: ['inProgress', 'pending'],
            pageIndex: 0,
            pageSize: 0,
            sort: [
                { field: 'status', direction: 'desc' },
                { field: 'created_at', direction: 'asc' }
            ]
        }));
        expect(mockedPool).not.toHaveBeenCalled();
    });

    test('in progress and pending jobs', async () => {
        const jobsToRun = [{
            id: 5,
            status: 'inProgress' as const,
            internal_data: {},
            ...newJobAttributes
        }, jobAttributes, {
            id: 6,
            status: 'pending' as const,
            internal_data: {},
            ...newJobAttributes
        }];
        mockedJobCollection.mockResolvedValueOnce({ jobs: jobsToRun, totalCount: jobsToRun.length })
        expect(await ExecutableJob.enqueueRunningAndPendingJobs()).toEqual(true);
        // Wait for the jobs to have been enqueued and saved
        await TestUtils.flushPromises();
        expect(mockedJobCollection).toHaveBeenCalledWith(expect.objectContaining({
            statuses: ['inProgress', 'pending'],
            pageIndex: 0,
            pageSize: 0,
            sort: [
                { field: 'status', direction: 'desc' },
                { field: 'created_at', direction: 'asc' }
            ]
        }));
        // Just needs a return value, anything will do
        mockedPool.mockResolvedValue(5 as any);
        
        expect(mockedPool).toHaveBeenCalledTimes(3);
        expect(mockedPool).toHaveBeenNthCalledWith(1, 'task', [jobsToRun[0].id], expect.anything());
        expect(mockedPool).toHaveBeenNthCalledWith(2, 'task', [jobsToRun[1].id], expect.anything());
        expect(mockedPool).toHaveBeenNthCalledWith(3, 'task', [jobsToRun[2].id], expect.anything());
    });

    test('exception', async () => {

        mockedJobCollection.mockRejectedValueOnce('exception')
        expect(await ExecutableJob.enqueueRunningAndPendingJobs()).toEqual(false);
        expect(mockedPool).not.toHaveBeenCalled();

    });
});


test('Test getJobFileDirectory', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    expect(jobObj.getJobFileDirectory()).toContain(`userData/${jobAttributes.user_id}/${jobAttributes.id}`);
});

test('Test enqueue', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    // FIXME The type of execJob may be wrong, the return value now does not matter now, but may eventually. This should not be typed to any.
    mockedPool.mockResolvedValueOnce(5 as any);
    await jobObj.enqueue(progressEmitter);
    
    expect(mockedPool).toHaveBeenCalledTimes(1);
    expect(mockedPool).toHaveBeenCalledWith('task', [jobAttributes.id], expect.anything());
});

test('Test refresh', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);

    const updatedAttributes = {
        data: { parameters: { foo: 'newFoo' }, results: 5 },
        status: 'completed',
        resources: { files: { testFile: 'other/path/to/file', testFile2: 'abc' } }
    };
    const updatedJobAttributes = Object.assign({}, _cloneDeep(jobAttributes), updatedAttributes);

    // First return an actual job
    mockedJobRead.mockRejectedValueOnce('Job does not exist');
    mockedJobRead.mockResolvedValueOnce(_cloneDeep(updatedJobAttributes));
    
    // Refresh a job with error
    let error: any = undefined;
    try {
        await jobObj.refresh();
    } catch (err) {
        error = err
    }
    expect(error).toEqual('Job deleted');
    expect(jobObj.attributes).toEqual(expect.objectContaining({ id: jobAttributes.id, ...newJobAttributes }));
    expect(jobObj.status).toEqual(jobAttributes.status);

    // Refresh with udated attributes
    await jobObj.refresh();
    const { status, ...updated } = updatedJobAttributes
    expect(jobObj.attributes).toEqual(expect.objectContaining(updated));
    expect(jobObj.status).toEqual(updatedAttributes.status);
});

test('Test save', async () => {
    mockedJobRead.mockResolvedValue(_cloneDeep(jobAttributes));
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);

    // Change something, including the user_id, and save the existing object, user_id should not be updated
    jobObj.attributes.data.results = 3;
    jobObj.attributes.user_id = jobAttributes.user_id + 1;
    jobObj.attributes.internal_data.checkpoint = 23;
    await jobObj.save();
    expect(mockedJobUpdate).toHaveBeenCalledTimes(1);
    const { data, status, resources, internal_data } = jobAttributes;
    expect(mockedJobUpdate).toHaveBeenCalledWith(jobObj.attributes.id, { status, data: { ...data, results: 3 }, resources, internal_data: { ...internal_data, checkpoint: 23 } });

    // Change the status, it should be updated
    jobObj.setInProgress();
    await jobObj.save();
    expect(mockedJobUpdate).toHaveBeenCalledTimes(2);
    expect(mockedJobUpdate).toHaveBeenLastCalledWith(jobObj.attributes.id, { status: 'inProgress', data: { ...data, results: 3 }, resources, internal_data: { ...internal_data, checkpoint: 23 } });

    // Save with listener
    const listener = new EventEmitter();
    const jobUpdatedListener = jest.fn();
    listener.on('executableJob.updated', jobUpdatedListener);
    await jobObj.save(listener);
    expect(jobUpdatedListener).toHaveBeenCalledTimes(1);
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobObj.attributes.id, name: jobObj.attributes.name });
});

test('Test delete no child', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    mockedJobCollection.mockResolvedValueOnce({ jobs: [], totalCount: 0 })

    // Delete the object
    await jobObj.delete();
    expect(mockedJobDelete).toHaveBeenCalledTimes(1);
    expect(mockedJobDelete).toHaveBeenCalledWith(jobObj.attributes.id);

    // Delete with listener
    const listener = new EventEmitter();
    const jobUpdatedListener = jest.fn();
    listener.on('executableJob.updated', jobUpdatedListener);
    mockedJobCollection.mockResolvedValueOnce({ jobs: [], totalCount: 0 })

    await jobObj.delete(listener);
    expect(jobUpdatedListener).toHaveBeenCalledTimes(1);
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobObj.attributes.id, name: jobObj.attributes.name });
});

test('Test delete with children', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    mockedJobCollection.mockResolvedValueOnce({ jobs: [jobAttributesChild1, jobAttributesChild2], totalCount: 2 });
    mockedJobCollection.mockResolvedValueOnce({ jobs: [], totalCount: 0 })
    mockedJobCollection.mockResolvedValueOnce({ jobs: [], totalCount: 0 })

    // Delete the object
    await jobObj.delete();
    expect(mockedJobDelete).toHaveBeenCalledTimes(3);
    expect(mockedJobDelete).toHaveBeenCalledWith(jobObj.attributes.id);
    expect(mockedJobDelete).toHaveBeenCalledWith(jobAttributesChild1.id);
    expect(mockedJobDelete).toHaveBeenCalledWith(jobAttributesChild2.id);

    // Delete with listener
    const listener = new EventEmitter();
    const jobUpdatedListener = jest.fn();
    listener.on('executableJob.updated', jobUpdatedListener);
    mockedJobCollection.mockResolvedValueOnce({ jobs: [jobAttributesChild1, jobAttributesChild2], totalCount: 2 });
    mockedJobCollection.mockResolvedValueOnce({ jobs: [], totalCount: 0 })
    mockedJobCollection.mockResolvedValueOnce({ jobs: [], totalCount: 0 })
    await jobObj.delete(listener);
    expect(jobUpdatedListener).toHaveBeenCalledTimes(3);
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobObj.attributes.id, name: jobObj.attributes.name });
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobAttributesChild1.id, name: jobAttributesChild1.name });
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobAttributesChild2.id, name: jobAttributesChild2.name });

});

describe('Test status change', () => {
    const loadObjWithStatus = async (status: JobStatus) => {
        mockedJobRead.mockResolvedValueOnce(Object.assign({}, jobAttributes, { status }));
        return await ExecutableJob.loadTask(jobAttributes.id);
    }

    each([
        ['pending', true],
        ['inProgress', false],
        ['paused', false],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from "%s" to inProgress', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setInProgress()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'inProgress' : status);
    });

    each([
        ['pending', false],
        ['inProgress', true],
        ['paused', false],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from "%s" to completed', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setCompleted()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'completed' : status);
    });

    each([
        ['pending', false],
        ['inProgress', true],
        ['paused', false],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from "%s" to failed', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setFailed()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'failed' : status);
    });

    each([
        ['pending', true],
        ['inProgress', true],
        ['paused', true],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from "%s" to cancelled', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setCancelled()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'cancelled' : status);
    });

    each([
        ['pending', true],
        ['inProgress', true],
        ['paused', false],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('pause job with status "%s"', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setPaused()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'paused' : status);
    });

    each([
        ['pending', false],
        ['inProgress', false],
        ['paused', true],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('resume a job with status "%s" to pending', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        // No internal data, the job should go back to pending
        expect(await obj.resume()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'pending' : status);
    });

});

describe('Test stream methods', () => {
    let jobObj: ExecutableJob<TestJobType>;

    beforeEach(async () => {
        mockedJobRead.mockResolvedValue(_cloneDeep(jobAttributes));
        jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    });

    describe('fileExists', () => {
        test('Returns true when file exists', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            expect(jobObj.fileExists('testFile')).toBe(true);
        });

        test('Returns false when file does not exist', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            expect(jobObj.fileExists('testFile')).toBe(false);
        });

        test('Returns false when file is not defined in job', async () => {
            const jobAttribsWithoutFile = {
                ...jobAttributes,
                resources: { files: {} }
            };
            mockedJobRead.mockResolvedValue(jobAttribsWithoutFile);
            const jobWithoutFile = await ExecutableJob.loadTask(jobAttributes.id);
            expect(jobWithoutFile.fileExists('testFile')).toBe(false);
        });
    });

    describe('getReadStream', () => {
        test('Returns read stream for existing file', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const mockStream = {} as fs.ReadStream;
            jest.spyOn(fs, 'createReadStream').mockReturnValue(mockStream);

            const stream = jobObj.getReadStream('testFile');

            expect(stream).toBe(mockStream);
            expect(fs.createReadStream).toHaveBeenCalledWith(
                expect.stringContaining('path/to/file')
            );
        });

        test('Throws error when file is not defined', async () => {
            const jobAttribsWithoutFile = {
                ...jobAttributes,
                resources: { files: {} }
            };
            mockedJobRead.mockResolvedValue(jobAttribsWithoutFile);
            const jobWithoutFile = await ExecutableJob.loadTask(jobAttributes.id);

            expect(() => jobWithoutFile.getReadStream('testFile')).toThrow();
        });

        test('Throws error when file does not exist', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);

            expect(() => jobObj.getReadStream('testFile')).toThrow();
        });
    });

    describe('getWriteStream', () => {
        test('Returns write stream for file', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const mockStream = {} as fs.WriteStream;
            jest.spyOn(fs, 'createWriteStream').mockReturnValue(mockStream);

            const stream = jobObj.getWriteStream('testFile');

            expect(stream).toBe(mockStream);
            expect(fs.createWriteStream).toHaveBeenCalledWith(
                expect.stringContaining('path/to/file'),
                undefined
            );
        });

        test('Returns write stream with options', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const mockStream = {} as fs.WriteStream;
            jest.spyOn(fs, 'createWriteStream').mockReturnValue(mockStream);
            const options = { encoding: 'utf8' as BufferEncoding };

            const stream = jobObj.getWriteStream('testFile', options);

            expect(stream).toBe(mockStream);
            expect(fs.createWriteStream).toHaveBeenCalledWith(
                expect.stringContaining('path/to/file'),
                options
            );
        });

        test('Creates directory if it does not exist', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            const mockStream = {} as fs.WriteStream;
            jest.spyOn(fs, 'createWriteStream').mockReturnValue(mockStream);
            const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation();

            jobObj.getWriteStream('testFile');

            expect(mkdirSpy).toHaveBeenCalledWith(
                expect.any(String),
                { recursive: true }
            );
        });

        test('Throws error when file is not defined', async () => {
            const jobAttribsWithoutFile = {
                ...jobAttributes,
                resources: { files: {} }
            };
            mockedJobRead.mockResolvedValue(jobAttribsWithoutFile);
            const jobWithoutFile = await ExecutableJob.loadTask(jobAttributes.id);

            expect(() => jobWithoutFile.getWriteStream('testFile')).toThrow();
        });
    });
});

describe('registerOutputFile', () => {
    test('should register output file', async () => {
        const job = await ExecutableJob.loadTask(jobAttributes.id);

        job.registerOutputFile('testFile', 'output.csv');
        
        expect(job.attributes.resources?.files?.testFile).toEqual('output.csv');
        expect(job.getFileName('testFile')).toEqual('output.csv');
    });
    
    test('should handle multiple registrations with same filename', async () => {
        const job = await ExecutableJob.loadTask(jobAttributes.id);
        
        job.registerOutputFile('testFile', 'output.csv');
        job.registerOutputFile('testFile', 'output.csv'); // Should not throw
        
        expect(job.getFileName('testFile')).toEqual('output.csv');
    });
    
    test('should throw if registering same key with different filename', async () => {
        const job = await ExecutableJob.loadTask(jobAttributes.id);
        
        job.registerOutputFile('testFile', 'output.csv');
        
        expect(() => {
            job.registerOutputFile('testFile', 'different.csv');
        }).toThrow();
    });
});
