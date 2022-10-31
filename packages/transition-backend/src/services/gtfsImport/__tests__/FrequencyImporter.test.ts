/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';

import { gtfsValidSimpleData, gtfsValidSimpleDataWithFrequencies, defaultInternalImportData } from './GtfsImportData.test';
import FrequencyImporter from '../FrequencyImporter';
import TripImporter from '../TripImporter';

let currentData: any = gtfsValidSimpleDataWithFrequencies;

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

describe('GTFS Frequencies import preparation', () => {
    test('Test prepare frequency data, nothing imported', async () => {
        currentData = gtfsValidSimpleDataWithFrequencies;

        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(0);
    });

    test('Test invalid frequency data', async() => {
        const tripIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: tripIdToImport, shape_id: uuidV4() }];
        const badHeadway1 = { trip_id: tripIdToImport, start_time: '12:01', end_time: '12:01', headway_secs: '-5', exact_times: '0' };
        const badHeadway2 = { trip_id: tripIdToImport, start_time: '12:01', end_time: '12:01', headway_secs: 'badnumber', exact_times: '0' };
        const badStartTime1 = { trip_id: tripIdToImport, start_time: '', end_time: '12:01', headway_secs: '1800', exact_times: '0' };
        const badStartTime2 = { trip_id: tripIdToImport, start_time: 'notatime', end_time: '12:01', headway_secs: '1800', exact_times: '0' };
        const badEndTime1 = { trip_id: tripIdToImport, start_time: '12:01', end_time: '', headway_secs: '1800', exact_times: '0' };
        const badEndTime2 = { trip_id: tripIdToImport, start_time: '12:01', end_time: 'notatime', headway_secs: '1800', exact_times: '0' };
        const badExactTime1 = { trip_id: tripIdToImport, start_time: '12:01', end_time: '12:01', headway_secs: '1800', exact_times: '10' };
        const badExactTime2 = { trip_id: tripIdToImport, start_time: '12:01', end_time: '12:01', headway_secs: '1800', exact_times: 'badtype' };
        currentData = {
            'frequencies.txt': [ badHeadway1, badHeadway2, badStartTime1, badStartTime2, badEndTime1, badEndTime2, badExactTime1, badExactTime2 ]
        };

        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(2);
        expect(data[0]).toEqual(expect.objectContaining({ exact_times: 0 }));
        expect(data[1]).toEqual(expect.objectContaining({ exact_times: 0 }));
    });

    test('Test field conversions', async() => {
        const tripIdToImport = uuidV4();
        const importData = Object.assign({}, defaultInternalImportData);
        importData.tripsToImport = [{ route_id: uuidV4(), service_id: uuidV4(), trip_id: tripIdToImport, shape_id: uuidV4() }];

        const field = { trip_id: tripIdToImport, start_time: '01:00', end_time: '01:10', headway_secs: '60', exact_times: '0' };
        currentData = {
            'frequencies.txt': [ field ]
        };

        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(1);
        expect(data[0]).toEqual({
            trip_id: tripIdToImport,
            start_time: field.start_time,
            end_time: field.end_time,
            headway_secs: 60,
            exact_times: 0,
            startTimeSeconds: 3600,
            endTimeSeconds: 4200
        });
    });
});

describe('GTFS frequencies import preparation, using all base trips', () => {
    const routeIdsByGtfsIds = {};
    const serviceIdsByGtfsIds = {};
    gtfsValidSimpleDataWithFrequencies['trips.txt'].forEach(trip => {
        routeIdsByGtfsIds[trip.route_id] = uuidV4();
        serviceIdsByGtfsIds[trip.service_id] = uuidV4();
    });
    const importData = Object.assign({}, defaultInternalImportData, { lineIdsByRouteGtfsId: routeIdsByGtfsIds, serviceIdsByGtfsId: serviceIdsByGtfsIds });
    const tripImporter = new TripImporter({ directoryPath: '' });

    test('Test prepare import data', async () => {
        currentData = gtfsValidSimpleDataWithFrequencies;
        const tripData = await tripImporter.prepareImportData(importData);
        importData.tripsToImport = tripData;

        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(currentData['frequencies.txt'].length);
    });

    test('Test prepare frequencies data', async () => {
        currentData = gtfsValidSimpleDataWithFrequencies;
        const tripData = await tripImporter.prepareImportData(importData);
        importData.tripsToImport = tripData;

        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        const frequencies = FrequencyImporter.groupAndSortByTripId(data);
        expect(Object.keys(frequencies).length).toEqual(tripData.length);
        const keys = Object.keys(frequencies);
        for (let i = 0; i < keys.length; i++) {
            const frequenciesByTrip = frequencies[keys[i]];
            for (let freqIndex = 1; freqIndex < frequenciesByTrip.length; freqIndex++) {
                expect(frequenciesByTrip[freqIndex-1].startTimeSeconds).toBeLessThan(frequenciesByTrip[freqIndex].startTimeSeconds);
            }
        }
    });

});

describe('GTFS frequencies import preparation, one trip', () => {
    const oneTrip = gtfsValidSimpleDataWithFrequencies['trips.txt'][0];
    const importData = Object.assign({}, defaultInternalImportData);
    importData.tripsToImport = [{ route_id: oneTrip.route_id, service_id: oneTrip.service_id, trip_id: oneTrip.trip_id, shape_id: oneTrip.shape_id }];

    test('Test prepare import data', async () => {
        currentData = gtfsValidSimpleDataWithFrequencies;
        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toBeGreaterThan(0);
        expect(data.length).toEqual(currentData['frequencies.txt'].filter(freq => freq.trip_id === oneTrip.trip_id).length);
    });

    test('Test prepare shape data', async () => {
        currentData = gtfsValidSimpleDataWithFrequencies;
        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        const shapeData = FrequencyImporter.groupAndSortByTripId(data);
        expect(Object.keys(shapeData).length).toEqual(1);
    });

});

describe('GTFS frequencies import preparation, GTFS with no frequencies', () => {
    const oneTrip = gtfsValidSimpleData['trips.txt'][0];
    const importData = Object.assign({}, defaultInternalImportData);
    importData.tripsToImport = [{ route_id: oneTrip.route_id, service_id: oneTrip.service_id, trip_id: oneTrip.trip_id, shape_id: oneTrip.shape_id }];

    test('Test prepare import data', async () => {
        currentData = gtfsValidSimpleData;
        const importer = new FrequencyImporter({ directoryPath: '' });
        const data = await importer.prepareImportData(importData);
        expect(data.length).toEqual(0);
        const shapeData = FrequencyImporter.groupAndSortByTripId(data);
        expect(shapeData).toEqual({});
    });

});