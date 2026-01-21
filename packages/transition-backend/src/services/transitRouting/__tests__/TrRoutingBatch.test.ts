/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { EventEmitter } from 'events';
import { ObjectWritableMock } from 'stream-mock';

import { batchRoute } from '../TrRoutingBatch';
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitRoutingResult } from 'chaire-lib-common/lib/services/routing/TransitRoutingResult';
import { simplePathResult } from './TrRoutingResultStub';
import resultDbQueries from '../../../models/db/batchRouteResults.db.queries';
import jobsDbQueries from '../../../models/db/jobs.db.queries';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import routeOdTrip from '../TrRoutingOdTrip';
import { Readable } from 'stream';
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { BatchRouteJobType } from '../BatchRoutingJob';
import MemcachedProcessManager from 'chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager';

const absoluteDir = `${directoryManager.userDataDirectory}/1/exports`;

TrRoutingProcessManager.startBatch = jest.fn().mockResolvedValue({
    status: 'started',
    service: 'trRoutingBatch',
    port: 14000
});
const mockStartBatch = TrRoutingProcessManager.startBatch as jest.MockedFunction<typeof TrRoutingProcessManager.startBatch>;

// Mock MemcachedProcessManager
const mockMemcachedInstance = {
    getServer: jest.fn().mockReturnValue('localhost:11212'),
    status: jest.fn().mockResolvedValue('running'),
    stop: jest.fn().mockResolvedValue({ status: 'stopped' })
};

jest.mock('chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager', () => ({
    start: jest.fn().mockImplementation(() => mockMemcachedInstance)
}));
const mockMemcachedStart = MemcachedProcessManager.start as jest.MockedFunction<typeof MemcachedProcessManager.start>;

const socketMock = new EventEmitter();
const isCancelledMock = jest.fn().mockReturnValue(false);

let odTrips = [
    new BaseOdTrip({
        internal_id: '1',
        origin_geography: { type: 'Point' as const, coordinates: [ -73, 45 ]},
        destination_geography: { type: 'Point' as const, coordinates: [ -73.1002, 45.1002 ]},
        timeOfTrip: 8000,
        timeType: 'departure'
    }),
    new BaseOdTrip({
        internal_id: '2',
        origin_geography: { type: 'Point' as const, coordinates: [ -73.2, 45.1 ]},
        destination_geography: { type: 'Point' as const, coordinates: [ -73.1002, 45.1002 ]},
        timeOfTrip: 8000,
        timeType: 'departure'
    })
];

const mockParseOdTripsFromCsvStream = jest.fn().mockImplementation(() => ({ odTrips, errors: [] }));
jest.mock('../../odTrip/odTripProvider', () => {
    return {
        parseOdTripsFromCsvStream: jest.fn().mockImplementation(() => (mockParseOdTripsFromCsvStream()))
    }
});

let fileStreams: {[key: string]: ObjectWritableMock } = {};
const mockCreateStream = jest.fn().mockImplementation((filename: string) => {
    fileStreams[filename] = new ObjectWritableMock();
    return fileStreams[filename];
});

jest.mock('fs', () => {
    // Require the original module to not be mocked...
    const originalModule = jest.requireActual('fs');

    return {
        ...originalModule,
        createWriteStream: (fileName: string) => mockCreateStream(fileName)
    };
});

jest.mock('../TrRoutingOdTrip', () => jest.fn());
const routeOdTripMock = routeOdTrip as jest.MockedFunction<typeof routeOdTrip>;
routeOdTripMock.mockImplementation(async (odTrip: BaseOdTrip) => ({
    uuid: odTrip.getId(),
    internalId: odTrip.attributes.internal_id as string,
    origin: odTrip.attributes.origin_geography,
    destination: odTrip.attributes.destination_geography,
    result: { 
        transit: new TransitRoutingResult({
            origin: { type: 'Feature' as const, geometry: odTrip.attributes.origin_geography, properties: {} },
            destination: { type: 'Feature' as const, geometry: odTrip.attributes.destination_geography, properties: {} },
            paths: simplePathResult.routes
        })
    }
}));

