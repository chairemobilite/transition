/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import { gtfsValidSimpleData, defaultInternalImportData } from './GtfsImportData.test';
import StopTimeImporter from '../StopTimeImporter';
import TripImporter from '../TripImporter';

let currentData: any = gtfsValidSimpleData;

jest.mock('chaire-lib-backend/lib/services/files/CsvFile', () => {
    return {
        parseCsvFile: jest.fn().mockImplementation(async (filePath, rowCallback, _options) => {
            const data = currentData[filePath];
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    rowCallback(data[i], i);
                }
            }
        })
    }
});

describe('GTFS Stop time import preparation', () => {
    test('Test prepare stop time data, nothing imported', async () => {
        currentData = gtfsValidSimpleData

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(0);
    });

    test('Test invalid stop time data', async() => {
        const tripIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: tripIdToImport, shape_id: uuidV4() }];

        const badSeq1 = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '-1', arrival_time: '12:23', departure_time: '12:24', stop_headsign: 'Test North', pickup_type: '0', drop_off_type: '0', continuous_pickup: '0', continuous_drop_off: '0', shape_dist_traveled: '1', timepoint: '0' };
        const badSeq2 = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: 'notanumber', arrival_time: '12:23', departure_time: '12:24', stop_headsign: 'Test North', pickup_type: '0', drop_off_type: '0', continuous_pickup: '0', continuous_drop_off: '0', shape_dist_traveled: '1', timepoint: '0' };
        const badOptionalOutOfRange = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '3', arrival_time: '01:01', departure_time: '01:02', stop_headsign: 'Test North', pickup_type: '111', drop_off_type: '111', continuous_pickup: '111', continuous_drop_off: '111', shape_dist_traveled: '-111', timepoint: '9' };
        const badOptionalWrongType = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '4', arrival_time: '01:01', departure_time: '01:02', stop_headsign: 'Test North', pickup_type: 'badtype', drop_off_type: 'badtype', continuous_pickup: 'badtype', continuous_drop_off: 'badtype', shape_dist_traveled: 'badtype', timepoint: 'badtype' };
        currentData = {
            'stop_times.txt': [ badSeq1, badSeq2, badOptionalOutOfRange, badOptionalWrongType ]
        };

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(2);
        expect(data[0]).toEqual({
            trip_id: tripIdToImport,
            stop_sequence: parseInt(badOptionalOutOfRange.stop_sequence),
            pickup_type: 0,
            drop_off_type: 0,
            continuous_pickup: 1,
            continuous_drop_off: 1,
            timepoint: 1,
            arrival_time: badOptionalOutOfRange.arrival_time,
            departure_time: badOptionalOutOfRange.departure_time,
            stop_id: badOptionalOutOfRange.stop_id,
            stop_headsign: badOptionalOutOfRange.stop_headsign,
            arrivalTimeSeconds: 3660,
            departureTimeSeconds: 3720
        });
        expect(data[1]).toEqual({
            trip_id: tripIdToImport,
            stop_sequence: parseInt(badOptionalWrongType.stop_sequence),
            pickup_type: 0,
            drop_off_type: 0,
            continuous_pickup: 1,
            continuous_drop_off: 1,
            timepoint: 1,
            arrival_time: badOptionalWrongType.arrival_time,
            departure_time: badOptionalWrongType.departure_time,
            stop_id: badOptionalWrongType.stop_id,
            stop_headsign: badOptionalWrongType.stop_headsign,
            arrivalTimeSeconds: 3660,
            departureTimeSeconds: 3720
        });
    });

    test('Test only arrival or departure time', async() => {
        const tripIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: tripIdToImport, shape_id: uuidV4() }];

        const onlyArrivalTime = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '1', arrival_time: '12:00', stop_headsign: 'Test North', pickup_type: '0', drop_off_type: '0', continuous_pickup: '1', continuous_drop_off: '1', timepoint: '0' };
        const onlyDepartureTime = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '2', departure_time: '12:02', stop_headsign: 'Test North', pickup_type: '0', drop_off_type: '0', continuous_pickup: '1', continuous_drop_off: '1', timepoint: '0' };
        currentData = {
            'stop_times.txt': [ onlyArrivalTime, onlyDepartureTime ]
        };

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(2);
        expect(data[0]).toEqual({
            trip_id: tripIdToImport,
            stop_sequence: parseInt(onlyArrivalTime.stop_sequence),
            pickup_type: 0,
            drop_off_type: 0,
            continuous_pickup: 1,
            continuous_drop_off: 1,
            timepoint: 0,
            arrival_time: onlyArrivalTime.arrival_time,
            departure_time: '',
            stop_id: onlyArrivalTime.stop_id,
            stop_headsign: onlyArrivalTime.stop_headsign,
            arrivalTimeSeconds: 43200,
            departureTimeSeconds: 43200
        });
        expect(data[1]).toEqual({
            trip_id: tripIdToImport,
            stop_sequence: parseInt(onlyDepartureTime.stop_sequence),
            pickup_type: 0,
            drop_off_type: 0,
            continuous_pickup: 1,
            continuous_drop_off: 1,
            timepoint: 0,
            arrival_time: '',
            departure_time: onlyDepartureTime.departure_time,
            stop_id: onlyDepartureTime.stop_id,
            stop_headsign: onlyDepartureTime.stop_headsign,
            arrivalTimeSeconds: 43320,
            departureTimeSeconds: 43320
        });
    });

    test('Test valid stop time data and conversion', async() => {
        const tripIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: tripIdToImport, shape_id: uuidV4() }];

        const allFields = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '70', arrival_time: '10:00', departure_time: '10:02', stop_headsign: 'Test North', pickup_type: '0', drop_off_type: '0', continuous_pickup: '0', continuous_drop_off: '0', shape_dist_traveled: '1.321', timepoint: '0' };
        currentData = {
            'stop_times.txt': [ allFields ]
        };

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(1);
        expect(data[0]).toEqual({
            trip_id: tripIdToImport,
            stop_sequence: 70,
            pickup_type: 0,
            drop_off_type: 0,
            continuous_pickup: 0,
            continuous_drop_off: 0,
            timepoint: 0,
            arrival_time: allFields.arrival_time,
            departure_time: allFields.departure_time,
            stop_id: allFields.stop_id,
            stop_headsign: allFields.stop_headsign,
            shape_dist_traveled: 1.321,
            arrivalTimeSeconds: 36000,
            departureTimeSeconds: 36120
        });
    });
});


