/*
 * Copyright 2022-2025, Polytechnique Montreal and contributors
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
    destroy,
    createMultiple,
    deleteMultiple,
    updateMultiple
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import _cloneDeep from 'lodash/cloneDeep';
import {
    SchedulePeriodTrip,
    SchedulePeriod,
    ScheduleAttributes
} from 'transition-common/lib/services/schedules/Schedule';

import {
    secondsSinceMidnightToTimeStr,
    timeStrToSecondsSinceMidnight
} from 'chaire-lib-common/lib/utils/DateTimeUtils';
import { Knex } from 'knex';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const scheduleTable = 'tr_transit_schedules';
const periodTable = 'tr_transit_schedule_periods';
const tripTable = 'tr_transit_schedule_trips';

// In the database, the schedule table has a uuid column, and numeric id, but this needs to be mapped respectively to the string id and integer_id

const scheduleAttributesCleaner = function (attributes: Partial<ScheduleAttributes>): Partial<ScheduleAttributes> {
    const { integer_id, id, ...rest } = attributes;
    const _attributes = _cloneDeep(rest) as any;
    delete _attributes.periods;
    if (typeof integer_id === 'number' && integer_id > 0) {
        _attributes.id = integer_id;
    } else {
        delete _attributes.id;
    }
    _attributes.uuid = id;
    return _attributes;
};

const scheduleAttributesParser = function (attributes: { [key: string]: any }): Partial<ScheduleAttributes> {
    const { id, uuid, ...rest } = attributes;
    return {
        ...rest,
        id: uuid,
        integer_id: id
    };
};

const schedulePeriodsAttributesCleaner = function (attributes: Partial<SchedulePeriod>): { [key: string]: any } {
    const {
        id,
        integer_id,
        schedule_id,
        outbound_path_id,
        inbound_path_id,
        period_shortname,
        interval_seconds,
        inbound_interval_seconds,
        number_of_units,
        start_at_hour,
        end_at_hour,
        custom_start_at_str,
        custom_end_at_str
    } = attributes;
    return {
        uuid: id || uuidV4(),
        id: typeof integer_id === 'number' && integer_id > 0 ? integer_id : undefined,
        schedule_id,
        outbound_path_id,
        inbound_path_id,
        period_shortname,
        interval_seconds,
        inbound_interval_seconds,
        number_of_units,
        period_start_at_seconds: start_at_hour ? start_at_hour * 3600 : -1,
        period_end_at_seconds: end_at_hour ? end_at_hour * 3600 : -1,
        custom_start_at_seconds: custom_start_at_str ? timeStrToSecondsSinceMidnight(custom_start_at_str) : -1,
        custom_end_at_seconds: custom_end_at_str ? timeStrToSecondsSinceMidnight(custom_end_at_str) : -1
    };
};

const schedulePeriodsAttributesParser = function (attributes: any): SchedulePeriod {
    const {
        id,
        uuid,
        period_start_at_seconds,
        period_end_at_seconds,
        custom_start_at_seconds,
        custom_end_at_seconds,
        ...rest
    } = attributes;
    return {
        ...rest,
        id: uuid,
        integer_id: id,
        start_at_hour: period_start_at_seconds >= 0 ? period_start_at_seconds / 3600 : null,
        end_at_hour: period_end_at_seconds >= 0 ? period_end_at_seconds / 3600 : null,
        custom_start_at_str:
            custom_start_at_seconds >= 0 ? secondsSinceMidnightToTimeStr(custom_start_at_seconds) : null,
        custom_end_at_str: custom_end_at_seconds >= 0 ? secondsSinceMidnightToTimeStr(custom_end_at_seconds) : null
    };
};

const scheduleTripsAttributesCleaner = function (attributes: Partial<SchedulePeriodTrip>): { [key: string]: any } {
    const { id, integer_id, ...rest } = attributes;
    const _attributes = _cloneDeep(rest) as any;
    _attributes.uuid = id || uuidV4();
    _attributes.id = typeof integer_id === 'number' && integer_id > 0 ? integer_id : undefined;
    delete _attributes.unitReadyAt;
    delete _attributes.unitDirection;
    delete _attributes.is_frozen;
    // TODO consider renaming those fields in the object when we migrate to typescript
    _attributes.node_arrival_time_seconds = _attributes.node_arrival_times_seconds;
    delete _attributes.node_arrival_times_seconds;
    _attributes.node_departure_time_seconds = _attributes.node_departure_times_seconds;
    delete _attributes.node_departure_times_seconds;
    _attributes.uuid = attributes.id || uuidV4();
    _attributes.id =
        typeof attributes.integer_id === 'number' && attributes.integer_id > 0 ? attributes.integer_id : undefined;
    return _attributes;
};

const scheduleTripsAttributesParser = function (attributes: any): SchedulePeriodTrip {
    const { id, uuid, node_departure_time_seconds, node_arrival_time_seconds, ...rest } = attributes;
    return {
        ...rest,
        id: uuid,
        integer_id: id,
        node_departure_times_seconds: node_departure_time_seconds,
        node_arrival_times_seconds: node_arrival_time_seconds
    };
};

// Private function to insert trips, with a transaction
const _createTrips = async function (
    periodTrips: SchedulePeriodTrip[],
    options: { transaction: Knex.Transaction }
): Promise<{ id: string }[]> {
    const ids = (await createMultiple(knex, tripTable, scheduleTripsAttributesCleaner, periodTrips, {
        returning: 'uuid',
        transaction: options.transaction
    })) as { id: string }[];
    return ids;
};

// Private function to insert periods, with a transaction
const _createPeriods = async function (
    schedulePeriods: SchedulePeriod[],
    scheduleId: number,
    options: { transaction: Knex.Transaction }
): Promise<{ id: string }[]> {
    schedulePeriods.forEach((period) => {
        if (!period.id) {
            period.id = uuidV4();
        }
        period.schedule_id = scheduleId;
    });

    const ids = (await createMultiple(knex, periodTable, schedulePeriodsAttributesCleaner, schedulePeriods, {
        returning: ['id', 'uuid'],
        transaction: options.transaction
    })) as { id: number; uuid: string }[];
    // Update period's ids
    schedulePeriods.forEach((period, idx) => {
        period.id = ids[idx].uuid;
        period.integer_id = ids[idx].id;
    });
    const tripPromises = schedulePeriods
        .filter((period) => period.trips !== undefined)
        .map((period) => {
            period.trips.forEach((trip) => {
                if (!trip.id) {
                    trip.id = uuidV4();
                }
                trip.schedule_period_id = period.integer_id as number;
            });
            return _createTrips(period.trips, options);
        });
    await Promise.all(tripPromises);
    return ids.map((idUuid) => ({ id: idUuid.uuid }));
};

/**
 * Insert the complete schedule with periods and trips.
 *
 * @param scheduleData The schedule attributes
 * @param options Additional query options. `transaction` is an
 * optional transaction of which this insert is part of.
 * @returns The ID of the newly inserted schedule
 */