const resultsInDb: any[] = []
let mockedResultStream = new Readable();
jest.mock('../../../models/db/batchRouteResults.db.queries', () => {
    // Require the original module to not be mocked for config file existence check...
    const originalModule =
        jest.requireActual<typeof import('../../../models/db/batchRouteResults.db.queries')>('../../../models/db/batchRouteResults.db.queries');

    return {
        resultParser: originalModule.default.resultParser,
        create: jest.fn().mockImplementation(({ jobId, tripIndex, data }) => {
            resultsInDb.push({
                job_id: jobId,
                trip_index: tripIndex,
                data
            })
        }),
        collection: jest.fn().mockImplementation((jobId, options) => ({ totalCount: resultsInDb.length, tripResults: resultsInDb })),
        deleteForJob: jest.fn(),
        streamResults: jest.fn().mockImplementation((jobId) => mockedResultStream),
        countResults: jest.fn().mockResolvedValue(0) // The result is used for logging, any value works
    };
});
const mockResultCreate = resultDbQueries.create as jest.MockedFunction<typeof resultDbQueries.create>;
const mockResultCollection = resultDbQueries.collection as jest.MockedFunction<typeof resultDbQueries.collection>;
const mockResultDeleteForJob = resultDbQueries.deleteForJob as jest.MockedFunction<typeof resultDbQueries.deleteForJob>;
const mockStreamResults = resultDbQueries.streamResults as jest.MockedFunction<typeof resultDbQueries.streamResults>;

const inputFileName = 'batchRouting.csv';

jest.mock('../../../models/db/jobs.db.queries');
const mockJobsDbQueries = jobsDbQueries as jest.Mocked<typeof jobsDbQueries>;

const jobId = 1;
let resultsInDbCnt = 0;
const mockJobAttributes = {
    id: jobId,
    name: 'batchRoute' as const,
    user_id: 123,
    status: 'pending' as const,
    internal_data: {},
    data: {
        parameters: {
            demandAttributes: {
                type: 'csv' as const,
                fileAndMapping: {
                    fieldMappings: {
                        projection: '4326',
                        id: 'id',
                        originLon: 'originX',
                        originLat: 'originY',
                        destinationLon: 'destinationX',
                        destinationLat: 'destinationY',
                        timeType: 'departure' as const,
                        timeFormat: 'secondsSinceMidnight',
                        time: 'time',
                    },
                    csvFile: { location: 'upload', filename: inputFileName },
                },
                csvFields: ['originX', 'originY', 'destinationX', 'destinationY', 'time', 'id']
            },
            transitRoutingAttributes: {
                routingModes: ['transit'],
                detailed: false,
                withGeometries: false
            }
        }
    },
    resources: {
        files: {
            input: inputFileName
        }
    }
};
let job: ExecutableJob<BatchRouteJobType>;

beforeEach(async () => {
    resultsInDb.splice(0);
    resultsInDbCnt = 0;
    routeOdTripMock.mockClear();
    mockCreateStream.mockClear();
    mockResultCreate.mockClear();
    mockResultCollection.mockClear();
    mockResultDeleteForJob.mockClear();
    mockStreamResults.mockClear();
    mockStartBatch.mockClear();
    mockMemcachedStart.mockClear();
    mockedResultStream = new Readable({
        objectMode: true,
        read: function(size) {
            if (resultsInDbCnt < resultsInDb.length) {
                const sending = resultsInDb[resultsInDbCnt];
                resultsInDbCnt++
                return this.push(sending);
            }
            // Stream is finished return null to complete
            return this.push(null);
        }
    });
    mockJobsDbQueries.read.mockResolvedValue(mockJobAttributes);
    job = await ExecutableJob.loadTask(1);
    jest.spyOn(job, 'getFilePath').mockImplementation(() => './batchRouting.csv');
    jest.spyOn(job, 'getReadStream').mockImplementation(() => Readable.from('mock,csv,data\n1,2,3') as any);
});

