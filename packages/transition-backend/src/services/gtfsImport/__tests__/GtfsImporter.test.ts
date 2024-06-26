/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import Line from 'transition-common/lib/services/line/Line';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import Node from 'transition-common/lib/services/nodes/Node';
import Agency from 'transition-common/lib/services/agency/Agency';
import Service from 'transition-common/lib/services/service/Service';

import { gtfsValidSimpleData, defaultImportData } from './GtfsImportData.test';
import GtfsImporter from '../GtfsImporter';
import StopImporter from '../StopImporter';
import AgencyImporter from '../AgencyImporter';
import LineImporter from '../LineImporter';
import ServiceImporter from '../ServiceImporter';
import PathImporter from '../PathImporter';
import ScheduleImporter from '../ScheduleImporter';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';

jest.mock('../../../models/db/transitLines.db.queries');
jest.mock('../../../models/db/transitPaths.db.queries');


/** Each importer class has been unit tested individually with multiple use
 * cases. Here we test the workflow calls, making sure the GtfsImporter class
 * assigns the returned values of the other importer methods to the right data
 * and properly calls the next method of the workflow.
 * */

jest.mock('../PathImporter');
const mockedPathImport = jest.mocked(PathImporter.generateAndImportPaths, { shallow: true });
jest.spyOn(ScheduleImporter, 'generateAndImportSchedules');
const mockedScheduleImport = jest.mocked(ScheduleImporter.generateAndImportSchedules, { shallow: true });

LineCollection.prototype.loadFromServer = jest.fn();
NodeCollection.prototype.loadFromServer = jest.fn();
AgencyCollection.prototype.loadFromServer = jest.fn();
ServiceCollection.prototype.loadFromServer = jest.fn();
const mockStopImport = StopImporter.prototype.import = jest.fn().mockResolvedValue(() => []);
const mockAgencyImport = AgencyImporter.prototype.import = jest.fn().mockResolvedValue(() => []);
const mockLineImport = LineImporter.prototype.import = jest.fn().mockResolvedValue(() => []);
const mockServiceImport = ServiceImporter.prototype.import = jest.fn().mockResolvedValue(() => []);
const line = new Line({ id: uuidV4(), mode: 'bus', category: 'C' }, false);
const lineCollection = new LineCollection([line], {});
CollectionManager.prototype.get = jest.fn().mockImplementation((collectionName) => {
    if (collectionName === 'lines') {
        return lineCollection;
    }
    return undefined;
})

const importData = Object.assign({}, defaultImportData);

importData.periodsGroupShortname = 'test';
importData.periodsGroup = { name: { en: 'test'}, periods: [
    { shortname: 'morning', name: { en: 'morning' }, startAtHour: 0, endAtHour: 12 },
    { shortname: 'afternoon', name: { en: 'afternoon' }, startAtHour: 12, endAtHour: 24 },
]};

let currentData = gtfsValidSimpleData;

jest.mock('chaire-lib-backend/lib/services/files/CsvFile', () => {
    return {
        parseCsvFile: jest.fn().mockImplementation(async (filePath, rowCallback, _options) => {
            const data = currentData[filePath];
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    rowCallback(data[i], i);
                }
            }
        })
    }
});

// Prepare mocked returned values for object imports (one arbitrary object per class)
const nodes = { gtfsStop: new Node({ 
    id: uuidV4(),
    geography: { type: 'Point', coordinates: [1, 3] },
    data: {
        stops: [{
            id: 'gtfsStop',
            geography: { type: 'Point', coordinates: [1, 3.1] },
            data: {}
        }]
    }}, false) };
const nodeIdsByStopGtfsId = { gtfsStop: nodes.gtfsStop.getId() };
const stopCoordinatesByStopId = { gtfsStop: (nodes.gtfsStop.attributes.data as any).stops[0].geography.coordinates };
const agencies = { gtfsAgency: new Agency({ id: uuidV4() }, false) };
const agencyIdsByAgencyGtfsId = { gtfsAgency: agencies.gtfsAgency.getId() };
const lines = {};
lines[gtfsValidSimpleData['routes.txt'][0].route_id] = line;
const lineIdsByRouteGtfsId = {};
lineIdsByRouteGtfsId[gtfsValidSimpleData['routes.txt'][0].route_id] = line.getId();
const services = {};
services[gtfsValidSimpleData['calendar.txt'][0].service_id] = new Service({ id: uuidV4() }, false);
const serviceIdsByGtfsId = {};
serviceIdsByGtfsId[gtfsValidSimpleData['calendar.txt'][0].service_id] = services[gtfsValidSimpleData['calendar.txt'][0].service_id].getId();
mockStopImport.mockResolvedValue(nodes);
mockAgencyImport.mockResolvedValue(agencies);
mockLineImport.mockResolvedValue(lines);
mockServiceImport.mockResolvedValue(services);
const expectedInternalDataBeforePaths = {
    agencyIdsByAgencyGtfsId,
    lineIdsByRouteGtfsId,
    serviceIdsByGtfsId,
    nodeIdsByStopGtfsId,
    stopCoordinatesByStopId,
    periodsGroupShortname: importData.periodsGroupShortname,
    periodsGroup: importData.periodsGroup
};

