/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import os from 'os';
import { v4 as uuidV4 } from 'uuid';

import { exportGtfs } from '../GtfsExporter';
import { exportStop } from '../StopExporter';
import { exportAgency } from '../AgencyExporter';
import { exportLine } from '../LineExporter';
import { exportService } from '../ServiceExporter';
import { exportPath } from '../PathExporter';
import { exportSchedule } from '../ScheduleExporter';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';
import servicesDbQueries from '../../../models/db/transitServices.db.queries';
import agenciesDbQueries from '../../../models/db/transitAgencies.db.queries';


/** Each exporter class has been unit tested individually with multiple use
 * cases. Here we test the workflow calls, making sure the exportGtfs function
 * assigns the returned values of the other importer methods to the right data
 * and properly calls the next method of the workflow.
 * */

const directory = fileManager.getAbsolutePath('exports');
const expectedGtfsDir = `${directory}/gtfs`;
// Prepare ids for data
const selectedAgencyIds = [uuidV4(), uuidV4()];
const gtfsExportOptions = { selectedAgencies: selectedAgencyIds, selectedServices: [] };
const agencyToGtfsId = { [selectedAgencyIds[0]]: 'test', [selectedAgencyIds[1]]: 'test2' };
const lineIds = [uuidV4(), uuidV4()];
const serviceIds = [uuidV4(), uuidV4(), uuidV4()];
const serviceToGtfsId = { [serviceIds[0]]: 'test' };
const nodeIds = [uuidV4(), uuidV4()];
const pathIds = [uuidV4(), uuidV4(), uuidV4()];

// Default values to return for services and agencies collection. Each agency has one line
const defaultAgencies = selectedAgencyIds.map((id, index) => ({ id, acronym: `agency${id}`, data: {}, line_ids: [lineIds[index]] }));
// The 2 last services do not have scheduled lines
const defaultServices = serviceIds.map((id, index) => ({ id, scheduled_lines: index === 0 ? [lineIds[0]] : [] }));

// Mock the export methods and return a success by default
jest.mock('../AgencyExporter');
const mockedAgencyExport = jest.mocked(exportAgency, { shallow: true });
mockedAgencyExport.mockResolvedValue({ status: 'success', agencyToGtfsId });

jest.mock('../LineExporter');
const mockedLineExport = jest.mocked(exportLine, { shallow: true });
mockedLineExport.mockResolvedValue({ status: 'success' });

jest.mock('../ServiceExporter');
const mockedServiceExport = jest.mocked(exportService, { shallow: true });
mockedServiceExport.mockResolvedValue({ status: 'success', serviceToGtfsId });

jest.mock('../ScheduleExporter');
const mockedScheduleExport = jest.mocked(exportSchedule, { shallow: true });
mockedScheduleExport.mockResolvedValue({ status: 'success', pathIds: pathIds, nodeIds: nodeIds });

jest.mock('../StopExporter');
const mockedStopExport = jest.mocked(exportStop, { shallow: true });
mockedStopExport.mockResolvedValue({ status: 'success' });

jest.mock('../PathExporter');
const mockedPathExport = jest.mocked(exportPath, { shallow: true });
mockedPathExport.mockResolvedValue({ status: 'success' });

jest.mock('../../../models/db/transitAgencies.db.queries', () => ({
    collection: jest.fn()
}));
const mockAgenciesCollection = agenciesDbQueries.collection as jest.MockedFunction<typeof agenciesDbQueries.collection>;
// Return the default agencies by default
mockAgenciesCollection.mockResolvedValue(defaultAgencies);

