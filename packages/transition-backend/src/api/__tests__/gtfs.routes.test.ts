/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { mocked } from 'ts-jest/utils'

import gtfsRoutes from '../gtfs.socketRoutes';
import { GtfsImportData } from 'transition-common/lib/services/gtfs/GtfsImportTypes';
import GtfsImporter from '../../services/gtfsImport/GtfsImporter';
import { GtfsConstants, GtfsExportStatus } from 'transition-common/lib/api/gtfs';
import { exportGtfs } from '../../services/gtfsExport/GtfsExporter';
import { GtfsMessages } from 'transition-common/lib/services/gtfs/GtfsMessages';
import { directoryManager } from 'chaire-lib-backend/lib/utils/filesystem/directoryManager';

const userId = 2;
const socketStub = new EventEmitter();
gtfsRoutes(socketStub, userId);

// Set up mocks
const mockGtfsImport = GtfsImporter.importGtfsData = jest.fn() as jest.MockedFunction<typeof GtfsImporter.importGtfsData>;
jest.mock('../../services/gtfsExport/GtfsExporter');
const mockedGtfsExport = mocked(exportGtfs, true);

describe('GTFS data import', () => {

    // We are testing the socket routes, not the actual imports, so value do not matter
    const arbitraryImportData: GtfsImportData = {
        agencies: [
            {
                agency: { agency_id: 'UT', agency_name: 'Unit Test', agency_url: '', agency_timezone: '' },
                existingAgencies: []
            }
        ],
        lines: [],
        services: [],
        periodsGroupShortname: 'default',
        periodsGroup: 'What type is this? Update when we know',
    }

    beforeEach(() => {
        mockGtfsImport.mockClear();
    });

    test('Import gtfs data correctly', (done) => {
        const importErrors = ['error'];
        const importWarnings = ['warnings']
        mockGtfsImport.mockResolvedValueOnce({ status: 'success' as const, errors: importErrors, warnings: importWarnings, nodesDirty: false });
        socketStub.once(GtfsConstants.GTFS_DATA_IMPORTED, async (results) => {
            const { status, errors, warnings } = results;
            expect(status).toEqual('success');
            // Make sure it contains the expected object
            expect(errors).toEqual(importErrors);
            // Make sure it contains everything else also
            expect(warnings).toEqual(importWarnings);
            expect(mockGtfsImport).toHaveBeenCalledWith(`${directoryManager.userDataDirectory}/${userId}/gtfs/gtfs`, arbitraryImportData, expect.anything());
            done();
        })
        socketStub.emit(GtfsConstants.GTFS_IMPORT_DATA, Object.assign({}, arbitraryImportData));
    });

    test('Import agencies with error', (done) => {
        const errorMessage = 'import Error';
        mockGtfsImport.mockRejectedValueOnce(errorMessage);
        socketStub.once(GtfsConstants.GTFS_DATA_IMPORTED, (results) => {
            expect(results.status).toEqual('failed');
            expect(results.errors).toEqual([errorMessage]);
            done();
        })
        socketStub.emit(GtfsConstants.GTFS_IMPORT_DATA, Object.assign({}, arbitraryImportData));
    });
});

describe('GTFS data export', () => {

    const exportData = {
        gtfsExporterId: 'arbitraryId',
        selectedAgencies: ['agency1Id', 'agency2Id'],
        filename: 'foo_gtfs.zip'
    }

    beforeEach(() => {
        mockedGtfsExport.mockClear();
    });

    test('Export GTFS data correctly', (done) => {
        const gtfsFileName = 'gtfs.zip';
        mockedGtfsExport.mockResolvedValueOnce(gtfsFileName);
        socketStub.once(GtfsConstants.GTFS_EXPORT_READY, async (results: GtfsExportStatus) => {
            expect(results.status).toEqual('success');
            expect(results.gtfsExporterId).toEqual(exportData.gtfsExporterId);
            // Make sure it contains everything else also
            expect((results as any).zipFilePath).toEqual(`exports/${gtfsFileName}`);
            expect(mockedGtfsExport).toHaveBeenCalledWith(exportData.selectedAgencies, `${directoryManager.userDataDirectory}/${userId}/exports`, socketStub);
            done();
        });
        socketStub.emit(GtfsConstants.GTFS_EXPORT_PREPARE, exportData);
    });

    test('Export GTFS data with error', (done) => {
        const errorMessage = 'import Error';
        mockedGtfsExport.mockRejectedValueOnce(errorMessage);
        socketStub.once(GtfsConstants.GTFS_EXPORT_READY, async (results: GtfsExportStatus) => {
            expect(results.status).toEqual('failed');
            expect(results.gtfsExporterId).toEqual(exportData.gtfsExporterId);
            expect((results as any).errors).toEqual([GtfsMessages.GtfsExportError]);
            expect(mockedGtfsExport).toHaveBeenCalledWith(exportData.selectedAgencies, `${directoryManager.userDataDirectory}/${userId}/exports`, socketStub);
            done();
        })
        socketStub.emit(GtfsConstants.GTFS_EXPORT_PREPARE, exportData);
    });
});
