/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Schedule, { SchedulePeriodTrip } from 'transition-common/lib/services/schedules/Schedule';

export const haveSamePeriods = (schedule1: Schedule, schedule2: Schedule): boolean => {
    const periods1 = schedule1.attributes.periods;
    const periods2 = schedule2.attributes.periods;
    if (periods1.length !== periods2.length) {
        return false;
    }
    for (let i = 0; i < periods1?.length; i++) {
        const period1 = periods1[i];
        const period2 = periods2[i];
        if (period1.start_at_hour !== period2.start_at_hour || period1.end_at_hour !== period2.end_at_hour) {
            return false;
        }
    }
    return true;
};

const mergeTrips = (trips: SchedulePeriodTrip[], toMerge: SchedulePeriodTrip): void => {
    const findIndex = trips.findIndex((element) => element.departure_time_seconds > toMerge.departure_time_seconds);
    const insertIndex = findIndex === -1 ? trips.length : findIndex;
    trips.splice(insertIndex, 0, toMerge);
};

export const mergeScheduleTrips = (schedule: Schedule, toMerge: Schedule): void => {
    const basePeriods = schedule.attributes.periods;
    const mergePeriods = toMerge.attributes.periods;
    if (basePeriods.length !== mergePeriods?.length) {
        return;
    }
    for (let i = 0; i < basePeriods?.length; i++) {
        const basePeriod = basePeriods[i];
        const mergePeriod = mergePeriods[i];

        const baseTrips = basePeriod.trips;
        if (baseTrips.length === 0) {
            // Just add the mergeTrip
            basePeriod.trips = mergePeriod.trips;
            continue;
        }
        const tripsToMerge = mergePeriod.trips;
        for (let j = 0; j < tripsToMerge.length; j++) {
            mergeTrips(baseTrips, tripsToMerge[j]);
        }
    }
    return;
};
