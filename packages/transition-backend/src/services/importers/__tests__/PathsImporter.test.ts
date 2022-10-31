/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import pathsImporter from '../PathsImporter';

let currentData: { [key: string]: any }[] = [];
jest.mock('chaire-lib-backend/lib/services/files/GeojsonFileReader', () => {
    return {
        parseGeojsonFileFeatures: jest.fn().mockImplementation(async (filePath, rowCallback) => {
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

jest.mock('../../../models/db/transitPaths.db.queries', () => {
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
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-1, 0]] }, 
            properties: { id: uuidV4(), name: "Foo path", line_id: uuidV4(), integer_id: 1, direction: 'loop', data: { defaultAcceleration: 1, routingEngine: 'engine', travelTimeWithoutDwellTimesSeconds: 300, operatingSpeedMetersPerSecond: 10, operatingTimeWithoutLayoverTimeSeconds: 350 }, mode: 'bus', updated_at: null, nodes: [uuidV4(), uuidV4()], stops: [uuidV4(), uuidV4()], segments: [0, 3] } 
        },
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-2, 1]] }, 
            properties: { id: uuidV4(), name: "Bar path", line_id: uuidV4(), integer_id: 1, direction: 'loop', data: { defaultAcceleration: 1, routingEngine: 'engine', travelTimeWithoutDwellTimesSeconds: 300, operatingSpeedMetersPerSecond: 10, operatingTimeWithoutLayoverTimeSeconds: 350 }, mode: 'bus', updated_at: null, nodes: [uuidV4(), uuidV4()], stops: [uuidV4(), uuidV4()], segments: [0, 3] } 
        }
    ];
    const result = await pathsImporter.import('arbitraryFilePath');
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
    expect(updateMultiple).not.toHaveBeenCalled();
});

test('Valid with minimal fields', async () => {
    currentData = [
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-1, 0]] }, 
            properties: { id: uuidV4(), name: "Foo path", line_id: uuidV4(), direction: 'loop', data: { defaultAcceleration: 1, routingEngine: 'engine', travelTimeWithoutDwellTimesSeconds: 300, operatingSpeedMetersPerSecond: 10, operatingTimeWithoutLayoverTimeSeconds: 350 }, mode: 'bus', nodes: [uuidV4(), uuidV4()] } 
        },
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-2, 1]] }, 
            properties: { id: uuidV4(), name: "Bar path", line_id: uuidV4(), direction: 'loop', data: { defaultAcceleration: 1, routingEngine: 'engine', travelTimeWithoutDwellTimesSeconds: 300, operatingSpeedMetersPerSecond: 10, operatingTimeWithoutLayoverTimeSeconds: 350 }, mode: 'bus', nodes: [uuidV4(), uuidV4()] } 
        }
    ];
    const result = await pathsImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('success');
    expect((result as any).created).toEqual(currentData.length);
    expect((result as any).updated).toEqual(0);
});

test('Valid, one existing, one new', async () => {
    currentData = [
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-1, 0]] }, 
            properties: { id: existingId, name: "Foo path", line_id: uuidV4(), direction: 'loop', data: { defaultAcceleration: 1, routingEngine: 'engine', travelTimeWithoutDwellTimesSeconds: 300, operatingSpeedMetersPerSecond: 10, operatingTimeWithoutLayoverTimeSeconds: 350 }, mode: 'bus', nodes: [uuidV4(), uuidV4()] } 
        },
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-2, 1]] }, 
            properties: { id: uuidV4(), name: "Bar path", line_id: uuidV4(), direction: 'loop', data: { defaultAcceleration: 1, routingEngine: 'engine', travelTimeWithoutDwellTimesSeconds: 300, operatingSpeedMetersPerSecond: 10, operatingTimeWithoutLayoverTimeSeconds: 350 }, mode: 'bus', nodes: [uuidV4(), uuidV4()] } 
        }
    ];
    const result = await pathsImporter.import('arbitraryFilePath');
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
});

test('Invalid data types', async () => {
    // Line id is bad
    currentData = [
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-1, 0]] }, 
            properties: { id: existingId, name: "Foo path", line_id: 3, integer_id: 1 } 
        }
    ];
    const result = await pathsImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Invalid uuid', async () => {
    currentData = [
        { 
            type: 'Feature', 
            geometry: { type: 'LineString', coordinates: [[-1, 1], [-1, 0]] }, 
            properties: { id: 'arbitrary', name: "Foo path", line_id: uuidV4(), integer_id: 1 } 
        }
    ];
    const result = await pathsImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Invalid ID format`));
});

test('Wrong geometry type', async () => {
    currentData = [
        { 
            type: 'Feature', 
            geometry: { type: 'Point', coordinates: [-1, 1] }, 
            properties: { id: uuidV4(), name: "Bar path", line_id: uuidV4(), direction: 'loop', data: { defaultAcceleration: 1, routingEngine: 'engine', travelTimeWithoutDwellTimesSeconds: 300, operatingSpeedMetersPerSecond: 10, operatingTimeWithoutLayoverTimeSeconds: 350 }, mode: 'bus', nodes: [uuidV4(), uuidV4()] } 
        }
    ];
    const result = await pathsImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0:`));
});

test('Not a feature', async () => {
    // No acronym, the agency won't validate
    currentData = [
        { d: uuidV4(), name: "An agency" }
    ];
    const result = await pathsImporter.import('arbitraryFilePath');
    expect(result.result).toEqual('error');
    expect((result as any).error).toEqual(expect.stringContaining(`Error validating data for object at position 0: Object is not a feature`));
});