test('Batch route to csv', async () => {

    const result = await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });
    expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length);
    expect(mockCreateStream).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
        detailed: false,
        completed: true,
        errors: [],
        warnings: [],
        files: { input: inputFileName, csv: 'batchRoutingResults.csv' }
    });
    const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith('batchRoutingResults.csv'));
    expect(csvFileName).toBeDefined();
    const csvStream = fileStreams[csvFileName as string];
    expect(csvStream.data.length).toEqual(odTrips.length + 1);

    // Verify TrRoutingProcessManager.startBatch was called with no custom cachePath
    expect(mockStartBatch).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
            cacheDirectoryPath: undefined,
            memcachedServer: 'localhost:11212'
        })
    );

    // Validate the result database calls
    expect(mockResultCreate).toHaveBeenCalledTimes(odTrips.length);
    for (let i = 0; i < odTrips.length; i++) {
        expect(mockResultCreate).toHaveBeenCalledWith(expect.objectContaining({
            jobId,
            tripIndex: i
        }));
    }
    expect(mockStreamResults).toHaveBeenCalledTimes(1);
    expect(mockStreamResults).toHaveBeenCalledWith(jobId);
    expect(mockResultDeleteForJob).toHaveBeenCalledTimes(1);
    expect(mockResultDeleteForJob).toHaveBeenCalledWith(jobId, undefined);
});

test('Batch route with custom cachePath parameter', async () => {
    const customCachePath = '/custom/cache/path';

    // Create a new job attributes object with trRoutingJobParameters
    const jobAttributesWithCache = {
        ...mockJobAttributes,
        data: {
            ...mockJobAttributes.data,
            parameters: {
                ...mockJobAttributes.data.parameters,
                trRoutingJobParameters: {
                    cacheDirectoryPath: customCachePath
                }
            }
        }
    };
    mockJobsDbQueries.read.mockResolvedValueOnce(jobAttributesWithCache);
    job = await ExecutableJob.loadTask(1);
    jest.spyOn(job, 'getFilePath').mockImplementation(() => './batchRouting.csv');
    jest.spyOn(job, 'getReadStream').mockImplementation(() => Readable.from('mock,csv,data\n1,2,3') as any);

    const result = await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });

    // Verify TrRoutingProcessManager.startBatch was called with the custom cachePath
    expect(mockStartBatch).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
            cacheDirectoryPath: customCachePath,
            memcachedServer: 'localhost:11212'
        })
    );

    expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length);
    expect(mockCreateStream).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
        detailed: false,
        completed: true,
        errors: [],
        warnings: [],
        files: { input: inputFileName, csv: 'batchRoutingResults.csv' }
    });
});

test('Batch route with some errors', async () => {
    const errors = [ 'error1', 'error2' ];
    mockParseOdTripsFromCsvStream.mockResolvedValueOnce({ odTrips, errors });

    const result = await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });
    expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length);
    expect(mockCreateStream).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
        detailed: false,
        completed: true,
        errors: [],
        warnings: errors,
        files: { input: inputFileName, csv: 'batchRoutingResults.csv' }
    });
    const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith('batchRoutingResults.csv'));
    expect(csvFileName).toBeDefined();
    const csvStream = fileStreams[csvFileName as string];
    expect(csvStream.data.length).toEqual(odTrips.length + 1);

    // Validate the result database calls
    expect(mockResultCreate).toHaveBeenCalledTimes(odTrips.length);
    for (let i = 0; i < odTrips.length; i++) {
        expect(mockResultCreate).toHaveBeenCalledWith(expect.objectContaining({
            jobId,
            tripIndex: i
        }));
    }
    expect(mockStreamResults).toHaveBeenCalledTimes(1);
    expect(mockStreamResults).toHaveBeenCalledWith(jobId);
    expect(mockResultDeleteForJob).toHaveBeenCalledTimes(1);
    expect(mockResultDeleteForJob).toHaveBeenCalledWith(jobId, undefined);
});

