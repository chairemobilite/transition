/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import agenciesImporter from '../AgenciesImporter';

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

const existingId = uuidV4();
const createMultiple = jest.fn();
const updateMultiple = jest.fn();

jest.mock('../../../models/db/transitAgencies.db.queries', () => {
    return {
        exists: jest.fn().mockImplementation(async (id) => id === existingId ? true : false),
        createMultiple: jest.fn().mockImplementation((args) => createMultiple(args)),
        updateMultiple: jest.fn().mockImplementation((args) => updateMultiple(args))
    }
});

beforeEach(() => {
    createMultiple.mockClear();
    updateMultiple.mockClear();
})

test('Valid data, all new', async () => {
    currentData = [
        { internal_id: null, acronym: "TEST", name: "My agency", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-12T17:07:05.758Z", updated_at: null, simulation_id: null, data: { gtfs: { agency_id: "TEST" } }, is_frozen: false },
        { id: uuidV4(), internal_id: null, acronym: "FOO", name: "An agency", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-14T17:07:05.758Z", updated_at: null, simulation_id: uuidV4(), data: { gtfs: { agency_id: "FOO" } }, is_frozen: false },
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
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
    expect(updateMultiple).not.toHaveBeenCalled();
});

test('Valid with extra fields', async () => {
    currentData = [
        { internal_id: null, acronym: "TEST", name: "My agency", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-12T17:07:05.758Z", updated_at: null, simulation_id: null, data: { gtfs: { agency_id: "TEST" } }, is_frozen: false, line_ids: [ "should not be imported" ], notAgencyField: "not a field" },
        { id: uuidV4(), internal_id: null, acronym: "FOO", name: "An agency", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-14T17:07:05.758Z", updated_at: null, simulation_id: uuidV4(), data: { gtfs: { agency_id: "FOO" } }, is_frozen: false, someOtherField: "test" },
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);

    // Make sure the extra fields were not present in the object
    expect(createMultiple).toHaveBeenCalledTimes(1);
    // 0th object of the 0th argument of the 0th call
    expect(createMultiple.mock.calls[0][0][0].color).toEqual(currentData[0].color);
    expect(createMultiple.mock.calls[0][0][0].notAgencyField).toBeUndefined();
    // line_ids is an agency field, but not to be imported, so it should be empty.
    expect(createMultiple.mock.calls[0][0][0].line_ids).toEqual([]);
    expect(createMultiple.mock.calls[0][0][1].someOtherField).toBeUndefined();
});

test('Valid with missing fields', async () => {
    currentData = [
        { internal_id: null, acronym: "TEST", name: "My agency" },
        { id: uuidV4(), acronym: "FOO", name: "An agency" },
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
});

test('Valid, one existing, one new', async () => {
    currentData = [
        { id: existingId, internal_id: null, acronym: "TEST", name: "My agency", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-12T17:07:05.758Z", updated_at: null, simulation_id: null, data: { gtfs: { agency_id: "TEST" } }, is_frozen: false },
        { id: uuidV4(), internal_id: null, acronym: "FOO", name: "An agency", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-14T17:07:05.758Z", updated_at: null, simulation_id: uuidV4(), data: { gtfs: { agency_id: "FOO" } }, is_frozen: false },
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
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
});

test('Invalid data types', async () => {
    currentData = [
        { id: uuidV4(), acronym: ["FOO"], name: "An agency" }
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Invalid uuid', async () => {
    currentData = [
        { id: 'arbitrary', acronym: "FOO", name: "An agency" },
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Invalid ID format`));
});

test('Invalid objects', async () => {
    // No acronym, the agency won't validate
    currentData = [
        { d: uuidV4(), name: "An agency" }
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: transit:transitAgency:errors:AcronymIsRequired`));
});

test('Object with no valid data', async () => {
    currentData = [
        { field1: 2, field4: ['a', 'b'] },
    ];
    const result = await agenciesImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(`Error validating data for object at position 0: No valid fields`);
});