beforeEach(() => {
    mockedPathImport.mockClear();
    mockedScheduleImport.mockClear();
    mockStopImport.mockClear();
    mockAgencyImport.mockClear();
    mockLineImport.mockClear();
    mockServiceImport.mockClear();
})

test('Test valid complete workflow with success', async() => {    
    const pathIdsByTripId = {
        '9bd2f99e-1e15-4d04-bada-989b305950fe': uuidV4(),
        '290bfdda-3c7b-4444-9385-c16f971de6c4': uuidV4()
    }
    mockedPathImport.mockResolvedValueOnce({status: 'success', pathIdsByTripId, warnings: []});
    mockedScheduleImport.mockResolvedValueOnce({status: 'success', warnings: []});
    const result = await GtfsImporter.importGtfsData('', importData as any);
    expect(result.status).toEqual('success');

    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).toHaveBeenCalledTimes(1);
    expect(mockLineImport).toHaveBeenCalledTimes(1);
    expect(mockServiceImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledWith(expect.objectContaining({ 
        'fc8c8944-3478-42ed-82fd-a833ba16bb35': expect.anything() 
    }), expect.objectContaining(expectedInternalDataBeforePaths), expect.anything());
    expect(mockedScheduleImport).toHaveBeenCalledTimes(1);
    expect(mockedScheduleImport).toHaveBeenCalledWith(expect.objectContaining({ 
        'fc8c8944-3478-42ed-82fd-a833ba16bb35': expect.anything() 
    }), expect.objectContaining(Object.assign({}, expectedInternalDataBeforePaths, {
        pathIdsByTripId
    })), expect.anything(), false);
});

test('Test path and schedule success, with warnings', async() => {
    const pathIdsByTripId = {
        '9bd2f99e-1e15-4d04-bada-989b305950fe': uuidV4(),
        '290bfdda-3c7b-4444-9385-c16f971de6c4': uuidV4()
    }
    const pathWarnings = ['pathWarning1', 'pathWarning2'];
    const scheduleWarnings = ['scheduleWarning1'];
    mockedPathImport.mockResolvedValueOnce({status: 'success', pathIdsByTripId, warnings: pathWarnings});
    mockedScheduleImport.mockResolvedValueOnce({status: 'success', warnings: scheduleWarnings});
    const result = await GtfsImporter.importGtfsData('', importData as any);
    expect(result.status).toEqual('success');
    const successResult = result as {status: 'success', warnings: any[], errors: any[] };
    expect(successResult.warnings.length).toEqual(pathWarnings.length + scheduleWarnings.length);
    expect(successResult.warnings).toEqual(pathWarnings.concat(scheduleWarnings));
    expect(successResult.errors.length).toEqual(0);

    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).toHaveBeenCalledTimes(1);
    expect(mockLineImport).toHaveBeenCalledTimes(1);
    expect(mockServiceImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledWith(expect.objectContaining({ 
        'fc8c8944-3478-42ed-82fd-a833ba16bb35': expect.anything() 
    }), expect.anything(), expect.anything());
    expect(mockedScheduleImport).toHaveBeenCalledTimes(1);
    expect(mockedScheduleImport).toHaveBeenCalledWith(expect.objectContaining({ 
        'fc8c8944-3478-42ed-82fd-a833ba16bb35': expect.anything() 
    }), expect.objectContaining({
        pathIdsByTripId
    }), expect.anything(), false);
});

test('Test path success, but schedule failures', async() => {
    const pathIdsByTripId = {
        '9bd2f99e-1e15-4d04-bada-989b305950fe': uuidV4(),
        '290bfdda-3c7b-4444-9385-c16f971de6c4': uuidV4()
    }
    const pathWarnings = ['pathWarning1', 'pathWarning2'];
    const scheduleErrors = ['scheduleError1', 'scheduleError2'];
    mockedPathImport.mockResolvedValueOnce({status: 'success', pathIdsByTripId, warnings: pathWarnings});
    mockedScheduleImport.mockResolvedValueOnce({status: 'failed', errors: scheduleErrors});
    const result = await GtfsImporter.importGtfsData('', importData as any);
    expect(result.status).toEqual('success');
    const successResult = result as {status: 'success', warnings: any[], errors: any[] };
    expect(successResult.warnings.length).toEqual(pathWarnings.length);
    expect(successResult.warnings).toEqual(pathWarnings);
    expect(successResult.errors.length).toEqual(scheduleErrors.length);
    expect(successResult.errors).toEqual(scheduleErrors);
    
    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).toHaveBeenCalledTimes(1);
    expect(mockLineImport).toHaveBeenCalledTimes(1);
    expect(mockServiceImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledWith(expect.objectContaining({ 
        'fc8c8944-3478-42ed-82fd-a833ba16bb35': expect.anything() 
    }), expect.anything(), expect.anything());
    expect(mockedScheduleImport).toHaveBeenCalledTimes(1);
    expect(mockedScheduleImport).toHaveBeenCalledWith(expect.objectContaining({ 
        'fc8c8944-3478-42ed-82fd-a833ba16bb35': expect.anything() 
    }), expect.objectContaining({
        pathIdsByTripId
    }), expect.anything(), false);
});

