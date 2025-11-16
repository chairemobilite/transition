/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { parseLocationsFromCsv, parseLocationsFromCsvStream } from '../AccessMapLocationProvider';
import fs from 'fs';
import { Readable } from 'stream';

// Mock fs.existsSync
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn().mockReturnValue(true),
    createReadStream: jest.fn().mockReturnValue({destroy: jest.fn()} as any)
}));

// TODO Those helper functions are copied from odTripProvider.test.ts, should we have them in a common location?
// Helper function to create a readable stream from CSV string
const createCsvStream = (csvContent: string): Readable => {
    const stream = new Readable();
    stream.push(csvContent);
    stream.push(null); // Signal end of stream
    return stream;
};

// Helper function to convert data array to CSV string
const dataToCsv = (data: any[], headers: string[]): string => {
    const headerLine = headers.join(',');
    const dataLines = data.map(row => headers.map(h => row[h] ?? '').join(','));
    return headerLine + '\n' + dataLines.join('\n') + '\n';
};

beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
});

test('Parse a csv file, 4326 projection, departure time, HMM times', async () => {
    const data = [
        {
            id: 'id1',
            originX: -34,
            originY: 45,
            time: '0800',
            unused: '0500'
        },
        {
            id: 'id2',
            originX: '30',
            originY: '40',
            time: '1032',
            unused: '0500'
        },
        {
            id: 'id3',
            originX: 30,
            originY: 40,
            time: '000',
            unused: '0500'
        }
    ];

    const options = {
        projection: '4326',
        idAttribute: 'id',
        xAttribute: 'originX',
        yAttribute: 'originY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'HMM',
        timeAttribute: 'time',
    };

    // Mock a CSV file stream based on the above test values
    (fs.createReadStream as jest.Mock).mockReturnValueOnce(createCsvStream(dataToCsv(data, ['id','originX','originY','time','unused'])));

    const { locations, errors } = await parseLocationsFromCsv('path/to/file.csv', options);
    expect(locations.length).toEqual(3);
    expect(errors.length).toEqual(0);
    expect(locations[0]).toEqual(expect.objectContaining({
        id: data[0].id,
        geography: { type: 'Point' as const, coordinates: [data[0].originX, data[0].originY]},
        timeType: 'departure',
        timeOfTrip: 8 * 60 * 60
    }));
    expect(locations[1]).toEqual(expect.objectContaining({
        id: data[1].id,
        geography: { type: 'Point' as const, coordinates: [parseFloat(data[1].originX as string), parseFloat(data[1].originY as string)]},
        timeType: 'departure',
        timeOfTrip: 10 * 60 * 60 + 32 * 60
    }));
    expect(locations[2]).toEqual(expect.objectContaining({
        id: data[2].id,
        geography: { type: 'Point' as const, coordinates: [data[2].originX, data[2].originY]},
        timeType: 'departure',
        timeOfTrip: 0
    }));
});

test('Parse a csv file, 2950 projection, arrival time, HH:MM times', async () => {
    const data = [
        {
            id: 'id',
            originX: -34,
            originY: 45,
            destinationX: -34.23,
            destinationY: 45.45,
            time: '08:00',
            unused: '0500'
        },
        {
            id: 'id',
            originX: '30',
            originY: '40',
            destinationX: '-30.5',
            destinationY: '40.234',
            time: '10:32',
            unused: '0500'
        },
        {
            id: 'id',
            originX: '30',
            originY: '40',
            destinationX: '-30.5',
            destinationY: '40.234',
            time: '00:00',
            unused: '0500'
        }
    ];

    const options = {
        projection: '2950',
        idAttribute: 'id',
        xAttribute: 'originX',
        yAttribute: 'originY',
        timeAttributeDepartureOrArrival: 'arrival' as const,
        timeFormat: 'HH:MM',
        timeAttribute: 'time'
    };
    // Mock a CSV file stream based on the above test values
    (fs.createReadStream as jest.Mock).mockReturnValueOnce(createCsvStream(dataToCsv(data, ['id','originX','originY','time','unused'])));

    const { locations, errors } = await parseLocationsFromCsv('path/to/file.csv', options);
    expect(locations.length).toEqual(3);
    expect(errors.length).toEqual(0);
    expect(locations[0]).toEqual(expect.objectContaining({
        id: data[0].id,
        geography: { type: 'Point' as const, coordinates: expect.anything()},
        timeOfTrip: 8 * 60 * 60,
        timeType: 'arrival',
    }));
    // Validate that the coordinates are not the same as the original since the projection is different
    expect (locations[0].geography).not.toEqual({ type: 'Point' as const, coordinates: [data[0].originX, data[0].originY]});
    expect(locations[1]).toEqual(expect.objectContaining({
        id: data[1].id,
        geography: { type: 'Point' as const, coordinates: expect.anything()},
        timeOfTrip: 10 * 60 * 60 + 32 * 60,
        timeType: 'arrival',
    }));
    expect(locations[2]).toEqual(expect.objectContaining({
        id: data[1].id,
        geography: { type: 'Point' as const, coordinates: expect.anything()},
        timeOfTrip: 0,
        timeType: 'arrival',
    }));
});

