/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import importer from '../ServicesImporter';

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

jest.mock('../../../models/db/transitServices.db.queries', () => {
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
        { id: uuidV4(), name: "FOO Service", internal_id: null, monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: true, sunday: true, color: "#0086FF", is_enabled: true, description: null, start_date: "2018-10-29", end_date: "2019-01-04", only_dates: ["2018-10-29","2018-10-30"], except_dates: [], created_at: "2021-09-15T18:44:48.506Z", updated_at: null, simulation_id: null, is_frozen: false },
        { id: uuidV4(), name: "FOO Service2", internal_id: null, monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null, color: "#0086FF", is_enabled: true, description: null, start_date: "2018-10-29", end_date: "2019-01-04", only_dates: ["2018-10-29","2018-10-30"], except_dates: null, created_at: "2021-09-15T18:44:48.506Z", updated_at: null, simulation_id: uuidV4(), is_frozen: false },
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
        { id: uuidV4(), name: "FOO Service", internal_id: null, monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: true, sunday: true, color: "#0086FF", is_enabled: true, description: null, start_date: "2018-10-29", end_date: "2019-01-04", only_dates: ["2018-10-29","2018-10-30"], except_dates: [], created_at: "2021-09-15T18:44:48.506Z", updated_at: null, simulation_id: null, is_frozen: false, notServiceField: 'test' },
        { id: uuidV4(), name: "FOO Service2", internal_id: null, monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null, color: "#0086FF", is_enabled: true, description: null, start_date: "2018-10-29", end_date: "2019-01-04", only_dates: ["2018-10-29","2018-10-30"], except_dates: null, created_at: "2021-09-15T18:44:48.506Z", updated_at: null, simulation_id: uuidV4(), is_frozen: false, scheduled_lines: [uuidV4()] },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);

    // Make sure the extra fields were not present in the object
    expect(createMultiple).toHaveBeenCalledTimes(1);
    // 0th object of the 0th argument of the 0th call
    expect(createMultiple.mock.calls[0][0][0].color).toEqual(currentData[0].color);
    expect(createMultiple.mock.calls[0][0][0].notServiceField).toBeUndefined();
    // scheduled_lines is a service field, but not to be imported, it's data should be the default empty array
    expect(createMultiple.mock.calls[0][0][1].scheduled_lines).toEqual([]);
});

test('Valid with missing fields', async () => {
    currentData = [
        { id: uuidV4(), name: "FOO Service", start_date: "2018-10-29", end_date: "2019-01-04", only_dates: ["2018-10-29","2018-10-30"], except_dates: [] },
        { id: uuidV4(), name: "FOO Service2", start_date: "2018-10-29", end_date: "2019-01-04", monday: null, tuesday: null },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
});

test('Valid, one existing, one new', async () => {
    currentData = [
        { id: existingId, name: "FOO Service", internal_id: null, monday: false, tuesday: false, wednesday: false, thursday: false, friday: false, saturday: true, sunday: true, color: "#0086FF", is_enabled: true, description: null, start_date: "2018-10-29", end_date: "2019-01-04", only_dates: ["2018-10-29","2018-10-30"], except_dates: [], created_at: "2021-09-15T18:44:48.506Z", updated_at: null, simulation_id: null, is_frozen: false },
        { id: uuidV4(), name: "FOO Service2", internal_id: null, monday: null, tuesday: null, wednesday: null, thursday: null, friday: null, saturday: null, sunday: null, color: "#0086FF", is_enabled: true, description: null, start_date: "2018-10-29", end_date: "2019-01-04", only_dates: ["2018-10-29","2018-10-30"], except_dates: null, created_at: "2021-09-15T18:44:48.506Z", updated_at: null, simulation_id: uuidV4(), is_frozen: false },
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
        { id: uuidV4(), name: "FOO Service2", start_date: "2018-10-29", end_date: "2019-01-04", monday: "true", tuesday: "false" },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Invalid uuid', async () => {
    currentData = [
        { id: 'arbitrary', name: "FOO Service2", start_date: "2018-10-29", end_date: "2019-01-04", monday: false, tuesday: true },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Invalid ID format`));
});

test('Invalid objects', async () => {
    // No start or end dates, the service won't validate
    currentData = [
        { id: uuidV4(), name: "FOO Service2", monday: null, tuesday: null },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: transit:transitService:errors:StartDateIsRequired,transit:transitService:errors:EndDateIsRequired`));
});

test('Object with no valid data', async () => {
    currentData = [
        { field1: 2, field4: ['a', 'b'] },
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(`Error validating data for object at position 0: No valid fields`);
});