const createFromScheduleData = async (
    scheduleData: ScheduleAttributes,
    { transaction }: { transaction?: Knex.Transaction } = {}
): Promise<number> => {
    try {
        // Nested function to require a transaction around the insert
        const createWithTransaction = async (trx: Knex.Transaction) => {
            const idUuid = (await create(knex, scheduleTable, scheduleAttributesCleaner, scheduleData, {
                returning: ['id', 'uuid'],
                transaction: trx
            })) as { id: number; uuid: string };
            if (scheduleData.periods) {
                await _createPeriods(scheduleData.periods, idUuid.id, { transaction: trx });
            }
            return idUuid.id;
        };
        // Make sure the insert is done in a transaction, use the one in argument if available
        return await (transaction ? createWithTransaction(transaction) : knex.transaction(createWithTransaction));
    } catch (error) {
        throw new TrError(
            `Cannot insert schedules with id ${scheduleData.id} in database (knex error: ${error})`,
            'DBSCHED0001',
            'TransitScheduleCannotInsertBecauseDatabaseError'
        );
    }
};

// Private function to update trips within a transaction
const _updateTrips = async function (
    periodTrips: Partial<SchedulePeriodTrip>[],
    options: { transaction: Knex.Transaction }
) {
    periodTrips.forEach((periodTrip) => {
        if (!periodTrip.id || !periodTrip.schedule_period_id) {
            throw 'Missing trip, schedule or period id for trip, cannot update';
        }
    });

    const ids = await updateMultiple(knex, tripTable, scheduleTripsAttributesCleaner, periodTrips, {
        returning: 'id',
        transaction: options.transaction
    });
    return ids;
};

