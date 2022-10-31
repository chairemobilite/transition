/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import importer from '../LinesImporter';
import Line from 'transition-common/lib/services/line/Line';

let currentData: { [key: string]: any }[] = [];
jest.mock('chaire-lib-backend/lib/services/files/JsonFileReader', () => {
    return {
        parseJsonFile: jest.fn().mockImplementation(async (filePath, rowCallback) => {
            const data = currentData;
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    rowCallback(data[i], i);
                }
            }
        })
    }
});
const objectsToCacheMock = jest.fn();
jest.mock('../../../models/capnpCache/transitLines.cache.queries', () => ({
    objectsToCache: (lines: Line[]) => objectsToCacheMock(lines)
}));

const existingId = uuidV4();
const createMultiple = jest.fn();
const updateMultiple = jest.fn();

jest.mock('../../../models/db/transitLines.db.queries', () => {
    return {
        exists: jest.fn().mockImplementation(async (id) => id === existingId ? true : false),
        createMultiple: jest.fn().mockImplementation((args) => createMultiple(args)),
        updateMultiple: jest.fn().mockImplementation((args) => updateMultiple(args))
    }
});

beforeEach(() => {
    createMultiple.mockClear();
    updateMultiple.mockClear();
    objectsToCacheMock.mockClear();
});

test('Valid data, all new', async () => {
    currentData = [
        { id: uuidV4(), internal_id: null, mode: "bus", category: null, agency_id : uuidV4(), shortname: "F", longname: "FOO North", color: "#009EE0", is_enabled: true, description: null, created_at: "2021-09-15T18:44:47.964Z", updated_at: "2021-09-15T18:45:01.535Z", is_autonomous: false, allow_same_line_transfers: false, data: {"gtfs": { agency_id: "AG FOO", route_type: 3 } }, is_frozen: false },
        { id: uuidV4(), internal_id: null, mode: "metro", category: 'C+', agency_id : uuidV4(), shortname: "B", longname: "Bar Line", color: "#009EE0", is_enabled: true, description: 'description', created_at: "2021-09-15T18:44:47.964Z", updated_at: "2021-09-15T18:45:01.535Z", is_autonomous: true, allow_same_line_transfers: false, },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
    expect(createMultiple).toHaveBeenCalledTimes(1);
    expect(createMultiple).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        ...currentData[0]
    }), expect.objectContaining({
        ...currentData[1]
    })]);
    expect(objectsToCacheMock).toHaveBeenCalledTimes(1);
    expect(objectsToCacheMock).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        ...currentData[0]
    }), expect.objectContaining({
        ...currentData[1]
    })]);
    expect(updateMultiple).not.toHaveBeenCalled();
});

test('Valid with extra fields', async () => {
    currentData = [
        { id: uuidV4(), internal_id: null, mode: "bus", category: null, agency_id : uuidV4(), shortname: "F", longname: "FOO North", color: "#009EE0", is_enabled: true, description: null, created_at: "2021-09-15T18:44:47.964Z", updated_at: "2021-09-15T18:45:01.535Z", is_autonomous: false, allow_same_line_transfers: false, data: {"gtfs": { agency_id: "AG FOO", route_type: 3 } }, is_frozen: false, extraField: 'test', scheduleByServiceId: { [uuidV4()]: { scheduleField: 'should be ignored' } } },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);

    // Make sure the extra fields were not present in the object
    expect(createMultiple).toHaveBeenCalledTimes(1);
    // 0th object of the 0th argument of the 0th call
    expect(createMultiple.mock.calls[0][0][0].color).toEqual(currentData[0].color);
    expect(createMultiple.mock.calls[0][0][0].extraField).toBeUndefined();
    // scheduleByServiceId is a field of line, but it is ignored at import
    expect(createMultiple.mock.calls[0][0][0].scheduleByServiceId).toEqual({});
});

test('Valid, one existing, one new', async () => {
    currentData = [
        { id: existingId, internal_id: null, mode: "bus", category: null, agency_id : uuidV4(), shortname: "F", longname: "FOO North", color: "#009EE0", is_enabled: true, description: null, created_at: "2021-09-15T18:44:47.964Z", updated_at: "2021-09-15T18:45:01.535Z", is_autonomous: false, allow_same_line_transfers: false, data: {"gtfs": { agency_id: "AG FOO", route_type: 3 } }, is_frozen: false },
        { id: uuidV4(), internal_id: null, mode: "metro", category: 'C+', agency_id : uuidV4(), shortname: "B", longname: "Bar Line", color: "#009EE0", is_enabled: true, description: 'description', created_at: "2021-09-15T18:44:47.964Z", updated_at: "2021-09-15T18:45:01.535Z", is_autonomous: true, allow_same_line_transfers: false, },
    ];

    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(1);
    expect((result as any).updated).toEqual(1);
    expect(createMultiple).toHaveBeenCalledTimes(1);
    expect(createMultiple).toHaveBeenCalledWith([expect.objectContaining({
        ...currentData[1]
    })]);
    expect(updateMultiple).toHaveBeenCalledTimes(1);
    expect(updateMultiple).toHaveBeenCalledWith([expect.objectContaining({
        ...currentData[0]
    })]);
    expect(objectsToCacheMock).toHaveBeenCalledTimes(2);
    expect(objectsToCacheMock).toHaveBeenCalledWith([expect.objectContaining({
        ...currentData[1]
    })]);
    expect(objectsToCacheMock).toHaveBeenCalledWith([expect.objectContaining({
        ...currentData[0]
    })]);
});

test('Invalid data types', async () => {
    // Test invalid mode
    currentData = [
        { id: uuidV4(), internal_id: null, mode: "bus", agency_id : uuidV4(), shortname: "F" },
        { id: uuidV4(), internal_id: null, mode: "not a mode", agency_id : uuidV4(), shortname: "F" },
    ];
    let result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 1:`));

    // invalid category
    currentData = [
        { id: uuidV4(), internal_id: null, mode: "bus", category: "not a category", agency_id : uuidV4(), shortname: "F" },
    ];
    result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Invalid objects', async () => {
    // Missing agency ID, the line won't validate
    currentData = [
        { id: uuidV4(), internal_id: null, mode: "bus", shortname: "F" }
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: transit:transitLine:errors:AgencyIsRequired`));
});

test('Object with no valid data', async () => {
    currentData = [
        { field1: 2, field4: ['a', 'b'] },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(`Error validating data for object at position 0: No valid fields`);
});
