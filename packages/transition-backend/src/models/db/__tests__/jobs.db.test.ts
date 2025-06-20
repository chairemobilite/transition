/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import dbQueries from '../jobs.db.queries';
import { userAuthModel } from 'chaire-lib-backend/lib/services/auth/userAuthModel';
import { JobAttributes, Job as ObjectClass } from 'transition-common/lib/services/jobs/Job';

const objectName   = 'job';

type TestJobType = {
    name: 'test';
    data: {
        parameters: {
            foo: string
        };
    },
    files: { }
}

type TestJobType2 = {
    name: 'test2';
    data: {
        parameters: {
            foo: string
        };
    },
    files: { myFile: boolean; }
}

const data = { name: 'test' as const, data: { parameters: { foo: 'bar' } } } as TestJobType;

const userAttributes = {
    id: 3,
    uuid: uuidV4(),
    username: 'test'
}

const newObjectAttributes: Omit<JobAttributes<TestJobType>, 'id'> = {
    status: 'pending' as const,
    name: 'test' as const,
    user_id: userAttributes.id,
    internal_data: {},
    data: data.data,
    statusMessages: { errors: ['string'], warnings: ['warning1', {
        text: 'text',
        params: {
            key1: 'key'
        }
    }]}
};

const updatedAttributes = {
    status: 'inProgress' as const,
    internal_data: {
        checkpoint: 34
    },
    statusMessages: { errors: ['string2'] }
}

const newObjectAttributes2: Omit<JobAttributes<TestJobType2>, 'id'> = {
    status: 'completed' as const,
    name: 'test2' as const,
    user_id: userAttributes.id,
    internal_data: {
        checkpoint: 0
    },
    data: data.data,
    resources: { files: { myFile: '/path/to/file' } }
};

// Current ids in the DB for the various test objects to use throughout the tests
let currentIdForObject1: number | undefined = undefined;
let currentIdForObject2: number | undefined = undefined;

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await knex.raw(`TRUNCATE TABLE users CASCADE`);
    const user = await userAuthModel.createAndSave(userAttributes);
    userAttributes.id = user.attributes.id;
});

beforeEach(() => {
    // We get the user ID in the beforeAll, so set it before each test
    newObjectAttributes2.user_id = userAttributes.id;
    newObjectAttributes.user_id = userAttributes.id;
})

afterAll(async() => {
    await dbQueries.truncate();
    await knex.raw(`TRUNCATE TABLE users CASCADE`);
    await knex.destroy();
});

