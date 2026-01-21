/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { EventEmitter } from 'events';

import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { parseLocationsFromCsv } from '../../accessMapLocation/AccessMapLocationProvider';
import { createAccessMapFileResultProcessor } from '../TrAccessibilityMapBatchResult';
import { TransitAccessibilityMapCalculator } from '../../accessibilityMap/TransitAccessibilityMapCalculator';
import { batchAccessibilityMap } from '../TrAccessibilityMapBatch';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { BatchAccessMapJobType } from '../BatchAccessibilityMapJob';
import jobsDbQueries from '../../../models/db/jobs.db.queries';
import MemcachedProcessManager from 'chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager';

const absoluteDir = `${directoryManager.userDataDirectory}/1/exports`;

const progressEmitter = new EventEmitter();
serviceLocator.collectionManager = new CollectionManager(undefined);

// Mock called functions
jest.mock('../../accessMapLocation/AccessMapLocationProvider', () => ({
    parseLocationsFromCsv: jest.fn()
}));
const mockedParseLocations = parseLocationsFromCsv as jest.MockedFunction<typeof parseLocationsFromCsv>;
const isCancelledMock = jest.fn().mockReturnValue(false);

// Mock one process by default
jest.mock('chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager', () => ({
    startBatch: jest.fn().mockResolvedValue({
        status: 'started',
        service: 'trRoutingBatch',
        port: 14000
    }),
    stopBatch: jest.fn().mockResolvedValue({
        status: 'stopped',
        service: 'trRoutingBatch',
        port: 14000
    }),
}));
const mockedStartBatch = TrRoutingProcessManager.startBatch as jest.MockedFunction<typeof TrRoutingProcessManager.startBatch>;
const mockedStopBatch = TrRoutingProcessManager.stopBatch as jest.MockedFunction<typeof TrRoutingProcessManager.stopBatch>;

jest.mock('chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager', () => ({
    start: jest.fn().mockResolvedValue({
        getServer: () => 'localhost:11212',
        status: jest.fn().mockResolvedValue('running'),
        stop: jest.fn().mockResolvedValue({ status: 'stopped' })
    })
}));
const mockMemcachedStart = MemcachedProcessManager.start as jest.MockedFunction<typeof MemcachedProcessManager.start>;


jest.mock('../TrAccessibilityMapBatchResult', () => ({
    createAccessMapFileResultProcessor: jest.fn()
}));
const mockResultProcessor = {
    processResult: jest.fn(),
    end: jest.fn(),
    getFiles: jest.fn().mockReturnValue({ csv: 'result.csv' })
}
const mockedCreateResult = createAccessMapFileResultProcessor as jest.MockedFunction<typeof createAccessMapFileResultProcessor>;
mockedCreateResult.mockReturnValue(mockResultProcessor);

const mockedCalculateWithPolygon = TransitAccessibilityMapCalculator.calculateWithPolygons = jest.fn() as jest.MockedFunction<typeof TransitAccessibilityMapCalculator.calculateWithPolygons>;
mockedCalculateWithPolygon.mockResolvedValue({
    polygons: { type: 'FeatureCollection', features: []},
    strokes: { type: 'FeatureCollection', features: []},
    resultByNode: undefined
});

jest.mock('../../../models/db/transitNodes.db.queries', () => ({
    geojsonCollection: jest.fn().mockImplementation(() => ({ type: 'FeatureCollection', features: [] }))
}));
jest.mock('../../../models/db/transitScenarios.db.queries', () => ({
    read: jest.fn().mockImplementation(() => ({ id: 'arbitrary', name: 'test scenario' }))
}));

jest.mock('../../../models/db/jobs.db.queries');
const mockJobsDbQueries = jobsDbQueries as jest.Mocked<typeof jobsDbQueries>;
let mockedJob: ExecutableJob<BatchAccessMapJobType>;

// Test data

const locations = [
    {
        geography: { type: 'Point' as const, coordinates: [-73, 45] },
        timeType: 'departure' as const,
        timeOfTrip: 28800,
        id: 'arbitrary 1',
        data: {}
    },
    {
        geography: { type: 'Point' as const, coordinates: [-73, 45] },
        timeType: 'departure' as const,
        timeOfTrip: 30000,
        id: 'arbitrary 1',
        data: {}
    },
    {
        geography: { type: 'Point' as const, coordinates: [-73, 45] },
        timeType: 'departure' as const,
        timeOfTrip: 36000,
        id: 'arbitrary 1',
        data: {}
    }
];

