/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash.clonedeep';
import { EventEmitter } from 'events';
import { ObjectWritableMock } from 'stream-mock';

import { batchRoute, saveOdPairs } from '../TrRoutingBatch';
import DataSource, { DataSourceType } from 'transition-common/lib/services/dataSource/DataSource';
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { simplePathResult } from './TrRoutingResultStub';
import odPairsDbQueries from '../../../models/db/odPairs.db.queries';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';

const absoluteDir = `${directoryManager.userDataDirectory}/1/exports`;

TrRoutingProcessManager.startMultiple = jest.fn().mockResolvedValue({
    status: 'started',
    service: 'trRoutingMultiple',
    startingPort: 14000
});
TrRoutingProcessManager.getAvailablePortsByStartingPort = function(startingPort = 1400) { return { [startingPort]: true, [startingPort + 1]: true, [startingPort + 2]: false }; };
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

const mockParseOdTripsFromCsv = jest.fn().mockImplementation(() => ({ odTrips, errors: [] }));
jest.mock('../../odTrip/odTripProvider', () => {
    return {
        parseOdTripsFromCsv: jest.fn().mockImplementation(() => (mockParseOdTripsFromCsv()))
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

const routeOdTripMock = jest.fn().mockImplementation((odTrip: BaseOdTrip) => ({
    csv: ['any,string,not,important'],
    result: new TransitRoutingResult({
        origin: { type: 'Feature' as const, geometry: odTrip.attributes.origin_geography, properties: {} },
        destination: { type: 'Feature' as const, geometry: odTrip.attributes.destination_geography, properties: {} },
        paths: simplePathResult.routes,
        maxWalkingTime: 300
    })
}));

jest.mock('../TrRoutingOdTrip', () => {
    return jest.fn().mockImplementation((odTrip: BaseOdTrip) => routeOdTripMock(odTrip))
});

const dataSource = new DataSource({ name: 'name', shortnam: 'name' }, false);
jest.mock('../../dataSources/dataSources', () => ({
    getDataSource: jest.fn().mockImplementation(async (options: { isNew: true, dataSourceName: string, type: DataSourceType } | { isNew: false, dataSourceId: string }) => {
        return dataSource;
    })
}));

jest.mock('../../../models/db/odPairs.db.queries');

const defaultParameters = {
    calculationName: 'test',
    projection: 'test',
    idAttribute: 'id',
    originXAttribute: 'origX',
    originYAttribute: 'origX',
    destinationXAttribute: 'origX',
    destinationYAttribute: 'origX',
    timeAttributeDepartureOrArrival: 'departure' as const,
    timeFormat: 'HMM',
    timeAttribute: 'timeattrib',
    withGeometries: false,
    detailed: false,
    cpuCount: 2,
    saveToDb: false as false
}

beforeEach(() => {
    routeOdTripMock.mockClear();
    mockCreateStream.mockClear();
})

test('Batch route to csv', async () => {
    const parameters = { type: 'csv' as const, configuration: Object.assign({}, defaultParameters, { calculationName: 'test', detailed: false }) };
    const result = await batchRoute(parameters, { routingModes: ['walking' ] }, absoluteDir, socketMock, isCancelledMock);
    expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length);
    expect(mockCreateStream).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
        calculationName: parameters.configuration.calculationName,
        detailed: parameters.configuration.detailed,
        completed: true,
        errors: [],
        warnings: [],
        files: { input: 'batchRouting.csv', csv: 'batchRoutingResults.csv' }
    });
    const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith('batchRoutingResults.csv'));
    expect(csvFileName).toBeDefined();
    const csvStream = fileStreams[csvFileName as string];
    expect(csvStream.data.length).toEqual(odTrips.length + 1);
});