describe(`${objectName}`, () => {

    test('exists should return false if object is not in database', async () => {

        const exists = await dbQueries.exists(1);
        expect(exists).toBe(false);

    });

    test('should create a new object in database', async() => {

        currentIdForObject1 = await dbQueries.create(newObjectAttributes);
        expect(await dbQueries.exists(currentIdForObject1)).toBe(true);

    });

    test('should read a new object in database', async() => {
        
        const attributes = await dbQueries.read(currentIdForObject1 as number);
        expect(attributes).toEqual(expect.objectContaining(newObjectAttributes));

    });

    test('should update an object in database', async() => {
        
        const id = await dbQueries.update(currentIdForObject1 as number, updatedAttributes);
        expect(id).toEqual(currentIdForObject1);

    });

    test('should read an updated object from database', async() => {

        const updatedObject = await dbQueries.read(currentIdForObject1 as number);
        for (const attribute in updatedAttributes)
        {
            expect(updatedObject[attribute]).toEqual(updatedAttributes[attribute]);
        }

    });

    test('should create a second new object indatabase', async() => {
        
        currentIdForObject2 = await dbQueries.create(newObjectAttributes2);
        expect(await dbQueries.exists(currentIdForObject2 as number)).toBe(true);

    });

    test('should read collection from database', async() => {
        
        const { totalCount, jobs } = await dbQueries.collection();
        const _newObjectAttributes = Object.assign({ id: currentIdForObject1 as number }, newObjectAttributes);
        const _newObjectAttributes2 = Object.assign({ id: currentIdForObject2 as number }, newObjectAttributes2);
        expect(totalCount).toEqual(2)
        expect(jobs.length).toBe(2);
        for (const attribute in updatedAttributes)
        {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        expect(jobs[0].id).toBe(currentIdForObject2);
        expect(new ObjectClass(jobs[0]).attributes).toEqual(expect.objectContaining(new ObjectClass(_newObjectAttributes2).attributes));
        expect(jobs[1].id).toBe(currentIdForObject1);
        expect(new ObjectClass(jobs[1]).attributes).toEqual(expect.objectContaining(new ObjectClass(_newObjectAttributes).attributes));
    });

    test('update object, with error, should not be updated', async() => {
        
        // Put an unknown status, should throw an error
        const _updatedAttributes2 = { status: 'not a status' as any };

        let error: any = undefined;
        try {
            await dbQueries.update(currentIdForObject2 as number, _updatedAttributes2);
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Update the object1 to its original value
        await dbQueries.update(currentIdForObject1 as number, { status: newObjectAttributes.status, internal_data: newObjectAttributes.internal_data, statusMessages: newObjectAttributes.statusMessages });
    });

    test('Read collections by job type', async() => {
        
        // Test with first job type
        const { totalCount: count, jobs: _collection } = await dbQueries.collection({ jobType: 'test', pageIndex: 0, pageSize: 0 });
        expect(count).toBe(1);
        expect(_collection.length).toBe(1);
        expect(_collection[0]).toEqual(expect.objectContaining(newObjectAttributes));

        // Test with second job type
        const { totalCount: count2, jobs: _collection2 } = await dbQueries.collection({ jobType: 'test2', pageIndex: 0, pageSize: 0 });
        expect(count2).toBe(1);
        expect(_collection2.length).toBe(1);
        expect(_collection2[0]).toEqual(expect.objectContaining(newObjectAttributes2));

        // Test with unknown type
        const { totalCount: count3, jobs: _collection3 } = await dbQueries.collection({ jobType: 'none', pageIndex: 0, pageSize: 0 });
        expect(count3).toBe(0);
        expect(_collection3.length).toBe(0);
    });

    test('Read collections for specific user', async() => {

        // Add a user and a job for this user
        const user = await userAuthModel.createAndSave({ username: 'second' });
        const jobForSecondUser = Object.assign({}, newObjectAttributes, { user_id: user.attributes.id });
        await dbQueries.create(jobForSecondUser);
        
        // Make sure no parameter returns all jobs
        let result = await dbQueries.collection();
        expect(result.totalCount).toBe(3);
        expect(result.jobs.length).toBe(3);

        // Read collection for first user
        result = await dbQueries.collection({ userId: userAttributes.id, pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(2);
        expect(result.jobs.length).toBe(2);
        expect(result.jobs[0].user_id).toEqual(userAttributes.id);
        expect(result.jobs[1].user_id).toEqual(userAttributes.id);

        // Read collection for second user
        result = await dbQueries.collection({ userId: user.attributes.id, pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(1);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].user_id).toEqual(user.attributes.id);

    });

    test('Paging and sorting for specific user', async() => {

        // Read first page for first user, default sort
        let result = await dbQueries.collection({ userId: userAttributes.id, pageIndex: 0, pageSize: 1 });
        expect(result.totalCount).toBe(2);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].name).toEqual(newObjectAttributes2.name);
        const firstId = result.jobs[0].id;

        // Read second page for first user, default sort
        result = await dbQueries.collection({ userId: userAttributes.id, pageIndex: 1, pageSize: 1 });
        expect(result.totalCount).toBe(2);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].name).toEqual(newObjectAttributes.name);
        const secondId = result.jobs[0].id;

        // Read first page for first user, sort ascending
        result = await dbQueries.collection({ userId: userAttributes.id, pageIndex: 0, pageSize: 1, sort: [{ field: 'created_at', direction: 'asc' }] });
        expect(result.totalCount).toBe(2);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].name).toEqual(newObjectAttributes.name);
        expect(result.jobs[0].id).toEqual(secondId);

        // Read second page for first user, sort ascending
        result = await dbQueries.collection({ userId: userAttributes.id, pageIndex: 1, pageSize: 1, sort: [{ field: 'created_at', direction: 'asc' }] });
        expect(result.totalCount).toBe(2);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].name).toEqual(newObjectAttributes2.name);
        expect(result.jobs[0].id).toEqual(firstId);

    });

    test('Various sort', async() => {

        // Sort all by status ascending (statuses are sorted by their enum value, not alphabetically, pending is first)
        let result = await dbQueries.collection({ pageIndex: 0, pageSize: 0, sort: [{ field: 'status', direction: 'asc' }] });
        expect(result.totalCount).toBe(3);
        expect(result.jobs.length).toBe(3);
        expect(result.jobs[0].status).toEqual('pending');
        expect(result.jobs[1].status).toEqual('pending');
        expect(result.jobs[2].status).toEqual('completed');

        // Sort all by status descending
        result = await dbQueries.collection({ pageIndex: 0, pageSize: 0, sort: [{ field: 'status', direction: 'desc' }] });
        expect(result.totalCount).toBe(3);
        expect(result.jobs.length).toBe(3);
        expect(result.jobs[0].status).toEqual('completed');
        expect(result.jobs[1].status).toEqual('pending');
        expect(result.jobs[2].status).toEqual('pending');

        // Sort by status ascending and user id descending
        result = await dbQueries.collection({ pageIndex: 0, pageSize: 0, sort: [{ field: 'status', direction: 'asc' }, { field: 'user_id', direction: 'desc' }] });
        expect(result.totalCount).toBe(3);
        expect(result.jobs.length).toBe(3);
        expect(result.jobs[0]).toEqual(expect.objectContaining({ status: 'pending', user_id: userAttributes.id + 1 }));
        expect(result.jobs[1]).toEqual(expect.objectContaining({ status: 'pending', user_id: userAttributes.id }));
        expect(result.jobs[2]).toEqual(expect.objectContaining({ status: 'completed', user_id: userAttributes.id }));

        // Sort by status ascending and user id ascending
        result = await dbQueries.collection({ pageIndex: 0, pageSize: 0, sort: [{ field: 'status', direction: 'asc' }, { field: 'user_id', direction: 'asc' }] });
        expect(result.totalCount).toBe(3);
        expect(result.jobs.length).toBe(3);
        expect(result.jobs[0]).toEqual(expect.objectContaining({ status: 'pending', user_id: userAttributes.id }));
        expect(result.jobs[1]).toEqual(expect.objectContaining({ status: 'pending', user_id: userAttributes.id + 1 }));
        expect(result.jobs[2]).toEqual(expect.objectContaining({ status: 'completed', user_id: userAttributes.id }));

    });

    test('Read collection by status', async() => {

        // Empty status, should return all
        let result = await dbQueries.collection({ statuses: [], pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(3);
        expect(result.jobs.length).toBe(3);

        // Return pending jobs
        result = await dbQueries.collection({ statuses: ['pending'], pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(2);
        expect(result.jobs.length).toBe(2);

        // Return pending or inProgress jobs, only pending are in the db
        result = await dbQueries.collection({ statuses: ['pending', 'inProgress'], pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(2);
        expect(result.jobs.length).toBe(2);

        // Return pending or completed, should return all
        result = await dbQueries.collection({ statuses: ['pending', 'completed'], pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(3);
        expect(result.jobs.length).toBe(3);

        // Return pending or inProgress jobs for user. There are 2 pendign jobs, but only 1 for user 1
        result = await dbQueries.collection({ userId: userAttributes.id, statuses: ['pending', 'inProgress'], pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(1);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].status).toEqual('pending');
        expect(result.jobs[0].user_id).toEqual(userAttributes.id);

        // Return pending or completed jobs for the second user. There should be only one such job for user 2
        result = await dbQueries.collection({ userId: userAttributes.id + 1, statuses: ['pending', 'completed'], pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(1);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].status).toEqual('pending');
        expect(result.jobs[0].user_id).not.toEqual(userAttributes.id);

    });

    test('Read collections by user and job', async() => {
        
        // The user has 2 jobs, there are 2 jobs of job type, but only 1 for user
        let result = await dbQueries.collection({ userId: userAttributes.id, jobType: newObjectAttributes.name, pageIndex: 0, pageSize: 0 });
        expect(result.totalCount).toBe(1);
        expect(result.jobs.length).toBe(1);
        expect(result.jobs[0].user_id).toEqual(userAttributes.id);
        expect(result.jobs[0].name).toEqual(newObjectAttributes.name);
    });


    test('should delete objects from database', async() => {
        
        const id = await dbQueries.delete(currentIdForObject1 as number)
        expect(id).toBe(currentIdForObject1);

        const id2 = await dbQueries.delete(currentIdForObject2 as number)
        expect(id2).toBe(currentIdForObject2);

    });

});
