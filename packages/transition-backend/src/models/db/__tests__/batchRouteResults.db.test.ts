/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import dbQueries from '../batchRouteResults.db.queries';
import jobsDbQueries from '../jobs.db.queries';
import UserModel from 'chaire-lib-backend/lib/services/auth/user';
import { JobAttributes } from 'transition-common/lib/services/jobs/Job';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { cyclingRouteResult, simplePathResult, walkingRouteResult } from '../../../services/transitRouting/__tests__/TrRoutingResultStub';
import { UnimodalRouteCalculationResult } from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';


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

const data = { name: 'test' as const, data: { parameters: { foo: 'bar' } } } as TestJobType;

const userAttributes = {
    id: 3,
    uuid: uuidV4(),
    username: 'test'
}

const jobAttributes: Omit<JobAttributes<TestJobType>, 'id'> = {
    status: 'pending' as const,
    name: 'test' as const,
    user_id: userAttributes.id,
    data: data.data
};

// Current ids in the DB for the various test objects to use throughout the tests
let jobId: number | undefined = undefined;

const origin = simplePathResult.routes[0].originDestination[0];
const destination = simplePathResult.routes[0].originDestination[1];
const trip1Data = {
    uuid: uuidV4(),
    internalId: 'trip1',
    origin: origin.geometry,
    destination: destination.geometry
};
const trip2Data = {
    uuid: uuidV4(),
    internalId: 'trip2',
    origin: destination.geometry,
    destination: origin.geometry
};
const trip3Data = {
    uuid: uuidV4(),
    internalId: 'tripWithError'
};
const resultByMode = { transit:
    new TransitRoutingResult({
        origin: origin,
        destination: destination,
        paths: simplePathResult.routes,
        maxWalkingTime: 300
    }),
    walking: new UnimodalRouteCalculationResult({
        routingMode: 'walking',
        origin: origin,
        destination: destination,
        paths: walkingRouteResult.routes
    })
};

const resultByMode2 = {
    ...resultByMode,
    cycling: new UnimodalRouteCalculationResult({
        routingMode: 'walking',
        origin: origin,
        destination: destination,
        paths: cyclingRouteResult.routes
    })
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await jobsDbQueries.truncate();
    await knex.raw(`TRUNCATE TABLE users CASCADE`);
    const user = await UserModel.createAndSave(userAttributes);
    userAttributes.id = user.attributes.id;
    jobAttributes.user_id = userAttributes.id
    jobId = await jobsDbQueries.create(jobAttributes);
    
});

afterAll(async() => {
    await dbQueries.truncate();
    await jobsDbQueries.truncate();
    await knex.raw(`TRUNCATE TABLE users CASCADE`);
    dbQueries.destroy();
});

describe(`${objectName}`, () => {

    test('should create a new object in database', async() => {

        await dbQueries.create({
            jobId: jobId as number,
            tripIndex: 0,
            data: {
                ...trip1Data,
                results: resultByMode
            }
        });

    });

    test('should create another new object in database', async() => {

        await dbQueries.create({
            jobId: jobId as number,
            tripIndex: 1,
            data: {
                ...trip2Data,
                results: resultByMode2
            }
        });

    });

    test('should create another new object in database, with faulty results', async() => {

        await dbQueries.create({
            jobId: jobId as number,
            tripIndex: 2,
            data: trip3Data
        });

    });

    test('should throw exception when creation with same index', async() => {

        let error: any = undefined;
        try {
            await dbQueries.create({
                jobId: jobId as number,
                tripIndex: 1,
                data: {
                    ...trip2Data,
                    results: resultByMode2
                }
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();
        
    });

    test('should read an empty collection from the database', async() => {
        const { totalCount, tripResults } = await dbQueries.collection(jobId as number + 1);
        expect(totalCount).toEqual(0);
        expect(tripResults).toEqual([]);
    });

    test('should read the complete collection with default parameters', async() => {
        const { totalCount, tripResults } = await dbQueries.collection(jobId as number);
        expect(totalCount).toEqual(3);
        expect(tripResults.length).toEqual(3);
        expect(tripResults[0]).toEqual(expect.objectContaining({
            jobId,
            tripIndex: 0,
            data: expect.objectContaining(trip1Data)
        }));
        expect(Object.keys(tripResults[0].data.results as any)).toEqual(Object.keys(resultByMode));
        expect((tripResults[0].data.results as any)['transit']?.getParams()).toEqual(resultByMode.transit.getParams());

        expect(tripResults[1]).toEqual(expect.objectContaining({
            jobId,
            tripIndex: 1,
            data: expect.objectContaining(trip2Data)
        }));
        expect(Object.keys(tripResults[1].data.results as any)).toEqual(Object.keys(resultByMode2));
        expect((tripResults[1].data.results as any)['transit']?.getParams()).toEqual(resultByMode2.transit.getParams());
        expect((tripResults[1].data.results as any)['cycling']?.getParams()).toEqual(resultByMode2.cycling.getParams());

        expect(tripResults[2]).toEqual({
            jobId,
            tripIndex: 2,
            data: expect.objectContaining(trip3Data)
        });
        expect(tripResults[2].data.results).toBeUndefined();
    });

    test('should read a paginated list', async() => {
        const { totalCount, tripResults } = await dbQueries.collection(jobId as number, { pageSize: 1, pageIndex: 0 });
        expect(totalCount).toEqual(3);
        expect(tripResults.length).toEqual(1);
        expect(tripResults[0]).toEqual(expect.objectContaining({
            jobId,
            tripIndex: 0,
            data: expect.objectContaining(trip1Data)
        }));
        expect(Object.keys((tripResults[0].data.results as any))).toEqual(Object.keys(resultByMode));
        expect((tripResults[0].data.results as any)['transit']?.getParams()).toEqual(resultByMode.transit.getParams());

        const { totalCount: tcPage2, tripResults: resultsPage2 } = await dbQueries.collection(jobId as number, { pageSize: 1, pageIndex: 1 });
        expect(tcPage2).toEqual(3);
        expect(resultsPage2[0]).toEqual(expect.objectContaining({
            jobId,
            tripIndex: 1,
            data: expect.objectContaining(trip2Data)
        }));
        expect(Object.keys(resultsPage2[0].data.results as any)).toEqual(Object.keys(resultByMode2));
        expect((resultsPage2[0].data.results as any)['transit']?.getParams()).toEqual(resultByMode2.transit.getParams());
        expect((resultsPage2[0].data.results as any)['cycling']?.getParams()).toEqual(resultByMode2.cycling.getParams());
    });

    test('should correctly delete even for unexisting jobs', async() => {
        await dbQueries.deleteForJob(jobId as number + 1);

        // make sure the job results for the other job are still there
        const { totalCount } = await dbQueries.collection(jobId as number);
        expect(totalCount).toEqual(3);
    });

    test('should correctly delete results for a job after an index', async() => {
        await dbQueries.deleteForJob(jobId as number, 2);

        // make sure the job results for the other job are still there
        const { totalCount: afterDelete } = await dbQueries.collection(jobId as number);
        expect(afterDelete).toEqual(2);
    });

    test('should correctly delete all results for a job', async() => {
        await dbQueries.deleteForJob(jobId as number);

        // make sure the job results for the other job are still there
        const { totalCount } = await dbQueries.collection(jobId as number);
        expect(totalCount).toEqual(0);
    });

});
