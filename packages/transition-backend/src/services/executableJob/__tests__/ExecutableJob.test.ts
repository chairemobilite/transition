/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import { EventEmitter } from 'events';
import each from 'jest-each';

import { JobAttributes } from 'transition-common/lib/services/jobs/Job';
import { execJob } from '../../../tasks/serverWorkerPool';
import { ExecutableJob } from '../ExecutableJob';
import jobsDbQueries from '../../../models/db/jobs.db.queries'
import { JobStatus } from 'transition-common/src/services/jobs/Job';

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

const newJobAttributes: Omit<JobAttributes<TestJobType>, 'id' | 'status'> = {
    name: 'test' as const,
    user_id: 3,
    data: { parameters: { foo: 'bar' } },
    resources: { files: { testFile: 'path/to/file' } }
} as JobAttributes<TestJobType>

const jobAttributes: JobAttributes<TestJobType> = {
    id: 2,
    status: 'pending',
    ...newJobAttributes
};

// Mock db queries
jest.mock('../../../models/db/jobs.db.queries', () => {
    return {
        read: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(2),
        delete: jest.fn().mockResolvedValue(2)
    }
});
const mockedJobRead = jobsDbQueries.read as jest.MockedFunction<typeof jobsDbQueries.read>;
mockedJobRead.mockResolvedValue(_cloneDeep(jobAttributes));
const mockedJobCreate = jobsDbQueries.create as jest.MockedFunction<typeof jobsDbQueries.create>;
const mockedJobUpdate = jobsDbQueries.update as jest.MockedFunction<typeof jobsDbQueries.update>;
const mockedJobDelete = jobsDbQueries.delete as jest.MockedFunction<typeof jobsDbQueries.delete>;

jest.mock('../../../tasks/serverWorkerPool', () => (
    { execJob: jest.fn() }
));
const mockedPool = execJob as jest.MockedFunction<typeof execJob>;

beforeEach(() => {
    mockedJobRead.mockClear();
    mockedJobCreate.mockClear();
    mockedJobUpdate.mockClear();
    mockedJobDelete.mockClear();
    mockedPool.mockClear();
});

test('Test create job', async () => {
    mockedJobCreate.mockResolvedValueOnce(jobAttributes.id);
    const jobObj = await ExecutableJob.createJob(newJobAttributes);
    expect(mockedJobCreate).toHaveBeenCalledTimes(1);
    expect(mockedJobCreate).toHaveBeenCalledWith({ status: 'pending', ...newJobAttributes });
    expect(jobObj.attributes).toEqual(expect.objectContaining({ id: jobAttributes.id, ...newJobAttributes }));
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

test('Test load job', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    expect(mockedJobRead).toHaveBeenCalledTimes(1);
    expect(mockedJobRead).toHaveBeenCalledWith(jobAttributes.id);
    expect(jobObj.attributes).toEqual(expect.objectContaining({ id: jobAttributes.id, ...newJobAttributes }));
    expect(jobObj.status).toEqual('pending');
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
    await jobObj.save();
    expect(mockedJobUpdate).toHaveBeenCalledTimes(1);
    const { data, status, resources } = jobAttributes;
    expect(mockedJobUpdate).toHaveBeenCalledWith(jobObj.attributes.id, { status, data: { ...data, results: 3 }, resources });

    // Change the status, it should be updated
    jobObj.setInProgress();
    await jobObj.save();
    expect(mockedJobUpdate).toHaveBeenCalledTimes(2);
    expect(mockedJobUpdate).toHaveBeenLastCalledWith(jobObj.attributes.id, { status: 'inProgress', data: { ...data, results: 3 }, resources });

    // Save with listener
    const listener = new EventEmitter();
    const jobUpdatedListener = jest.fn();
    listener.on('executableJob.updated', jobUpdatedListener);
    await jobObj.save(listener);
    expect(jobUpdatedListener).toHaveBeenCalledTimes(1);
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobObj.attributes.id, name: jobObj.attributes.name });
});

test('Test delete', async () => {
    const jobObj = await ExecutableJob.loadTask(jobAttributes.id);
    // Delete the object
    await jobObj.delete();
    expect(mockedJobDelete).toHaveBeenCalledTimes(1);
    expect(mockedJobDelete).toHaveBeenCalledWith(jobObj.attributes.id);

    // Delete with listener
    const listener = new EventEmitter();
    const jobUpdatedListener = jest.fn();
    listener.on('executableJob.updated', jobUpdatedListener);
    await jobObj.delete(listener);
    expect(jobUpdatedListener).toHaveBeenCalledTimes(1);
    expect(jobUpdatedListener).toHaveBeenCalledWith({ id: jobObj.attributes.id, name: jobObj.attributes.name });
});

describe('Test status change', () => {
    const loadObjWithStatus = async (status: JobStatus) => {
        mockedJobRead.mockResolvedValueOnce(Object.assign({}, jobAttributes, { status }));
        return await ExecutableJob.loadTask(jobAttributes.id);
    }

    each([
        ['pending', true],
        ['inProgress', false],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from %s to inProgress', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setInProgress()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'inProgress' : status);
    });

    each([
        ['pending', false],
        ['inProgress', true],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from %s to completed', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setCompleted()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'completed' : status);
    });

    each([
        ['pending', false],
        ['inProgress', true],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from %s to failed', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setFailed()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'failed' : status);
    });

    each([
        ['pending', true],
        ['inProgress', true],
        ['completed', false],
        ['failed', false],
        ['cancelled', false]
    ]).test('Change from %s to cancelled', async (status, shouldChange) => {
        const obj = await loadObjWithStatus(status);
        expect(obj.setCancelled()).toEqual(shouldChange);
        expect(obj.status).toEqual(shouldChange ? 'cancelled' : status);
    });

})
