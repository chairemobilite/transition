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
import Schedule, { SchedulePeriod, BusUnit, BusLocation, BusDirection} from '../Schedule';
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

describe('updateBusAvailability', () => {
    let unit: BusUnit;

    beforeEach(() => {
        
        unit = {
            id: 1,
            totalCapacity: 50,
            seatedCapacity: 40,
            currentLocation: BusLocation.ORIGIN,
            expectedArrivalTime: 0,
            expectedReturnTime: null,
            direction: null,
            lastTripEndTime: null,
            timeInCycle: 0
        };
    });

    test('should update outbound bus to destination when arrived', () => {
        unit.direction = BusDirection.OUTBOUND;
        unit.expectedArrivalTime = 100;
        const currentTimeSeconds = 100;
        const testAttributes = _cloneDeep(scheduleAttributes);
        testAttributes.periods = [];
        const schedule = new Schedule(testAttributes, true);

        schedule["updateBusAvailability"](unit, currentTimeSeconds);

        expect(unit.currentLocation).toBe(BusLocation.DESTINATION);
        expect(unit.direction).toBeNull();
        expect(unit.lastTripEndTime).toBe(currentTimeSeconds);
    });

    test('should update inbound bus to origin when arrived', () => {
        unit.direction = BusDirection.INBOUND;
        unit.expectedArrivalTime = 100;
        const currentTimeSeconds = 100;
        const testAttributes = _cloneDeep(scheduleAttributes);
        testAttributes.periods = [];
        const schedule = new Schedule(testAttributes, true);

        schedule["updateBusAvailability"](unit, currentTimeSeconds);

        expect(unit.currentLocation).toBe(BusLocation.ORIGIN);
        expect(unit.direction).toBeNull();
        expect(unit.lastTripEndTime).toBe(currentTimeSeconds);
    });

    test('should not update outbound bus if not arrived', () => {
        unit.direction = BusDirection.OUTBOUND;
        unit.expectedArrivalTime = 200;
        const currentTimeSeconds = 100;
        const testAttributes = _cloneDeep(scheduleAttributes);
        testAttributes.periods = [];
        const schedule = new Schedule(testAttributes, true);

        schedule["updateBusAvailability"](unit, currentTimeSeconds);

        expect(unit.currentLocation).toBe(BusLocation.ORIGIN);
        expect(unit.direction).toBe(BusDirection.OUTBOUND);
        expect(unit.lastTripEndTime).toBeNull();
    });

    test('should not update inbound bus if not arrived', () => {
        unit.direction = BusDirection.INBOUND;
        unit.expectedArrivalTime = 200;
        const currentTimeSeconds = 100;
        const testAttributes = _cloneDeep(scheduleAttributes);
        testAttributes.periods = [];
        const schedule = new Schedule(testAttributes, true);

        schedule["updateBusAvailability"](unit, currentTimeSeconds);

        expect(unit.currentLocation).toBe(BusLocation.ORIGIN);
        expect(unit.direction).toBe(BusDirection.INBOUND);
        expect(unit.lastTripEndTime).toBeNull();
    });

    test('should not update bus if direction is null', () => {
        unit.direction = null;
        unit.expectedArrivalTime = 100;
        const currentTimeSeconds = 100;
        const testAttributes = _cloneDeep(scheduleAttributes);
        testAttributes.periods = [];
        const schedule = new Schedule(testAttributes, true);

        schedule["updateBusAvailability"](unit, currentTimeSeconds);

        expect(unit.currentLocation).toBe(BusLocation.ORIGIN);
        expect(unit.direction).toBeNull();
        expect(unit.lastTripEndTime).toBeNull();
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
    const smallPeriodsForUpdate: SchedulePeriod[] = [{
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