// Private function to update the trips for periods, within a transaction. Trips
// may need to be created, updated or deleted. This function properly decides
// which operation needs to be executed for each trip.
const _updateTripsForPeriods = async (
    schedulePeriods: Partial<SchedulePeriod>[],
    options: { transaction: Knex.Transaction }
) => {
    // Trips need to be inserted, updated or deleted
    const createUpdateDeletePromises: Promise<unknown>[] = [];

    // Get the previous trips for those periods
    const previousTripIds = await _getTripIdsForPeriods(
        schedulePeriods.map((period) => period.integer_id as number),
        options
    );
    const currentTripIds: string[] = [];
    const tripsToInsert: SchedulePeriodTrip[] = [];
    const tripsToUpdate: SchedulePeriodTrip[] = [];

    // Update or create trips in updated periods
    schedulePeriods.forEach((period) => {
        const trips = period.trips || [];
        for (let tripIdx = 0; tripIdx < trips.length; tripIdx++) {
            const trip = trips[tripIdx];
            if (previousTripIds.includes(trip.id)) {
                // Add to current trips and to trips to update
                currentTripIds.push(trip.id);
                tripsToUpdate.push(trip);
            } else {
                // Add to trips to insert
                trip.schedule_period_id = period.integer_id as number;
                tripsToInsert.push(trip);
            }
        }
    });
    if (tripsToInsert.length > 0) {
        createUpdateDeletePromises.push(_createTrips(tripsToInsert, options));
    }
    if (tripsToUpdate.length > 0) {
        createUpdateDeletePromises.push(_updateTrips(tripsToUpdate, options));
    }

    // Delete any period that was deleted
    const deletedTrips = previousTripIds.filter((tripId) => !currentTripIds.includes(tripId));
    if (deletedTrips.length > 0) {
        createUpdateDeletePromises.push(_deleteSchedulePeriodTrips(deletedTrips, options));
    }
    await Promise.all(createUpdateDeletePromises);
};

// Private function to update periods, with transaction
const _updatePeriods = async (
    schedulePeriods: Partial<SchedulePeriod>[],
    options: { transaction: Knex.Transaction }
) => {
    schedulePeriods.forEach((schedulePeriod) => {
        if (!schedulePeriod.id || !schedulePeriod.schedule_id) {
            throw 'Missing schedule or period id for period, cannot update';
        }
    });

    const ids = await updateMultiple(knex, periodTable, schedulePeriodsAttributesCleaner, schedulePeriods, {
        returning: 'uuid',
        transaction: options.transaction
    });

    const periodsWithTrips = schedulePeriods.filter((period) => period.trips !== undefined);
    if (periodsWithTrips.length > 0) {
        await _updateTripsForPeriods(periodsWithTrips, options);
    }
    return ids;
};

/**
 * Update the complete schedule with periods and trips. The update is done in a
 * transaction, that can be passed as an option.
 *
 * @param scheduleId The ID of the schedule to update
 * @param scheduleData The schedule attributes
 * @param options Additional query options. `transaction` is an optional
 * transaction of which this insert is part of.
 * @returns The ID of the updated schedule
 */
