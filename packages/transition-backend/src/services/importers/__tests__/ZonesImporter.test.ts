/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import importBoundariesFromGml, { addCommasToPosList } from '../ZonesImporter';
import { fileManager } from 'chaire-lib-backend/lib/utils/filesystem/fileManager';

jest.mock('chaire-lib-backend/lib/utils/filesystem/fileManager', () => ({
    fileManager: {
        fileExistsAbsolute: jest.fn().mockReturnValue(true),
    }
}));
const fileExistsMock = fileManager.fileExistsAbsolute as jest.MockedFunction<typeof fileManager.fileExistsAbsolute>;

describe('importBoundariesFromGml', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should throw an error if GML file does not exist', async () => {
        fileExistsMock.mockReturnValueOnce(false);
        const filename = '/absolute/path/to/filename.gml';
        await expect(importBoundariesFromGml(filename, 'data source')).rejects.toThrow(`Boundaries GML file not found: ${filename}`);
        expect(fileExistsMock).toHaveBeenCalledWith(filename);
    });

    //TODO: Add more tests
});

describe('addCommasToPosList', () => {

    test('should return the string of coordinates in the right format', async () => {
        const coordinateWithoutCommas = '1 2 3 4 5 6 7 8 9 10';
        const coordinateWithCommas = '1 2,3 4,5 6,7 8,9 10';
        expect(addCommasToPosList(coordinateWithoutCommas)).toBe(coordinateWithCommas);
    });
});