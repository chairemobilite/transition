/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import _omit from 'lodash/omit';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Schedule, * as ScheduleTypes from '../Schedule';
import { getScheduleAttributes } from './ScheduleData.test';
import { getPathObject } from '../../path/__tests__/PathData.test';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import LineCollection from '../../line/LineCollection';
import PathCollection from '../../path/PathCollection';
import Line from '../../line/Line';
import { minutesToSeconds, timeStrToSecondsSinceMidnight } from 'chaire-lib-common/lib/utils/DateTimeUtils';

const eventManager = EventManagerMock.eventManagerMock;

const lineId = uuidV4();
const serviceId = uuidV4();
const pathId = uuidV4();

const scheduleAttributes = getScheduleAttributes({ lineId, serviceId, pathId });

beforeEach(() => {
    EventManagerMock.mockClear();
});

test('Test constructor', function() {
    const schedule1 = new Schedule(scheduleAttributes, true);
    expect(schedule1.getAttributes()).toEqual(scheduleAttributes);
    expect(schedule1.isNew()).toBe(true);

    const schedule2 = new Schedule(scheduleAttributes, false);
    expect(schedule2.isNew()).toBe(false);

    // Test the default attributes preparation
    const scheduleAttributesCopy = _omit(scheduleAttributes, ['periods', 'allow_seconds_based_schedules']);
    const expected = { ..._cloneDeep(scheduleAttributesCopy), periods: [], allow_seconds_based_schedules: false };
    const schedule3 = new Schedule(scheduleAttributesCopy, true);
    expect(schedule3.getAttributes()).toEqual(expected);
    expect(schedule3.isNew()).toBe(true);
});

test('should validate', function() {
    let schedule = new Schedule(scheduleAttributes, true);
    expect(schedule.validate()).toBe(true);

    const scheduleAttributesCopy = _cloneDeep(scheduleAttributes);
    schedule = new Schedule(scheduleAttributesCopy, true);

    // Test no service
    schedule.set('service_id', undefined);
    expect(schedule.validate()).toBe(false);
    schedule.set('service_id', scheduleAttributes.service_id);
    expect(schedule.validate()).toBe(true);

    // Test no period group shortname
    delete schedule.getAttributes().periods_group_shortname;
    expect(schedule.validate()).toBe(false);
    schedule.set('periods_group_shortname', scheduleAttributes.periods_group_shortname);
    expect(schedule.validate()).toBe(true);

    // Test period with both interval and unit count
    schedule.getAttributes().periods[0].number_of_units = 4;
    expect(schedule.validate()).toBe(false);
    delete schedule.getAttributes().periods[0].interval_seconds;
    expect(schedule.validate()).toBe(true);
});

test('Save schedule', async () => {
    const schedule = new Schedule(scheduleAttributes, true);
    schedule.startEditing();
    await schedule.save(eventManager);
    expect(eventManager.emit).toHaveBeenCalledTimes(1);
    expect(eventManager.emit).toHaveBeenCalledWith('transitSchedule.create', schedule.getAttributes(), expect.anything());

    // Update
    schedule.set('mode', 'train');
    await schedule.save(eventManager);
    expect(eventManager.emit).toHaveBeenCalledTimes(2);
    expect(eventManager.emit).toHaveBeenCalledWith('transitSchedule.update', schedule.getId(), schedule.getAttributes(), expect.anything());
});

test('Delete schedule', async () => {
    EventManagerMock.emitResponseReturnOnce(Status.createOk({ id: scheduleAttributes.id }));
    const schedule = new Schedule(scheduleAttributes, true);
    await schedule.delete(eventManager);
    expect(eventManager.emit).toHaveBeenCalledTimes(1);
    expect(eventManager.emit).toHaveBeenCalledWith('transitSchedule.delete', schedule.getId(), undefined, expect.anything());
    expect(schedule.isDeleted()).toBe(true);
});

describe('getAssociatedPathIds', () => {

    test('No periods', () => {
        const testAttributes = _cloneDeep(scheduleAttributes);
        testAttributes.periods = [];
        const schedule = new Schedule(testAttributes, true);
        expect(schedule.getAssociatedPathIds()).toEqual([]);
    });

    test('Periods with no trips', () => {
        const testAttributes = _cloneDeep(scheduleAttributes);
        testAttributes.periods.forEach(period => {
            period.trips = [];
        })
        const schedule = new Schedule(testAttributes, true);
        expect(schedule.getAssociatedPathIds()).toEqual([]);
    });

    test('Multiple trips with single paths', () => {
        const schedule = new Schedule(scheduleAttributes, true);
        expect(schedule.getAssociatedPathIds()).toEqual([pathId]);
    });

    test('Multiple trips with multiple paths', () => {
        const otherPathId = uuidV4();
        const testAttributes = _cloneDeep(scheduleAttributes);
        // Change the first trip of each period to the other path id
        testAttributes.periods.forEach(period => {
            if (period.trips.length > 0) {
                period.trips[0].path_id = otherPathId;
            }
        })
        const schedule = new Schedule(testAttributes, true);
        const pathIds = schedule.getAssociatedPathIds()
        expect(pathIds).toContain(otherPathId);
        expect(pathIds).toContain(pathId);
    });

});

describe('updateForAllPeriods', () => {
    // Prepare collection manager and path objects
    const collectionManager = new CollectionManager(null);
    const pathCollection = new PathCollection([], {});
    const path = getPathObject({ lineId, pathCollection }, 'smallReal');

    const lineCollection = new LineCollection([new Line({ id: lineId, path_ids: [pathId] }, false)], {});
    collectionManager.add('lines', lineCollection);
    collectionManager.add('paths', pathCollection);
    const scheduleAttributesForUpdate = getScheduleAttributes({ lineId, serviceId, pathId: path.getId() });
    
    test('No periods', () => {
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        testAttributes.periods = [];
        const schedule = new Schedule(testAttributes, true, collectionManager);
        schedule.updateForAllPeriods();
        expect(schedule.attributes.periods).toEqual([]);
    });

    test('Periods with originally no trips', () => {
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        // Easier for calculated expected trip count to have second based schedule, this tests period update, not actual trip generation
        testAttributes.allow_seconds_based_schedules = true;
        testAttributes.periods.forEach(period => {
            period.trips = [];
            // The number of units of the test schedule is too high
            if (period.number_of_units) {
                period.number_of_units = 2;
            }
        });
        const schedule = new Schedule(testAttributes, true, collectionManager);
        schedule.updateForAllPeriods();
        expect(schedule.attributes.periods.length).toEqual(scheduleAttributesForUpdate.periods.length);
        for (let i = 0; i < schedule.attributes.periods.length; i++) {
            const period = schedule.attributes.periods[i];
            const periodStart = period.custom_start_at_str ? timeStrToSecondsSinceMidnight(period.custom_start_at_str) as number : period.start_at_hour * 60 * 60;
            const periodEnd = period.custom_end_at_str ? timeStrToSecondsSinceMidnight(period.custom_end_at_str) as number : period.end_at_hour * 60 * 60;
            
            if (period.interval_seconds) {
                expect(period.trips.length).toEqual(Math.ceil((periodEnd - periodStart) / period.interval_seconds));
            } else if (period.number_of_units) {
                expect(period.trips.length).toEqual(Math.ceil((periodEnd - periodStart) / (path?.attributes.data?.operatingTimeWithLayoverTimeSeconds as number)) * period.number_of_units);
            }

        }
    });

    test('Periods with individual trips, no outbound/inbound/frequencies/units', () => {
        // Reset paths, intervals and units
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        testAttributes.periods.forEach(period => {
            (period as any).outbound_path_id = null;
            (period as any).inbound_path_id = null;
            period.interval_seconds = undefined;
            period.number_of_units = undefined;
        });
        const schedule = new Schedule(testAttributes, true, collectionManager);

        // Update schedules, there should be no change
        schedule.updateForAllPeriods();
        expect(schedule.attributes.periods.length).toEqual(scheduleAttributesForUpdate.periods.length);
        for (let i = 0; i < schedule.attributes.periods.length; i++) {
            expect(schedule.attributes.periods[i].trips).toEqual(scheduleAttributesForUpdate.periods[i].trips);
        }
    });

    test('Update a frequency based schedule', () => {
        // Set the interval to be a factor of the index
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        testAttributes.periods.forEach((period, idx) => {
            period.interval_seconds = 10 * 60 * (idx + 1);
            period.number_of_units = undefined;
        });
        const schedule = new Schedule(testAttributes, true, collectionManager);

        // Update schedules, trips should be at a certain frequency
        schedule.updateForAllPeriods();
        expect(schedule.attributes.periods.length).toEqual(scheduleAttributesForUpdate.periods.length);
        for (let i = 0; i < schedule.attributes.periods.length; i++) {
            const period = schedule.attributes.periods[i];
            const interval = 10 * 60 * (i + 1);
            const periodStart = period.custom_start_at_str ? timeStrToSecondsSinceMidnight(period.custom_start_at_str) as number : period.start_at_hour * 60 * 60;
            const periodEnd = period.custom_end_at_str ? timeStrToSecondsSinceMidnight(period.custom_end_at_str) as number : period.end_at_hour * 60 * 60;
            expect(period.trips.length).toEqual(Math.ceil((periodEnd - periodStart)/ interval));
        }
    });
});