jest.mock('../../../models/db/transitServices.db.queries', () => ({
    collection: jest.fn()
}));
const mockServicesCollection = servicesDbQueries.collection as jest.MockedFunction<typeof servicesDbQueries.collection>;
// Return the default services by default
mockServicesCollection.mockResolvedValue(defaultServices);

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Test valid workflow', () => {
    test('With exported agencies only', async() => {

        // Get the selected agency ids to export
        const testGtfsExportOptions = {
            ...gtfsExportOptions,
            selectedAgencies: selectedAgencyIds
        }

        // There are no actual file written, so the zip will not zip anything. Ideally, we should mock JSZip, but it works
        const file = await exportGtfs(testGtfsExportOptions, directory);
        expect(file).toEqual('gtfs.zip');
        
        // Validate method calls
        expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
        expect(mockedAgencyExport).toHaveBeenCalledWith(selectedAgencyIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything()
        });

        expect(mockedLineExport).toHaveBeenCalledTimes(1);
        expect(mockedLineExport).toHaveBeenCalledWith(lineIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
            agencyToGtfsId
        });

        // Only the first service has lines, so only it should be exported
        expect(mockedServiceExport).toHaveBeenCalledTimes(1);
        expect(mockedServiceExport).toHaveBeenCalledWith([serviceIds[0]], {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything()
        });

        expect(mockedScheduleExport).toHaveBeenCalledTimes(1);
        expect(mockedScheduleExport).toHaveBeenCalledWith(lineIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
            serviceToGtfsId
        });

        expect(mockedStopExport).toHaveBeenCalledTimes(1);
        expect(mockedStopExport).toHaveBeenCalledWith(nodeIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
        });

        expect(mockedPathExport).toHaveBeenCalledTimes(1);
        expect(mockedPathExport).toHaveBeenCalledWith(pathIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
        });
    });

    test('With exported services only', async() => {

        // Prepare test data:
        // Services, only the first one exists and has the first line scheduled, so second line and second agency should not be exported
        const selectedServiceIds = [uuidV4(), uuidV4()];
        const expectedLineIds = [lineIds[0]];
        const services = [{ id: selectedServiceIds[0], scheduled_lines: expectedLineIds }];
        mockServicesCollection.mockResolvedValueOnce(services);
        

        // Set the service IDs to export, with empty agencies
        const testGtfsExportOptions = {
            ...gtfsExportOptions,
            selectedAgencies:[],
            selectedServices: selectedServiceIds
        }

        // There are no actual file written, so the zip will not zip anything. Ideally, we should mock JSZip, but it works
        const file = await exportGtfs(testGtfsExportOptions, directory);
        expect(file).toEqual('gtfs.zip');

        expect(mockServicesCollection).toHaveBeenCalledWith({ serviceIds: selectedServiceIds });
        
        // Validate method calls
        expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
        expect(mockedAgencyExport).toHaveBeenCalledWith([selectedAgencyIds[0]], {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything()
        });

        expect(mockedLineExport).toHaveBeenCalledTimes(1);
        expect(mockedLineExport).toHaveBeenCalledWith(expectedLineIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
            agencyToGtfsId
        });

        expect(mockedServiceExport).toHaveBeenCalledTimes(1);
        expect(mockedServiceExport).toHaveBeenCalledWith([selectedServiceIds[0]], {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything()
        });

        expect(mockedScheduleExport).toHaveBeenCalledTimes(1);
        expect(mockedScheduleExport).toHaveBeenCalledWith(expectedLineIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
            serviceToGtfsId
        });

        expect(mockedStopExport).toHaveBeenCalledTimes(1);
        expect(mockedStopExport).toHaveBeenCalledWith(nodeIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
        });

        expect(mockedPathExport).toHaveBeenCalledTimes(1);
        expect(mockedPathExport).toHaveBeenCalledWith(pathIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
        });
    });

    test('With both exported agencies and services only', async() => {
        // Prepare test data:
        // Services, and agency are selected, services should import both agencies, but agencies should limit to the first one, so second service is not required after all
        const selectedServiceIds = [uuidV4(), uuidV4()];
        const expectedLineIds = [lineIds[0]];
        const services = [{ id: selectedServiceIds[0], scheduled_lines: [lineIds[0]] }, { id: selectedServiceIds[1], scheduled_lines: [lineIds[1]] }];
        mockServicesCollection.mockResolvedValueOnce(services);
        
        // Set the service IDs to export, with empty agencies
        const testGtfsExportOptions = {
            ...gtfsExportOptions,
            selectedAgencies:[selectedAgencyIds[0]],
            selectedServices: selectedServiceIds
        }

        // There are no actual file written, so the zip will not zip anything. Ideally, we should mock JSZip, but it works
        const file = await exportGtfs(testGtfsExportOptions, directory);
        expect(file).toEqual('gtfs.zip');

        expect(mockServicesCollection).toHaveBeenCalledWith({ serviceIds: selectedServiceIds });
        
        // Validate method calls
        expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
        expect(mockedAgencyExport).toHaveBeenCalledWith([selectedAgencyIds[0]], {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything()
        });

        expect(mockedLineExport).toHaveBeenCalledTimes(1);
        expect(mockedLineExport).toHaveBeenCalledWith(expectedLineIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
            agencyToGtfsId
        });

        expect(mockedServiceExport).toHaveBeenCalledTimes(1);
        expect(mockedServiceExport).toHaveBeenCalledWith([selectedServiceIds[0]], {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything()
        });

        expect(mockedScheduleExport).toHaveBeenCalledTimes(1);
        expect(mockedScheduleExport).toHaveBeenCalledWith(expectedLineIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
            serviceToGtfsId
        });

        expect(mockedStopExport).toHaveBeenCalledTimes(1);
        expect(mockedStopExport).toHaveBeenCalledWith(nodeIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
        });

        expect(mockedPathExport).toHaveBeenCalledTimes(1);
        expect(mockedPathExport).toHaveBeenCalledWith(pathIds, {
            directoryPath: expectedGtfsDir,
            quotesFct: expect.anything(),
            includeTransitionFields: expect.anything(),
        });
    });

    test('Test no data to export after filter', async() => {
        // Intersection of service and lines is empty, shoud throw an error
        // Agencies have line 0, but services have line 1 scheduled only, so there is no data to export
        const selectedAgencies = selectedAgencyIds.map((id) => ({ id, acronym: `agency${id}`, data: {}, line_ids: [lineIds[0]] }));
        // The 2 last services do not have scheduled lines
        const selectedServices = serviceIds.map((id) => ({ id, scheduled_lines: [lineIds[1]] }));
        mockAgenciesCollection.mockResolvedValueOnce(selectedAgencies);
        mockServicesCollection.mockResolvedValueOnce(selectedServices);

        // Set the service IDs to export, with empty agencies
        const testGtfsExportOptions = {
            ...gtfsExportOptions,
            selectedAgencies: selectedAgencyIds,
            selectedServices: serviceIds
        }

        await expect(exportGtfs(testGtfsExportOptions, directory))
            .rejects
            .toThrow('No data to export in the GTFS');
        
        // Validate method calls
        expect(mockedAgencyExport).not.toHaveBeenCalled();
        expect(mockedLineExport).not.toHaveBeenCalled();
        expect(mockedServiceExport).not.toHaveBeenCalled();
        expect(mockedScheduleExport).not.toHaveBeenCalled();
        expect(mockedStopExport).not.toHaveBeenCalled();
        expect(mockedPathExport).not.toHaveBeenCalled();
    });

    test('Test no data to export in the options', async() => {

        // Set the service IDs to export, with empty agencies
        const testGtfsExportOptions = {
            ...gtfsExportOptions,
            selectedAgencies: [],
            selectedServices: []
        }

        await expect(exportGtfs(testGtfsExportOptions, directory))
            .rejects
            .toThrow('No data specified for GTFS export');
        
        // Validate method calls
        expect(mockedAgencyExport).not.toHaveBeenCalled();
        expect(mockedLineExport).not.toHaveBeenCalled();
        expect(mockedServiceExport).not.toHaveBeenCalled();
        expect(mockedScheduleExport).not.toHaveBeenCalled();
        expect(mockedStopExport).not.toHaveBeenCalled();
        expect(mockedPathExport).not.toHaveBeenCalled();
    });

});

