/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import each from 'jest-each';
import _cloneDeep from 'lodash/cloneDeep';
import Line from 'transition-common/lib/services/line/Line';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import { StopTimeImportData } from '../GtfsImportTypes';
import { defaultInternalImportData, offsetStopTimes } from './GtfsImportData.test';
import ScheduleImporter from '../ScheduleImporter';
import linesDbQueries from '../../../models/db/transitLines.db.queries';
import schedulesDbQueries from '../../../models/db/transitSchedules.db.queries';
// Add a simple 2 periods group, for easier testing
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import { secondsSinceMidnightToTimeStr, timeStrToSecondsSinceMidnight } from 'chaire-lib-common/lib/utils/DateTimeUtils';

const testPeriodGroupShortname = 'test';
const testPeriod = { 
    name: { en: 'test'}, 
    periods: [
        { shortname: 'morning', name: { en: 'morning' }, startAtHour: 0, endAtHour: 12 },
        { shortname: 'afternoon', name: { en: 'afternoon' }, startAtHour: 12, endAtHour: 24 }
    ]
}
Preferences.set('transit.periods', { [testPeriodGroupShortname]: testPeriod });

const objectToCacheMock = jest.fn();
jest.mock('../../../models/db/transitLines.db.queries');
jest.mock('../../../models/db/transitSchedules.db.queries');
jest.mock('../../../models/capnpCache/transitLines.cache.queries', () => ({
    objectToCache: (line: Line) => objectToCacheMock(line)
}));