const mockJobAttributes = {
    id: 1,
    name: 'batchAccessMap' as const,
    user_id: 123,
    status: 'pending' as const,
    internal_data: {},
    data: {
        parameters: {
            batchAccessMapAttributes: {
                type: 'csv' as const,
                projection: 'test',
                idAttribute: 'id',
                xAttribute: 'origX',
                yAttribute: 'origY',
                timeAttributeDepartureOrArrival: 'departure' as const,
                timeFormat: 'HMM',
                timeAttribute: 'timeattrib',
                withGeometries: false,
                detailed: false,
                cpuCount: 1,
                csvFile: { location: 'upload' as const, filename: 'input.csv' }
            },
            accessMapAttributes: {
                maxTotalTravelTimeSeconds: 1800,
                maxAccessEgressTravelTimeSeconds: 300,
                scenarioId: 'arbitrary',
                numberOfPolygons: 1,
                deltaSeconds: 300,
                deltaIntervalSeconds: 300,
                id: 'arbitrary',
                data: {}
            }
        }
    },
    resources: {
        files: {
            input: 'input.csv'
        }
    }
};

beforeEach(async () => {
    mockedParseLocations.mockClear();
    mockedStartBatch.mockClear();
    mockedStopBatch.mockClear();
    mockMemcachedStart.mockClear();
    mockedCreateResult.mockClear();
    mockedCalculateWithPolygon.mockClear();
    mockResultProcessor.processResult.mockClear();
    mockResultProcessor.end.mockClear();

    mockJobsDbQueries.read.mockResolvedValue(mockJobAttributes);
    mockedJob = await ExecutableJob.loadTask(1);
    jest.spyOn(mockedJob, 'getFilePath').mockImplementation(() => '123/1/input.csv');

});

test('3 locations, all successful', async() => {
    mockedParseLocations.mockResolvedValue({ locations, errors: [] });
    const result = await batchAccessibilityMap(mockedJob, progressEmitter, isCancelledMock);
    expect(result).toEqual({
        detailed: mockJobAttributes.data.parameters.batchAccessMapAttributes.detailed,
        completed: true,
        errors: [],
        warnings: [],
        files: { input: 'input.csv', csv: 'result.csv' }
    });

    // Make sure all functions have been called
    expect(mockedParseLocations).toHaveBeenCalledTimes(1);
    expect(mockedParseLocations).toHaveBeenCalledWith(
        expect.stringContaining(`${mockJobAttributes.user_id}/${mockJobAttributes.id}/input.csv`),
        mockJobAttributes.data.parameters.batchAccessMapAttributes
    );
    expect(mockResultProcessor.processResult).toHaveBeenCalledTimes(3);
    expect(mockResultProcessor.end).toHaveBeenCalledTimes(1);
    expect(mockedStartBatch).toHaveBeenCalledTimes(1);
    expect(mockedStartBatch).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
            cacheDirectoryPath: undefined,
            memcachedServer: 'localhost:11212'
        })
    );
    expect(mockedStopBatch).toHaveBeenCalledTimes(2);
    
});

test('3 locations, error on first', async() => {
    mockedParseLocations.mockResolvedValue({ locations, errors: [] });
    mockedCalculateWithPolygon.mockRejectedValueOnce('Some error occurred');
    const result = await batchAccessibilityMap(mockedJob, progressEmitter, isCancelledMock);
    expect(result).toEqual(expect.objectContaining({
        detailed: mockJobAttributes.data.parameters.batchAccessMapAttributes.detailed,
        completed: true,
        errors: []
    }));
    expect(result.warnings.length).toEqual(1); 

    // Make sure all functions have been called
    expect(mockedParseLocations).toHaveBeenCalledTimes(1);
    expect(mockedParseLocations).toHaveBeenCalledWith(
        expect.stringContaining(`${mockJobAttributes.user_id}/${mockJobAttributes.id}/input.csv`),
        mockJobAttributes.data.parameters.batchAccessMapAttributes
    );
    expect(mockResultProcessor.processResult).toHaveBeenCalledTimes(3);
    expect(mockResultProcessor.end).toHaveBeenCalledTimes(1);
    expect(mockedStartBatch).toHaveBeenCalledTimes(1);
    expect(mockedStopBatch).toHaveBeenCalledTimes(2);
});
