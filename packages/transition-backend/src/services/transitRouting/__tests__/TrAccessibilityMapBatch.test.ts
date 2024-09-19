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

beforeEach(() => {
    mockedParseLocations.mockClear();
    mockedStartBatch.mockClear();
    mockedStopBatch.mockClear();
    mockedCreateResult.mockClear();
    mockedCalculateWithPolygon.mockClear();
    mockResultProcessor.processResult.mockClear();
    mockResultProcessor.end.mockClear();
});

// Test data
const defaultParameters = {
    calculationName: 'test',
    projection: 'test',
    idAttribute: 'id',
    xAttribute: 'origX',
    yAttribute: 'origX',
    timeAttributeDepartureOrArrival: 'departure' as const,
    timeFormat: 'HMM',
    timeAttribute: 'timeattrib',
    withGeometries: false,
    detailed: false,
    cpuCount: 1,
    csvFile: { location: 'upload' as const, filename: 'input.csv' }
};

const defaultAttributes = {
    maxTotalTravelTimeSeconds: 1800,
    maxAccessEgressTravelTimeSeconds: 300,
    scenarioId: 'arbitrary',
    numberOfPolygons: 1,
    deltaSeconds: 300,
    deltaIntervalSeconds: 300,
    id: 'arbitrary',
    data: {}
};

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

test('3 locations, all successful', async() => {
    mockedParseLocations.mockResolvedValue({ locations, errors: [] });
    const result = await batchAccessibilityMap(defaultParameters, defaultAttributes, absoluteDir, progressEmitter, isCancelledMock);
    expect(result).toEqual({
        calculationName: defaultParameters.calculationName,
        detailed: defaultParameters.detailed,
        completed: true,
        errors: [],
        warnings: [],
        files: { input: 'batchAccessMap.csv', csv: 'result.csv' }
    });

    // Make sure all functions have been called
    expect(mockedParseLocations).toHaveBeenCalledTimes(1);
    expect(mockResultProcessor.processResult).toHaveBeenCalledTimes(3);
    expect(mockResultProcessor.end).toHaveBeenCalledTimes(1);
    expect(mockedStartBatch).toHaveBeenCalledTimes(1);
    expect(mockedStopBatch).toHaveBeenCalledTimes(2);
});

test('3 locations, error on first', async() => {
    mockedParseLocations.mockResolvedValue({ locations, errors: [] });
    mockedCalculateWithPolygon.mockRejectedValueOnce('Some error occurred');
    const result = await batchAccessibilityMap(defaultParameters, defaultAttributes, absoluteDir, progressEmitter, isCancelledMock);
    expect(result).toEqual(expect.objectContaining({
        calculationName: defaultParameters.calculationName,
        detailed: defaultParameters.detailed,
        completed: true,
        errors: []
    }));
    expect(result.warnings.length).toEqual(1); 

    // Make sure all functions have been called
    expect(mockedParseLocations).toHaveBeenCalledTimes(1);
    expect(mockResultProcessor.processResult).toHaveBeenCalledTimes(3);
    expect(mockResultProcessor.end).toHaveBeenCalledTimes(1);
    expect(mockedStartBatch).toHaveBeenCalledTimes(1);
    expect(mockedStopBatch).toHaveBeenCalledTimes(2);
});
