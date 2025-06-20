/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { parseOdTripsFromCsv } from '../odTripProvider';

let currentData: any = [];

jest.mock('chaire-lib-backend/lib/services/files/CsvFile', () => {
    return {
        parseCsvFile: jest.fn().mockImplementation(async (filePath, rowCallback, _options) => {
            const data = currentData;
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    rowCallback(data[i], i);
                }
            }
        })
    }
});

beforeEach(() => {

});

test('Parse a csv file, 4326 projection, departure time, HMM times', async () => {
    const data = [
        {
            id: 'id1',
            originX: -34,
            originY: 45,
            destinationX: -34.23,
            destinationY: 45.45,
            time: '0800',
            unused: '0500'
        },
        // String coordinates
        {
            id: 'id2',
            originX: '30',
            originY: '40',
            destinationX: '-30.5',
            destinationY: '40.234',
            time: '1032',
            unused: '0500'
        },
        {
            id: 'id3',
            originX: 30,
            originY: 40,
            destinationX: -30.5,
            destinationY: 40.234,
            time: '000',
            unused: '0500'
        }
    ];
    currentData = data;
    const options = {
        projection: '4326',
        idAttribute: 'id',
        originXAttribute: 'originX',
        originYAttribute: 'originY',
        destinationXAttribute: 'destinationX',
        destinationYAttribute: 'destinationY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'HMM',
        timeAttribute: 'time',
    };

    const { odTrips, errors } = await parseOdTripsFromCsv('path/to/file.csv', options);
    expect(odTrips.length).toEqual(3);
    expect(errors.length).toEqual(0);
    expect(odTrips[0].attributes).toEqual(expect.objectContaining({
        internal_id: data[0].id,
        origin_geography: { type: 'Point' as const, coordinates: [data[0].originX, data[0].originY]},
        destination_geography: { type: 'Point' as const, coordinates: [data[0].destinationX, data[0].destinationY]},
        timeType: 'departure',
        timeOfTrip: 8 * 60 * 60
    }));
    expect(odTrips[1].attributes).toEqual(expect.objectContaining({
        internal_id: data[1].id,
        origin_geography: { type: 'Point' as const, coordinates: [parseFloat(data[1].originX as string), parseFloat(data[1].originY as string)]},
        destination_geography: { type: 'Point' as const, coordinates: [parseFloat(data[1].destinationX as string), parseFloat(data[1].destinationY as string)]},
        timeType: 'departure',
        timeOfTrip: 10 * 60 * 60 + 32 * 60
    }));
    expect(odTrips[2].attributes).toEqual(expect.objectContaining({
        internal_id: data[2].id,
        origin_geography: { type: 'Point' as const, coordinates: [data[2].originX, data[2].originY]},
        destination_geography: { type: 'Point' as const, coordinates: [data[2].destinationX, data[2].destinationY]},
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
    currentData = data;
    const options = {
        projection: '2950',
        idAttribute: 'id',
        originXAttribute: 'originX',
        originYAttribute: 'originY',
        destinationXAttribute: 'destinationX',
        destinationYAttribute: 'destinationY',
        timeAttributeDepartureOrArrival: 'arrival' as const,
        timeFormat: 'HH:MM',
        timeAttribute: 'time'
    };

    const { odTrips, errors } = await parseOdTripsFromCsv('path/to/file.csv', options);
    expect(odTrips.length).toEqual(3);
    expect(errors.length).toEqual(0);
    expect(odTrips[0].attributes).toEqual(expect.objectContaining({
        internal_id: data[0].id,
        origin_geography: { type: 'Point' as const, coordinates: expect.anything()},
        destination_geography: { type: 'Point' as const, coordinates: expect.anything()},
        timeOfTrip: 8 * 60 * 60,
        timeType: 'arrival',
    }));
    // Validate that the coordinates are not the same as the original since the projection is different
    expect (odTrips[0].attributes.origin_geography).not.toEqual({ type: 'Point' as const, coordinates: [data[0].originX, data[0].originY]});
    expect (odTrips[0].attributes.destination_geography).not.toEqual({ type: 'Point' as const, coordinates: [data[0].destinationX, data[0].destinationY]});
    expect(odTrips[1].attributes).toEqual(expect.objectContaining({
        internal_id: data[1].id,
        origin_geography: { type: 'Point' as const, coordinates: expect.anything()},
        destination_geography: { type: 'Point' as const, coordinates: expect.anything()},
        timeOfTrip: 10 * 60 * 60 + 32 * 60,
        timeType: 'arrival',
    }));
    expect(odTrips[2].attributes).toEqual(expect.objectContaining({
        internal_id: data[1].id,
        origin_geography: { type: 'Point' as const, coordinates: expect.anything()},
        destination_geography: { type: 'Point' as const, coordinates: expect.anything()},
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
    currentData = data;
    const options = {
        projection: '4326',
        idAttribute: 'id',
        originXAttribute: 'originX',
        originYAttribute: 'originY',
        destinationXAttribute: 'destinationX',
        destinationYAttribute: 'destinationY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'secondsSinceMidnight',
        timeAttribute: 'time',
    };

    const { odTrips, errors } = await parseOdTripsFromCsv('path/to/file.csv', options);
    expect(odTrips.length).toEqual(2);
    expect(errors.length).toBeGreaterThan(currentData.length - 2);
    expect(odTrips[0].attributes).toEqual(expect.objectContaining({
        internal_id: data[3].id,
        origin_geography: { type: 'Point' as const, coordinates: [data[3].originX, data[3].originY]},
        destination_geography: { type: 'Point' as const, coordinates: [data[3].destinationX, data[3].destinationY]},
        timeType: 'departure',
        timeOfTrip: 8 * 60 * 60
    }));
    expect(odTrips[1].attributes).toEqual(expect.objectContaining({
        internal_id: data[4].id,
        origin_geography: { type: 'Point' as const, coordinates: [data[3].originX, data[3].originY]},
        destination_geography: { type: 'Point' as const, coordinates: [data[3].destinationX, data[3].destinationY]},
        timeType: 'departure',
        timeOfTrip: 0
    }));
});

test('Parse a csv file, wrong coordinates format', async () => {
    const data = [
        // Invalid origin coordinates format
        {
            id: 'id1',
            originX: 'thirtyfour',
            originY: 'fortyfive',
            destinationX: -34.23,
            destinationY: 45.45,
            time: '0800',
            unused: '0500'
        },
        // Invalid destination coordinates format
        {
            id: 'id1',
            originX: -34.23,
            originY: 45.25,
            destinationX: 'thirtyfour',
            destinationY: 'fortyfive',
            time: '0800',
            unused: '0500'
        },
        // Invalid origin and destination coordinates format
        {
            id: 'id1',
            originX: 'thirtythree',
            originY: 'fortyfour',
            destinationX: 'thirtyfour',
            destinationY: 'fortyfive',
            time: '0800',
            unused: '0500'
        },
    ];
    currentData = data;
    const options = {
        projection: '4326',
        idAttribute: 'id',
        originXAttribute: 'originX',
        originYAttribute: 'originY',
        destinationXAttribute: 'destinationX',
        destinationYAttribute: 'destinationY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'secondsSinceMidnight',
        timeAttribute: 'time',
    };

    const { odTrips, errors } = await parseOdTripsFromCsv('path/to/file.csv', options);
    expect(odTrips.length).toEqual(0);
    // 2 error messages per row: one for the line error and one for the coordinates error
    expect(errors.length).toEqual(data.length * 2);
    expect(errors).toEqual([
        {
            text: 'transit:transitRouting:errors:BatchRouteErrorOnLine',
            params: { n: '1' }
        },
        'transit:transitRouting:errors:InvalidOriginCoordinates',
        {
            text: 'transit:transitRouting:errors:BatchRouteErrorOnLine',
            params: { n: '2' }
        },
        'transit:transitRouting:errors:InvalidDestinationCoordinates',
        {
            text: 'transit:transitRouting:errors:BatchRouteErrorOnLine',
            params: { n: '3' }
        },
        'transit:transitRouting:errors:InvalidOriginDestinationCoordinates'
    ])
});

test('Parse a csv file, too many faulty lines', async () => {
    const data = Array(20).fill({ foo: 'bar', unused: 'data' });
    currentData = data;
    const options = {
        projection: '4326',
        idAttribute: 'id',
        originXAttribute: 'originX',
        originYAttribute: 'originY',
        destinationXAttribute: 'destinationX',
        destinationYAttribute: 'destinationY',
        timeAttributeDepartureOrArrival: 'departure' as const,
        timeFormat: 'HMM',
        timeAttribute: 'time',
    };

    let exception: unknown = undefined;
    try {
        await parseOdTripsFromCsv('path/to/file.csv', options);
    } catch (error) {
        exception = error;
    }
    expect(Array.isArray(exception)).toBeTruthy();
    expect((exception as any)[0]).toEqual('transit:transitRouting:errors:TooManyErrorsParsingFile');
});