describe('generateForPeriod', () => {
    // Prepare collection manager and path objects
    const collectionManager = new CollectionManager(null);
    const pathCollection = new PathCollection([], {});
    // Use same path for outbound and inbound, geography is not important for schedules
    const path = getPathObject({ lineId, pathCollection }, 'smallReal');
    const returnPath = getPathObject({ lineId, pathCollection }, 'smallReal');
    returnPath.attributes.direction = 'inbound';

    const lineCollection = new LineCollection([new Line({ id: lineId, path_ids: [path.getId(), returnPath.getId()] }, false)], {});
    collectionManager.add('lines', lineCollection);
    collectionManager.add('paths', pathCollection);
    const scheduleAttributesForUpdate = getScheduleAttributes({ lineId, serviceId, pathId: path.getId() });
    // Use 2 small periods by default for those tests
    const smallPeriodsForUpdate: ScheduleTypes.SchedulePeriod[] = [{
        // Period with start and end hours and multiple trips
        id: uuidV4(),
        schedule_id: scheduleAttributesForUpdate.integer_id,
        inbound_path_id: undefined,
        outbound_path_id: path.getId(),       
        period_shortname: "period1",
        start_at_hour: 10,
        end_at_hour: 12,
        data:{},
        trips: []
    }, {
        id: uuidV4(),
        schedule_id: scheduleAttributesForUpdate.integer_id,
        inbound_path_id: undefined,
        outbound_path_id: path.getId(),
        period_shortname: "period2",
        start_at_hour: 12,
        end_at_hour: 14,
        data: {},
        trips: []
    }]
    
    test('Update frequency based period, one direction', () => {
        // Use a 15-minute frequency
        const testFrequencyMinutes = 15;
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        const testPeriods = _cloneDeep(smallPeriodsForUpdate);
        testPeriods[0].interval_seconds = minutesToSeconds(testFrequencyMinutes) as number;
        testAttributes.periods = testPeriods;
        const schedule = new Schedule(testAttributes, true, collectionManager);
        const { trips } = schedule.generateForPeriod(testPeriods[0].period_shortname as string);

        // Expected values
        const expectedTripCnt = 8;
        const expectedFirstDeparture = timeStrToSecondsSinceMidnight('10:00') as number;
        const dwellTimes = path.getAttributes().data.dwellTimeSeconds as number[];
        const expectedPathDuration = (path.attributes.data.segments as any[]).reduce((total, current) => total + current.travelTimeSeconds, 0) + dwellTimes.reduce((total, current) => total + current, 0) - dwellTimes[dwellTimes.length - 1];

        // Validate return value, and 0.6 vehicle
        const scheduledTrips = schedule.attributes.periods[0].trips;
        expect(scheduledTrips).toEqual(trips);
        expect(schedule.attributes.periods[0].calculated_number_of_units).toEqual(0.6);

        // Validate actual trip content
        expect(scheduledTrips.length).toEqual(expectedTripCnt);
        for (let i = 0; i < expectedTripCnt; i++) {
            const currentTrip = scheduledTrips[i];
            expect(currentTrip.departure_time_seconds).toEqual(expectedFirstDeparture + i * (minutesToSeconds(testFrequencyMinutes) as number))
            expect(currentTrip.path_id).toEqual(path.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(expectedPathDuration + expectedFirstDeparture + i * (minutesToSeconds(testFrequencyMinutes) as number))
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }
    });

    test('Update frequency based period, 2 directions', () => {
        // Use a 15-minute frequency
        const testFrequencyMinutes = 15;
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        const testPeriods = _cloneDeep(smallPeriodsForUpdate);
        testPeriods[0].interval_seconds = minutesToSeconds(testFrequencyMinutes) as number;
        testPeriods[0].inbound_path_id = returnPath.getId();
        testAttributes.periods = testPeriods;
        const schedule = new Schedule(testAttributes, true, collectionManager);
        const { trips } = schedule.generateForPeriod(testPeriods[0].period_shortname as string);

        // Expected values
        const expectedTripCntPerDirection = 8;
        const expectedFirstDeparture = timeStrToSecondsSinceMidnight('10:00') as number;
        const dwellTimes = path.getAttributes().data.dwellTimeSeconds as number[];
        const expectedPathDuration = (path.attributes.data.segments as any[]).reduce((total, current) => total + current.travelTimeSeconds, 0) + dwellTimes.reduce((total, current) => total + current, 0) - dwellTimes[dwellTimes.length - 1];

        // Validate return value and 1.2 vehicles
        const scheduledTrips = schedule.attributes.periods[0].trips;
        expect(scheduledTrips).toEqual(trips);
        expect(schedule.attributes.periods[0].calculated_number_of_units).toEqual(1.2);

        // Validate outbound trips
        const outboundTrips = scheduledTrips.filter(trip => trip.path_id === path.getId());
        // Validate actual trip content
        expect(outboundTrips.length).toEqual(expectedTripCntPerDirection);
        for (let i = 0; i < expectedTripCntPerDirection; i++) {
            const currentTrip = outboundTrips[i];
            expect(currentTrip.departure_time_seconds).toEqual(expectedFirstDeparture + i * (minutesToSeconds(testFrequencyMinutes) as number))
            expect(currentTrip.path_id).toEqual(path.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(expectedPathDuration + expectedFirstDeparture + i * (minutesToSeconds(testFrequencyMinutes) as number))
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }

        // Validate inbound trips, there's one more trip, starting at start time for the second unit
        const inboundTrips = scheduledTrips.filter(trip => trip.path_id === returnPath.getId());
        expect(inboundTrips.length).toEqual(expectedTripCntPerDirection + 1);
        const returnTripOffset = path.attributes.data.operatingTimeWithLayoverTimeSeconds as number;
        // FIXME Because of issue #854, we can't use this loop for the first trip
        for (let i = 1; i < expectedTripCntPerDirection; i++) {
            const currentTrip = inboundTrips[i];
            expect(currentTrip.departure_time_seconds).toEqual(returnTripOffset + expectedFirstDeparture + (i - 1) * (minutesToSeconds(testFrequencyMinutes) as number))
            expect(currentTrip.path_id).toEqual(returnPath.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(returnTripOffset + expectedPathDuration + expectedFirstDeparture + (i - 1) * (minutesToSeconds(testFrequencyMinutes) as number))
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
            // FIXME Issue #854 frequency is too high for first trips, but the next line should be uncommented
            // expect(currentTrip.departure_time_seconds - inboundTrips[i - 1].departure_time_seconds).toEqual(minutesToSeconds(testFrequencyMinutes));
        }
    });

    test('Update unexisting period', () => {
        // Use a 15-minute frequency
        const testFrequencyMinutes = 15;
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        const testPeriods = _cloneDeep(smallPeriodsForUpdate);
        testPeriods[0].interval_seconds = minutesToSeconds(testFrequencyMinutes) as number;
        testAttributes.periods = testPeriods;
        const schedule = new Schedule(testAttributes, true, collectionManager);
        const { trips } = schedule.generateForPeriod('not a period');
        expect(trips).toEqual([]);
    });

    test('Update unit based period, 2 directions', () => {
        // Use 2 units. Paths are perfectly symetric so travel time with layover is the frequency
        const testNumberOfUnits = 2;
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        const testPeriods = _cloneDeep(smallPeriodsForUpdate);
        testPeriods[0].number_of_units = testNumberOfUnits;
        testPeriods[0].inbound_path_id = returnPath.getId();
        testAttributes.periods = testPeriods;
        const schedule = new Schedule(testAttributes, true, collectionManager);
        const { trips } = schedule.generateForPeriod(testPeriods[0].period_shortname as string);

        // Expected values
        const expectedFirstDeparture = timeStrToSecondsSinceMidnight('10:00') as number;
        const dwellTimes = path.getAttributes().data.dwellTimeSeconds as number[];
        const expectedPathDuration = (path.attributes.data.segments as any[]).reduce((total, current) => total + current.travelTimeSeconds, 0) + dwellTimes.reduce((total, current) => total + current, 0) - dwellTimes[dwellTimes.length - 1];
        const expectedFrequency = path.attributes.data.operatingTimeWithLayoverTimeSeconds as number;
        const expectedTripCntPerDirection = Math.ceil(2 * 3600 / expectedFrequency);

        // Validate return value
        const scheduledTrips = schedule.attributes.periods[0].trips;
        expect(scheduledTrips).toEqual(trips);
        expect(schedule.attributes.periods[0].calculated_interval_seconds).toEqual(expectedFrequency);

        // Validate outbound trips
        const outboundTrips = scheduledTrips.filter(trip => trip.path_id === path.getId());
        // Validate actual trip content
        expect(outboundTrips.length).toEqual(expectedTripCntPerDirection);
        for (let i = 0; i < expectedTripCntPerDirection; i++) {
            const currentTrip = outboundTrips[i];
            expect(currentTrip.departure_time_seconds).toEqual(expectedFirstDeparture + i * expectedFrequency)
            expect(currentTrip.path_id).toEqual(path.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(expectedPathDuration + expectedFirstDeparture + i * expectedFrequency)
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }

        // Validate inbound trips
        const inboundTrips = scheduledTrips.filter(trip => trip.path_id === returnPath.getId());
        expect(inboundTrips.length).toEqual(expectedTripCntPerDirection);
        for (let i = 0; i < expectedTripCntPerDirection; i++) {
            const currentTrip = inboundTrips[i];
            expect(currentTrip.departure_time_seconds).toEqual(expectedFirstDeparture + i * expectedFrequency)
            expect(currentTrip.path_id).toEqual(returnPath.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(expectedPathDuration + expectedFirstDeparture + i * expectedFrequency)
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }
    });

    test('Update frequency based, 2 directions, 2 periods', () => {
        // Use a 15-minute frequency
        const testFrequencyMinutesPeriod1 = 14;
        const testFrequencyMinutesPeriod2 = 20;
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        const testPeriods = _cloneDeep(smallPeriodsForUpdate);
        testPeriods[0].interval_seconds = minutesToSeconds(testFrequencyMinutesPeriod1) as number;
        testPeriods[0].inbound_path_id = returnPath.getId();
        testPeriods[1].interval_seconds = minutesToSeconds(testFrequencyMinutesPeriod2) as number;
        testPeriods[1].inbound_path_id = returnPath.getId();
        testAttributes.periods = testPeriods;
        const schedule = new Schedule(testAttributes, true, collectionManager);

        //********** Test for first period */
        const { trips } = schedule.generateForPeriod(testPeriods[0].period_shortname as string);

        // Expected values
        const expectedTripCntPerDirection = 9;
        const expectedFirstDeparture = timeStrToSecondsSinceMidnight('10:00') as number;
        const dwellTimes = path.getAttributes().data.dwellTimeSeconds as number[];
        const expectedPathDuration = (path.attributes.data.segments as any[]).reduce((total, current) => total + current.travelTimeSeconds, 0) + dwellTimes.reduce((total, current) => total + current, 0) - dwellTimes[dwellTimes.length - 1];

        // Validate return value and 1.2 vehicles
        const scheduledTrips = schedule.attributes.periods[0].trips;
        expect(scheduledTrips).toEqual(trips);
        expect(schedule.attributes.periods[0].calculated_number_of_units).toEqual(((path.attributes.data.operatingTimeWithLayoverTimeSeconds as number) + (returnPath.attributes.data.operatingTimeWithLayoverTimeSeconds as number)) / (testFrequencyMinutesPeriod1 * 60));

        // Validate outbound trips
        const outboundTrips = scheduledTrips.filter(trip => trip.path_id === path.getId());
        // Validate actual trip content
        expect(outboundTrips.length).toEqual(expectedTripCntPerDirection);
        for (let i = 0; i < expectedTripCntPerDirection; i++) {
            const currentTrip = outboundTrips[i];
            expect(currentTrip.departure_time_seconds).toEqual(expectedFirstDeparture + i * (minutesToSeconds(testFrequencyMinutesPeriod1) as number))
            expect(currentTrip.path_id).toEqual(path.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(expectedPathDuration + expectedFirstDeparture + i * (minutesToSeconds(testFrequencyMinutesPeriod1) as number))
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }

        // Validate inbound trips
        const inboundTrips = scheduledTrips.filter(trip => trip.path_id === returnPath.getId());
        expect(inboundTrips.length).toEqual(expectedTripCntPerDirection);
        const returnTripOffset = path.attributes.data.operatingTimeWithLayoverTimeSeconds as number;
        for (let i = 1; i < expectedTripCntPerDirection; i++) {
            const currentTrip = inboundTrips[i];
            expect(currentTrip.departure_time_seconds).toEqual(returnTripOffset + expectedFirstDeparture + (i - 1) * (minutesToSeconds(testFrequencyMinutesPeriod1) as number))
            expect(currentTrip.path_id).toEqual(returnPath.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(returnTripOffset + expectedPathDuration + expectedFirstDeparture + (i - 1) * (minutesToSeconds(testFrequencyMinutesPeriod1) as number))
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }

        //********** Test for second period */
        // FIXME Issue #681: First trip of period 1 is too close to the last of period 0
        const { trips: tripsPeriod2 } = schedule.generateForPeriod(testPeriods[1].period_shortname as string);

        // Expected values
        const expectedTripCntPerDirection2 = 6;
        const expectedFirstDeparture2 = timeStrToSecondsSinceMidnight('12:00') as number;
        const expectedPathDuration2 = (path.attributes.data.segments as any[]).reduce((total, current) => total + current.travelTimeSeconds, 0) + dwellTimes.reduce((total, current) => total + current, 0) - dwellTimes[dwellTimes.length - 1];

        // Validate return value and 1.2 vehicles
        const scheduledTripsPeriod2 = schedule.attributes.periods[1].trips;
        expect(scheduledTripsPeriod2).toEqual(tripsPeriod2);
        expect(schedule.attributes.periods[1].calculated_number_of_units).toEqual(((path.attributes.data.operatingTimeWithLayoverTimeSeconds as number) + (returnPath.attributes.data.operatingTimeWithLayoverTimeSeconds as number)) / (testFrequencyMinutesPeriod2 * 60));

        // Validate outbound trips
        const outboundTrips2 = scheduledTripsPeriod2.filter(trip => trip.path_id === path.getId());
        // Validate actual trip content
        expect(outboundTrips2.length).toEqual(expectedTripCntPerDirection2);
        for (let i = 0; i < expectedTripCntPerDirection2; i++) {
            const currentTrip = outboundTrips2[i];
            expect(currentTrip.departure_time_seconds).toEqual(expectedFirstDeparture2 + i * (minutesToSeconds(testFrequencyMinutesPeriod2) as number))
            expect(currentTrip.path_id).toEqual(path.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(expectedPathDuration2 + expectedFirstDeparture2 + i * (minutesToSeconds(testFrequencyMinutesPeriod2) as number))
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }

        // Validate inbound trips, there's one more trip, starting at start time for the second unit
        const inboundTrips2 = scheduledTripsPeriod2.filter(trip => trip.path_id === returnPath.getId());
        expect(inboundTrips2.length).toEqual(expectedTripCntPerDirection2);
        const returnTripOffset2 = path.attributes.data.operatingTimeWithLayoverTimeSeconds as number;
        for (let i = 0; i < expectedTripCntPerDirection2; i++) {
            const currentTrip = inboundTrips2[i];
            expect(currentTrip.departure_time_seconds).toEqual(returnTripOffset2 + expectedFirstDeparture2 + i * (minutesToSeconds(testFrequencyMinutesPeriod2) as number))
            expect(currentTrip.path_id).toEqual(returnPath.getId());
            expect(currentTrip.arrival_time_seconds).toEqual(returnTripOffset2 + expectedPathDuration2 + expectedFirstDeparture2 + i * (minutesToSeconds(testFrequencyMinutesPeriod2) as number))
            expect(currentTrip.node_departure_times_seconds.length).toEqual(path.attributes.nodes.length);
            expect(currentTrip.node_arrival_times_seconds.length).toEqual(path.attributes.nodes.length);
        }
    });


});

describe('BaseScheduleStrategy', () => {
    
    describe('BaseScheduleStrategy generateTrip', () => {
        let validOptions: ScheduleTypes.GenerateTripOptions;
        class TestStrategy extends ScheduleTypes.BaseScheduleStrategy {
            public testGenerateTrip(options: ScheduleTypes.GenerateTripOptions) {
                return this.generateTrip(options); // Expose protected method
            }
            // Mock the abstract methods
            calculateResourceRequirements() {
                return {
                    units: [],
                    outboundIntervalSeconds: 0,
                    inboundIntervalSeconds: 0
                };
            }
            
            generateTrips() {
                return {
                    trips: [],
                    realUnitCount: 0,
                }
            }
        }
    
        beforeEach(() => {
            // Create a mock implementation of the abstract class with valid options that should work
            const pathCollection = new PathCollection([], {});
            validOptions = {
                tripStartAtSeconds: 3600, // 1 hour
                unit: {
                    id: 1,
                    totalCapacity: 100,
                    seatedCapacity: 50,
                    currentLocation: ScheduleTypes.UnitLocation.ORIGIN,
                    expectedArrivalTime: 3600,
                    expectedReturnTime: 7200,
                    direction: ScheduleTypes.UnitDirection.OUTBOUND,
                    lastTripEndTime: null,
                    timeInCycle: 1
                },
                path: getPathObject({ lineId, pathCollection }, 'smallReal'),
                segments: [
                    { travelTimeSeconds: 300 }, // 5 minutes
                    { travelTimeSeconds: 420 }  // 7 minutes
                ],
                nodes: ['node1', 'node2', 'node3'],
                dwellTimes: [60, 60] // 1 minute each
            };
        });
    
        it('should successfully generate trip with valid options', () => {
            let strategy = new TestStrategy();
            const trip = strategy.testGenerateTrip(validOptions);
            expect(trip).toBeDefined();
            expect(trip.node_arrival_times_seconds.length).toBe(3);
        });
    
        it('segments length does not match nodes length - 1', () => {
            let strategy = new TestStrategy();
            const invalidOptions = {
                ...validOptions,
                segments: [{ travelTimeSeconds: 300 }]
            };
            expect(() => strategy.testGenerateTrip(invalidOptions)).toThrow();
        });
    });
});

describe ('ScheduleStrategyFactory', () => {
    
    describe('createStrategy', () => {
        it('should return AsymmetricScheduleStrategy for ASYMMETRIC mode', () => {
            const strategy = ScheduleTypes.ScheduleStrategyFactory.createStrategy(ScheduleTypes.ScheduleCalculationMode.ASYMMETRIC);
            expect(strategy).toBeInstanceOf(ScheduleTypes.AsymmetricScheduleStrategy);
        });
    
        it('should return SymmetricScheduleStrategy for BASIC mode', () => {
            const strategy = ScheduleTypes.ScheduleStrategyFactory.createStrategy(ScheduleTypes.ScheduleCalculationMode.BASIC);
            expect(strategy).toBeInstanceOf(ScheduleTypes.SymmetricScheduleStrategy);
        });
    
        it('should return SymmetricScheduleStrategy for undefined mode', () => {
            const strategy = ScheduleTypes.ScheduleStrategyFactory.createStrategy(undefined as unknown as ScheduleTypes.ScheduleCalculationMode);
            expect(strategy).toBeInstanceOf(ScheduleTypes.SymmetricScheduleStrategy);
        });
    
        it('should return SymmetricScheduleStrategy for null mode', () => {
            const strategy = ScheduleTypes.ScheduleStrategyFactory.createStrategy(null as unknown as ScheduleTypes.ScheduleCalculationMode);
            expect(strategy).toBeInstanceOf(ScheduleTypes.SymmetricScheduleStrategy);
        });
    
        it('should return SymmetricScheduleStrategy for unknown mode', () => {
            const strategy = ScheduleTypes.ScheduleStrategyFactory.createStrategy('UNKNOWN_MODE' as ScheduleTypes.ScheduleCalculationMode);
            expect(strategy).toBeInstanceOf(ScheduleTypes.SymmetricScheduleStrategy);
        });
    
        it('should use default case for non-enum values', () => {
            const strategy = ScheduleTypes.ScheduleStrategyFactory.createStrategy('123' as ScheduleTypes.ScheduleCalculationMode);
            expect(strategy).toBeInstanceOf(ScheduleTypes.SymmetricScheduleStrategy);
        });
    });
});

describe('AsymmetricScheduleStrategy', () => {
    
    describe('AsymmetricScheduleStrategy calculateResourceRequirements', () => {
        let scheduleStrategy = new ScheduleTypes.AsymmetricScheduleStrategy();
        describe('Scenario 1: Fixed number of units', () => {
            it('should calculate correct interval when number_of_units is provided', () => {
                const options = {
                    period: { number_of_units: 2 },
                    startAtSecondsSinceMidnight: 0,
                    endAtSecondsSinceMidnight: 3600,
                    outboundTotalTimeSeconds: 1200, // 20 min
                    inboundTotalTimeSeconds: 1800, // 30 min
                    secondAllowed: true
                };
            
            const result =scheduleStrategy.calculateResourceRequirements(options);
            expect(result.units.length).toBe(2);
            expect(result.outboundIntervalSeconds).toBe(1500); // (20+30)/2 = 25 min (1500s)
            });
        
            it('should round interval to minutes when secondAllowed is false', () => {
                const options = {
                    period: { number_of_units: 3 },
                    startAtSecondsSinceMidnight: 0,
                    endAtSecondsSinceMidnight: 3600,
                    outboundTotalTimeSeconds: 1250,
                    inboundTotalTimeSeconds: 1750,
                    secondAllowed: false
                };
            
            const result = scheduleStrategy.calculateResourceRequirements(options);
            // (1250+1750)/3 = 1000s → arrondi à 1020s (17 min)
            expect(result.outboundIntervalSeconds).toBe(1020);
            });
        });

        describe('Scenario 2: Fixed intervals', () => {
            it('should calculate required units based on outbound/inbound intervals', () => {
                const options = {
                    period: {
                        interval_seconds: 900,  // 15 min
                        inbound_interval_seconds: 1200 // 20 min
                    },
                    startAtSecondsSinceMidnight: 0,
                    endAtSecondsSinceMidnight: 7200, // 2h
                    outboundTotalTimeSeconds: 1800,
                    inboundTotalTimeSeconds: 1800,
                    secondAllowed: true
                };
                
                const result = scheduleStrategy.calculateResourceRequirements(options);
                
                // Calculer le nombre d'unités selon la logique actuelle
                const outboundUnitsNeeded = Math.ceil(1800 / 900); // = 2
                const inboundUnitsNeeded = Math.ceil(1800 / 1200); // = 2
                const expectedUnits = outboundUnitsNeeded + inboundUnitsNeeded; // = 4
                
                // Ajouter la vérification du nombre simultané si nécessaire
                const simultaneousStarts = Math.min(
                    Math.ceil(7200 / 900),
                    Math.ceil(7200 / 1200)
                ); // = 6
                
                // Le test doit vérifier le maximum entre la somme des unités et le nombre pour départs simultanés
                const finalExpectedUnits = Math.max(expectedUnits, simultaneousStarts); // = 6
                
                expect(result.units.length).toBe(finalExpectedUnits);
            });
        
        
            it('should handle zero time period', () => {
                const options = {
                period: { number_of_units: 2 },
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 0,
                outboundTotalTimeSeconds: 1800,
                inboundTotalTimeSeconds: 1800,
                secondAllowed: true
                };
                
                const result = scheduleStrategy.calculateResourceRequirements(options);
                expect(result.units.length).toBe(2);
                expect(result.outboundIntervalSeconds).toBe(1800); // (1800+1800)/2
            });
        
        });

    });

    describe('AsymmetricScheduleStrategy updateUnitAvailability', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;
        const baseUnit: ScheduleTypes.TransitUnit = {
            id: 1,
            totalCapacity: 50,
            seatedCapacity: 30,
            currentLocation: ScheduleTypes.UnitLocation.ORIGIN,
            expectedArrivalTime: 0,
            expectedReturnTime: null,
            direction: null,
            lastTripEndTime: null,
            timeInCycle: 0
        };
    
        beforeEach(() => {
        strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
        });
        it('should update outbound unit to destination', () => {
            const unit: ScheduleTypes.TransitUnit = {
            ...baseUnit,
            direction: ScheduleTypes.UnitDirection.OUTBOUND,
            expectedArrivalTime: 1000
            };

            strategy["updateUnitAvailability"](unit, 1001);

            expect(unit.currentLocation).toBe(ScheduleTypes.UnitLocation.DESTINATION);
            expect(unit.direction).toBeNull();
            expect(unit.lastTripEndTime).toBe(1001);
        });

        it('should update inbound unit to origin', () => {
            const unit: ScheduleTypes.TransitUnit = {
            ...baseUnit,
            currentLocation: ScheduleTypes.UnitLocation.DESTINATION,
            direction: ScheduleTypes.UnitDirection.INBOUND,
            expectedArrivalTime: 1500,
            timeInCycle: 300
            };

            strategy["updateUnitAvailability"](unit, 1500);

            expect(unit.currentLocation).toBe(ScheduleTypes.UnitLocation.ORIGIN);
            expect(unit.direction).toBeNull();
            expect(unit.lastTripEndTime).toBe(1500);
        });

        // when unit has not arrived
        it('should not modify outbound unit', () => {
            const unit: ScheduleTypes.TransitUnit = {
            ...baseUnit,
            direction: ScheduleTypes.UnitDirection.OUTBOUND,
            expectedArrivalTime: 2000,
            lastTripEndTime: 500
            };

            strategy["updateUnitAvailability"](unit, 1999);

            expect(unit.currentLocation).toBe(ScheduleTypes.UnitLocation.ORIGIN);
            expect(unit.direction).toBe(ScheduleTypes.UnitDirection.OUTBOUND);
            expect(unit.lastTripEndTime).toBe(500);
        });
    });

    describe('AsymmetricScheduleStrategy findBestUnit', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy; 
        
        beforeEach(() => {
        strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
        });
    
        const baseUnit: ScheduleTypes.TransitUnit = {
        id: 1,
        totalCapacity: 50,
        seatedCapacity: 30,
        currentLocation: ScheduleTypes.UnitLocation.ORIGIN,
        expectedArrivalTime: 0,
        expectedReturnTime: null,
        direction: null,
        lastTripEndTime: null,
        timeInCycle: 0
        };

        it('should select correct outbound unit at origin', () => {
            const units = [
            { ...baseUnit, id: 1, currentLocation: ScheduleTypes.UnitLocation.ORIGIN },
            { ...baseUnit, id: 2, currentLocation: ScheduleTypes.UnitLocation.DESTINATION }
            ];
        
            const result = strategy["findBestUnit"](1000, ScheduleTypes.UnitDirection.OUTBOUND, units);
            expect(result?.id).toBe(1);
        });

        it('should select correct inbound unit at destination', () => {
            const units = [
                { ...baseUnit, id: 1, currentLocation: ScheduleTypes.UnitLocation.ORIGIN },
                { ...baseUnit, id: 2, currentLocation: ScheduleTypes.UnitLocation.DESTINATION }];
        
            const result = strategy["findBestUnit"](1000, ScheduleTypes.UnitDirection.INBOUND, units);
            expect(result?.id).toBe(2);
        });

        it('should prioritize used units by availability time', () => {
            const units = [
            { ...baseUnit, id: 1, lastTripEndTime: 1500 },
            { ...baseUnit, id: 2, lastTripEndTime: 1200 },
            { ...baseUnit, id: 3, lastTripEndTime: null }
            ];
        
            const result = strategy["findBestUnit"](1300, ScheduleTypes.UnitDirection.OUTBOUND, units);
            expect(result?.id).toBe(2);
        });
        
        it('should select unused unit if no used units are ready', () => {
            const units = [
                { ...baseUnit, id: 1, lastTripEndTime: 1500 },
                { ...baseUnit, id: 2, lastTripEndTime: null }
            ];
            
            const result = strategy["findBestUnit"](1000, ScheduleTypes.UnitDirection.OUTBOUND, units);
            expect(result?.id).toBe(2);
        });

        it('should return null when no units are available', () => {
            const units = [
                { ...baseUnit, id: 1, direction: ScheduleTypes.UnitDirection.OUTBOUND },
                { ...baseUnit, id: 2, currentLocation: ScheduleTypes.UnitLocation.DESTINATION }
            ];
            
            const result = strategy["findBestUnit"](1000, ScheduleTypes.UnitDirection.OUTBOUND, units);
            expect(result).toBeNull();
        });
        
        it('should handle empty units array', () => {
            const result = strategy["findBestUnit"](1000, ScheduleTypes.UnitDirection.OUTBOUND, []);
            expect(result).toBeNull();
        });
        
        it('should ignore not-ready units', () => {
            const units = [
                { ...baseUnit, id: 1, lastTripEndTime: 1500 }
            ];
            
            const result = strategy["findBestUnit"](1000, ScheduleTypes.UnitDirection.OUTBOUND, units);
            expect(result).toBeNull();
        });

        it('should select unit at ready time', () => {
            const units = [
                { ...baseUnit, id: 1, lastTripEndTime: 1000 }
            ];
            
            const result = strategy["findBestUnit"](1000, ScheduleTypes.UnitDirection.OUTBOUND, units);
            expect(result?.id).toBe(1);
        });

    });

    describe('AsymmetricScheduleStrategy processDeparture', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;
        let trips: any[];
        let mockPath: any;
        let mockUnits: any[];
    
        let findBestUnitSpy: jest.SpyInstance;
        let generateTripSpy: jest.SpyInstance;
    
        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
            trips = [];
    
            mockPath = {
                getData: jest.fn(() => [60, 90, 120]),
                getAttributes: jest.fn(() => ({
                    data: { segments: [] },
                    nodes: ['a', 'b', 'c']
                }))
            };
    
            mockUnits = [{
                id: 1,
                totalCapacity: 100,
                seatedCapacity: 50,
                currentLocation: ScheduleTypes.UnitLocation.ORIGIN,
                expectedArrivalTime: 3600,
                expectedReturnTime: 7200,
                direction: ScheduleTypes.UnitDirection.OUTBOUND
            }];
    
            findBestUnitSpy = jest
                .spyOn(strategy as any, 'findBestUnit')
                .mockReturnValue(mockUnits[0]);
    
            generateTripSpy = jest
                .spyOn(strategy as any, 'generateTrip')
                .mockReturnValue({ id: 'mock-trip', unit_id: 1 });
        });
    
        afterEach(() => {
            jest.restoreAllMocks();
        });
    
        it('should return correct unitId and call internal methods with expected args', () => {
            const result = strategy['processDeparture']({
                currentTime: 1000,
                totalTimeSeconds: 3600,
                units: mockUnits,
                path: mockPath,
                trips,
                direction: ScheduleTypes.UnitDirection.OUTBOUND
            });
    
            expect(result.unitId).toBe(1);
            expect(findBestUnitSpy).toHaveBeenCalledWith(1000, ScheduleTypes.UnitDirection.OUTBOUND, mockUnits);
            expect(generateTripSpy).toHaveBeenCalledWith(expect.objectContaining({
                tripStartAtSeconds: 1000,
                unit: mockUnits[0],
                path: mockPath,
                segments: [],
                nodes: ['a', 'b', 'c'],
                dwellTimes: [60, 90, 120]
            }));
        });
    
        it('should return null when no unit is available', () => {
            findBestUnitSpy.mockReturnValue(null);
    
            const result = strategy['processDeparture']({
                currentTime: 1000,
                totalTimeSeconds: 3600,
                units: mockUnits,
                path: mockPath,
                trips,
                direction: ScheduleTypes.UnitDirection.OUTBOUND
            });
    
            expect(result.unitId).toBeNull();
            expect(generateTripSpy).not.toHaveBeenCalled();
        });
    });
    
    describe('AsymmetricScheduleStrategy initializeUnits', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;
        let mockUnits: any[];

        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
            mockUnits = [
                {
                    id: 1,
                    totalCapacity: 100,
                    seatedCapacity: 50
                },
                {
                    id: 2,
                    totalCapacity: 80,
                    seatedCapacity: 40
                }
            ];
        });

        it('should initialize units starting from origin', () => {
            strategy['initializeUnits']({
                units: mockUnits,
                startFromDestination: false,
                startTime: 5000
            });

            mockUnits.forEach(unit => {
                expect(unit.currentLocation).toBe(ScheduleTypes.UnitLocation.ORIGIN);
                expect(unit.direction).toBeNull();
                expect(unit.expectedArrivalTime).toBe(5000);
                expect(unit.expectedReturnTime).toBeNull();
                expect(unit.lastTripEndTime).toBeNull();
            });
        });

        it('should initialize units starting from destination', () => {
            strategy['initializeUnits']({
                units: mockUnits,
                startFromDestination: true,
                startTime: 8000
            });

            mockUnits.forEach(unit => {
                expect(unit.currentLocation).toBe(ScheduleTypes.UnitLocation.DESTINATION);
                expect(unit.expectedArrivalTime).toBe(8000);
            });
        });
    });

    describe('AsymmetricScheduleStrategy generateDepartureSchedules', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;

        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
        });

        it('should generate outbound then inbound departures when starting from origin', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: false,
                hasInboundPath: true,
                startTime: 0,
                endTime: 1000,
                outboundIntervalSeconds: 200,
                inboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 150,
                inboundTotalTimeSeconds: 100
            });

            expect(result.outboundDepartures).toEqual([0, 200, 400, 600, 800]);
            expect(result.inboundDepartures).toEqual([0, 300, 600, 900]);
        });

        it('should generate only outbound departures when no inbound path', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: false,
                hasInboundPath: false,
                startTime: 100,
                endTime: 900,
                outboundIntervalSeconds: 250,
                inboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 0,
                inboundTotalTimeSeconds: 0
            });

            expect(result.outboundDepartures).toEqual([100, 350, 600, 850]);
            expect(result.inboundDepartures).toEqual([]);
        });

        it('should generate inbound then outbound when starting from destination', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: true,
                hasInboundPath: true,
                startTime: 500,
                endTime: 2000,
                outboundIntervalSeconds: 300,
                inboundIntervalSeconds: 400,
                outboundTotalTimeSeconds: 600,
                inboundTotalTimeSeconds: 200
            });

            expect(result.inboundDepartures).toEqual([500, 900, 1300, 1700]);
            expect(result.outboundDepartures).toEqual([500, 800, 1100, 1400, 1700]);
        });

        it('should handle empty result if intervals exceed endTime', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: true,
                hasInboundPath: true,
                startTime: 0,
                endTime: 100,
                outboundIntervalSeconds: 200,
                inboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 50,
                inboundTotalTimeSeconds: 50
            });

            expect(result.outboundDepartures.length).toBe(1); // 0 + 50 = 50 is pushed
            expect(result.inboundDepartures.length).toBe(1);  // 0 is pushed
        });
    });

    describe('AsymmetricScheduleStrategy generateDepartureSchedules', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;

        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
        });

        it('should generate outbound then inbound departures when starting from origin', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: false,
                hasInboundPath: true,
                startTime: 0,
                endTime: 1000,
                outboundIntervalSeconds: 200,
                inboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 150,
                inboundTotalTimeSeconds: 100
            });

            expect(result.outboundDepartures).toEqual([0, 200, 400, 600, 800]);
            expect(result.inboundDepartures).toEqual([0, 300, 600, 900]);
        });

        it('should generate only outbound departures when no inbound path', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: false,
                hasInboundPath: false,
                startTime: 100,
                endTime: 900,
                outboundIntervalSeconds: 250,
                inboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 0,
                inboundTotalTimeSeconds: 0
            });

            expect(result.outboundDepartures).toEqual([100, 350, 600, 850]);
            expect(result.inboundDepartures).toEqual([]);
        });

        it('should generate inbound then outbound when starting from destination', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: true,
                hasInboundPath: true,
                startTime: 500,
                endTime: 2000,
                outboundIntervalSeconds: 300,
                inboundIntervalSeconds: 400,
                outboundTotalTimeSeconds: 600,
                inboundTotalTimeSeconds: 200
            });

            expect(result.inboundDepartures).toEqual([500, 900, 1300, 1700]);
            expect(result.outboundDepartures).toEqual([500, 800, 1100, 1400, 1700]);
        });

        it('should handle empty result if intervals exceed endTime', () => {
            const result = strategy['generateDepartureSchedules']({
                startFromDestination: true,
                hasInboundPath: true,
                startTime: 0,
                endTime: 100,
                outboundIntervalSeconds: 200,
                inboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 50,
                inboundTotalTimeSeconds: 50
            });

            expect(result.outboundDepartures.length).toBe(1); // 0 + 50 = 50 is pushed
            expect(result.inboundDepartures.length).toBe(1);  // 0 is pushed
        });
    });

    describe('AsymmetricScheduleStrategy updateAllUnitsAvailability', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;
        let updateUnitAvailabilitySpy: jest.SpyInstance;
        let mockUnit1: any;
        let mockUnit2: any;
    
        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
    
            updateUnitAvailabilitySpy = jest.spyOn(strategy as any, 'updateUnitAvailability');
    
            mockUnit1 = {
                id: 1,
                currentLocation: ScheduleTypes.UnitLocation.DESTINATION,
                expectedArrivalTime: 1000,
                direction: ScheduleTypes.UnitDirection.INBOUND,
                lastTripEndTime: null
            };
    
            mockUnit2 = {
                id: 2,
                currentLocation: ScheduleTypes.UnitLocation.ORIGIN,
                expectedArrivalTime: 2000,
                direction: ScheduleTypes.UnitDirection.OUTBOUND,
                lastTripEndTime: null
            };
        });
    
        afterEach(() => {
            jest.restoreAllMocks();
        });
    
        it('should teleport unit to ORIGIN when no inboundPath and arrival time is reached', () => {
            strategy['updateAllUnitsAvailability']([mockUnit1], 1500);
    
            expect(mockUnit1.currentLocation).toBe(ScheduleTypes.UnitLocation.ORIGIN);
            expect(mockUnit1.direction).toBeNull();
            expect(mockUnit1.lastTripEndTime).toBe(1500);
    
            // Should not call fallback in this case
            expect(updateUnitAvailabilitySpy).not.toHaveBeenCalled();
        });
    
        it('should call updateUnitAvailability for unit not matching ghost trip condition', () => {
            strategy['updateAllUnitsAvailability']([mockUnit2], 1500);
    
            expect(updateUnitAvailabilitySpy).toHaveBeenCalledTimes(1);
            expect(updateUnitAvailabilitySpy).toHaveBeenCalledWith(mockUnit2, 1500);
        });
    
        it('should NOT teleport unit if arrival time not yet reached', () => {
            mockUnit1.expectedArrivalTime = 1600; // Future
    
            strategy['updateAllUnitsAvailability']([mockUnit1], 1500);
    
            // Should fall back to updateUnitAvailability
            expect(updateUnitAvailabilitySpy).toHaveBeenCalledWith(mockUnit1, 1500);
            expect(mockUnit1.currentLocation).toBe(ScheduleTypes.UnitLocation.DESTINATION); // Not reset
        });
    
        it('should NOT teleport unit if inboundPath is provided', () => {
            const inboundPath: any = {}; // Just to pass the check
    
            strategy['updateAllUnitsAvailability']([mockUnit1], 1500, inboundPath);
    
            expect(mockUnit1.currentLocation).toBe(ScheduleTypes.UnitLocation.ORIGIN);
            expect(updateUnitAvailabilitySpy).toHaveBeenCalledWith(mockUnit1, 1500);
        });
    
        it('should apply logic independently to multiple units', () => {
            // Unit1: ghost-teleport
            // Unit2: fallback
            strategy['updateAllUnitsAvailability']([mockUnit1, mockUnit2], 1500);
    
            expect(mockUnit1.currentLocation).toBe(ScheduleTypes.UnitLocation.ORIGIN);
            expect(mockUnit1.direction).toBeNull();
            expect(updateUnitAvailabilitySpy).toHaveBeenCalledWith(mockUnit2, 1500);
            expect(updateUnitAvailabilitySpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('AsymmetricScheduleStrategy processDepartures', () => {
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;
        let trips: any[];
        let units: any[];
        let options: ScheduleTypes.ProcessDeparturesOptions;
        let usedUnitsIds: Set<number>;
        let outboundDepartures: number[];
        let inboundDepartures: number[];
        let processDepartureSpy: jest.SpyInstance;
        
        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
            trips = [];
            units = [
                { id: 1, currentLocation: ScheduleTypes.UnitLocation.ORIGIN },
                { id: 2, currentLocation: ScheduleTypes.UnitLocation.DESTINATION }
            ];
            outboundDepartures = [1000, 2000];
            inboundDepartures = [1000, 2000];
            usedUnitsIds = new Set();
            
            options = {
                currentTime: 1000,
                nextOutbound: 1000,
                nextInbound: 1000,
                units,
                outboundPath: {} as any,
                inboundPath: {} as any,
                outboundTotalTimeSeconds: 300,
                inboundTotalTimeSeconds: 400,
                trips: [],
                usedUnitsIds,
                outboundDepartures,
                inboundDepartures
            };
            
            // Default mock behavior: return unit ID 1 for outbound, 2 for inbound
            processDepartureSpy = jest.spyOn(strategy as any, 'processDeparture').mockImplementation((args) => {
                const options = args as ScheduleTypes.ProcessDepartureOptions;
                if (options.direction === ScheduleTypes.UnitDirection.OUTBOUND) return { unitId: 1 };
                return { unitId: 2 };
            });
        });
        
        afterEach(() => {
            jest.restoreAllMocks();
        });
        

        it('should process both directions when currentTime matches both nextOutbound and nextInbound', () => {
            strategy["processDepartures"](options);
            
            expect(processDepartureSpy).toHaveBeenCalledTimes(2);
            expect(processDepartureSpy).toHaveBeenCalledWith(expect.objectContaining({
                direction: ScheduleTypes.UnitDirection.OUTBOUND,
                currentTime: 1000,
            }));
            expect(processDepartureSpy).toHaveBeenCalledWith(expect.objectContaining({
                direction: ScheduleTypes.UnitDirection.INBOUND,
                currentTime: 1000,
            }));
            expect(options.usedUnitsIds).toEqual(new Set([1, 2]));
        });
        
        it('should only process outbound when currentTime only matches nextOutbound', () => {
            options.nextInbound = 2000;
            
            strategy["processDepartures"](options);
            
            expect(processDepartureSpy).toHaveBeenCalledTimes(1);
            expect(processDepartureSpy).toHaveBeenCalledWith(expect.objectContaining({
                direction: ScheduleTypes.UnitDirection.OUTBOUND
            }));
            expect(options.usedUnitsIds).toEqual(new Set([1]));
        });
        
        it('should only process inbound when currentTime only matches nextInbound', () => {
            options.nextOutbound = 2000;
            
            strategy["processDepartures"](options);
            
            expect(processDepartureSpy).toHaveBeenCalledTimes(1);
            expect(processDepartureSpy).toHaveBeenCalledWith(expect.objectContaining({
                direction: ScheduleTypes.UnitDirection.INBOUND
            }));
            expect(options.usedUnitsIds).toEqual(new Set([2]));
        });
        
        it('should not process any departures when currentTime matches neither', () => {
            options.nextOutbound = 2000;
            options.nextInbound = 2000;
            
            strategy["processDepartures"](options);
            
            expect(processDepartureSpy).not.toHaveBeenCalled();
            expect(options.usedUnitsIds.size).toBe(0);
        });
        
        it('should skip inbound processing if inboundPath is not defined', () => {
            options.inboundPath = undefined;
            
            strategy["processDepartures"](options);
            
            expect(processDepartureSpy).toHaveBeenCalledTimes(1);
            expect(processDepartureSpy).toHaveBeenCalledWith(expect.objectContaining({
                direction: ScheduleTypes.UnitDirection.OUTBOUND
            }));
            expect(options.usedUnitsIds).toEqual(new Set([1]));
        });
    });

    describe('AsymmetricScheduleStrategy generateTripsWithIntervals', () => {
        const mockUnit: ScheduleTypes.TransitUnit = {
            id: 1,
            totalCapacity: 50,
            seatedCapacity: 20,
            currentLocation: ScheduleTypes.UnitLocation.ORIGIN,
            expectedArrivalTime: 0,
            expectedReturnTime: null,
            direction: null,
            lastTripEndTime: null,
            timeInCycle: 0
        };
    
        const createOptions = (overrides = {}): ScheduleTypes.GenerateTripsWithIntervalsOptions => ({
            startAtSecondsSinceMidnight: 0,
            endAtSecondsSinceMidnight: 1000,
            outboundIntervalSeconds: 200,
            inboundIntervalSeconds: 300,
            outboundTotalTimeSeconds: 100,
            inboundTotalTimeSeconds: 100,
            units: [mockUnit],
            outboundPath: { get: () => 'outbound' } as any,
            inboundPath: { get: () => 'inbound' } as any,
            ...overrides
        });
    
        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;
        let processDepartureSpy: jest.SpyInstance;
    
        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
            processDepartureSpy = jest
                .spyOn(strategy as any, 'processDeparture')
                .mockImplementation(({ direction }: any) => {
                    return direction === ScheduleTypes.UnitDirection.OUTBOUND
                        ? { unitId: 1 }
                        : { unitId: 2 };
                });
        });
    
        afterEach(() => {
            jest.restoreAllMocks();
        });
    
        it('should handle initialization, scheduling, and processing departures correctly', () => {
            const initializeUnitsSpy = jest.spyOn(strategy as any, 'initializeUnits').mockImplementation(() => {});
            const generateDepartureSchedulesSpy = jest.spyOn(strategy as any, 'generateDepartureSchedules').mockReturnValue({
                outboundDepartures: [100, 300, 500],
                inboundDepartures: [200, 300, 600]
            });
            
            const updateAllUnitsAvailabilitySpy = jest
                .spyOn(strategy as any, 'updateAllUnitsAvailability')
                .mockImplementation(() => {});
    
            const processDeparturesSpy = jest
                .spyOn(strategy as any, 'processDepartures')
                .mockImplementation((args: any) => {
                    args.trips.push({ tripId: `trip-${args.currentTime}` });
                    args.usedUnitsIds.add(1);
                    
                    // Logic to handle both cases
                    if (args.currentTime === args.nextOutbound) {
                        args.outboundDepartures.shift();
                    }
                    if (args.currentTime === args.nextInbound) {
                        args.inboundDepartures.shift();
                    }
                });
    
            const options = createOptions({
                inboundIntervalSeconds: 300,
                outboundIntervalSeconds: 200,
                startAtSecondsSinceMidnight: 10,
                endAtSecondsSinceMidnight: 1000
            });
    
            const result = strategy['generateTripsWithIntervals'](options);
    
            // Initialization check
            expect(initializeUnitsSpy).toHaveBeenCalledWith({
                units: options.units,
                startFromDestination: false,
                startTime: 10
            });
    
            // Departure schedule generation check
            expect(generateDepartureSchedulesSpy).toHaveBeenCalledWith({
                startTime: 10,
                endTime: 1000,
                outboundIntervalSeconds: 200,
                inboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 100,
                inboundTotalTimeSeconds: 100,
                startFromDestination: false,
                hasInboundPath: true
            });
    
            // Unit availability should be updated at 100, 200, 300, 500, 600
            expect(updateAllUnitsAvailabilitySpy).toHaveBeenCalledTimes(5);
            expect(updateAllUnitsAvailabilitySpy).toHaveBeenNthCalledWith(1, options.units, 100, options.inboundPath);
            expect(updateAllUnitsAvailabilitySpy).toHaveBeenNthCalledWith(2, options.units, 200, options.inboundPath);
            expect(updateAllUnitsAvailabilitySpy).toHaveBeenNthCalledWith(3, options.units, 300, options.inboundPath);
            expect(updateAllUnitsAvailabilitySpy).toHaveBeenNthCalledWith(4, options.units, 500, options.inboundPath);
            expect(updateAllUnitsAvailabilitySpy).toHaveBeenNthCalledWith(5, options.units, 600, options.inboundPath);
    
            // Check calls to processDepartures instead of the old methods
            expect(processDeparturesSpy).toHaveBeenCalledTimes(5); // 5 total calls for all departures
            
            // Verify each call to processDepartures
            expect(processDeparturesSpy).toHaveBeenCalledWith(expect.objectContaining({
                currentTime: 100,
                nextOutbound: 100,
                nextInbound: 200
            }));
            expect(processDeparturesSpy).toHaveBeenCalledWith(expect.objectContaining({
                currentTime: 200,
                nextOutbound: 300,
                nextInbound: 200
            }));
            expect(processDeparturesSpy).toHaveBeenCalledWith(expect.objectContaining({
                currentTime: 300,
                nextOutbound: 300,
                nextInbound: 300
            }));
            expect(processDeparturesSpy).toHaveBeenCalledWith(expect.objectContaining({
                currentTime: 500,
                nextOutbound: 500,
                nextInbound: 600
            }));
            expect(processDeparturesSpy).toHaveBeenCalledWith(expect.objectContaining({
                currentTime: 600,
                nextOutbound: expect.anything(),
                nextInbound: 600
            }));
    
            // Final result check
            expect(result).toEqual({
                trips: [
                    { tripId: 'trip-100' },
                    { tripId: 'trip-200' },
                    { tripId: 'trip-300' },
                    { tripId: 'trip-500' },
                    { tripId: 'trip-600' }
                ],
                realUnitCount: 1
            });
        });
    });

    describe('AsymmetricScheduleStrategy generateTripsWithFixedUnits', () => {

        const createMockPath = (direction: 'outbound' | 'inbound') => ({
            getAttributes: () => ({
                data: {
                    segments: [{ travelTimeSeconds: 10 }]
                },
                nodes: [`${direction}-node1`, `${direction}-node2`]
            }),
            getData: (key: string) => key === 'dwellTimeSeconds' ? [5, 5] : undefined,
            get: (key: string) => key === 'id' ? `mock-${direction}-id` : undefined,
            getId: () => `mock-${direction}-id`,
            getLine: () => ({ getAttributes: () => ({ shortname: `${direction}-line` }) }),
            attributes: {
                line_id: `${direction}-line-id`
            }
        });

        const mockOutboundPath = createMockPath('outbound');
        const mockInboundPath = createMockPath('inbound');

        const createUnits = (count: number): ScheduleTypes.TransitUnit[] =>
            Array.from({ length: count }, (_, i) => ({
                id: i + 1,
                totalCapacity: 50,
                seatedCapacity: 20,
                currentLocation: ScheduleTypes.UnitLocation.ORIGIN,
                expectedArrivalTime: 0,
                expectedReturnTime: null,
                direction: null,
                lastTripEndTime: null,
                timeInCycle: 0
            }));

        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;

        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();
        });

        it('should initialize timeInCycle staggered across units', () => {
            const units = createUnits(4);

            strategy['generateTripsWithFixedUnits']({
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 1,
                outboundIntervalSeconds: 300,
                outboundTotalTimeSeconds: 100,
                inboundTotalTimeSeconds: 100,
                units,
                outboundPath: mockOutboundPath,
                inboundPath: mockInboundPath
            } as any);

            const expectedStartTimes = [0, 50, 100, 150]; // 200 cycle / 4 units
            const actual = units.map(u => u.timeInCycle);
            expect(actual).toEqual(expectedStartTimes.map(t => t + 1)); // +1 due to final increment
        });

        it('should generate outbound trips at correct times', () => {
            const units = createUnits(1);

            const result = strategy['generateTripsWithFixedUnits']({
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 3,
                outboundIntervalSeconds: 1,
                outboundTotalTimeSeconds: 1,
                inboundTotalTimeSeconds: 1,
                units,
                outboundPath: mockOutboundPath,
                inboundPath: undefined
            }as any);

            const outboundTrips = result.trips.filter(t => t.path_id === 'mock-outbound-id');
            expect(outboundTrips.length).toBeGreaterThan(0);
            expect(result.realUnitCount).toBe(1);
        });

        it('should generate inbound trips only when inboundPath is defined', () => {
            const units = createUnits(1);

            const result = strategy['generateTripsWithFixedUnits']({
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 3,
                outboundIntervalSeconds: 1,
                outboundTotalTimeSeconds: 1,
                inboundTotalTimeSeconds: 1,
                units,
                outboundPath: mockOutboundPath,
                inboundPath: mockInboundPath
            } as any);

            const inboundTrips = result.trips.filter(t => t.path_id === 'mock-inbound-id');
            expect(inboundTrips.length).toBeGreaterThan(0);
        });

        it('should reset timeInCycle when appropriate', () => {
            const units = createUnits(1);

            const result = strategy['generateTripsWithFixedUnits']({
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 10,
                outboundIntervalSeconds: 2,
                outboundTotalTimeSeconds: 1,
                inboundTotalTimeSeconds: 1,
                units,
                outboundPath: mockOutboundPath,
                inboundPath: mockInboundPath
            } as any);

            const outboundTrips = result.trips.filter(t => t.path_id === 'mock-outbound-id');
            const outboundTimes = outboundTrips.map(t => t.departure_time_seconds);

            expect(outboundTimes).toContain(0);
            expect(outboundTimes).toContain(2);
            expect(outboundTimes).toContain(4);
        });

        it('should return realUnitCount equal to units.length', () => {
            const units = createUnits(3);

            const result = strategy['generateTripsWithFixedUnits']({
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 1,
                outboundIntervalSeconds: 1,
                outboundTotalTimeSeconds: 1,
                inboundTotalTimeSeconds: 1,
                units,
                outboundPath: mockOutboundPath,
                inboundPath: mockInboundPath
            } as any);

            expect(result.realUnitCount).toBe(3);
        });
    });

    describe('AsymmetricScheduleStrategy generateTrips', () => {

        let strategy: ScheduleTypes.AsymmetricScheduleStrategy;
        let generateTripsWithIntervalsSpy: jest.SpyInstance;
        let generateTripsWithFixedUnitsSpy: jest.SpyInstance;

        beforeEach(() => {
            strategy = new ScheduleTypes.AsymmetricScheduleStrategy();

            generateTripsWithIntervalsSpy = jest.spyOn(strategy as any, 'generateTripsWithIntervals').mockReturnValue(['interval-trip']);
            generateTripsWithFixedUnitsSpy = jest.spyOn(strategy as any, 'generateTripsWithFixedUnits').mockReturnValue(['fixed-trip']);
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('calls generateTripsWithIntervals when both intervals are provided', () => {
            const options = {
                outboundIntervalSeconds: 300,
                inboundIntervalSeconds: 300,
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 3600,
                outboundTotalTimeSeconds: 1800,
                inboundTotalTimeSeconds: 1600,
                units: [],
                outboundPath: {} as any,
                inboundPath: {} as any
            };

            const result = strategy.generateTrips(options);

            expect(generateTripsWithIntervalsSpy).toHaveBeenCalledTimes(1);
            expect(generateTripsWithIntervalsSpy).toHaveBeenCalledWith(options);
            expect(generateTripsWithFixedUnitsSpy).not.toHaveBeenCalled();
            expect(result).toEqual(['interval-trip']);
        });

        it('calls generateTripsWithFixedUnits when intervals are null', () => {
            const options = {
                outboundIntervalSeconds: null,
                inboundIntervalSeconds: null,
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 3600,
                outboundTotalTimeSeconds: 1800,
                inboundTotalTimeSeconds: 1600,
                units: [],
                outboundPath: {} as any,
                inboundPath: {} as any
            } as any;

            const result = strategy.generateTrips(options);

            expect(generateTripsWithFixedUnitsSpy).toHaveBeenCalledTimes(1);
            expect(generateTripsWithFixedUnitsSpy).toHaveBeenCalledWith({
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 3600,
                outboundIntervalSeconds: null,
                outboundTotalTimeSeconds: 1800,
                inboundTotalTimeSeconds: 1600,
                units: [],
                outboundPath: {} as any,
                inboundPath: {} as any
            });

            expect(generateTripsWithIntervalsSpy).not.toHaveBeenCalled();
            expect(result).toEqual(['fixed-trip']);
        });

        it('calls generateTripsWithFixedUnits when one of the intervals is null', () => {
            const options = {
                outboundIntervalSeconds: 300,
                inboundIntervalSeconds: null,
                startAtSecondsSinceMidnight: 0,
                endAtSecondsSinceMidnight: 3600,
                outboundTotalTimeSeconds: 1800,
                inboundTotalTimeSeconds: 1600,
                units: [],
                outboundPath: {} as any,
                inboundPath: {} as any
            } as any;

            const result = strategy.generateTrips(options);

            expect(generateTripsWithFixedUnitsSpy).toHaveBeenCalledTimes(1);
            expect(generateTripsWithIntervalsSpy).not.toHaveBeenCalled();
            expect(result).toEqual(['fixed-trip']);
        });
    });

});