const updateFromScheduleData = async (
    scheduleId: number,
    scheduleData: ScheduleAttributes,
    { transaction }: { transaction?: Knex.Transaction } = {}
): Promise<number> => {
    try {
        // Nested function to require a transaction around the update
        const updateWithTransaction = async (trx: Knex.Transaction) => {
            // Update the object itself
            const id = (await update(knex, scheduleTable, scheduleAttributesCleaner, scheduleId, scheduleData, {
                returning: 'id',
                transaction: trx
            })) as number;

            // Quick return if there are no periods to update
            if (scheduleData.periods === undefined) {
                return id;
            }

            // Periods need to be inserted, updated or deleted
            const createUpdateDeletePromises: Promise<unknown>[] = [];

            const previousPeriodIds = await _getPeriodIdsForSchedule(scheduleId, { transaction: trx });
            const currentPeriodIds: number[] = [];
            const periodsToInsert: SchedulePeriod[] = [];
            const periodsToUpdate: SchedulePeriod[] = [];
            // Update or create periods in schedule
            for (let i = 0; i < scheduleData.periods.length; i++) {
                const period = scheduleData.periods[i];
                if (period.integer_id && previousPeriodIds.includes(period.integer_id)) {
                    // Add to current periods and to periods to update
                    currentPeriodIds.push(period.integer_id);
                    periodsToUpdate.push(period);
                } else {
                    // Add to periods to insert
                    periodsToInsert.push(period);
                }
            }
            if (periodsToInsert.length > 0) {
                createUpdateDeletePromises.push(_createPeriods(periodsToInsert, scheduleId, { transaction: trx }));
            }
            if (periodsToUpdate.length > 0) {
                createUpdateDeletePromises.push(_updatePeriods(periodsToUpdate, { transaction: trx }));
            }

            // Delete any period that was deleted
            const deletedPeriodIds = previousPeriodIds.filter((periodId) => !currentPeriodIds.includes(periodId));
            if (deletedPeriodIds.length > 0) {
                createUpdateDeletePromises.push(_deleteSchedulePeriods(deletedPeriodIds, { transaction: trx }));
            }
            await Promise.all(createUpdateDeletePromises);

            return id;
        };
        // Make sure the update is done in a transaction, use the one in argument if available
        return await (transaction ? updateWithTransaction(transaction) : knex.transaction(updateWithTransaction));
    } catch (error) {
        throw new TrError(
            `Cannot update schedule with id ${scheduleData.id} in database (knex error: ${error})`,
            'DBSCHED0002',
            'TransitScheduleCannotUpdateBecauseDatabaseError'
        );
    }
};

const save = async function (scheduleData: ScheduleAttributes, options: { transaction?: Knex.Transaction } = {}) {
    const scheduleExists = scheduleData.integer_id
        ? await exists(knex, scheduleTable, scheduleData.integer_id, { transaction: options.transaction })
        : false;
    return scheduleExists
        ? await updateFromScheduleData(scheduleData.integer_id as number, scheduleData, options)
        : await createFromScheduleData(scheduleData, options);
};

// FIXME Handle a few promises at a time instead of all at once
const saveAll = async function (schedulesData: ScheduleAttributes[], options: { transaction?: Knex.Transaction } = {}) {
    const saveAllTransaction = async (trx: Knex.Transaction) => {
        return await Promise.all(
            schedulesData.map((scheduleData) => save(scheduleData, { ...options, transaction: trx }))
        );
    };
    return options.transaction
        ? await saveAllTransaction(options.transaction)
        : await knex.transaction(saveAllTransaction);
};
// Private function to get the period ids for a given schedule, select within
// the current transaction
const _getPeriodIdsForSchedule = async function (
    schedule_id: number,
    options: { transaction: Knex.Transaction }
): Promise<number[]> {
    const periodQueries = knex(periodTable)
        .select('id')
        .where('schedule_id', schedule_id)
        .transacting(options.transaction);
    const rows = await periodQueries;
    // TODO Figure out if we can type this, examples like https://github.com/bkonkle/node-knex-typescript-example/blob/master/src/users/UserData.ts seem to cast the return value to an interface first
    return rows.map((row) => (row as any).id);
};

// Private function to get the trip ids for the given periods, select within the
// current transaction
const _getTripIdsForPeriods = async function (periodIds: number[], options: { transaction: Knex.Transaction }) {
    const trips = await knex(tripTable)
        .select('id')
        .whereIn('schedule_period_id', periodIds)
        .transacting(options.transaction);
    return trips.map((trip) => (trip as any).id);
};

const getScheduleIdsForLine = async function (
    line_id: string,
    options: {
        transaction?: Knex.Transaction;
    } = {}
) {
    const scheduleQueries = knex(scheduleTable).select('id').where('line_id', line_id);
    if (options.transaction) {
        scheduleQueries.transacting(options.transaction);
    }
    const rows = await scheduleQueries;
    return rows.map((row) => (row as any).id);
};