test('Test path export failure', async() => {
    const error = new TrError('path error', 'CODE1')
    mockedPathExport.mockResolvedValueOnce({ status: 'error', error });
    await expect(exportGtfs(gtfsExportOptions, directory))
        .rejects
        .toThrow(error);
    
    // Validate method calls
    expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
    expect(mockedLineExport).toHaveBeenCalledTimes(1);
    expect(mockedServiceExport).toHaveBeenCalledTimes(1);
    expect(mockedScheduleExport).toHaveBeenCalledTimes(1);
    expect(mockedStopExport).toHaveBeenCalledTimes(1);
    expect(mockedPathExport).toHaveBeenCalledTimes(1);
    expect(mockedPathExport).toHaveBeenCalledWith(pathIds, {
        directoryPath: expectedGtfsDir,
        quotesFct: expect.anything(),
        includeTransitionFields: expect.anything()
    });
});

test('Test stop export failure', async() => {
    const error = new TrError('stop error', 'CODE1')
    mockedStopExport.mockResolvedValueOnce({ status: 'error', error });
    await expect(exportGtfs(gtfsExportOptions, directory))
        .rejects
        .toThrow(error);
    
    // Validate method calls
    expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
    expect(mockedLineExport).toHaveBeenCalledTimes(1);
    expect(mockedServiceExport).toHaveBeenCalledTimes(1);
    expect(mockedScheduleExport).toHaveBeenCalledTimes(1);
    expect(mockedStopExport).toHaveBeenCalledTimes(1);
    expect(mockedStopExport).toHaveBeenCalledWith(nodeIds, {
        directoryPath: expectedGtfsDir,
        quotesFct: expect.anything(),
        includeTransitionFields: expect.anything()
    });
    expect(mockedPathExport).not.toHaveBeenCalled();
});

