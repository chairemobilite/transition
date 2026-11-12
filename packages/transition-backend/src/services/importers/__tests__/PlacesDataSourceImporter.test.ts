/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import importPlacesFromGeojson from '../PlacesDataSourceImporter';
import placesDbQueries from '../../../models/db/places.db.queries';
import dataSourcesDbQuery from 'chaire-lib-backend/lib/models/db/dataSources.db.queries';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

jest.mock('../../../models/db/places.db.queries');
jest.mock('chaire-lib-backend/lib/models/db/dataSources.db.queries');

jest.mock('@inquirer/prompts', () => ({
    confirm: jest.fn()
}));
import { confirm } from '@inquirer/prompts';
const mockConfirm = confirm as jest.MockedFunction<typeof confirm>;

jest.mock('chaire-lib-backend/lib/utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn().mockReturnValue(true),
    }
}));
const fileExistsMock = fileManager.fileExistsAbsolute as jest.MockedFunction<typeof fileManager.fileExistsAbsolute>;

describe('ImportPlacesFromGeojson', () => {
    let tmpDir: string;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'placesImporter-'));
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should throw an error if GeoJSON file does not exist', async () => {
        fileExistsMock.mockReturnValueOnce(false);
        const filename = '/absolute/path/to/filename.geojson';
        await expect(importPlacesFromGeojson(filename, 'data source')).rejects.toThrow('GeoJSON file not found:');
        expect(fileExistsMock).toHaveBeenCalledWith(filename);
    });

    test('should not import if data source exists and user chooses not to overwrite', async () => {
        (dataSourcesDbQuery.findByName as any).mockResolvedValue({ id: 'existingDataSourceId' });
        mockConfirm.mockResolvedValueOnce(false);

        await importPlacesFromGeojson('filename', 'data source');

        expect(placesDbQueries.deleteForDataSourceId).not.toHaveBeenCalled();
        expect(placesDbQueries.createMultiple).not.toHaveBeenCalled();
    });

    test('should import the point features of the GeoJSON file as places', async () => {
        (dataSourcesDbQuery.findByName as jest.Mock).mockResolvedValue(undefined);
        const filename = path.join(tmpDir, 'places.geojson');
        fs.writeFileSync(filename, JSON.stringify({
            type: 'FeatureCollection',
            features: [
                { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 1] }, properties: { name: 'Place 1', description: 'First place', other: 'value' } },
                { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 1], [1, 2]] }, properties: { name: 'Not a place' } },
                { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: { name: 'Place 2' } }
            ]
        }));

        await importPlacesFromGeojson(filename, 'data source');

        expect(mockConfirm).not.toHaveBeenCalled();
        expect(dataSourcesDbQuery.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'data source', type: 'places' }));
        const dataSourceId = (dataSourcesDbQuery.create as jest.Mock).mock.calls[0][0].id;
        expect(placesDbQueries.create).toHaveBeenCalledTimes(2);
        expect(placesDbQueries.create).toHaveBeenCalledWith({
            id: expect.any(String),
            data_source_id: dataSourceId,
            geography: { type: 'Point', coordinates: [0, 1] },
            name: 'Place 1',
            description: 'First place',
            data: { name: 'Place 1', description: 'First place', other: 'value' }
        });
        expect(placesDbQueries.create).toHaveBeenCalledWith(expect.objectContaining({
            data_source_id: dataSourceId,
            geography: { type: 'Point', coordinates: [1, 2] },
            name: 'Place 2'
        }));
    });
});

