/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import importer from '../ScenariosImporter';

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

jest.mock('../../../models/db/transitScenarios.db.queries', () => {
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
        { id: uuidV4(), name: "FOO", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-14T14:30:51.584Z", updated_at: "2021-10-14T14:30:51.584Z", services: [ uuidV4() ], only_agencies: [], only_lines: [], only_nodes: [], only_modes: [], except_agencies: [], except_lines: [], except_nodes: [], except_modes: [], simulation_id: null, data: {}, is_frozen: false },
        { id: uuidV4(), name: "FOO", color: null, is_enabled: true, description: null, created_at: "2021-10-14T14:30:51.584Z", updated_at: "2021-10-14T14:30:51.584Z", services: [ uuidV4(), uuidV4() ], only_agencies: [], only_lines: [], only_nodes: [], only_modes: [], except_agencies: [uuidV4()], except_lines: [], except_nodes: [], except_modes: [], simulation_id: uuidV4(), data: { something: 3 }, is_frozen: true },
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
    expect(updateMultiple).not.toHaveBeenCalled();
});

test('Valid with extra fields', async () => {
    currentData = [
        { id: uuidV4(), name: "FOO", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-14T14:30:51.584Z", updated_at: "2021-10-14T14:30:51.584Z", services: [ uuidV4() ], only_agencies: [], only_lines: [], only_nodes: [], only_modes: [], except_agencies: [], except_lines: [], except_nodes: [], except_modes: [], simulation_id: null, data: {}, is_frozen: false, notScenarioField: "test" },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);

    // Make sure the extra fields were not present in the object
    expect(createMultiple).toHaveBeenCalledTimes(1);
    // 0th object of the 0th argument of the 0th call
    expect(createMultiple.mock.calls[0][0][0].color).toEqual(currentData[0].color);
    expect(createMultiple.mock.calls[0][0][0].notScenarioField).toBeUndefined();
});

test('Valid with missing fields', async () => {
    currentData = [
        { id: uuidV4(), name: "FOO", services: [ uuidV4() ] },
        { name: "FOO2", services: [ uuidV4() ] },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
});

test('Valid, one existing, one new', async () => {
    currentData = [
        { id: existingId, name: "FOO", color: "#0086FF", is_enabled: true, description: "description", created_at: "2021-10-14T14:30:51.584Z", updated_at: "2021-10-14T14:30:51.584Z", services: [ uuidV4() ], only_agencies: [], only_lines: [], only_nodes: [], only_modes: [], except_agencies: [], except_lines: [], except_nodes: [], except_modes: [], simulation_id: null, data: {}, is_frozen: false },
        { id: uuidV4(), name: "FOO", color: null, is_enabled: true, description: null, created_at: "2021-10-14T14:30:51.584Z", updated_at: "2021-10-14T14:30:51.584Z", services: [ uuidV4(), uuidV4() ], only_agencies: [], only_lines: [], only_nodes: [], only_modes: [], except_agencies: [uuidV4()], except_lines: [], except_nodes: [], except_modes: [], simulation_id: uuidV4(), data: { something: 3 }, is_frozen: true },
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
});

test('Invalid data types', async () => {
    currentData = [
        { id: uuidV4(), name: ["FOO"], services: [ uuidV4() ] },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Invalid uuid', async () => {
    currentData = [
        { id: 'arbitrary', name: "FOO", services: [ uuidV4() ] },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Invalid ID format`));
});

test('Invalid objects', async () => {
    // No name or service, the scenario won't validate
    currentData = [
        { id: uuidV4() },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: transit:transitScenario:errors:NameIsRequired,transit:transitScenario:errors:ServicesAreRequired`));
});

test('Object with no valid data', async () => {
    currentData = [
        { field1: 2, field4: ['a', 'b'] },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(`Error validating data for object at position 0: No valid fields`);
});