const readScheduleTrips = async function (period_id: number, options: { transaction?: Knex.Transaction } = {}) {
    const query = knex(tripTable).select(knex.raw('*')).where('schedule_period_id', period_id);
    if (options.transaction) {
        query.transacting(options.transaction);
    }
    const rows = await query;
    const trips: SchedulePeriodTrip[] = [];
    for (let i = 0; i < rows.length; i++) {
        trips.push(scheduleTripsAttributesParser(rows[i]));
    }
    return trips;
};

const readSchedulePeriods = async function (id: number, options: { transaction?: Knex.Transaction } = {}) {
    const query = knex(periodTable).select(knex.raw('*')).where('schedule_id', id);
    if (options.transaction) {
        query.transacting(options.transaction);
    }
    const rows = await query;
    const periods: SchedulePeriod[] = [];
    for (let i = 0; i < rows.length; i++) {
        const period = schedulePeriodsAttributesParser(rows[i]);
        periods.push(period);
        period.trips = await readScheduleTrips(period.integer_id!, options);
        period.trips.sort((a, b) => a.departure_time_seconds - b.departure_time_seconds);
    }
    return periods;
};

const readScheduleData = async function (id: number, options: { transaction?: Knex.Transaction } = {}) {
    const schedule = scheduleAttributesParser(
        await read(knex, scheduleTable, undefined, '*', id, options)
    ) as ScheduleAttributes;
    schedule.periods = await readSchedulePeriods(id, options);
    schedule.periods.sort((a, b) => a.start_at_hour - b.start_at_hour);
    return schedule;
};

const readForLine = async function (lineId: string) {
    // TODO Read objects independently. It would be possible to make it all in one query to DB if performance becomes problematic
    const scheduleIds = await getScheduleIdsForLine(lineId);
    return await Promise.all(scheduleIds.map((scheduleId) => readScheduleData(scheduleId)));
};

// Private function to delete periods by ids, within a transaction
const _deleteSchedulePeriods = async function (ids: number[], options: { transaction: Knex.Transaction }) {
    return await deleteMultiple(knex, periodTable, ids, options);
};

// Private function to delete trips by id, within a transaction
const _deleteSchedulePeriodTrips = async function (ids: number[], options: { transaction: Knex.Transaction }) {
    return await deleteMultiple(knex, tripTable, ids, options);
};

const deleteScheduleData = async function (id: number | string, options: Parameters<typeof deleteRecord>[3] = {}) {
    // FIXME The main workflow still receives the uuid of the schedule to delete instead of the numeric id, so have to handle both
    if (typeof id === 'string') {
        const query = knex(scheduleTable).where('uuid', id).del();
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        return await query;
    }
    return await deleteRecord(knex, scheduleTable, id, options);
};

const getCollectionSubquery = () => {
    // Get the complete collection from DB, with trips aggregated
    const subquery = knex(`${periodTable} as p`)
        .leftJoin(`${tripTable} as trip`, function () {
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
        .leftJoin(subquery, function () {
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
    const schedule = scheduleAttributesParser(row) as ScheduleAttributes;
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

const readForLines = async function (lineIds: string[]): Promise<ScheduleAttributes[]> {
    if (lineIds.length === 0) {
        // Empty line array, return empty
        return [];
    }
    const collection = await getCollectionSubquery().whereIn('sched.line_id', lineIds).orderByRaw('sched.line_id');
    return collection.map(dbRowToScheduleAttributes);
};

const collection = async function () {
    const collection = await getCollectionSubquery().orderByRaw('sched.line_id');

    return collection.map(dbRowToScheduleAttributes);
};

export default {
    exists: exists.bind(null, knex, scheduleTable),
    read: readScheduleData,
    readForLine,
    /**
     * TODO This function needs to remain for now as TransitObjectHandler makes use of it
     * @deprecated Use the `save` function instead */
    create: save,
    /**
     * TODO This function needs to remain for now as TransitObjectHandler makes use of it
     * @deprecated Use the `save` function instead */
    update: (
        scheduleId: string,
        scheduleData: ScheduleAttributes,
        { transaction }: { transaction?: Knex.Transaction } = {}
    ) => save({ ...scheduleData, id: scheduleId }, { transaction }),
    save,
    saveAll: (schedulesData: ScheduleAttributes[], { transaction }: { transaction?: Knex.Transaction } = {}) =>
        saveAll(schedulesData, { transaction }),
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