describe('Test trip preparation', () => {

    const importData = Object.assign({}, defaultInternalImportData);
    const route_id = uuidV4();
    const service_id = uuidV4();
    const sampleTripFromGtfs = { trip_id: uuidV4(), route_id, service_id };
    const sampleStopTimes = [{
        trip_id: sampleTripFromGtfs.trip_id,
        arrival_time: '06:00:00',
        arrivalTimeSeconds: 21600,
        departure_time: '06:00:30',
        departureTimeSeconds: 21630,
        stop_id: uuidV4(),
        stop_sequence: 1
    },
    {
        trip_id: sampleTripFromGtfs.trip_id,
        departure_time: '06:06',
        departureTimeSeconds: 21960,
        arrival_time: '06:05:20',
        arrivalTimeSeconds: 21920,
        stop_id: uuidV4(),
        stop_sequence: 30
    },
    {
        trip_id: sampleTripFromGtfs.trip_id,
        departure_time: '06:11',
        departureTimeSeconds: 22260,
        arrival_time: '06:10:00',
        arrivalTimeSeconds: 22200,
        stop_id: uuidV4(),
        stop_sequence: 50
    }];
    const sampleStopTimesByTripId: StopTimeImportData = {};
    sampleStopTimesByTripId[sampleTripFromGtfs.trip_id] = sampleStopTimes;

    test('One trip, with only stop_times', () => {
        importData.stopTimesByTripId = sampleStopTimesByTripId;
        importData.tripsToImport = [sampleTripFromGtfs];
        const preparedTrips = ScheduleImporter.prepareTripData(importData);
        expect(Object.keys(preparedTrips).length).toEqual(1);
        const tripsForLine = preparedTrips[route_id];
        expect(tripsForLine).toBeDefined();
        expect(tripsForLine.length).toEqual(1);
        const { trip, stopTimes } = tripsForLine[0];
        expect(trip).toEqual(sampleTripFromGtfs);
        expect(stopTimes).toEqual([sampleStopTimes[0], sampleStopTimes[1], sampleStopTimes[2]]);
    });

    test('One trip, with stop times and frequencies', () => {
        // Stop times for cases with frequencies should all be 0
        const testImportData = _cloneDeep(importData);
        const timeOffset = 21600;
        const testSampleStopTimes = sampleStopTimes.map(({ arrivalTimeSeconds, departureTimeSeconds, ...rest }) => ({
            ...rest,
            arrivalTimeSeconds: arrivalTimeSeconds - timeOffset,
            departureTimeSeconds: departureTimeSeconds - timeOffset
        }))
        testImportData.stopTimesByTripId = {
            [sampleTripFromGtfs.trip_id]: testSampleStopTimes
        };

        // First frequency every 12 minutes, another every 15 minutes
        const frequencies = [{
            trip_id: sampleTripFromGtfs.trip_id,
            start_time: '06:00',
            startTimeSeconds: 21600,
            end_time: '06:24',
            endTimeSeconds: 23040,
            headway_secs: 720
        },
        {
            trip_id: sampleTripFromGtfs.trip_id,
            start_time: '06:24',
            startTimeSeconds: 23040,
            end_time: '06:55:00',
            endTimeSeconds: 24900,
            headway_secs: 900
        }];
        testImportData.frequenciesByTripId = {};
        testImportData.frequenciesByTripId[sampleTripFromGtfs.trip_id] = frequencies;
        testImportData.tripsToImport = [sampleTripFromGtfs];
        const preparedTrips = ScheduleImporter.prepareTripData(testImportData);
        expect(Object.keys(preparedTrips).length).toEqual(1);
        const tripsForLine = preparedTrips[route_id];
        expect(tripsForLine).toBeDefined();
        console.log('trips for line', tripsForLine);
        expect(tripsForLine.length).toEqual(5);

        // All trips should be the same
        expect(tripsForLine[0].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[1].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[2].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[3].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[4].trip).toEqual(sampleTripFromGtfs);

        // First trips starts at 06:00, second at 06:12, third at 06:24, fourth at 06:39, fifth at 06:54
        // Time offset is to bring the first arrival time at 0, but the frequency starts at departure time, remove the first waiting time
        const departureTimeOffset = timeOffset - (testSampleStopTimes[0].departureTimeSeconds - testSampleStopTimes[0].arrivalTimeSeconds);
        expect(tripsForLine[0].stopTimes).toEqual([
            offsetStopTimes(testSampleStopTimes[0], departureTimeOffset),
            offsetStopTimes(testSampleStopTimes[1], departureTimeOffset),
            offsetStopTimes(testSampleStopTimes[2], departureTimeOffset)
        ]);
        expect(tripsForLine[1].stopTimes).toEqual([
            offsetStopTimes(testSampleStopTimes[0], departureTimeOffset + 720), 
            offsetStopTimes(testSampleStopTimes[1], departureTimeOffset + 720), 
            offsetStopTimes(testSampleStopTimes[2], departureTimeOffset + 720)
        ]);
        expect(tripsForLine[2].stopTimes).toEqual([
            offsetStopTimes(testSampleStopTimes[0], departureTimeOffset + 720*2), 
            offsetStopTimes(testSampleStopTimes[1], departureTimeOffset + 720*2), 
            offsetStopTimes(testSampleStopTimes[2], departureTimeOffset + 720*2)
        ]);
        expect(tripsForLine[3].stopTimes).toEqual([
            offsetStopTimes(testSampleStopTimes[0], departureTimeOffset + 720*2 + 900), 
            offsetStopTimes(testSampleStopTimes[1], departureTimeOffset + 720*2 + 900), 
            offsetStopTimes(testSampleStopTimes[2], departureTimeOffset + 720*2 + 900)
        ]);
        expect(tripsForLine[4].stopTimes).toEqual([
            offsetStopTimes(testSampleStopTimes[0], departureTimeOffset + 720*2 + 900*2), 
            offsetStopTimes(testSampleStopTimes[1], departureTimeOffset + 720*2 + 900*2), 
            offsetStopTimes(testSampleStopTimes[2], departureTimeOffset + 720*2 + 900*2)
        ]);
    });

    test('One line, multiple trips, mixed stop times and frequencies', () => {
        importData.stopTimesByTripId = Object.assign({}, sampleStopTimesByTripId);
        // A frequency every 15 minutes for 30 minutes, will test boundaries
        const frequencies = [{
            trip_id: sampleTripFromGtfs.trip_id,
            start_time: '06:00',
            startTimeSeconds: 21600,
            end_time: '06:31',
            endTimeSeconds: 23460,
            headway_secs: 900
        }];
        importData.frequenciesByTripId = {};
        importData.frequenciesByTripId[sampleTripFromGtfs.trip_id] = frequencies;
        // Add a trip with stop times at 06:10
        const otherTrip = { trip_id: uuidV4(), route_id, service_id };
        const otherTripStopTimes = sampleStopTimes.map(stopTime => {
            const newStopTime = offsetStopTimes(stopTime, 600);
            newStopTime.trip_id = otherTrip.trip_id;
            return newStopTime;
        });
        importData.stopTimesByTripId[otherTrip.trip_id] = otherTripStopTimes
        importData.tripsToImport = [sampleTripFromGtfs, otherTrip];
        const preparedTrips = ScheduleImporter.prepareTripData(importData);
        expect(Object.keys(preparedTrips).length).toEqual(1);
        const tripsForLine = preparedTrips[route_id];
        expect(tripsForLine).toBeDefined();
        expect(tripsForLine.length).toEqual(4);

        // Trips should be sorted by time
        expect(tripsForLine[0].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[1].trip).toEqual(otherTrip);
        expect(tripsForLine[2].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[3].trip).toEqual(sampleTripFromGtfs);

        // First trips starts at 06:00, second at 06:10, third at 06:15, fourth at 06:30
        // Time offset is to bring the first arrival time at 0, but the frequency starts at departure time, remove the first waiting time
        const departureTimeOffset = frequencies[0].startTimeSeconds - sampleStopTimes[0].departureTimeSeconds;
        expect(tripsForLine[0].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], departureTimeOffset),
            offsetStopTimes(sampleStopTimes[1], departureTimeOffset),
            offsetStopTimes(sampleStopTimes[2], departureTimeOffset)
        ]);
        expect(tripsForLine[1].stopTimes).toEqual([otherTripStopTimes[0], otherTripStopTimes[1], otherTripStopTimes[2]]);
        expect(tripsForLine[2].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], departureTimeOffset + 900), 
            offsetStopTimes(sampleStopTimes[1], departureTimeOffset + 900), 
            offsetStopTimes(sampleStopTimes[2], departureTimeOffset + 900)
        ]);
        expect(tripsForLine[3].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], departureTimeOffset + 900*2), 
            offsetStopTimes(sampleStopTimes[1], departureTimeOffset + 900*2), 
            offsetStopTimes(sampleStopTimes[2], departureTimeOffset + 900*2)
        ]);
    });

    test('Multiple lines, multiple simple trips', () => {
        const secondRouteId = uuidV4();
        // Use test's main data for first trip and stop times
        
        importData.stopTimesByTripId = Object.assign({}, sampleStopTimesByTripId);
        const trips = [sampleTripFromGtfs];

        // Add a trip for the same route, with different stop times
        const otherTrip = { trip_id: uuidV4(), route_id, service_id };
        trips.push(otherTrip);
        importData.stopTimesByTripId[otherTrip.trip_id] = sampleStopTimes.map(stopTime => {
            const newStopTime = offsetStopTimes(stopTime, 600);
            newStopTime.trip_id = otherTrip.trip_id;
            return newStopTime;
        });

        // Add a trip for another route
        const line2Trip1 = { trip_id: uuidV4(), route_id: secondRouteId, service_id };
        trips.push(line2Trip1);
        importData.stopTimesByTripId[line2Trip1.trip_id] = sampleStopTimes.map(stopTime => {
            const newStopTime = offsetStopTimes(stopTime, 800);
            newStopTime.trip_id = line2Trip1.trip_id;
            return newStopTime;
        });

        // Add a second trip for another route
        const line2Trip2 = { trip_id: uuidV4(), route_id: secondRouteId, service_id };
        trips.push(line2Trip2);
        importData.stopTimesByTripId[line2Trip2.trip_id] = sampleStopTimes.map(stopTime => {
            const newStopTime = offsetStopTimes(stopTime, 900);
            newStopTime.trip_id = line2Trip2.trip_id;
            return newStopTime;
        });

        importData.frequenciesByTripId = {};
        importData.tripsToImport = trips;
        
        // Prepare data for those 4 trips
        const preparedTrips = ScheduleImporter.prepareTripData(importData);
        expect(Object.keys(preparedTrips).length).toEqual(2);
        const tripsForLine1 = preparedTrips[route_id];
        expect(tripsForLine1).toBeDefined();
        expect(tripsForLine1.length).toEqual(2);

        const tripsForLine2 = preparedTrips[secondRouteId];
        expect(tripsForLine2).toBeDefined();
        expect(tripsForLine2.length).toEqual(2);  
    });

    test('No stop times in import data', () => {
        importData.stopTimesByTripId = {};
        importData.tripsToImport = [sampleTripFromGtfs];
        const preparedTrips = ScheduleImporter.prepareTripData(importData);
        expect(Object.keys(preparedTrips).length).toEqual(0);
    });

    test('No stop times for trips', () => {
        importData.stopTimesByTripId = sampleStopTimesByTripId;
        const tripWithNoTimes = { trip_id: uuidV4(), route_id, service_id };
        importData.tripsToImport = [tripWithNoTimes];
        const preparedTrips = ScheduleImporter.prepareTripData(importData);
        expect(Object.keys(preparedTrips).length).toEqual(0);
    });
});

