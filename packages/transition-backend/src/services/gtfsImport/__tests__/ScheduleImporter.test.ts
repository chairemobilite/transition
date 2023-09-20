/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import each from 'jest-each';
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
        importData.stopTimesByTripId = sampleStopTimesByTripId;

        // First frequency every 12 minutes, another every 15 minutes
        const frequencies = [{
            trip_id: sampleTripFromGtfs.trip_id,
            start_time: '06:00',
            startTimeSeconds: 21600,
            end_time: '06:30',
            endTimeSeconds: 23400,
            headway_secs: 720
        },
        {
            trip_id: sampleTripFromGtfs.trip_id,
            start_time: '06:30',
            startTimeSeconds: 23400,
            end_time: '07:00:00',
            endTimeSeconds: 25200,
            headway_secs: 900
        }];
        importData.frequenciesByTripId = {};
        importData.frequenciesByTripId[sampleTripFromGtfs.trip_id] = frequencies;
        importData.tripsToImport = [sampleTripFromGtfs];
        const preparedTrips = ScheduleImporter.prepareTripData(importData);
        expect(Object.keys(preparedTrips).length).toEqual(1);
        const tripsForLine = preparedTrips[route_id];
        expect(tripsForLine).toBeDefined();
        expect(tripsForLine.length).toEqual(5);

        // All trips should be the same
        expect(tripsForLine[0].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[1].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[2].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[3].trip).toEqual(sampleTripFromGtfs);
        expect(tripsForLine[4].trip).toEqual(sampleTripFromGtfs);

        // First trips starts at 06:00, second at 06:12, third at 06:24, fourth at 06:39, fifth at 06:54
        expect(tripsForLine[0].stopTimes).toEqual([sampleStopTimes[0], sampleStopTimes[1], sampleStopTimes[2]]);
        expect(tripsForLine[1].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], 720), 
            offsetStopTimes(sampleStopTimes[1], 720), 
            offsetStopTimes(sampleStopTimes[2], 720)
        ]);
        expect(tripsForLine[2].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], 720*2), 
            offsetStopTimes(sampleStopTimes[1], 720*2), 
            offsetStopTimes(sampleStopTimes[2], 720*2)
        ]);
        expect(tripsForLine[3].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], 720*2 + 900), 
            offsetStopTimes(sampleStopTimes[1], 720*2 + 900), 
            offsetStopTimes(sampleStopTimes[2], 720*2 + 900)
        ]);
        expect(tripsForLine[4].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], 720*2 + 900*2), 
            offsetStopTimes(sampleStopTimes[1], 720*2 + 900*2), 
            offsetStopTimes(sampleStopTimes[2], 720*2 + 900*2)
        ]);
    });

    test('One line, multiple trip, mixed stop times and frequencies', () => {
        importData.stopTimesByTripId = Object.assign({}, sampleStopTimesByTripId);
        // A frequency every 15 minutes for 30 minutes, will test boundaries
        const frequencies = [{
            trip_id: sampleTripFromGtfs.trip_id,
            start_time: '06:00',
            startTimeSeconds: 21600,
            end_time: '06:30',
            endTimeSeconds: 23400,
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
        expect(tripsForLine[0].stopTimes).toEqual([sampleStopTimes[0], sampleStopTimes[1], sampleStopTimes[2]]);
        expect(tripsForLine[1].stopTimes).toEqual([otherTripStopTimes[0], otherTripStopTimes[1], otherTripStopTimes[2]]);
        expect(tripsForLine[2].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], 900), 
            offsetStopTimes(sampleStopTimes[1], 900), 
            offsetStopTimes(sampleStopTimes[2], 900)
        ]);
        expect(tripsForLine[3].stopTimes).toEqual([
            offsetStopTimes(sampleStopTimes[0], 900*2), 
            offsetStopTimes(sampleStopTimes[1], 900*2), 
            offsetStopTimes(sampleStopTimes[2], 900*2)
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
        (linesDbQueries.update as any).mockClear();
        (linesDbQueries.updateMultiple as any).mockClear();
        (schedulesDbQueries.create as any).mockClear();
        (schedulesDbQueries.delete as any).mockClear();
        // Reset line to its original state
        line = new Line({id: importData.lineIdsByRouteGtfsId[routeId], mode: 'metro', category: 'A', agency_id: uuidV4() }, false);
        lineCollection = new LineCollection([line], {});
        collectionManager.set('lines', lineCollection);
        objectToCacheMock.mockClear();
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
        expect(schedulesDbQueries.create).toHaveBeenCalledTimes(1);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributes.id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_id: scheduleAttributes.id,
                            schedule_period_id: scheduleAttributes.periods[0].id,
                            path_id: pathId,
                            node_departure_times_seconds: [baseTripAndStopTimes.stopTimes[0].departureTimeSeconds, baseTripAndStopTimes.stopTimes[1].departureTimeSeconds, baseTripAndStopTimes.stopTimes[2].departureTimeSeconds, baseTripAndStopTimes.stopTimes[3].departureTimeSeconds],
                            node_arrival_times_seconds: [baseTripAndStopTimes.stopTimes[0].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[1].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[2].arrivalTimeSeconds, baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds],
                            departure_time_seconds: baseTripAndStopTimes.stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: baseTripAndStopTimes.stopTimes[3].arrivalTimeSeconds,
                            nodes_can_board: [true, true, true, false],
                            nodes_can_unboard: [false, true, true, true],
                        }),
                        expect.objectContaining({
                            schedule_id: scheduleAttributes.id,
                            schedule_period_id: scheduleAttributes.periods[0].id,
                            path_id: pathId,
                            node_departure_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].departureTimeSeconds],
                            node_arrival_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds],
                            departure_time_seconds: tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds,
                            arrival_time_seconds: tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds,
                            nodes_can_board: [true, false, true, false],
                            nodes_can_unboard: [false, false, true, true],
                        })
                    ],
                }),
                expect.objectContaining({
                    schedule_id: scheduleAttributes.id,
                    start_at_hour: importData.periodsGroup.periods[1].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[1].endAtHour,
                    period_shortname: importData.periodsGroup.periods[1].shortname,
                    trips: []
                })
            ]
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
        expect(schedulesDbQueries.create).toHaveBeenCalledTimes(1);

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
            schedule_id: scheduleAttributes.id,
            start_at_hour: importData.periodsGroup.periods[0].startAtHour,
            end_at_hour: importData.periodsGroup.periods[0].endAtHour,
            period_shortname: importData.periodsGroup.periods[0].shortname
        }));
        expect(scheduleAttributes.periods[0].trips.length).toEqual(1);
        expect(scheduleAttributes.periods[0].trips[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.id,
            schedule_period_id: scheduleAttributes.periods[0].id,
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
            schedule_id: scheduleAttributes.id,
            start_at_hour: importData.periodsGroup.periods[1].startAtHour,
            end_at_hour: importData.periodsGroup.periods[1].endAtHour,
            period_shortname: importData.periodsGroup.periods[1].shortname,
        }));
        expect(scheduleAttributes.periods[1].trips.length).toEqual(2);
        expect(scheduleAttributes.periods[1].trips[0]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.id,
            schedule_period_id: scheduleAttributes.periods[1].id,
            path_id: pathId,
            node_departure_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].departureTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].departureTimeSeconds],
            node_arrival_times_seconds: [tripsByRouteId[routeId][1].stopTimes[0].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[1].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[2].arrivalTimeSeconds, tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds],
            departure_time_seconds: tripsByRouteId[routeId][1].stopTimes[0].departureTimeSeconds,
            arrival_time_seconds: tripsByRouteId[routeId][1].stopTimes[3].arrivalTimeSeconds,
            nodes_can_board: [true, true, true, false],
            nodes_can_unboard: [false, true, true, true],
        }));
        expect(scheduleAttributes.periods[1].trips[1]).toEqual(expect.objectContaining({
            schedule_id: scheduleAttributes.id,
            schedule_period_id: scheduleAttributes.periods[1].id,
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
        expect(schedulesDbQueries.create).toHaveBeenCalledTimes(2);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(2);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributes.id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_id: scheduleAttributes.id,
                            schedule_period_id: scheduleAttributes.periods[0].id,
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
                    schedule_id: scheduleAttributes.id,
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
                    schedule_id: secondScheduleAttributes.id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_id: secondScheduleAttributes.id,
                            schedule_period_id: secondScheduleAttributes.periods[0].id,
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
                    schedule_id: secondScheduleAttributes.id,
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
        expect(schedulesDbQueries.create).toHaveBeenCalledTimes(1);

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
        expect(schedulesDbQueries.create).toHaveBeenCalledTimes(2);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(2);

        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributes.id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_id: scheduleAttributes.id,
                            schedule_period_id: scheduleAttributes.periods[0].id,
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
                    schedule_id: scheduleAttributes.id,
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
                    schedule_id: secondScheduleAttributes.id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_id: secondScheduleAttributes.id,
                            schedule_period_id: secondScheduleAttributes.periods[0].id,
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
                    schedule_id: secondScheduleAttributes.id,
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
        expect(schedulesDbQueries.create).toHaveBeenCalledTimes(2);

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(1);
        const scheduleAttributes = modifiedLine.getAttributes().scheduleByServiceId[importData.serviceIdsByGtfsId[gtfsServiceId]];
        expect(scheduleAttributes).toBeDefined();

        expect(scheduleAttributes).toEqual(expect.objectContaining({
            line_id: line.getId(),
            service_id: importData.serviceIdsByGtfsId[gtfsServiceId],
            periods_group_shortname: importData.periodsGroupShortname,
            periods: [
                expect.objectContaining({
                    schedule_id: scheduleAttributes.id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_id: scheduleAttributes.id,
                            schedule_period_id: scheduleAttributes.periods[0].id,
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
                    schedule_id: scheduleAttributes.id,
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
                    schedule_id: scheduleAttributesLine2.id,
                    start_at_hour: importData.periodsGroup.periods[0].startAtHour,
                    end_at_hour: importData.periodsGroup.periods[0].endAtHour,
                    period_shortname: importData.periodsGroup.periods[0].shortname,
                    trips: [
                        expect.objectContaining({
                            schedule_id: scheduleAttributesLine2.id,
                            schedule_period_id: scheduleAttributesLine2.periods[0].id,
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
                    schedule_id: scheduleAttributesLine2.id,
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
            expect(schedulesDbQueries.create).toHaveBeenCalledTimes(1);
            expect(schedulesDbQueries.delete).toHaveBeenCalledTimes(1);
            expect(modifiedLine.getAttributes().scheduleByServiceId[serviceId].id).not.toEqual(previousScheduleId);
        } else {
            expect(linesDbQueries.update).toHaveBeenCalledTimes(1);
            expect(schedulesDbQueries.create).not.toHaveBeenCalled();
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
        expect(schedulesDbQueries.create).not.toHaveBeenCalled();

        expect(Object.keys(modifiedLine.getAttributes().scheduleByServiceId).length).toEqual(0);
    });
    
});