test('Test schedule export failure', async() => {
    const error = new TrError('schedule error', 'CODE1')
    mockedScheduleExport.mockResolvedValueOnce({ status: 'error', error });
    await expect(exportGtfs(gtfsExportOptions, directory))
        .rejects
        .toThrow(error);
    
    // Validate method calls
    expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
    expect(mockedLineExport).toHaveBeenCalledTimes(1);
    expect(mockedServiceExport).toHaveBeenCalledTimes(1);
    expect(mockedScheduleExport).toHaveBeenCalledTimes(1);
    expect(mockedScheduleExport).toHaveBeenCalledWith(lineIds, {
        directoryPath: expectedGtfsDir,
        quotesFct: expect.anything(),
        includeTransitionFields: expect.anything(),
        serviceToGtfsId
    });
    expect(mockedStopExport).not.toHaveBeenCalled();
    expect(mockedPathExport).not.toHaveBeenCalled();
});

test('Test service export failure', async() => {
    const error = new TrError('service error', 'CODE1')
    mockedServiceExport.mockResolvedValueOnce({ status: 'error', error });
    await expect(exportGtfs(gtfsExportOptions, directory))
        .rejects
        .toThrow(error);
    
    // Validate method calls
    expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
    expect(mockedLineExport).toHaveBeenCalledTimes(1);
    expect(mockedServiceExport).toHaveBeenCalledTimes(1);
    // Only the first service has lines
    expect(mockedServiceExport).toHaveBeenCalledWith([serviceIds[0]], {
        directoryPath: expectedGtfsDir,
        quotesFct: expect.anything(),
        includeTransitionFields: expect.anything()
    });
    expect(mockedScheduleExport).not.toHaveBeenCalled();
    expect(mockedStopExport).not.toHaveBeenCalled();
    expect(mockedPathExport).not.toHaveBeenCalled();
});

test('Test line export failure', async() => {
    const error = new TrError('line error', 'CODE1')
    mockedLineExport.mockResolvedValueOnce({ status: 'error', error });
    await expect(exportGtfs(gtfsExportOptions, directory))
        .rejects
        .toThrow(error);
    
    // Validate method calls
    expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
    expect(mockedLineExport).toHaveBeenCalledTimes(1);
    expect(mockedLineExport).toHaveBeenCalledWith(lineIds, {
        directoryPath: expectedGtfsDir,
        quotesFct: expect.anything(),
        includeTransitionFields: expect.anything(),
        agencyToGtfsId
    });
    expect(mockedServiceExport).not.toHaveBeenCalled();
    expect(mockedScheduleExport).not.toHaveBeenCalled();
    expect(mockedStopExport).not.toHaveBeenCalled();
    expect(mockedPathExport).not.toHaveBeenCalled();
});