describe('Generate schedules for lines', () => {
    Line.prototype.refreshSchedules = jest.fn();
    
    const importData = Object.assign({}, defaultInternalImportData);
    const routeId = uuidV4();
    const gtfsServiceId = uuidV4();
    importData.lineIdsByRouteGtfsId[routeId] = uuidV4();
    importData.serviceIdsByGtfsId[gtfsServiceId] = uuidV4();
    let line: Line;
    let lineCollection: LineCollection;
    const collectionManager = new CollectionManager(null);
    importData.periodsGroupShortname = testPeriodGroupShortname;
    importData.periodsGroup = testPeriod;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset line to its original state
        line = new Line({id: importData.lineIdsByRouteGtfsId[routeId], mode: 'metro', category: 'A', agency_id: uuidV4() }, false);
        lineCollection = new LineCollection([line], {});
        collectionManager.set('lines', lineCollection);
    });
    
    test('One line, simple trips, second with various pick_up/drop', async () => {
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        }
        tripsByRouteId[routeId] = [
            baseTripAndStopTimes,
            { trip: baseTripAndStopTimes.trip, stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36600, departureTimeSeconds: 36600 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36690, departureTimeSeconds: 36700, drop_off_type: 1, pickup_type: 1 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36780, departureTimeSeconds: 36800, drop_off_type: 2, pickup_type: 2 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36900, departureTimeSeconds: 36900 }
            ]}
        ];
        importData.pathIdsByTripId = {};
        const pathId = uuidV4();
        importData.pathIdsByTripId[tripId] = pathId;
    
        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        // Compare resulting schedule
        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
        }));
        expect(scheduleAttributes.periods.length).toEqual(2);
        expect(scheduleAttributes.periods[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname,
        }));
        expect(scheduleAttributes.periods[0].trips.length).toEqual(2);
        expect(scheduleAttributes.periods[0].trips[0]).toEqual(expect.objectContaining({
            schedule_period_id: scheduleAttributes.periods[0].integer_id,
            path_id: pathId,
            node_departure_times_seconds: [baseTripAndStopTimes.stopTimes[0].departureTimeSeconds, baseTripAndStopTimes.stopTimes[1].departureTimeSeconds, baseTripAndStopTimes.stopTimes[2].departureTimeSeconds, baseTripAndStopTimes.stopTimes[3].departureTimeSeconds],
            node_arrival_times_seconds: [baseTripAndStopTimes.stopTimes[0].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[1].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[2].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds],
            departure_time_seconds: baseTripAndStopTimes.stopTimes[0].departureTimeSeconds,
            arrival_time_seconds: baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds,
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
        }));
        expect(scheduleAttributes.periods[0].trips[1]).toEqual(expect.objectContaining({
            schedule_period_id: scheduleAttributes.periods[0].integer_id,
            path_id: pathId,
            node_departure_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].departureTimeSeconds],
            node_arrival_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds],
            departure_time_seconds: tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds,
            arrival_time_seconds: tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds,
            nodes_can_board: [true, false, true, false],
            nodes_can_unboard: [false, false, true, true],
        }));
        expect(scheduleAttributes.periods[1]).toEqual(expect.objectContaining({
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
            trips: []
        }));

    });

    test('One line, trips for multiple periods, including outside period range', async() => {
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        }
        // Third trip is not in a period of the period group, it will be added to last period
        tripsByRouteId[routeId] = [
            baseTripAndStopTimes,
            { trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 10000))},
            { trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 60000))}
        ];
        importData.pathIdsByTripId = {};
        const pathId = uuidV4();
        importData.pathIdsByTripId[tripId] = pathId;
    
        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname
        }));
        expect(scheduleAttributes.periods.length).toEqual(2);
        // Check first period
        expect(scheduleAttributes.periods[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname
        }));
        expect(scheduleAttributes.periods[0].trips.length).toEqual(1);
        expect(scheduleAttributes.periods[0].trips[0]).toEqual(expect.objectContaining({
            schedule_period_id: scheduleAttributes.periods[0].integer_id,
            path_id: pathId,
            node_departure_times_seconds: [baseTripAndStopTimes.stopTimes[0].departureTimeSeconds, baseTripAndStopTimes.stopTimes[1].departureTimeSeconds, baseTripAndStopTimes.stopTimes[2].departureTimeSeconds, baseTripAndStopTimes.stopTimes[3].departureTimeSeconds],
            node_arrival_times_seconds: [baseTripAndStopTimes.stopTimes[0].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[1].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[2].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds],
            departure_time_seconds: baseTripAndStopTimes.stopTimes[0].departureTimeSeconds,
            arrival_time_seconds: baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds,
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
        }));

        // Check second period
        expect(scheduleAttributes.periods[1]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
        }));
        expect(scheduleAttributes.periods[1].trips.length).toEqual(2);
        expect(scheduleAttributes.periods[1].trips[0]).toEqual(expect.objectContaining({
            schedule_period_id: scheduleAttributes.periods[1].integer_id,
            path_id: pathId,
            node_departure_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].departureTimeSeconds],
            node_arrival_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds],
            departure_time_seconds: tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds,
            arrival_time_seconds: tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds,
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
        }));
        expect(scheduleAttributes.periods[1].trips[1]).toEqual(expect.objectContaining({
            schedule_period_id: scheduleAttributes.periods[1].integer_id,
            path_id: pathId,
            node_departure_times_seconds: [tripsByRouteId[routeId][2].stopTimes[0].departureTimeSeconds, tripsByRouteId[routeId][2].stopTimes[1].departureTimeSeconds, tripsByRouteId[routeId][2].stopTimes[2].departureTimeSeconds, tripsByRouteId[routeId][2].stopTimes[3].departureTimeSeconds],
            node_arrival_times_seconds: [tripsByRouteId[routeId][2].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[routeId][2].stopTimes[1].arrivalTimeSeconds, tripsByRouteId[routeId][2].stopTimes[2].arrivalTimeSeconds, tripsByRouteId[routeId][2].stopTimes[3].arrivalTimeSeconds],
            departure_time_seconds: tripsByRouteId[routeId][2].stopTimes[0].departureTimeSeconds,
            arrival_time_seconds: tripsByRouteId[routeId][2].stopTimes[3].arrivalTimeSeconds,
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
        }));
    });

    test('One line, multiple services', async() => {
        const secondGtfsService = 'secondService';
        const secondServiceId = uuidV4();
        importData.serviceIdsByGtfsId[secondGtfsService] = secondServiceId;
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        }
        tripsByRouteId[routeId] = [
            baseTripAndStopTimes,
            { trip: Object.assign({}, baseTripAndStopTimes.trip, { service_id: secondGtfsService }), stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600))}
        ];
        importData.pathIdsByTripId = {};
        const pathId = uuidV4();
        importData.pathIdsByTripId[tripId] = pathId;
    
        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(2);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(2);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_period_id: scheduleAttributes.periods[0].integer_id,
                            path_id: pathId,
                            node_departure_times_seconds: [baseTripAndStopTimes.stopTimes[0].departureTimeSeconds, baseTripAndStopTimes.stopTimes[1].departureTimeSeconds, baseTripAndStopTimes.stopTimes[2].departureTimeSeconds, baseTripAndStopTimes.stopTimes[3].departureTimeSeconds],
                            node_arrival_times_seconds: [baseTripAndStopTimes.stopTimes[0].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[1].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[2].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds],
                            departure_time_seconds: baseTripAndStopTimes.stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds,
                            nodes_can_board: [true, true, true, false],
                            nodes_can_unboard: [false, true, true, true],
                        })
                    ],
                }),
                expect.objectContaining({
                    schedule_id: scheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[1].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[1].endAtHour,
                    period_shortname: importData.periodsGroup.periods[1].shortname,
                    trips: []
                })
            ]
        }));

        const secondScheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[secondServiceId];
        expect(secondScheduleAttributes).toBeDefined();

        expect(secondScheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: secondServiceId,
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: secondScheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_period_id: secondScheduleAttributes.periods[0].integer_id,
                            path_id: pathId,
                            node_departure_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].departureTimeSeconds],
                            node_arrival_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds],
                            departure_time_seconds: tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds,
                            nodes_can_board: [true, true, true, false],
                            nodes_can_unboard: [false, true, true, true],
                        })
                    ],
                }),
                expect.objectContaining({
                    schedule_id: secondScheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[1].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[1].endAtHour,
                    period_shortname: importData.periodsGroup.periods[1].shortname,
                    trips: []
                })
            ]
        }));
    });

    test('One line, multiple services, imported separately', async() => {
        // Import a first service to create schedules and trips
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        };
        tripsByRouteId[routeId] = [
            baseTripAndStopTimes
        ];
        const pathId = uuidV4();
        importData.pathIdsByTripId = { [tripId]: pathId };

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        let modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);

        // Import a second time for a second service, it should be combined with the other service
        const secondGtfsService = 'secondService';
        const secondServiceId = uuidV4();
        const secondImportData = Object.assign({}, importData, { serviceIdsByGtfsId: { [secondGtfsService]: secondServiceId } });
        
        tripsByRouteId[routeId] = [
            { trip: Object.assign({}, baseTripAndStopTimes.trip, { service_id: secondGtfsService }), stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, 600))}
        ];

        const result2 = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, secondImportData, collectionManager) as any;
        expect(result2.status).toEqual('success');
        expect(result2.warnings).toEqual([]);
        modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(2);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(2);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(2);

        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_period_id: scheduleAttributes.periods[0].integer_id,
                            path_id: pathId,
                            node_departure_times_seconds: [baseTripAndStopTimes.stopTimes[0].departureTimeSeconds, baseTripAndStopTimes.stopTimes[1].departureTimeSeconds, baseTripAndStopTimes.stopTimes[2].departureTimeSeconds, baseTripAndStopTimes.stopTimes[3].departureTimeSeconds],
                            node_arrival_times_seconds: [baseTripAndStopTimes.stopTimes[0].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[1].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[2].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds],
                            departure_time_seconds: baseTripAndStopTimes.stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds,
                            nodes_can_board: [true, true, true, false],
                            nodes_can_unboard: [false, true, true, true],
                        })
                    ],
                }),
                expect.objectContaining({
                    schedule_id: scheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[1].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[1].endAtHour,
                    period_shortname: importData.periodsGroup.periods[1].shortname,
                    trips: []
                })
            ]
        }));

        const secondScheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[secondServiceId];
        expect(secondScheduleAttributes).toBeDefined();

        expect(secondScheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: secondServiceId,
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: secondScheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_period_id: secondScheduleAttributes.periods[0].integer_id,
                            path_id: pathId,
                            node_departure_times_seconds: [tripsByRouteId[routeId][0].stopTimes[0].departureTimeSeconds, tripsByRouteId[routeId][0].stopTimes[1].departureTimeSeconds, tripsByRouteId[routeId][0].stopTimes[2].departureTimeSeconds, tripsByRouteId[routeId][0].stopTimes[3].departureTimeSeconds],
                            node_arrival_times_seconds: [tripsByRouteId[routeId][0].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[routeId][0].stopTimes[1].arrivalTimeSeconds, tripsByRouteId[routeId][0].stopTimes[2].arrivalTimeSeconds, tripsByRouteId[routeId][0].stopTimes[3].arrivalTimeSeconds],
                            departure_time_seconds: tripsByRouteId[routeId][0].stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: tripsByRouteId[routeId][0].stopTimes[3].arrivalTimeSeconds,
                            nodes_can_board: [true, true, true, false],
                            nodes_can_unboard: [false, true, true, true],
                        })
                    ],
                }),
                expect.objectContaining({
                    schedule_id: secondScheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[1].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[1].endAtHour,
                    period_shortname: importData.periodsGroup.periods[1].shortname,
                    trips: []
                })
            ]
        }));
    });

    test('Multiple lines, single trip per line', async() => {
        // Prepare the second line
        const expressRouteId = uuidV4();
        importData.lineIdsByRouteGtfsId[expressRouteId] = uuidV4();
        const expressLine = new Line({id: importData.lineIdsByRouteGtfsId[expressRouteId], mode: 'metro', category: 'A' }, false);
        lineCollection.add(expressLine);

        const tripIdLine1 = 'simpleTripLine1';
        const tripIdLine2 = 'simpleTripLine2';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripIdLine1, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripIdLine1, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripIdLine1, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripIdLine1, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripIdLine1, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        }
    
        tripsByRouteId[routeId] = [
            baseTripAndStopTimes
        ];
        const expressTripAndStopTimes = {
            trip: { route_id: expressRouteId, service_id: gtfsServiceId, trip_id: tripIdLine2, trip_headsign: 'Test West Express', direction_id: 0},
            stopTimes: [
                { trip_id: tripIdLine2, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripIdLine2, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        };
        tripsByRouteId[expressRouteId] = [
            expressTripAndStopTimes
        ];
        importData.pathIdsByTripId = {};
        const pathId1 = uuidV4();
        const pathId2 = uuidV4();
        importData.pathIdsByTripId[tripIdLine1] = pathId1;
        importData.pathIdsByTripId[tripIdLine2] = pathId2;

        // Do the actual test
        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        const modifiedLine2 = lineCollection.getById(importData.lineIdsByRouteGtfsId[expressRouteId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(modifiedLine2).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(2);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[expressRouteId], modifiedLine2.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(2);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_period_id: scheduleAttributes.periods[0].integer_id,
                            path_id: pathId1,
                            node_departure_times_seconds: [baseTripAndStopTimes.stopTimes[0].departureTimeSeconds, baseTripAndStopTimes.stopTimes[1].departureTimeSeconds, baseTripAndStopTimes.stopTimes[2].departureTimeSeconds, baseTripAndStopTimes.stopTimes[3].departureTimeSeconds],
                            node_arrival_times_seconds: [baseTripAndStopTimes.stopTimes[0].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[1].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[2].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds],
                            departure_time_seconds: baseTripAndStopTimes.stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds,
                            nodes_can_board: [true, true, true, false],
                            nodes_can_unboard: [false, true, true, true],
                        })
                    ],
                }),
                expect.objectContaining({
                    schedule_id: scheduleAttributes.integer_id,
                    start_at_hour: importData.periodsGroup.periods[1].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[1].endAtHour,
                    period_shortname: importData.periodsGroup.periods[1].shortname,
                    trips: []
                })
            ]
        }));

        const scheduleAttributesLine2 = modifiedLine2.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributesLine2).toBeDefined();

        expect(scheduleAttributesLine2).toEqual(expect.objectContaining({
            line_id: expressLine.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributesLine2.integer_id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_period_id: scheduleAttributesLine2.periods[0].integer_id,
                            path_id: pathId2,
                            node_departure_times_seconds: [tripsByRouteId[expressRouteId][0].stopTimes[0].departureTimeSeconds, tripsByRouteId[expressRouteId][0].stopTimes[1].departureTimeSeconds],
                            node_arrival_times_seconds: [tripsByRouteId[expressRouteId][0].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[expressRouteId][0].stopTimes[1].arrivalTimeSeconds],
                            departure_time_seconds: tripsByRouteId[expressRouteId][0].stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: tripsByRouteId[expressRouteId][0].stopTimes[1].arrivalTimeSeconds,
                            nodes_can_board: [true, false],
                            nodes_can_unboard: [false, true],
                        })
                    ],
                }),
                expect.objectContaining({
                    schedule_id: scheduleAttributesLine2.integer_id,
                    start_at_hour: importData.periodsGroup.periods[1].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[1].endAtHour,
                    period_shortname: importData.periodsGroup.periods[1].shortname,
                    trips: []
                })
            ]
        }));
    });

    each([
        ['mergeAndIgnore', false],
        ['mergeAndReplace', true]
    ]).test('One line, one service, exists, %s', async(_title: string, shouldUpdateSchedule: boolean) => {
        // Prepare a line with a schedule for the imported service already present
        const localImportData = Object.assign({}, importData);
        const serviceId = localImportData.serviceIdsByGtfsId[gtfsServiceId];
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        };
        tripsByRouteId[routeId] = [
            baseTripAndStopTimes
        ];
        const pathId = uuidV4();
        localImportData.pathIdsByTripId = { [tripId]: pathId };
        localImportData.doNotUpdateAgencies = shouldUpdateSchedule ? [] : [line.attributes.agency_id];
        line.attributes.service_ids = [serviceId];
        const previousScheduleId = uuidV4();
        line.attributes.scheduleByServiceId[serviceId] = { 
            id: previousScheduleId,
            integer_id: 4,
            line_id: line.getId(),
            service_id: serviceId,
            periods: [],
            data: {}
        }

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, localImportData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        let modifiedLine = lineCollection.getById(localImportData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        if (shouldUpdateSchedule) {
            expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
            expect(linesDbQueries.update).toHaveBeenCalledWith(localImportData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
            expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);
            expect(schedulesDbQueries.delete).toHaveBeenCalledTimes(1);
            expect(modifiedLine.getAttributes().scheduleByServiceId[serviceId].id).not.toEqual(previousScheduleId);
        } else {
            expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
            expect(schedulesDbQueries.save).not.toHaveBeenCalled();
            expect(schedulesDbQueries.delete).not.toHaveBeenCalled();
            expect(modifiedLine.getAttributes().scheduleByServiceId[serviceId].id).toEqual(previousScheduleId);
        }
    });


    test('No path for trip', async () => {
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        }
        tripsByRouteId[routeId] = [
            baseTripAndStopTimes
        ];
        importData.pathIdsByTripId = {};

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).not.toHaveBeenCalled();

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(0);
    });
    
});

