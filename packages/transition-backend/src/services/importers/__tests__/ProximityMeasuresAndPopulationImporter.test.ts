/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import importProximityMeasuresAndPopulationFromCsv from '../ProximityMeasuresAndPopulationImporter';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

jest.mock('chaire-lib-backend/lib/utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn().mockReturnValue(true),
    }
}));
const fileExistsMock = fileManager.fileExistsAbsolute as jest.MockedFunction<typeof fileManager.fileExistsAbsolute>;

describe('importProximityMeasuresAndPopulationFromCsv', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should throw an error if CSV file does not exist', async () => {
        fileExistsMock.mockReturnValueOnce(false);
        const filename = '/absolute/path/to/filename.csv';
        await expect(importProximityMeasuresAndPopulationFromCsv(filename)).rejects.toThrow(`Proximity CSV file not found: ${filename}`);
        expect(fileExistsMock).toHaveBeenCalledWith(filename);
    });

    //TODO: Add more tests
});