test('Batch route with too many errors', async () => {
    const errors = [ 'error1', 'error2' ];
    mockParseOdTripsFromCsvStream.mockRejectedValueOnce(errors);

    const result = await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });
    expect(routeOdTripMock).toHaveBeenCalledTimes(0);
    expect(mockCreateStream).toHaveBeenCalledTimes(0);
    expect(result).toEqual({
        detailed: false,
        completed: false,
        errors,
        warnings: [],
        files: { input: inputFileName }
    });

    // Validate the result database calls
    expect(mockResultCreate).not.toHaveBeenCalled();
    expect(mockResultCollection).not.toHaveBeenCalled();
    expect(mockResultDeleteForJob).not.toHaveBeenCalled();
});

describe('Batch route from checkpoint', () => {

    test('Checkpoint is 0', async () => {
        const currentCheckpoint = 0;
        job.attributes.internal_data.checkpoint = currentCheckpoint;

        const result = await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });
        expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length - currentCheckpoint);
        expect(mockCreateStream).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            detailed: false,
            completed: true,
            errors: [],
            warnings: [],
            files: { input: inputFileName, csv: 'batchRoutingResults.csv' }
        });
        const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith('batchRoutingResults.csv'));
        expect(csvFileName).toBeDefined();
        const csvStream = fileStreams[csvFileName as string];
        expect(csvStream.data.length).toEqual(odTrips.length + 1 - currentCheckpoint);

        expect(mockResultDeleteForJob).toHaveBeenCalledTimes(1);
        expect(mockResultDeleteForJob).toHaveBeenNthCalledWith(1, jobId, 0);
    });

    test('Checkpoint of 1', async () => {
        const currentCheckpoint = 1;
        job.attributes.internal_data.checkpoint = currentCheckpoint;

        const result = await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });
        expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length - currentCheckpoint);
        expect(mockCreateStream).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            detailed: false,
            completed: true,
            errors: [],
            warnings: [],
            files: { input: inputFileName, csv: 'batchRoutingResults.csv' }
        });
        const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith('batchRoutingResults.csv'));
        expect(csvFileName).toBeDefined();
        const csvStream = fileStreams[csvFileName as string];
        expect(csvStream.data.length).toEqual(odTrips.length + 1 - currentCheckpoint);

        expect(mockResultDeleteForJob).toHaveBeenNthCalledWith(1, jobId, 1);
    });

    test('Checkpoint callback is called', async () => {
        // Return a number of od trips larger than the checkpoint size
        const checkpointListenerMock = jest.fn();
        socketMock.on('checkpoint', checkpointListenerMock);
        const largeOdTripsArray = Array(756).fill(odTrips[0]);
        mockParseOdTripsFromCsvStream.mockResolvedValueOnce({ odTrips: largeOdTripsArray, errors: [] });
        const currentCheckpoint = 0;
        job.attributes.internal_data.checkpoint = currentCheckpoint;
        await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });
        expect(checkpointListenerMock).toHaveBeenCalledWith(250);
        expect(checkpointListenerMock).toHaveBeenCalledWith(500);
        expect(checkpointListenerMock).toHaveBeenCalledWith(750);
        expect(checkpointListenerMock).toHaveBeenCalledWith(756);
    });

    test('Checkpoint callback is called after resuming', async () => {
        // Return a number of od trips larger than the checkpoint size
        const checkpointListenerMock = jest.fn();
        socketMock.on('checkpoint', checkpointListenerMock);
        const largeOdTripsArray = Array(756).fill(odTrips[0]);
        mockParseOdTripsFromCsvStream.mockResolvedValueOnce({ odTrips: largeOdTripsArray, errors: [] });
        const currentCheckpoint = 500;
        job.attributes.internal_data.checkpoint = currentCheckpoint;
        await batchRoute(job, { progressEmitter: socketMock, isCancelled: isCancelledMock });
        expect(checkpointListenerMock).toHaveBeenCalledWith(750);
        expect(checkpointListenerMock).toHaveBeenCalledWith(756);
    });

});