describe('Generate frequency based schedules for line', () => {
    Line.prototype.refreshSchedules = jest.fn();
    Schedule.prototype.generateForPeriod = jest.fn();
    
    const importData = Object.assign({}, defaultInternalImportData);
    const routeId = uuidV4();
    const gtfsServiceId = uuidV4();
    importData.lineIdsByRouteGtfsId[routeId] = uuidV4();
    importData.serviceIdsByGtfsId[gtfsServiceId] = uuidV4();
    let line: Line;
    let lineCollection: LineCollection;
    const collectionManager = new CollectionManager(null);
    importData.periodsGroupShortname = testPeriodGroupShortname;
    importData.periodsGroup = testPeriod;
    const generateForPeriodMock = Schedule.prototype.generateForPeriod as jest.MockedFunction<typeof Schedule.prototype.generateForPeriod>;

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset line to its original state
        line = new Line({id: importData.lineIdsByRouteGtfsId[routeId], mode: 'metro', category: 'A', agency_id: uuidV4() }, false);
        lineCollection = new LineCollection([line], {});
        collectionManager.set('lines', lineCollection);
    });
    
    test('Single trip for one period', async () => {
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 36000, departureTimeSeconds: 36000 },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 36090, departureTimeSeconds: 36100 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 36180, departureTimeSeconds: 36200 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 36300, departureTimeSeconds: 36300 }
            ]
        }
        tripsByRouteId[routeId] = [ baseTripAndStopTimes ];
        importData.pathIdsByTripId = {};
        const pathId = uuidV4();
        importData.pathIdsByTripId[tripId] = pathId;

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager, true) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);
        // One period should have been generated, no trip in the other
        expect(generateForPeriodMock).toHaveBeenCalledTimes(1);
        expect(generateForPeriodMock).toHaveBeenCalledWith(testPeriod.periods[0].shortname);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        // Compare resulting schedule periods
        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
        }));
        expect(scheduleAttributes.periods.length).toEqual(2);
        expect(scheduleAttributes.periods[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname,
            custom_start_at_str: secondsSinceMidnightToTimeStr(baseTripAndStopTimes.stopTimes[0].departureTimeSeconds),
            custom_end_at_str: secondsSinceMidnightToTimeStr(baseTripAndStopTimes.stopTimes[0].departureTimeSeconds + 60),
            interval_seconds: 60,
            outbound_path_id: pathId,
            inbound_path_id: undefined
        }));
        expect(scheduleAttributes.periods[1]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
            trips: []
        }));

    });

    test('Multiple periods, one already with frequencies, one with various trips', async() => {
        const tripId = 'simpleTrip';
        const tripsByRouteId = {};

        // From 8:05 to 12:05, one trip every 15 minutes (17 trips)
        const startTimeStr = '8:05';
        const startTime = timeStrToSecondsSinceMidnight(startTimeStr) as number;
        const baseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: tripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: tripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: startTime, departureTimeSeconds: startTime },
                { trip_id: tripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: startTime + 90, departureTimeSeconds: startTime + 100 },
                { trip_id: tripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: startTime + 180, departureTimeSeconds: startTime + 200 },
                { trip_id: tripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: startTime + 300, departureTimeSeconds: startTime + 300 }
            ]
        }
        tripsByRouteId[routeId] = Array.from({ length: 17 }, (_, idx) => ({ trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, idx * 15 * 60))}));
        // Add 2 trips at 16:00 and 18:00 for the second period (should be aggregated with last frequency trip of 12:05)
        tripsByRouteId[routeId].push({ trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('16:00') as number - startTime))});
        tripsByRouteId[routeId].push({ trip: baseTripAndStopTimes.trip, stopTimes: baseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('18:00') as number - startTime))});

        // Add the path to import data
        importData.pathIdsByTripId = {};
        const pathId = uuidV4();
        importData.pathIdsByTripId[tripId] = pathId;

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager, true) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);
        expect(generateForPeriodMock).toHaveBeenCalledTimes(2);
        expect(generateForPeriodMock).toHaveBeenCalledWith(testPeriod.periods[0].shortname);
        expect(generateForPeriodMock).toHaveBeenCalledWith(testPeriod.periods[1].shortname);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        // Compare resulting schedule periods
        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
        }));
        expect(scheduleAttributes.periods.length).toEqual(2);
        expect(scheduleAttributes.periods[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname,
            custom_start_at_str: startTimeStr,
            // TODO We use custom time, even if the end time is close to period end, given the frequency. Should we?
            custom_end_at_str: '11:51',
            interval_seconds: 15 * 60,
            outbound_path_id: pathId,
            inbound_path_id: undefined
        }));
        expect(scheduleAttributes.periods[1]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
            // TODO We use custom time, even if the start time is close to period start, given the frequency. Should we?
            custom_start_at_str: '12:05',
            custom_end_at_str: '18:01',
            interval_seconds: (timeStrToSecondsSinceMidnight('18:00') as number - (timeStrToSecondsSinceMidnight('12:05') as number)) / 2,
            outbound_path_id: pathId,
            trips: []
        }));
    });

    test('2 different paths, one for each period, of different direction', async() => {
        // Prepare trips for 2 directions
        const outboundTripId = 'outboundish';
        const inboundTripId = 'inboundish';
        const tripsByRouteId = {};
        const outboundBaseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: outboundTripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: outboundTripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 0, departureTimeSeconds: 0 },
                { trip_id: outboundTripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 90, departureTimeSeconds: 100 },
                { trip_id: outboundTripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 180, departureTimeSeconds: 200 },
                { trip_id: outboundTripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 300, departureTimeSeconds: 300 }
            ]
        }
        const reverseBaseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: inboundTripId, trip_headsign: 'Test East', direction_id: 1 },
            stopTimes: [
                { trip_id: inboundTripId, stop_id: 'stop4', stop_sequence: 2, arrivalTimeSeconds: 0, departureTimeSeconds: 0 },
                { trip_id: inboundTripId, stop_id: 'stop3', stop_sequence: 3, arrivalTimeSeconds: 100, departureTimeSeconds: 120 },
                { trip_id: inboundTripId, stop_id: 'stop2', stop_sequence: 4, arrivalTimeSeconds: 200, departureTimeSeconds: 210 },
                { trip_id: inboundTripId, stop_id: 'stop1', stop_sequence: 5, arrivalTimeSeconds: 300, departureTimeSeconds: 300 }
            ]
        }
        // 3 trips in the morning: 9:00, 10:00, 11:30, 3 in the afternoon in the return direction 14:00, 15:00, 15:30
        tripsByRouteId[routeId] = [
            { trip: outboundBaseTripAndStopTimes.trip, stopTimes: outboundBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('9:00') as number))},
            { trip: outboundBaseTripAndStopTimes.trip, stopTimes: outboundBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('10:00') as number))},
            { trip: outboundBaseTripAndStopTimes.trip, stopTimes: outboundBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('11:30') as number))},
            { trip: reverseBaseTripAndStopTimes.trip, stopTimes: reverseBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('14:00') as number))},
            { trip: reverseBaseTripAndStopTimes.trip, stopTimes: reverseBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('15:00') as number))},
            { trip: reverseBaseTripAndStopTimes.trip, stopTimes: reverseBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, timeStrToSecondsSinceMidnight('15:30') as number))},
        ];
        importData.pathIdsByTripId = {};
        const outboundPathId = uuidV4();
        const inboundPathId = uuidV4();
        importData.pathIdsByTripId[outboundTripId] = outboundPathId;
        importData.pathIdsByTripId[inboundTripId] = inboundPathId;

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager, true) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);
        expect(generateForPeriodMock).toHaveBeenCalledTimes(2);
        expect(generateForPeriodMock).toHaveBeenCalledWith(testPeriod.periods[0].shortname);
        expect(generateForPeriodMock).toHaveBeenCalledWith(testPeriod.periods[1].shortname);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        // Compare resulting schedule periods
        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
        }));
        expect(scheduleAttributes.periods.length).toEqual(2);
        expect(scheduleAttributes.periods[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname,
            custom_start_at_str: '9:00',
            // TODO We use custom time, even if the end time is close to period end, given the frequency. Should we?
            custom_end_at_str: '11:31',
            interval_seconds: (timeStrToSecondsSinceMidnight('11:30') as number - (timeStrToSecondsSinceMidnight('9:00') as number)) / 2,
            outbound_path_id: outboundPathId,
            inbound_path_id: undefined
        }));
        expect(scheduleAttributes.periods[1]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
            custom_start_at_str: '14:00',
            custom_end_at_str: '15:31',
            interval_seconds: (timeStrToSecondsSinceMidnight('15:30') as number - (timeStrToSecondsSinceMidnight('14:00') as number)) / 2,
            outbound_path_id: inboundPathId,
            trips: []
        }));
    });

    test('Multiple paths and directions', async() => {
        // Prepare trips for 2 directions
        const outboundTripId = 'outboundish';
        const inboundTripId = 'inboundish';
        const tripsByRouteId = {};
        const outboundBaseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: outboundTripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: outboundTripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 0, departureTimeSeconds: 0 },
                { trip_id: outboundTripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 90, departureTimeSeconds: 100 },
                { trip_id: outboundTripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 180, departureTimeSeconds: 200 },
                { trip_id: outboundTripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 300, departureTimeSeconds: 300 }
            ]
        }
        const reverseBaseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: inboundTripId, trip_headsign: 'Test East', direction_id: 1 },
            stopTimes: [
                { trip_id: inboundTripId, stop_id: 'stop4', stop_sequence: 2, arrivalTimeSeconds: 0, departureTimeSeconds: 0 },
                { trip_id: inboundTripId, stop_id: 'stop3', stop_sequence: 3, arrivalTimeSeconds: 100, departureTimeSeconds: 120 },
                { trip_id: inboundTripId, stop_id: 'stop2', stop_sequence: 4, arrivalTimeSeconds: 200, departureTimeSeconds: 210 },
                { trip_id: inboundTripId, stop_id: 'stop1', stop_sequence: 5, arrivalTimeSeconds: 300, departureTimeSeconds: 300 }
            ]
        }
        // outbound: trips every 15 minutes from period start to end (0:05 to 11:50, 48 trips)
        // inbound: trips every 30 minutes from start to end (0:10 to 11:40, 24)
        const outboundStart = timeStrToSecondsSinceMidnight('0:05') as number;
        const inboundStart = timeStrToSecondsSinceMidnight('0:10') as number;
        tripsByRouteId[routeId] = Array.from({ length: 48 }, (_, idx) => ({ trip: outboundBaseTripAndStopTimes.trip, stopTimes: outboundBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, outboundStart + idx * 15 * 60))}));
        tripsByRouteId[routeId].push(...Array.from({ length: 24 }, (_, idx) => ({ trip: reverseBaseTripAndStopTimes.trip, stopTimes: reverseBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, inboundStart + idx * 30 * 60))})))
        importData.pathIdsByTripId = {};
        const outboundPathId = uuidV4();
        const inboundPathId = uuidV4();
        importData.pathIdsByTripId[outboundTripId] = outboundPathId;
        importData.pathIdsByTripId[inboundTripId] = inboundPathId;

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager, true) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);
        expect(generateForPeriodMock).toHaveBeenCalledTimes(1);
        expect(generateForPeriodMock).toHaveBeenCalledWith(testPeriod.periods[0].shortname);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        // Compare resulting schedule periods
        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
        }));
        expect(scheduleAttributes.periods.length).toEqual(2);
        expect(scheduleAttributes.periods[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname,
            interval_seconds: (15 * 60 + 30 * 60) / 2,
            outbound_path_id: outboundPathId,
            inbound_path_id: inboundPathId
        }));
        expect(scheduleAttributes.periods[1]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
            trips: []
        }));
    });

    test('Multiple shapes for path', async() => {
        // Prepare trips for 2 directions
        const outboundTripId = 'outboundish';
        const inboundTripId = 'inboundish';
        const inboundTripAltId = 'inboundish alt';
        const tripsByRouteId = {};
        const outboundBaseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: outboundTripId, trip_headsign: 'Test West', direction_id: 0 },
            stopTimes: [
                { trip_id: outboundTripId, stop_id: 'stop1', stop_sequence: 2, arrivalTimeSeconds: 0, departureTimeSeconds: 0 },
                { trip_id: outboundTripId, stop_id: 'stop2', stop_sequence: 3, arrivalTimeSeconds: 90, departureTimeSeconds: 100 },
                { trip_id: outboundTripId, stop_id: 'stop3', stop_sequence: 4, arrivalTimeSeconds: 180, departureTimeSeconds: 200 },
                { trip_id: outboundTripId, stop_id: 'stop4', stop_sequence: 5, arrivalTimeSeconds: 300, departureTimeSeconds: 300 }
            ]
        };
        const reverseBaseTripAndStopTimes = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: inboundTripId, trip_headsign: 'Test East', direction_id: 1 },
            stopTimes: [
                { trip_id: inboundTripId, stop_id: 'stop4', stop_sequence: 2, arrivalTimeSeconds: 0, departureTimeSeconds: 0 },
                { trip_id: inboundTripId, stop_id: 'stop3', stop_sequence: 3, arrivalTimeSeconds: 100, departureTimeSeconds: 120 },
                { trip_id: inboundTripId, stop_id: 'stop2', stop_sequence: 4, arrivalTimeSeconds: 200, departureTimeSeconds: 210 },
                { trip_id: inboundTripId, stop_id: 'stop1', stop_sequence: 5, arrivalTimeSeconds: 300, departureTimeSeconds: 300 }
            ]
        };
        const reverseBaseTripAndStopTimesAlt = {
            trip: { route_id: routeId, service_id: gtfsServiceId, trip_id: inboundTripAltId, trip_headsign: 'Test East', direction_id: 1 },
            stopTimes: [
                { trip_id: inboundTripAltId, stop_id: 'stop4', stop_sequence: 2, arrivalTimeSeconds: 0, departureTimeSeconds: 0 },
                { trip_id: inboundTripAltId, stop_id: 'stop3', stop_sequence: 3, arrivalTimeSeconds: 100, departureTimeSeconds: 120 },
                { trip_id: inboundTripAltId, stop_id: 'stop2', stop_sequence: 4, arrivalTimeSeconds: 200, departureTimeSeconds: 210 },
                { trip_id: inboundTripAltId, stop_id: 'stop1', stop_sequence: 5, arrivalTimeSeconds: 300, departureTimeSeconds: 320 },
                { trip_id: inboundTripAltId, stop_id: 'stop0', stop_sequence: 6, arrivalTimeSeconds: 400, departureTimeSeconds: 450 }
            ]
        }
        // outbound: trips every 30 minutes from period start to end (0:05 to 11:35, 24 trips)
        // inbound: trips every 15 minutes from start to end (0:10 to 11:40, 48), every 4 trips is the alternative
        const outboundStart = timeStrToSecondsSinceMidnight('0:05') as number;
        const inboundStart = timeStrToSecondsSinceMidnight('0:10') as number;
        tripsByRouteId[routeId] = Array.from({ length: 24 }, (_, idx) => ({ trip: outboundBaseTripAndStopTimes.trip, stopTimes: outboundBaseTripAndStopTimes.stopTimes.map(stopTime => offsetStopTimes(stopTime, outboundStart + idx * 30 * 60))}));
        tripsByRouteId[routeId].push(...Array.from({ length: 48 }, (_, idx) => {
            const baseTrip = idx % 4 === 0 ? reverseBaseTripAndStopTimesAlt : reverseBaseTripAndStopTimes;
            return { trip: baseTrip.trip, stopTimes: baseTrip.stopTimes.map(stopTime => offsetStopTimes(stopTime, inboundStart + idx * 15 * 60))}
        }));
        importData.pathIdsByTripId = {};
        const outboundPathId = uuidV4();
        const inboundPathId = uuidV4();
        const inboundPathAlt = uuidV4();
        importData.pathIdsByTripId[outboundTripId] = outboundPathId;
        importData.pathIdsByTripId[inboundTripId] = inboundPathId;
        importData.pathIdsByTripId[inboundTripAltId] = inboundPathAlt;

        const result = await ScheduleImporter.generateAndImportSchedules(tripsByRouteId, importData, collectionManager, true) as any;
        expect(result.status).toEqual('success');
        expect(result.warnings).toEqual([]);
        const modifiedLine = lineCollection.getById(importData.lineIdsByRouteGtfsId[routeId]) as Line;
        expect(modifiedLine).toBeDefined();
        expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
        expect(linesDbQueries.update).toHaveBeenCalledWith(importData.lineIdsByRouteGtfsId[routeId], modifiedLine.getAttributes(), expect.anything());
        expect(schedulesDbQueries.save).toHaveBeenCalledTimes(1);
        expect(generateForPeriodMock).toHaveBeenCalledTimes(1);
        expect(generateForPeriodMock).toHaveBeenCalledWith(testPeriod.periods[0].shortname);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        // Compare resulting schedule periods
        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
        }));
        expect(scheduleAttributes.periods.length).toEqual(2);
        expect(scheduleAttributes.periods[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname,
            interval_seconds: (15 * 60 + 30 * 60) / 2,
            outbound_path_id: outboundPathId,
            inbound_path_id: inboundPathId
        }));
        expect(scheduleAttributes.periods[1]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.integer_id,
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
            trips: []
        }));
    });

});