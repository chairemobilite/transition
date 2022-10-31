/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import importer from '../NodesImporter';
import Node from 'transition-common/lib/services/nodes/Node';

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
jest.mock('../../../models/capnpCache/transitNodes.cache.queries', () => ({
    objectsToCache: (nodes: Node[]) => objectsToCacheMock(nodes)
}));

const existingId = uuidV4();
const createMultiple = jest.fn();
const updateMultiple = jest.fn();

jest.mock('../../../models/db/transitNodes.db.queries', () => {
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
        { 
            type: 'Feature',
            id: 1,
            geometry: { type: 'Point', coordinates: [-1, 0] }, 
            properties: { id: uuidV4(), code: '1234', data: { stops: [{ code: 'stop1', name: 'other' }]}, name: "Foo", routing_radius_meters: 50, default_dwell_time_seconds: 20, integer_id: 1, updated_at: null, created_at: '2021-10-26', description: 'desc', is_frozen: false, is_enabled: true, station_id: uuidV4(), internal_id: 'some internal ID' } 
        },
        { 
            type: 'Feature',
            id: 2,
            geometry: { type: 'Point', coordinates: [-2, 1] }, 
            properties: { id: uuidV4(), code: '4321', data: { stops: [{ code: 'stop1', name: 'other' }]}, name: "Bar", routing_radius_meters: 50, default_dwell_time_seconds: 20, integer_id: 2, updated_at: null, created_at: '2021-10-26', description: null, is_frozen: true, is_enabled: false, station_id: null, internal_id: null } 
        }
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
    expect(createMultiple).toHaveBeenCalledTimes(1);
    expect(createMultiple).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[0].geometry,
        ...currentData[0].properties,
        data: expect.objectContaining(currentData[0].properties.data)
    }), expect.objectContaining({
        geography: currentData[1].geometry,
        ...currentData[1].properties,
        data: expect.objectContaining(currentData[1].properties.data)
    })]);
    expect(objectsToCacheMock).toHaveBeenCalledTimes(1);
    expect(objectsToCacheMock).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[0].geometry,
        ...currentData[0].properties,
        data: expect.objectContaining(currentData[0].properties.data)
    }), expect.objectContaining({
        geography: currentData[1].geometry,
        ...currentData[1].properties,
        data: expect.objectContaining(currentData[1].properties.data)
    })]);
    expect(updateMultiple).not.toHaveBeenCalled();
});

test('Valid with extra fields', async () => {
    currentData = [
        { 
            type: 'Feature',
            id: 1,
            geometry: { type: 'Point', coordinates: [-1, 0] }, 
            properties: { id: uuidV4(), extraField: 'hello', code: '1234', data: { stops: [{ code: 'stop1', name: 'other' }]}, name: "Foo", routing_radius_meters: 50, default_dwell_time_seconds: 20, integer_id: 1, updated_at: null, created_at: '2021-10-26', description: 'desc', is_frozen: false, is_enabled: true, station_id: uuidV4(), internal_id: 'some internal ID' } 
        }
    ]
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);

    // Make sure the extra fields were not present in the object
    expect(createMultiple).toHaveBeenCalledTimes(1);
    // 0th object of the 0th argument of the 0th call
    expect(createMultiple.mock.calls[0][0][0].color).toEqual(currentData[0].color);
    expect(createMultiple.mock.calls[0][0][0].extraField).toBeUndefined();
});

test('Valid data, with minimal fields', async () => {
    currentData = [{ 
        type: 'Feature',
        id: 1,
        geometry: { type: 'Point', coordinates: [-1, 0] }, 
        properties: { id: uuidV4(), code: '1234', routing_radius_meters: 50, default_dwell_time_seconds: 20 } 
    }];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
    expect(createMultiple).toHaveBeenCalledTimes(1);
    expect(createMultiple).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[0].geometry,
        ...currentData[0].properties
    })]);
    expect(objectsToCacheMock).toHaveBeenCalledTimes(1);
    expect(objectsToCacheMock).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[0].geometry,
        ...currentData[0].properties
    })]);
    expect(updateMultiple).not.toHaveBeenCalled();
});

test('Valid, one existing, one new', async () => {
    currentData = [
        { 
            type: 'Feature',
            id: 1,
            geometry: { type: 'Point', coordinates: [-1, 0] }, 
            properties: { id: existingId, code: '1234', data: { stops: [{ code: 'stop1', name: 'other' }]}, name: "Foo", routing_radius_meters: 50, default_dwell_time_seconds: 20, integer_id: 1, updated_at: null, created_at: '2021-10-26', description: 'desc', is_frozen: false, is_enabled: true, station_id: uuidV4(), internal_id: 'some internal ID' } 
        },
        { 
            type: 'Feature',
            id: 2,
            geometry: { type: 'Point', coordinates: [-2, 1] }, 
            properties: { id: uuidV4(), code: '4321', data: { stops: [{ code: 'stop1', name: 'other' }]}, name: "Bar", routing_radius_meters: 50, default_dwell_time_seconds: 20, integer_id: 2, updated_at: null, created_at: '2021-10-26', description: null, is_frozen: true, is_enabled: false, station_id: null, internal_id: null } 
        }
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(1);
    expect((result as any).updated).toEqual(1);
    expect(createMultiple).toHaveBeenCalledTimes(1);
    expect(createMultiple).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[1].geometry,
        ...currentData[1].properties,
        data: expect.objectContaining(currentData[1].properties.data)
    })]);
    expect(updateMultiple).toHaveBeenCalledTimes(1);
    expect(updateMultiple).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[0].geometry,
        ...currentData[0].properties,
        data: expect.objectContaining(currentData[0].properties.data)
    })]);
    expect(objectsToCacheMock).toHaveBeenCalledTimes(2);
    expect(objectsToCacheMock).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[1].geometry,
        ...currentData[1].properties,
        data: expect.objectContaining(currentData[1].properties.data)
    })]);
    expect(objectsToCacheMock).toHaveBeenCalledWith([expect.objectContaining({
        id: expect.anything(),
        geography: currentData[0].geometry,
        ...currentData[0].properties,
        data: expect.objectContaining(currentData[0].properties.data)
    })]);
});

test('Invalid data types', async () => {
    // routing_radius is not a number
    currentData = [{ 
        type: 'Feature',
        id: 1,
        geometry: { type: 'Point', coordinates: [-1, 0] }, 
        properties: { id: uuidV4(), code: '1234', routing_radius_meters: 'fifty', default_dwell_time_seconds: 20 } 
    }];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Invalid uuid', async () => {
    currentData = [
        { 
            type: 'Feature', 
            geometry: { type: 'Point', coordinates: [-1, 0] }, 
            properties: { id: 'arbitrary', code: '1234', routing_radius_meters: 50, default_dwell_time_seconds: 20 }
        }
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Invalid ID format`));
});

test('Wrong geometry type', async () => {
    currentData = [
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[0,0], [-1, 1]] }, 
            properties: { id: uuidV4(), code: '1234', routing_radius_meters: 50, default_dwell_time_seconds: 20 }
        }
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Not a feature', async () => {
    // No acronym, the agency won't validate
    currentData = [
        { d: uuidV4(), name: "An agency" }
    ];
    const result = await importer.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Object is not a feature`));
});