test('Test path failure', async() => {
    const pathErrors = ['pathError1', 'pathError2'];
    mockedPathImport.mockResolvedValueOnce({status: 'failed', errors: pathErrors});
    const result = await GtfsImporter.importGtfsData('', importData as any);
    expect(result.status).toEqual('failed');
    const successResult = result as {status: 'failed', errors: any[] };
    expect(successResult.errors.length).toEqual(pathErrors.length);
    expect(successResult.errors).toEqual(pathErrors);
    
    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).toHaveBeenCalledTimes(1);
    expect(mockLineImport).toHaveBeenCalledTimes(1);
    expect(mockServiceImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).toHaveBeenCalledWith(expect.objectContaining({ 
        'fc8c8944-3478-42ed-82fd-a833ba16bb35': expect.anything() 
    }), expect.anything(), expect.anything());
    expect(mockedScheduleImport).not.toHaveBeenCalled();
});

test('Test services failure', async() => {
    mockServiceImport.mockRejectedValueOnce('Some error');
    const result = await GtfsImporter.importGtfsData('', importData);
    expect(result.status).toEqual('failed');
    const failedResult = result as {status: 'failed', errors: any[] };
    expect(failedResult.errors.length).toEqual(1);
    expect(failedResult.errors).toEqual([GtfsMessages.ServicesImportError]);
    
    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).toHaveBeenCalledTimes(1);
    expect(mockLineImport).toHaveBeenCalledTimes(1);
    expect(mockServiceImport).toHaveBeenCalledTimes(1);
    expect(mockedPathImport).not.toHaveBeenCalled();
    expect(mockedScheduleImport).not.toHaveBeenCalled();
});

test('Test lines failure', async() => {
    mockLineImport.mockRejectedValueOnce('Some error');
    const result = await GtfsImporter.importGtfsData('', importData);
    expect(result.status).toEqual('failed');
    const failedResult = result as {status: 'failed', errors: any[] };
    expect(failedResult.errors.length).toEqual(1);
    expect(failedResult.errors).toEqual([GtfsMessages.LinesImportError]);
    
    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).toHaveBeenCalledTimes(1);
    expect(mockLineImport).toHaveBeenCalledTimes(1);
    expect(mockServiceImport).not.toHaveBeenCalled();
    expect(mockedPathImport).not.toHaveBeenCalled();
    expect(mockedScheduleImport).not.toHaveBeenCalled();
});

test('Test agencies failure', async() => {
    mockAgencyImport.mockRejectedValueOnce('Some error');
    const result = await GtfsImporter.importGtfsData('', importData);
    expect(result.status).toEqual('failed');
    const failedResult = result as {status: 'failed', errors: any[] };
    expect(failedResult.errors.length).toEqual(1);
    expect(failedResult.errors).toEqual([GtfsMessages.AgenciesImportError]);
    
    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).toHaveBeenCalledTimes(1);
    expect(mockLineImport).not.toHaveBeenCalled();
    expect(mockServiceImport).not.toHaveBeenCalled();
    expect(mockedPathImport).not.toHaveBeenCalled();
    expect(mockedScheduleImport).not.toHaveBeenCalled();
});

test('Test nodes failure', async() => {
    mockStopImport.mockRejectedValueOnce('Some error');
    const result = await GtfsImporter.importGtfsData('', importData as any);
    expect(result.status).toEqual('failed');
    const failedResult = result as {status: 'failed', errors: any[] };
    expect(failedResult.errors.length).toEqual(1);
    expect(failedResult.errors).toEqual([GtfsMessages.NodesImportError]);
    
    // Validate method calls
    expect(mockStopImport).toHaveBeenCalledTimes(1);
    expect(mockAgencyImport).not.toHaveBeenCalled();
    expect(mockLineImport).not.toHaveBeenCalled();
    expect(mockServiceImport).not.toHaveBeenCalled();
    expect(mockedPathImport).not.toHaveBeenCalled();
    expect(mockedScheduleImport).not.toHaveBeenCalled();
});