/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { v4 as uuidV4 } from 'uuid';
import {
    exists,
    read,
    create,
    update,
    truncate,
    deleteRecord,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import _cloneDeep from 'lodash.clonedeep';
import {
    SchedulePeriodTrip,
    SchedulePeriod,
    ScheduleAttributes
} from 'transition-common/lib/services/schedules/Schedule';

import {
    secondsSinceMidnightToTimeStr,
    timeStrToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';

const scheduleTable = 'tr_transit_schedules';
const periodTable = 'tr_transit_schedule_periods';
const tripTable = 'tr_transit_schedule_trips';

const scheduleAttributesCleaner = function(attributes: Partial<ScheduleAttributes>): Partial<ScheduleAttributes> {
    const _attributes = _cloneDeep(attributes);
    delete _attributes.periods;
    return _attributes;
};

const schedulePeriodsAttributesCleaner = function(attributes: Partial<SchedulePeriod>): { [key: string]: any } {
    const {
        id,
        schedule_id,
        outbound_path_id,
        inbound_path_id,
        period_shortname,
        interval_seconds,
        number_of_units,
        start_at_hour,
        end_at_hour,
        custom_start_at_str,
        custom_end_at_str
    } = attributes;
    return {
        id,
        schedule_id,
        outbound_path_id,
        inbound_path_id,
        period_shortname,
        interval_seconds,
        number_of_units,
        period_start_at_seconds: start_at_hour ? start_at_hour * 3600 : -1,
        period_end_at_seconds: end_at_hour ? end_at_hour * 3600 : -1,
        custom_start_at_seconds: custom_start_at_str ? timeStrToSecondsSinceMidnight(custom_start_at_str) : -1,
        custom_end_at_seconds: custom_end_at_str ? timeStrToSecondsSinceMidnight(custom_end_at_str) : -1
    };
};

const schedulePeriodsAttributesParser = function(attributes: any): SchedulePeriod {
    const {
        period_start_at_seconds,
        period_end_at_seconds,
        custom_start_at_seconds,
        custom_end_at_seconds,
        ...rest
    } = attributes;
    return {
        ...rest,
        start_at_hour: period_start_at_seconds >= 0 ? period_start_at_seconds / 3600 : null,
        end_at_hour: period_end_at_seconds >= 0 ? period_end_at_seconds / 3600 : null,
        custom_start_at_str:
            custom_start_at_seconds >= 0 ? secondsSinceMidnightToTimeStr(custom_start_at_seconds) : null,
        custom_end_at_str: custom_end_at_seconds >= 0 ? secondsSinceMidnightToTimeStr(custom_end_at_seconds) : null
    };
};

const scheduleTripsAttributesCleaner = function(attributes: Partial<SchedulePeriodTrip>): { [key: string]: any } {
    const _attributes = _cloneDeep(attributes) as any;
    delete _attributes.unitReadyAt;
    delete _attributes.unitDirection;
    delete _attributes.is_frozen;
    // TODO consider renaming those fields in the object when we migrate to typescript
    _attributes.node_arrival_time_seconds = _attributes.node_arrival_times_seconds;
    delete _attributes.node_arrival_times_seconds;
    _attributes.node_departure_time_seconds = _attributes.node_departure_times_seconds;
    delete _attributes.node_departure_times_seconds;
    return _attributes;
};

const scheduleTripsAttributesParser = function(attributes: any): SchedulePeriodTrip {
    const { node_departure_time_seconds, node_arrival_time_seconds, ...rest } = attributes;
    return {
        ...rest,
        node_departure_times_seconds: node_departure_time_seconds,
        node_arrival_times_seconds: node_arrival_time_seconds
    };
};

const createFromTrip = async function(periodTrip: SchedulePeriodTrip, scheduleId: string, periodId: string) {
    if (!periodTrip.id) {
        periodTrip.id = uuidV4();
    }
    if (!periodTrip.schedule_id) {
        periodTrip.schedule_id = scheduleId;
    }
    if (!periodTrip.schedule_period_id) {
        periodTrip.schedule_period_id = periodId;
    }
    const id = await create(knex, tripTable, scheduleTripsAttributesCleaner, periodTrip, 'id');
    return id;
};

const createFromPeriod = async function(periodSchedule: SchedulePeriod, schedule_id: string) {
    if (!periodSchedule.id) {
        periodSchedule.id = uuidV4();
    }
    if (!periodSchedule.schedule_id) {
        periodSchedule.schedule_id = schedule_id;
    }
    const id = await create(knex, periodTable, schedulePeriodsAttributesCleaner, periodSchedule, 'id');
    if (periodSchedule.trips) {
        for (let i = 0; i < periodSchedule.trips.length; i++) {
            await createFromTrip(periodSchedule.trips[i], schedule_id, id);
        }
    }
    return id;
};

// create all needed inserts from scheduleData (from scheduleByServiceId[serviceId])
const createFromScheduleData = async function(scheduleData: ScheduleAttributes) {
    const id = await create(knex, scheduleTable, scheduleAttributesCleaner, scheduleData, 'id');
    for (let i = 0; i < scheduleData.periods.length; i++) {
        await createFromPeriod(scheduleData.periods[i], id);
    }
    return id;
};

const updateFromTrip = async function(periodTrip: Partial<SchedulePeriodTrip>) {
    if (!periodTrip.id || !periodTrip.schedule_id || !periodTrip.schedule_period_id) {
        throw 'Missing trip, schedule or period id for trip, cannot update';
    }
    const id = await update(knex, tripTable, scheduleTripsAttributesCleaner, periodTrip.id, periodTrip, 'id');
    return id;
};

const updateFromPeriod = async function(periodSchedule: Partial<SchedulePeriod>) {
    if (!periodSchedule.id || !periodSchedule.schedule_id) {
        throw 'Missing schedule or period id for period, cannot update';
    }
    const id = await update(
        knex,
        periodTable,
        schedulePeriodsAttributesCleaner,
        periodSchedule.id,
        periodSchedule,
        'id'
    );
    const tripIds = await getTripIdsForPeriod(id);
    const currentTrips: string[] = [];
    // Update or create periods in schedule
    if (periodSchedule.trips) {
        for (let i = 0; i < periodSchedule.trips.length; i++) {
            const trip = periodSchedule.trips[i];
            if (tripIds.includes(trip.id)) {
                currentTrips.push(await updateFromTrip(trip));
            } else {
                currentTrips.push(await createFromTrip(trip, periodSchedule.schedule_id, id));
            }
        }
    }
    // Delete any period that was deleted
    const deletedTrips = tripIds.filter((periodId) => !currentTrips.includes(periodId));
    await Promise.all(deletedTrips.map(deleteSchedulePeriodTrip));
    return id;
};

const updateFromScheduleData = async function(scheduleId: string, scheduleData: ScheduleAttributes) {
    const id = await update(knex, scheduleTable, scheduleAttributesCleaner, scheduleId, scheduleData, 'id');
    const periodIds = await getPeriodIdsForSchedule(id);
    const currentPeriods: string[] = [];
    // Update or create periods in schedule
    for (let i = 0; i < scheduleData.periods.length; i++) {
        const period = scheduleData.periods[i];
        if (periodIds.includes(period.id)) {
            currentPeriods.push(await updateFromPeriod(period));
        } else {
            currentPeriods.push(await createFromPeriod(period, id));
        }
    }
    // Delete any period that was deleted
    const deletedPeriods = periodIds.filter((periodId) => !currentPeriods.includes(periodId));
    await Promise.all(deletedPeriods.map(deleteSchedulePeriod));
    return id;
};

const save = async function(scheduleData: ScheduleAttributes) {
    const scheduleExists = await exists(knex, scheduleTable, scheduleData.id);
    return scheduleExists
        ? await updateFromScheduleData(scheduleData.id, scheduleData)
        : await createFromScheduleData(scheduleData);
};

const getPeriodIdsForSchedule = async function(schedule_id: string) {
    const rows = await knex(periodTable)
        .select(knex.raw('id'))
        .where('schedule_id', schedule_id);
    // TODO Figure out if we can type this, examples like https://github.com/bkonkle/node-knex-typescript-example/blob/master/src/users/UserData.ts seem to cast the return value to an interface first
    return rows.map((row) => (row as any).id);
};

const getTripIdsForPeriod = async function(period_id: string) {
    const rows = await knex(tripTable)
        .select(knex.raw('id'))
        .where('schedule_period_id', period_id);
    return rows.map((row) => (row as any).id);
};

const getScheduleIdsForLine = async function(line_id: string) {
    const rows = await knex(scheduleTable)
        .select(knex.raw('id'))
        .where('line_id', line_id);
    return rows.map((row) => (row as any).id);
};

const readScheduleTrips = async function(period_id: string) {
    const rows = await knex(tripTable)
        .select(knex.raw('*'))
        .where('schedule_period_id', period_id);
    const trips: SchedulePeriodTrip[] = [];
    for (let i = 0; i < rows.length; i++) {
        trips.push(scheduleTripsAttributesParser(rows[i]));
    }
    return trips;
};

const readSchedulePeriods = async function(id: string) {
    const rows = await knex(periodTable)
        .select(knex.raw('*'))
        .where('schedule_id', id);
    const periods: SchedulePeriod[] = [];
    for (let i = 0; i < rows.length; i++) {
        const period = schedulePeriodsAttributesParser(rows[i]);
        periods.push(period);
        period.trips = await readScheduleTrips(period.id);
        period.trips.sort((a, b) => a.departure_time_seconds - b.departure_time_seconds);
    }
    return periods;
};

const readScheduleData = async function(id: string) {
    const schedule = (await read(knex, scheduleTable, undefined, '*', id)) as ScheduleAttributes;
    schedule.periods = await readSchedulePeriods(id);
    schedule.periods.sort((a, b) => a.start_at_hour - b.start_at_hour);
    return schedule;
};

const readForLine = async function(lineId: string) {
    // TODO Read objects independently. It would be possible to make it all in one query to DB if performance becomes problematic
    const scheduleIds = await getScheduleIdsForLine(lineId);
    return await Promise.all(scheduleIds.map(readScheduleData));
};

const deleteSchedulePeriod = async function(id: string) {
    return await deleteRecord(knex, periodTable, id);
};

const deleteSchedulePeriodTrip = async function(id: string) {
    return await deleteRecord(knex, tripTable, id);
};

const deleteScheduleData = async function(id: string) {
    return await deleteRecord(knex, scheduleTable, id);
};

const getCollectionSubquery = () => {
    // Get the complete collection from DB, with trips aggregated
    const subquery = knex(`${periodTable} as p`)
        .leftJoin(`${tripTable} as trip`, function() {
            this.on('p.id', 'trip.schedule_period_id');
        })
        .select(
            knex.raw(`
            p.*, 
            json_agg(trip order by trip.departure_time_seconds) as trips
        `)
        )
        .groupByRaw('p.id, trip.schedule_period_id')
        .as('periods');
    return knex(`${scheduleTable} as sched`)
        .leftJoin(subquery, function() {
            this.on('sched.id', 'periods.schedule_id');
        })
        .select(
            knex.raw(`
            sched.*, 
            json_agg(periods order by periods.period_start_at_seconds) as periods
        `)
        )
        .groupByRaw('sched.id, periods.schedule_id');
};

const dbRowToScheduleAttributes = (row: any): ScheduleAttributes => {
    const schedule = (row as unknown) as ScheduleAttributes;
    // Clean attributes
    if (schedule.periods && schedule.periods[0]) {
        schedule.periods = schedule.periods.map((period) => {
            const newPeriod = schedulePeriodsAttributesParser(period);
            // A period without trips would have an array of one null element, ignore in this case
            if (period.trips && period.trips[0]) {
                newPeriod.trips = period.trips.map(scheduleTripsAttributesParser);
            } else {
                newPeriod.trips = [];
            }
            return newPeriod;
        });
    } else {
        schedule.periods = [];
    }
    return schedule;
};

const readForLines = async function(lineIds: string[]): Promise<ScheduleAttributes[]> {
    if (lineIds.length === 0) {
        // Empty line array, return empty
        return [];
    }
    const collection = await getCollectionSubquery()
        .whereIn('sched.line_id', lineIds)
        .orderByRaw('sched.line_id');
    return collection.map(dbRowToScheduleAttributes);
};

const collection = async function() {
    const collection = await getCollectionSubquery().orderByRaw('sched.line_id');

    return collection.map(dbRowToScheduleAttributes);
};

export default {
    exists: exists.bind(null, knex, scheduleTable),
    read: readScheduleData,
    readForLine,
    create: createFromScheduleData,
    /** Use the 'save' method instead as it will either create or update if necessary */

    update: updateFromScheduleData,
    save,
    delete: deleteScheduleData,
    getScheduleIdsForLine,
    truncateSchedules: truncate.bind(null, knex, scheduleTable),
    truncateSchedulePeriods: truncate.bind(null, knex, periodTable),
    truncateScheduleTrips: truncate.bind(null, knex, tripTable),
    destroy: destroy.bind(null, knex),
    /** Get the complete collection of schedules, with all periods and trips */
    collection,
    /** Read the schedules for a list of lines */
    readForLines
};
