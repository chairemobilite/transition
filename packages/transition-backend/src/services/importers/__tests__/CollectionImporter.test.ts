/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as z from 'zod';
import { v4 as uuidV4 } from 'uuid';

import { GenericObject, GenericAttributes } from 'chaire-lib-common/lib/utils/objects/GenericObject';
import CollectionImporter, { genericAttributesSchema } from '../CollectionImporter';

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

interface StubTypeToImport extends GenericAttributes {
    field1: number;
    field2?: number;
    field3: string;
    field4: string[];
}

class StubObjectToImport extends GenericObject<StubTypeToImport> {

    _prepareAttributes(attribs: Partial<StubTypeToImport>) {
        // Make sure field1 exists
        if (!attribs.field1) {
            attribs.field1 = 9;
        }
        return super._prepareAttributes(attribs);
    }

    validate() {
        super.validate();
        if (this.attributes.field1 > 10) {
            this._errors.push('Value for field 1 is too high');
            return false;
        }
        return true;
    }
}

const stubTypeSchema = genericAttributesSchema.extend({
    field1: z.number(),
    field2: z.number().optional(),
    field3: z.string(),
    field4: z.array(z.string())
});
const existingId = uuidV4();
const createMultiple = jest.fn();
const updateMultiple = jest.fn();

const collectionImporter = new CollectionImporter<StubTypeToImport>({
    dbQueries: {
        exists: jest.fn().mockImplementation(async (id) => id === existingId ? true : false),
        createMultiple,
        updateMultiple
    },
    newObjectMethod: (args: Partial<StubTypeToImport>) => new StubObjectToImport(args, true),
    schema: stubTypeSchema
});

beforeEach(() => {
    createMultiple.mockClear();
    updateMultiple.mockClear();
})

test('Valid data, all new', async () => {
    currentData = [
        { field1: 2, field2: 3, field3: 'test', field4: ['a', 'b'], data: { test: 'data'}, updated_at: null },
        { id: uuidV4(), field1: 3, field3: 'test2', field4: ['a', 'b'] },
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
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
        { field1: 2, field2: 3, field3: 'test', field4: ['a', 'b'], extraField: 'extraData' },
        { field1: 3, field3: 'test2', field4: ['a', 'b'] },
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);

    // Make sure the extra fields were not present in the object
    expect(createMultiple).toHaveBeenCalledTimes(1);
    // 0th object of the 0th argument of the 0th call
    expect(createMultiple.mock.calls[0][0][0].field3).toEqual(currentData[0].field3);
    expect(createMultiple.mock.calls[0][0][0].extraField).toBeUndefined();
});

test('Valid with missing fields', async () => {
    currentData = [
        { field1: 2, field4: ['a', 'b'] },
        { field1: 3, field4: ['a', 'b'] },
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
});

test('Valid, one existing, one new', async () => {
    currentData = [
        { id: existingId, field1: 2, field2: 3, field3: 'test', field4: ['a', 'b'] },
        { id: uuidV4(), field1: 3, field3: 'test2', field4: ['a', 'b'] },
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
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
        { field1: 2, field2: 3, field3: 'test', field4: ['a', 'b'] },
        { field1: 3, field3: 'test2', field4: ['a', 'b'] },
        { field1: "3", field3: ['should not be an array'] }
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 2:`));
});

test('Invalid uuid', async () => {
    // The object with this data won't validate
    currentData = [
        { id: 'not a uuid', field1: 15, field2: 3, field3: 'test', field4: ['a', 'b'] },
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Invalid ID format`));
});

test('Invalid objects', async () => {
    // The object with this data won't validate
    currentData = [
        { field1: 15, field2: 3, field3: 'test', field4: ['a', 'b'] },
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Value for field 1 is too high`));
});

test('Object with no valid data', async () => {
    currentData = [
        { field1: 2, field4: ['a', 'b'] },
        { invalidField: 'useless data' },
    ];
    const result = await collectionImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(`Error validating data for object at position 1: No valid fields`);
});