describe('GTFS Stop time import preparation, using all base trips', () => {
    const routeIdsByGtfsIds = {};
    const serviceIdsByGtfsIds = {};
    gtfsValidSimpleData['trips.txt'].forEach(trip => {
        routeIdsByGtfsIds[trip.route_id] = uuidV4();
        serviceIdsByGtfsIds[trip.service_id] = uuidV4();
    });
    const importData = Object.assign({}, defaultInternalImportData, { 
        lineIdsByRouteGtfsId: routeIdsByGtfsIds, 
        serviceIdsByGtfsId: serviceIdsByGtfsIds 
    });
    const tripImporter = new TripImporter({ directoryPath: '' });

    test('Test prepare import data', async () => {
        currentData = gtfsValidSimpleData;
        const tripData = await tripImporter.prepareImportData(importData);
        importData.tripsToImport = tripData;

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(currentData['stop_times.txt'].length);
    });

    test('Test prepare stop time data', async () => {
        currentData = gtfsValidSimpleData;
        const tripData = await tripImporter.prepareImportData(importData);
        importData.tripsToImport = tripData;

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        const stopTimes = StopTimeImporter.groupAndSortByTripId(data);
        // One trip was manually added and has no stop times, so one less trip expected
        expect(Object.keys(stopTimes).length).toEqual(tripData.length - 1);
        const keys = Object.keys(stopTimes);
        for (let i = 0; i < keys.length; i++) {
            const stopTimeByStop = stopTimes[keys[i]];
            for (let stopIndex = 1; stopIndex < stopTimeByStop.length; stopIndex++) {
                expect(stopTimeByStop[stopIndex-1].stop_sequence).toBeLessThan(stopTimeByStop[stopIndex].stop_sequence);
            }
        }
    });

});