test('Parse a csv file, faulty lines and time in seconds', async () => {
    const data = [
        // No fields
        {
            foo: 'bar',
            unused: 'data'
        },
        // Invalid coordinates data
        {
            id: 'id',
            originX: 'abc',
            originY: 'def',
            destinationX: -30.5,
            destinationY: 40.234,
            time: '1032',
            unused: '0500'
        },
        // Invalid time format, both time values will be undefined
        {
            id: 'id',
            originX: 30,
            originY: 40,
            destinationX: -30.5,
            destinationY: 40.234,
            time: 'abcd',
            unused: '0500'
        },
        {
            id: 'id',
            originX: 30,
            originY: 40,
            destinationX: -30.5,
            destinationY: 40.234,
            time: '28800',
            unused: '0500'
        },
        {
            id: 'id2',
            originX: 30,
            originY: 40,
            destinationX: -30.5,
            destinationY: 40.234,
            time: '0',
            unused: '0500'
        }
    ];

    const options = {
        projection: '4326',
        idAttribute: 'id',
        xAttribute: 'originX',
        yAttribute: 'originY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'secondsSinceMidnight',
        timeAttribute: 'time',
    };
    // Mock a CSV file stream based on the above test values
    (fs.createReadStream as jest.Mock).mockReturnValueOnce(createCsvStream(dataToCsv(data, ['id','originX','originY','destinationX','destinationY','time','unused'])));

    const { locations, errors } = await parseLocationsFromCsv('path/to/file.csv', options);
    expect(locations.length).toEqual(2);
    expect(errors.length).toBeGreaterThan(data.length - 2);
    expect(locations[0]).toEqual(expect.objectContaining({
        id: data[3].id,
        geography: { type: 'Point' as const, coordinates: [data[3].originX, data[3].originY]},
        timeType: 'departure',
        timeOfTrip: 8 * 60 * 60,
    }));
    expect(locations[1]).toEqual(expect.objectContaining({
        id: data[4].id,
        geography: { type: 'Point' as const, coordinates: [data[3].originX, data[3].originY]},
        timeType: 'departure',
        timeOfTrip: 0,
    }));
});

test('Parse a csv file, wrong coordinates format', async () => {
    const data = [
        // Invalid location coordinates format
        {
            id: 'id1',
            originX: 'thirtyfour',
            originY: 'fortyfive',
            time: '0800',
            unused: '0500'
        },
    ];

    const options = {
        projection: '4326',
        idAttribute: 'id',
        xAttribute: 'originX',
        yAttribute: 'originY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'secondsSinceMidnight',
        timeAttribute: 'time',
    };
    // Mock a CSV file stream based on the above test values
    (fs.createReadStream as jest.Mock).mockReturnValueOnce(createCsvStream(dataToCsv(data, ['id','originX','originY','time','unused'])));

    const { locations, errors } = await parseLocationsFromCsv('path/to/file.csv', options);
    expect(locations.length).toEqual(0);
    expect(errors.length).toEqual(2);
    expect(errors).toEqual([
        {
            text: 'transit:transitRouting:errors:BatchRouteErrorOnLine',
            params: { n: '2' }
        },
        'transit:transitRouting:errors:InvalidLocationCoordinates',
    ])
});

