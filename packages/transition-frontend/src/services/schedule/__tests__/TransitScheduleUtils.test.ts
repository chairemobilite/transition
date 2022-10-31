/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as ScheduleUtils from '../TransitScheduleUtils';
import Schedule from 'transition-common/lib/services/schedules/Schedule';

export const scheduleBase = new Schedule({
    id: "base",
    periods: [
        { period_shortname: "1", start_at_hour: 4, end_at_hour: 6, trips: [
            { arrival_time_seconds: 100, departure_time_seconds: 200, path_id: "outbound" },
            { arrival_time_seconds: 250, departure_time_seconds: 350, path_id: "inbound" },
            { arrival_time_seconds: 400, departure_time_seconds: 500, path_id: "outbound" },
        ] },
        { period_shortname: "2", start_at_hour: 6, end_at_hour: 9, trips: [] },
        { period_shortname: "3", start_at_hour: 9, end_at_hour: 15, trips: [
            { arrival_time_seconds: 2100, departure_time_seconds: 2200, path_id: "outbound" },
            { arrival_time_seconds: 2300, departure_time_seconds: 2400, path_id: "inbound" },
            { arrival_time_seconds: 2500, departure_time_seconds: 2600, path_id: "outbound" },
        ] },
        { period_shortname: "4", start_at_hour: 15, end_at_hour: 18, trips: [] },
        { period_shortname: "5", start_at_hour: 18, end_at_hour: 24, trips: [] }
    ],
}, false);

export const scheduleSamePeriod = new Schedule({
    id: "sameperiod",
    periods: [
        { period_shortname: "1", start_at_hour: 4, end_at_hour: 6, trips: [] },
        { period_shortname: "2", start_at_hour: 6, end_at_hour: 9, trips: [
            { arrival_time_seconds: 1000, departure_time_seconds: 1100, path_id: "outbound" },
            { arrival_time_seconds: 1250, departure_time_seconds: 1350, path_id: "inbound" },
            { arrival_time_seconds: 1400, departure_time_seconds: 1500, path_id: "outbound" },
        ] },
        { period_shortname: "3", start_at_hour: 9, end_at_hour: 15, trips: [
            { arrival_time_seconds: 2050, departure_time_seconds: 2150, path_id: "outbound" },
            { arrival_time_seconds: 2350, departure_time_seconds: 2450, path_id: "inbound" },
            { arrival_time_seconds: 2600, departure_time_seconds: 2700, path_id: "outbound" },
        ] },
        { period_shortname: "4", start_at_hour: 15, end_at_hour: 18, trips: [] },
        { period_shortname: "5", start_at_hour: 18, end_at_hour: 24, trips: [] }
    ],
}, false);

const notSameAmount = new Schedule({
    id: "notsameperiod",
    periods: [
        { period_shortname: "1", start_at_hour: 4, end_at_hour: 6, trips: [] },
        { period_shortname: "2", start_at_hour: 6, end_at_hour: 9, trips: [] },
        { period_shortname: "3", start_at_hour: 9, end_at_hour: 15, trips: [] },
        { period_shortname: "4", start_at_hour: 15, end_at_hour: 18, trips: [] },
    ],
}, false);

const noPeriods = new Schedule({
    id: "noperiod",
}, false);

export const differentTimes = new Schedule({
    id: "differentTimePeriods",
    periods: [
        { period_shortname: "1", start_at_hour: 4, end_at_hour: 6, trips: [] },
        { period_shortname: "2", start_at_hour: 6, end_at_hour: 9, trips: [] },
        { period_shortname: "3", start_at_hour: 9, end_at_hour: 15, trips: [] },
        { period_shortname: "4", start_at_hour: 15, end_at_hour: 19, trips: [] },
        { period_shortname: "5", start_at_hour: 19, end_at_hour: 24, trips: [] }
    ],
}, false);

test('Have Same Periods', () => {
    expect(ScheduleUtils.haveSamePeriods(scheduleBase, scheduleSamePeriod)).toBeTruthy();
    expect(ScheduleUtils.haveSamePeriods(scheduleBase, notSameAmount)).toBeFalsy();
    expect(ScheduleUtils.haveSamePeriods(scheduleBase, noPeriods)).toBeFalsy();
    expect(ScheduleUtils.haveSamePeriods(scheduleBase, differentTimes)).toBeFalsy();
    expect(ScheduleUtils.haveSamePeriods(noPeriods, differentTimes)).toBeFalsy();
});

test('Merge trips', () => {
    const clonedSchedule = new Schedule(scheduleBase.attributes, false);
    // clonedSchedule is now expected to have merged schedule
    ScheduleUtils.mergeScheduleTrips(clonedSchedule, scheduleSamePeriod);
    // Period 1, should be the trips from the first schedule
    const firstPeriod = clonedSchedule.attributes.periods[0];
    const firstTrips = firstPeriod.trips;
    expect(firstTrips.length).toBe(3);
    expect(firstTrips).toEqual(scheduleBase.attributes.periods[0].trips);

    // Period 2 should be the trips from the second schedule only
    const secondPeriod = clonedSchedule.attributes.periods[1];
    const secondTrips = secondPeriod.trips;
    expect(secondTrips.length).toBe(3);
    expect(secondTrips).toEqual(scheduleSamePeriod.attributes.periods[1].trips);

    // Period 3 should merge the trips
    const thirdPeriod = clonedSchedule.attributes.periods[2];
    const thirdTrips = thirdPeriod.trips;
    expect(thirdTrips.length).toBe(6);
    const baseTrips = scheduleBase.attributes.periods[2].trips;
    const otherTrips = scheduleSamePeriod.attributes.periods[2].trips;
    expect(thirdTrips).toEqual([otherTrips[0], baseTrips[0], baseTrips[1], otherTrips[1], baseTrips[2], otherTrips[2]]);
});