test('Batch route with some errors', async () => {
    const errors = [ 'error1', 'error2' ];
    mockParseOdTripsFromCsv.mockResolvedValueOnce({ odTrips, errors });
    const parameters = { type: 'csv' as const, configuration: Object.assign({}, defaultParameters, { calculationName: 'test', detailed: false }) };
    const result = await batchRoute(parameters, { routingModes: ['walking' ] }, absoluteDir, socketMock, isCancelledMock);
    expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length);
    expect(mockCreateStream).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
        calculationName: parameters.configuration.calculationName,
        detailed: parameters.configuration.detailed,
        completed: true,
        errors: [],
        warnings: errors,
        files: { input: 'batchRouting.csv', csv: 'batchRoutingResults.csv' }
    });
    const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith('batchRoutingResults.csv'));
    expect(csvFileName).toBeDefined();
    const csvStream = fileStreams[csvFileName as string];
    expect(csvStream.data.length).toEqual(odTrips.length + 1);
});

test('Batch route with too many errors', async () => {
    const errors = [ 'error1', 'error2' ];
    mockParseOdTripsFromCsv.mockRejectedValueOnce(errors);
    const parameters = { type: 'csv' as const, configuration: Object.assign({}, defaultParameters, { calculationName: 'test', detailed: false }) };
    const result = await batchRoute(parameters, { routingModes: ['walking' ] }, absoluteDir, socketMock, isCancelledMock);
    expect(routeOdTripMock).toHaveBeenCalledTimes(0);
    expect(mockCreateStream).toHaveBeenCalledTimes(0);
    expect(result).toEqual({
        calculationName: parameters.configuration.calculationName,
        detailed: false,
        completed: false,
        errors,
        warnings: [],
        files: { input: 'batchRouting.csv' }
    });
});

test('Batch route and save to db', async () => {
    (odPairsDbQueries.createMultiple as any).mockClear();
    (odPairsDbQueries.deleteForDataSourceId as any).mockClear();

    const parameters = { type: 'csv' as const, configuration: Object.assign({}, defaultParameters, { saveToDb: {type: 'new', dataSourceName: 'name'}, calculationName: 'test', detailed: false }) };
    const result = await batchRoute(parameters, { routingModes: ['walking' ] }, absoluteDir, socketMock, isCancelledMock);
    expect(routeOdTripMock).toHaveBeenCalledTimes(odTrips.length);
    expect(mockCreateStream).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
        calculationName: parameters.configuration.calculationName,
        detailed: parameters.configuration.detailed,
        completed: true,
        errors: [],
        warnings: [],
        files: { input: 'batchRouting.csv', csv: 'batchRoutingResults.csv' }
    });
    const csvFileName = Object.keys(fileStreams).find(filename => filename.endsWith('batchRoutingResults.csv'));
    expect(csvFileName).toBeDefined();
    const csvStream = fileStreams[csvFileName as string];
    expect(csvStream.data.length).toEqual(odTrips.length + 1);
    // Just make sure the functions have been called, other tests will test the content
    expect(odPairsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
    expect(odPairsDbQueries.deleteForDataSourceId).toHaveBeenCalledTimes(1);
});

describe('saveOdPairs', () => {

    test('saveTrips', async () => {
        (odPairsDbQueries.createMultiple as any).mockClear();
        (odPairsDbQueries.deleteForDataSourceId as any).mockClear();
        await saveOdPairs(odTrips, { type: 'new', dataSourceName: 'name' });
        expect(odPairsDbQueries.deleteForDataSourceId).toHaveBeenCalledTimes(1);
        expect(odPairsDbQueries.createMultiple).toHaveBeenCalledTimes(1);
        expect(odPairsDbQueries.createMultiple).toHaveBeenCalledWith(odTrips.map((odTrip) => (expect.objectContaining(odTrip.attributes))));
        expect(odPairsDbQueries.createMultiple).toHaveBeenCalledWith(odTrips.map((_odTrip) => (expect.objectContaining({ dataSourceId: dataSource.getId() }))));
    })    
})