test('Parse a csv file, too many faulty lines', async () => {
    const csvString = Array(20).fill("bar,data").join("\n");

    (fs.createReadStream as jest.Mock).mockReturnValueOnce(createCsvStream(csvString));

    const options = {
        projection: '4326',
        idAttribute: 'id',
        xAttribute: 'originX',
        yAttribute: 'originY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'HMM',
        timeAttribute: 'time',
    };

    let exception: unknown = undefined;
    try {
        await parseLocationsFromCsv('path/to/file.csv', options);
    } catch (error) {
        exception = error;
    }
    expect(Array.isArray(exception)).toBeTruthy();
    expect((exception as any)[0]).toEqual('transit:transitRouting:errors:TooManyErrorsParsingFile');
});

describe('parseLocationsFromCsvStream', () => {
    test('Parse a stream, 4326 projection, departure time, HMM times', async () => {
        const csvContent = 'id,originX,originY,time,unused\n' +
            'id1,-34,45,0800,0500\n' +
            'id2,30,40,1032,0500\n';

        const options = {
            projection: '4326',
            idAttribute: 'id',
            xAttribute: 'originX',
            yAttribute: 'originY',
            timeAttributeDepartureOrArrival: 'departure' as const,
            timeFormat: 'HMM',
            timeAttribute: 'time',
        };

        const stream = createCsvStream(csvContent);
        const { locations, errors } = await parseLocationsFromCsvStream(stream, options);

        expect(locations.length).toEqual(2);
        expect(errors.length).toEqual(0);
        expect(locations[0]).toEqual(expect.objectContaining({
            id: 'id1',
            geography: { type: 'Point' as const, coordinates: [-34, 45]},
            timeType: 'departure',
            timeOfTrip: 8 * 60 * 60
        }));
        expect(locations[1]).toEqual(expect.objectContaining({
            id: 'id2',
            geography: { type: 'Point' as const, coordinates: [30, 40]},
            timeType: 'departure',
            timeOfTrip: 10 * 60 * 60 + 32 * 60
        }));
    });

    test('Parse a stream with errors', async () => {
        const csvContent = 'id,originX,originY,time,unused\n' +
            'id1,invalid,invalid,0800,0500\n';

        const options = {
            projection: '4326',
            idAttribute: 'id',
            xAttribute: 'originX',
            yAttribute: 'originY',
            timeAttributeDepartureOrArrival: 'departure' as const,
            timeFormat: 'HMM',
            timeAttribute: 'time',
        };

        const stream = createCsvStream(csvContent);
        const { locations, errors } = await parseLocationsFromCsvStream(stream, options);

        expect(locations.length).toEqual(0);
        expect(errors.length).toBeGreaterThan(0);
    });

    test('Parse a stream with arrival time and seconds format', async () => {
        const csvContent = 'id,originX,originY,time,unused\n' +
            'id1,-34,45,28800,0500\n' +
            'id2,30,40,37920,0500\n';

        const options = {
            projection: '4326',
            idAttribute: 'id',
            xAttribute: 'originX',
            yAttribute: 'originY',
            timeAttributeDepartureOrArrival: 'arrival' as const,
            timeFormat: 'secondsSinceMidnight',
            timeAttribute: 'time',
        };

        const stream = createCsvStream(csvContent);
        const { locations, errors } = await parseLocationsFromCsvStream(stream, options);

        expect(locations.length).toEqual(2);
        expect(errors.length).toEqual(0);
        expect(locations[0]).toEqual(expect.objectContaining({
            timeType: 'arrival',
            timeOfTrip: 28800
        }));
        expect(locations[1]).toEqual(expect.objectContaining({
            timeType: 'arrival',
            timeOfTrip: 37920
        }));
    });
});

describe('File existence check', () => {
    test('Throws error when file does not exist', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);

        const options = {
            projection: '4326',
            idAttribute: 'id',
            xAttribute: 'originX',
            yAttribute: 'originY',
            timeAttributeDepartureOrArrival: 'departure' as const,
            timeFormat: 'HMM',
            timeAttribute: 'time',
        };

        await expect(parseLocationsFromCsv('nonexistent.csv', options)).rejects.toEqual('CSV file does not exist');
    });
});