test('Test agency export failure', async() => {
    const error = new TrError('agency error', 'CODE1')
    mockedAgencyExport.mockResolvedValueOnce({ status: 'error', error });
    await expect(exportGtfs(gtfsExportOptions, directory))
        .rejects
        .toThrow(error);
    
    // Validate method calls
    expect(mockedAgencyExport).toHaveBeenCalledTimes(1);
    expect(mockedAgencyExport).toHaveBeenCalledWith(selectedAgencyIds, {
        directoryPath: expectedGtfsDir,
        quotesFct: expect.anything(),
        includeTransitionFields: expect.anything()
    });
    expect(mockedLineExport).not.toHaveBeenCalled();
    expect(mockedServiceExport).not.toHaveBeenCalled();
    expect(mockedScheduleExport).not.toHaveBeenCalled();
    expect(mockedStopExport).not.toHaveBeenCalled();
    expect(mockedPathExport).not.toHaveBeenCalled();
});


// Validate ZIP file compression
test('Test ZIP file compression validation', async() => {
    const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'gtfs-compress-'));
    const testGtfsDirectory = `${testDirectory}/gtfs`;

    // Create test directory
    fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(testDirectory);
    fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(testGtfsDirectory);
    
    // Sample data with repetitive content that should compress well
    const sampleData = {
        'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\ntest_agency,Test Agency Name,http://example.com,America/Montreal\n'.repeat(100),
        'routes.txt': 'route_id,agency_id,route_short_name,route_long_name,route_type\nroute_1,test_agency,1,Test Route Long Name,3\n'.repeat(100)
    };
    
    try {
        // Mock the export methods to create actual test files
        mockedAgencyExport.mockImplementationOnce(async (_agencyIds, options) => {
            const filePath = path.join(options.directoryPath, 'agency.txt');
            await fs.promises.writeFile(filePath, sampleData['agency.txt']);
            return { status: 'success', lineIds: [], agencyToGtfsId: {} };
        });

        mockedLineExport.mockImplementationOnce(async (_lineIds, options) => {
            const filePath = path.join(options.directoryPath, 'routes.txt');
            await fs.promises.writeFile(filePath, sampleData['routes.txt']);
            return { status: 'success', serviceIds: [] };
        });

        // Mock other exports to return success without creating files
        mockedServiceExport.mockResolvedValue({ status: 'success', serviceToGtfsId: {} });
        mockedScheduleExport.mockResolvedValue({ status: 'success', pathIds: [], nodeIds: [] });
        mockedStopExport.mockResolvedValue({ status: 'success' });
        mockedPathExport.mockResolvedValue({ status: 'success' });

        // Export GTFS
        const zipFileName = await exportGtfs(gtfsExportOptions, testDirectory);
        const zipFilePath = path.join(testDirectory, zipFileName);

        // Verify ZIP file exists
        expect(fs.existsSync(zipFilePath)).toBe(true);

        // Calculate uncompressed size
        let uncompressedSize = 0;
        Object.values(sampleData).forEach(content => {
            uncompressedSize += Buffer.byteLength(content, 'utf8');
        });

        // Get compressed size
        const zipStats = fs.statSync(zipFilePath);
        const compressedSize = zipStats.size;

        // Verify compression occurred (should be significantly smaller for repetitive data)
        const compressionRatio = compressedSize / uncompressedSize;
        expect(compressionRatio).toBeLessThan(0.9); // Compression expected
        
        // Verify ZIP file is valid and contains expected files
        const zipContent = fs.readFileSync(zipFilePath);
        const zip = await JSZip.loadAsync(zipContent);
        
        expect(zip.file('agency.txt')).toBeTruthy();
        expect(zip.file('routes.txt')).toBeTruthy();

        // Verify content integrity
        const agencyContent = await zip.file('agency.txt')?.async('string');
        expect(agencyContent).toBe(sampleData['agency.txt']);

    } finally {
        // Clean up test directory
        if (fs.existsSync(testDirectory)) {
            await fs.promises.rm(testDirectory, { recursive: true, force: true });
        }
    }
});