describe('GTFS Stop time import preparation, one trip', () => {
    const oneTrip = gtfsValidSimpleData['trips.txt'][0];
    const importData = Object.assign({}, defaultInternalImportData);
    importData.tripsToImport = [{ route_id: oneTrip.route_id, service_id: oneTrip.service_id, trip_id: oneTrip.trip_id, shape_id: oneTrip.shape_id }];

    test('Test prepare import data', async () => {
        currentData = gtfsValidSimpleData;
        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toBeGreaterThan(0);
        expect(data.length).toEqual(currentData['stop_times.txt'].filter(stopTime => stopTime.trip_id === oneTrip.trip_id).length);
    });

    test('Test prepare stop time data', async () => {
        currentData = gtfsValidSimpleData;
        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        const shapeData = StopTimeImporter.groupAndSortByTripId(data);
        expect(Object.keys(shapeData).length).toEqual(1);
    });

});

describe('GTFS Stop time import preparation, with times to interpolate', () => {
    
    test('Test prepare and sort stop times, with times only at beginning and end', async () => {
        const tripIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: tripIdToImport, shape_id: uuidV4() }];

        const startStopTime = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '1', arrival_time: '12:20', departure_time: '12:20' };
        const stInterpolate1 = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '2' };
        const stInterpolate2 = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '3' };
        const endStopTime = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '4', arrival_time: '12:50' };
        currentData = {
            'stop_times.txt': [ startStopTime, stInterpolate2, stInterpolate1, endStopTime ]
        };

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(4);

        const stopTimeData = StopTimeImporter.groupAndSortByTripId(data);
        const orderedStopTimes = stopTimeData[tripIdToImport];
        expect(orderedStopTimes.length).toEqual(4);

        expect(orderedStopTimes[1].arrivalTimeSeconds).toEqual(12 * 3600 + 30 * 60);
        expect(orderedStopTimes[1].departureTimeSeconds).toEqual(12 * 3600 + 30 * 60);
        expect(orderedStopTimes[2].arrivalTimeSeconds).toEqual(12 * 3600 + 40 * 60);
        expect(orderedStopTimes[2].departureTimeSeconds).toEqual(12 * 3600 + 40 * 60);
    });

    test('Test prepare and stop stop times, with many times to interpolate', async () => {
        const tripIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: tripIdToImport, shape_id: uuidV4() }];

        const startStopTime = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '1', arrival_time: '12:20', departure_time: '12:20' };
        const stInterpolate1 = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '2' };
        const stInterpolate2 = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '3' };
        const refStopTime = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '4', arrival_time: '12:50', departure_time: '12:55' };
        const stInterpolate3 = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '5' };
        const endStopTime = { trip_id: tripIdToImport, stop_id: uuidV4(), stop_sequence: '6', arrival_time: '13:25' };
        currentData = {
            'stop_times.txt': [ startStopTime, stInterpolate2, stInterpolate1, endStopTime, refStopTime, stInterpolate3 ]
        };

        const importer = new StopTimeImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(6);

        const stopTimeData = StopTimeImporter.groupAndSortByTripId(data);
        const orderedStopTimes = stopTimeData[tripIdToImport];
        expect(orderedStopTimes.length).toEqual(6);

        // Validate interpolated times for first section
        expect(orderedStopTimes[1].arrivalTimeSeconds).toEqual(12 * 3600 + 30 * 60);
        expect(orderedStopTimes[1].departureTimeSeconds).toEqual(12 * 3600 + 30 * 60);
        expect(orderedStopTimes[2].arrivalTimeSeconds).toEqual(12 * 3600 + 40 * 60);
        expect(orderedStopTimes[2].departureTimeSeconds).toEqual(12 * 3600 + 40 * 60);
        // Time reference at position 3
        expect(orderedStopTimes[3].arrivalTimeSeconds).toEqual(12 * 3600 + 50 * 60);
        expect(orderedStopTimes[3].departureTimeSeconds).toEqual(12 * 3600 + 55 * 60);
        // Validate interpolated times for second section
        expect(orderedStopTimes[4].arrivalTimeSeconds).toEqual(13 * 3600 + 10 * 60);
        expect(orderedStopTimes[4].departureTimeSeconds).toEqual(13 * 3600 + 10 * 60);
        expect(orderedStopTimes[5].arrivalTimeSeconds).toEqual(13 * 3600 + 25 * 60);
        expect(orderedStopTimes[5].departureTimeSeconds).toEqual(13 * 3600 + 25 * 60);
    });

});