describe('getClonedAttributes', () => {
    test('should properly remove specific fields when deleteSpecifics is true', () => {
        // Create a Schedule object with specific attributes to be removed
        const scheduleId = uuidV4();
        const testSchedule = new Schedule({
            id: scheduleId,
            integer_id: 123,
            line_id: lineId,
            service_id: serviceId,
            periods_group_shortname: 'test_group',
            periods: [
                {
                    id: uuidV4(),
                    integer_id: 456,
                    schedule_id: 789,
                    created_at: '2022-01-01',
                    updated_at: '2022-01-02',
                    period_shortname: 'test_period',
                    start_at_hour: 8,
                    end_at_hour: 18,
                    trips: [
                        {
                            id: uuidV4(),
                            integer_id: 999,
                            schedule_period_id: 456,
                            created_at: '2022-01-01',
                            updated_at: '2022-01-02',
                            path_id: pathId,
                            departure_time_seconds: 28800, // 8:00
                            arrival_time_seconds: 29400,   // 8:10
                            node_arrival_times_seconds: [null, 28900, 29400],
                            node_departure_times_seconds: [28800, 29000, null],
                            nodes_can_board: [true, true, false],
                            nodes_can_unboard: [false, true, true]
                        }
                    ]
                }
            ]
        }, true);

        // Get cloned attributes with deleteSpecifics=true
        const clonedAttributes = testSchedule.getClonedAttributes(true);

        // Check that specific fields have been properly removed
        
        // 1. Check at the schedule level
        // It seems that the id is also removed when deleteSpecifics=true
        expect(clonedAttributes).not.toHaveProperty('id');
        expect(clonedAttributes).not.toHaveProperty('integer_id');
        
        // But we verify that the essential properties are preserved
        expect(clonedAttributes).toHaveProperty('line_id', lineId);
        expect(clonedAttributes).toHaveProperty('service_id', serviceId);
        
        // 2. Check at the periods level
        expect(clonedAttributes.periods).toBeDefined();
        
        // Ensure that periods exist before accessing them
        if (clonedAttributes.periods) {
            expect(clonedAttributes.periods.length).toBe(1);
            
            const period = clonedAttributes.periods[0];
            expect(period).not.toHaveProperty('id');
            expect(period).not.toHaveProperty('integer_id');
            expect(period).not.toHaveProperty('schedule_id');
            expect(period).not.toHaveProperty('created_at');
            expect(period).not.toHaveProperty('updated_at');
            expect(period).toHaveProperty('period_shortname', 'test_period');
            
            // 3. Check at the trips level
            expect(period.trips).toBeDefined();
            
            // Ensure that trips exist before accessing them
            if (period.trips) {
                expect(period.trips.length).toBe(1);
                
                const trip = period.trips[0];
                expect(trip).not.toHaveProperty('id');
                expect(trip).not.toHaveProperty('integer_id');
                expect(trip).not.toHaveProperty('schedule_period_id');
                expect(trip).not.toHaveProperty('created_at');
                expect(trip).not.toHaveProperty('updated_at');
                expect(trip).toHaveProperty('path_id', pathId);
                expect(trip).toHaveProperty('departure_time_seconds', 28800);
            } else {
                fail('Period trips is undefined');
            }
        } else {
            fail('Cloned attributes periods is undefined');
        }
    });

    test('should keep specific fields when deleteSpecifics is false', () => {
        // Create a Schedule object with specific attributes
        const scheduleId = uuidV4();
        const periodId = uuidV4();
        const tripId = uuidV4();
        
        const testSchedule = new Schedule({
            id: scheduleId,
            integer_id: 123,
            line_id: lineId,
            service_id: serviceId,
            periods_group_shortname: 'test_group',
            periods: [
                {
                    id: periodId,
                    integer_id: 456,
                    schedule_id: 789,
                    created_at: '2022-01-01',
                    updated_at: '2022-01-02',
                    period_shortname: 'test_period',
                    start_at_hour: 8,
                    end_at_hour: 18,
                    trips: [
                        {
                            id: tripId,
                            integer_id: 999,
                            schedule_period_id: 456,
                            created_at: '2022-01-01',
                            updated_at: '2022-01-02',
                            path_id: pathId,
                            departure_time_seconds: 28800,
                            arrival_time_seconds: 29400
                        }
                    ]
                }
            ]
        }, true);

        // Get cloned attributes with deleteSpecifics=false
        const clonedAttributes = testSchedule.getClonedAttributes(false);

        // Check that specific fields have been retained
        
        // 1. Check at the schedule level
        expect(clonedAttributes).toHaveProperty('id', scheduleId);
        expect(clonedAttributes).toHaveProperty('integer_id', 123);
        
        // 2. Check at the periods level
        expect(clonedAttributes.periods).toBeDefined();
        
        if (clonedAttributes.periods && clonedAttributes.periods.length > 0) {
            const period = clonedAttributes.periods[0];
            expect(period).toHaveProperty('id', periodId);
            expect(period).toHaveProperty('integer_id', 456);
            expect(period).toHaveProperty('schedule_id', 789);
            expect(period).toHaveProperty('created_at', '2022-01-01');
            expect(period).toHaveProperty('updated_at', '2022-01-02');
            
            // 3. Check at the trips level
            expect(period.trips).toBeDefined();
            
            // Ensure that trips exist before accessing them
            if (period.trips && period.trips.length > 0) {
                const trip = period.trips[0];
                expect(trip).toHaveProperty('id', tripId);
                expect(trip).toHaveProperty('integer_id', 999);
                expect(trip).toHaveProperty('schedule_period_id', 456);
                expect(trip).toHaveProperty('created_at', '2022-01-01');
                expect(trip).toHaveProperty('updated_at', '2022-01-02');
            } else {
                fail('Period trips is undefined or empty');
            }
        } else {
            fail('Cloned attributes periods is undefined or empty');
        }
    });
});

describe('Schedule static methods', () => {
    test('getPluralName should return "schedules"', () => {
        expect(Schedule.getPluralName()).toBe('schedules');
    });

    test('getCapitalizedPluralName should return "Schedules"', () => {
        expect(Schedule.getCapitalizedPluralName()).toBe('Schedules');
    });

    test('getDisplayName should return the displayName property', () => {
        // we can verify that getDisplayName returns a non-empty value
        const displayName = Schedule.getDisplayName();
        expect(displayName).toBeDefined();
        expect(typeof displayName).toBe('string');
        expect(displayName.length).toBeGreaterThan(0);

        expect(displayName).toBe('Schedule');
    });
});