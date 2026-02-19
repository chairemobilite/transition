/*
 * Copyright 2022-2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { v4 as uuidV4, validate } from 'uuid';
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

const getCollectionSubquery = (lineIds: string[] = []) => {
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
    if (lineIds.length > 0) {
        subquery.whereIn(
            'p.schedule_id',
            knex(`${scheduleTable} as sched`).select('sched.id').whereIn('sched.line_id', lineIds)
        );
    }
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
    const collection = await getCollectionSubquery(lineIds)
        .whereIn('sched.line_id', lineIds)
        .orderByRaw('sched.line_id');
    return collection.map(dbRowToScheduleAttributes);
};

const collection = async function () {
    const collection = await getCollectionSubquery().orderByRaw('sched.line_id');

    return collection.map(dbRowToScheduleAttributes);
};

/**
 * Duplicate entire schedules for a specific mapping for lines, services and
 * paths. There should be at least a mapping for services or lines as there
 * cannot be duplicate schedules for those.
 *
 * @param param The parameter object
 * @param param.lineIdMapping The mapping of original line IDs to new line IDs
 * @param param.serviceIdMapping The mapping of original service IDs to new
 * service IDs
 * @param param.pathIdMapping The mapping of original path IDs to new path IDs
 * @param param.transaction The transaction to use for the duplication, if any
 * @returns A mapping of the ID of the schedules copied to the ID of the copy.
 */
const duplicateSchedule = async ({
    lineIdMapping = {},
    serviceIdMapping = {},
    pathIdMapping = {},
    transaction
}: {
    lineIdMapping?: { [key: string]: string };
    serviceIdMapping?: { [key: string]: string };
    pathIdMapping?: { [key: string]: string };
    transaction?: Knex.Transaction;
}): Promise<{ [originalScheduleId: number]: number }> => {
    try {
        if (Object.keys(lineIdMapping).length === 0 && Object.keys(serviceIdMapping).length === 0) {
            throw new Error(
                'There needs to be either a line or service mapping or both to duplicate schedules, none provided.'
            );
        }
        // Validate that mappings are all uuids
        // FIXME won't be necessary when we use numeric ids for lines, services and paths
        Object.entries(lineIdMapping).forEach(([originalId, mappedId]) => {
            if (!validate(originalId) || !validate(mappedId)) {
                throw new Error('Line mappings must be valid uuids');
            }
        });
        Object.entries(serviceIdMapping).forEach(([originalId, mappedId]) => {
            if (!validate(originalId) || !validate(mappedId)) {
                throw new Error('Service mappings must be valid uuids');
            }
        });
        Object.entries(pathIdMapping).forEach(([originalId, mappedId]) => {
            if (!validate(originalId) || !validate(mappedId)) {
                throw new Error('Path mappings must be valid uuids');
            }
        });

        // Group query parts according to mappings values, if there are any or
        // not. `mappingWith` is the `with` sql query part that creates the
        // mapping table, `mappedField` is the field to use in the select/insert
        // query, `mappedJoin` is the join to use in the select query,
        // `whereClause` is the where clause to use in the query to select the
        // schedules to duplicate, and `bindings` are the values to bind in the
        // where clause
        const getMappingQueries = (
            objectIdMapping: { [key: string]: string },
            mappedKey: string,
            tblName: string,
            canBeNull = false
        ) => {
            return Object.keys(objectIdMapping).length === 0
                ? {
                    mappingWith: '',
                    mappedField: `${mappedKey}_id`,
                    mappedJoin: '',
                    whereClause: undefined,
                    bindings: []
                }
                : {
                    mappingWith: `${mappedKey}_mapping (original_id, new_id) as (\
                values \
                    ${Object.entries(objectIdMapping)
        .map(([originalId, mappedId]) => `('${originalId}'::uuid, '${mappedId}'::uuid)`)
        .join(',')} \
                )`,
                    mappedField: `${mappedKey}_mapping.new_id`,
                    mappedJoin: `${canBeNull ? 'left ' : ''}join ${mappedKey}_mapping on ${mappedKey}_mapping.original_id = ${tblName}.${mappedKey}_id`,
                    whereClause: `${mappedKey}_id in (${Object.keys(objectIdMapping)
                        .map((_) => '?')
                        .join(',')})`,
                    bindings: Object.keys(objectIdMapping)
                };
        };
        const lineMappingQuery = getMappingQueries(lineIdMapping, 'line', scheduleTable);
        const serviceMappingQuery = getMappingQueries(serviceIdMapping, 'service', scheduleTable);
        const pathMappingQuery = getMappingQueries(pathIdMapping, 'path', tripTable);
        const inboundPathMappingQuery = getMappingQueries(pathIdMapping, 'inbound_path', periodTable, true);
        const outboundPathMappingQuery = getMappingQueries(pathIdMapping, 'outbound_path', periodTable, true);

        // Nested function to require a transaction around the duplication
        const duplicateWithTransaction = async (trx: Knex.Transaction) => {
            // These queries are inspired by both
            // https://stackoverflow.com/questions/29256888/insert-into-from-select-returning-id-mappings
            // and
            // https://dba.stackexchange.com/questions/46410/how-do-i-insert-a-row-which-contains-a-foreign-key
            // so that 3 queries are sufficient to copy all schedules, periods and
            // trips with the requested mappings

            // Query to copy the schedules for the requested lines. Using raw as it
            // is complex to put in knex
            const duplicateSchedulesQuery = `with ${[lineMappingQuery.mappingWith, serviceMappingQuery.mappingWith].filter((query) => query !== '').join(', ')} \
                insert into ${scheduleTable}(line_id, service_id, periods_group_shortname, allow_seconds_based_schedules, is_frozen, data) \
                    select ${lineMappingQuery.mappedField}, ${serviceMappingQuery.mappedField}, periods_group_shortname, allow_seconds_based_schedules, is_frozen, data 
                    from ${scheduleTable} \
                    ${lineMappingQuery.mappedJoin} \
                    ${serviceMappingQuery.mappedJoin} \
                    order by id returning id`;

            // Put the where queries and bindings for lines and services in arrays to better join them if necessary in the query
            const scheduleWhereQueries: { whereClauses: string[]; bindings: any[] } = {
                whereClauses: [],
                bindings: []
            };
            if (lineMappingQuery.whereClause) {
                scheduleWhereQueries.whereClauses.push(lineMappingQuery.whereClause);
                scheduleWhereQueries.bindings.push(...lineMappingQuery.bindings);
            }
            if (serviceMappingQuery.whereClause) {
                scheduleWhereQueries.whereClauses.push(serviceMappingQuery.whereClause);
                scheduleWhereQueries.bindings.push(...serviceMappingQuery.bindings);
            }

            // The `sel` part selects the original schedule IDs and row numbers
            // for services and lines, if specified and order them by row ID,
            // the `ins` part duplicates the schedules, also ordered by ID and
            // returns the new IDs. Both `sel` and `ins` have the same number of
            // rows and the same order of elements. The last select matches the
            // original and new IDs from the row number, effectively giving the
            // mapping between old and new schedules.
            const scheduleIdMapping = await knex
                .raw(
                    `with sel as (select id, row_number() over (order by id) as rn from ${scheduleTable} where ${scheduleWhereQueries.whereClauses.join(' and ')} order by id), \
                ins as (${duplicateSchedulesQuery}) \
                select i.id, s.id as from_id from (select id, row_number() over (order by id) as rn from ins) i\
                join sel s using(rn)`,
                    scheduleWhereQueries.bindings
                )
                .transacting(trx);

            if (scheduleIdMapping.rows.length === 0) {
                return {};
            }

            // Query to duplicate the schedule periods for the duplicated
            // schedules. Similar to above, it uses the scheduleIdMapping to
            // select the periods to duplicate, ordered by ID to generate the
            // mapping.
            const scheduleMappingWithQuery = `schedule_mapping (original_id, new_id) as (\
                values \
                ${scheduleIdMapping.rows.map((mapping) => `(${mapping.from_id}, ${mapping.id})`).join(',')}\
            )`;
            const duplicatePeriodsQuery = `with ${[scheduleMappingWithQuery, outboundPathMappingQuery.mappingWith, inboundPathMappingQuery.mappingWith].filter((query) => query !== '').join(', ')} \
                insert into ${periodTable}(schedule_id, outbound_path_id, inbound_path_id, period_shortname, interval_seconds, number_of_units, period_start_at_seconds, period_end_at_seconds, custom_start_at_seconds, custom_end_at_seconds) \
                    select schedule_mapping.new_id, ${outboundPathMappingQuery.mappedField}, ${inboundPathMappingQuery.mappedField}, period_shortname, interval_seconds, number_of_units, period_start_at_seconds, period_end_at_seconds, custom_start_at_seconds, custom_end_at_seconds 
                    from ${periodTable} 
                    join schedule_mapping on schedule_mapping.original_id = ${periodTable}.schedule_id
                    ${outboundPathMappingQuery.mappedJoin} \
                    ${inboundPathMappingQuery.mappedJoin} \
                    order by id returning id`;

            const schedulePeriodIdMapping = await knex
                .raw(
                    `with sel as (select id, row_number() over (order by id) as rn from ${periodTable} where schedule_id in (${scheduleIdMapping.rows.map((_) => '?').join(',')}) order by id), \
                ins as (${duplicatePeriodsQuery}) \
                select i.id, s.id as from_id from (select id, row_number() over (order by id) as rn from ins) i\
                join sel s using(rn)`,
                    scheduleIdMapping.rows.map((mapping) => mapping.from_id)
                )
                .transacting(trx);

            if (schedulePeriodIdMapping.rows.length === 0) {
                return scheduleIdMapping.rows.reduce((acc, row) => {
                    acc[row.from_id] = row.id;
                    return acc;
                }, {});
            }

            // Query to duplicate the schedule trips for the duplicated periods
            const periodMappingWithQuery = `period_mapping (original_id, new_id) as (\
                values \
                ${schedulePeriodIdMapping.rows.map((mapping) => `(${mapping.from_id}, ${mapping.id})`).join(',')}\
            )`;
            const duplicateTripsQuery = `with ${[periodMappingWithQuery, pathMappingQuery.mappingWith].filter((query) => query !== '').join(', ')}
                insert into ${tripTable}(schedule_period_id, path_id, unit_id, block_id, departure_time_seconds, arrival_time_seconds, seated_capacity, total_capacity, node_arrival_time_seconds, node_departure_time_seconds, nodes_can_board, nodes_can_unboard, data) \
                    select period_mapping.new_id, ${pathMappingQuery.mappedField}, unit_id, block_id, departure_time_seconds, arrival_time_seconds, seated_capacity, total_capacity, node_arrival_time_seconds, node_departure_time_seconds, nodes_can_board, nodes_can_unboard, data \
                    from ${tripTable} \
                    join period_mapping on period_mapping.original_id = ${tripTable}.schedule_period_id \
                    ${pathMappingQuery.mappedJoin} \
                    order by id returning id`;

            await knex
                .raw(
                    `with sel as (select id, row_number() over (order by id) as rn from ${tripTable} where schedule_period_id in (${schedulePeriodIdMapping.rows.map((_) => '?').join(',')}) order by id), \
                ins as (${duplicateTripsQuery}) \
                select i.id, s.id as from_id from (select id, row_number() over (order by id) as rn from ins) i\
                join sel s using(rn)`,
                    schedulePeriodIdMapping.rows.map((mapping) => mapping.from_id)
                )
                .transacting(trx);
            return scheduleIdMapping.rows.reduce((acc, row) => {
                acc[row.from_id] = row.id;
                return acc;
            }, {});
        };
        // Make sure the update is done in a transaction, use the one in the options if available
        return transaction
            ? await duplicateWithTransaction(transaction)
            : await knex.transaction(duplicateWithTransaction);
    } catch (error) {
        throw new TrError(
            `Cannot duplicate schedules for lines ${lineIdMapping} in database (knex error: ${error})`,
            'DBSCHED0003',
            'TransitScheduleCannotUpdateBecauseDatabaseError'
        );
    }
};

const getTripsInTimeRange = async ({
    rangeStart,
    rangeEnd,
    lineIds,
    serviceIds
}: {
    rangeStart: number;
    rangeEnd: number;
    lineIds: string[];
    serviceIds: string[];
}): Promise<(SchedulePeriodTrip & { line_id: string; service_id: string })[]> => {
    try {
        const query = knex(tripTable)
            .select([`${tripTable}.*`, `${scheduleTable}.service_id`, `${scheduleTable}.line_id`])
            .join(periodTable, `${tripTable}.schedule_period_id`, `${periodTable}.id`)
            .join(scheduleTable, `${periodTable}.schedule_id`, `${scheduleTable}.id`)
            .whereIn(`${scheduleTable}.line_id`, lineIds)
            .whereIn(`${scheduleTable}.service_id`, serviceIds)
            .andWhere(`${tripTable}.departure_time_seconds`, '<=', rangeEnd)
            .andWhere(`${tripTable}.arrival_time_seconds`, '>=', rangeStart);

        const rows = await query;
        const trips = rows.map(scheduleTripsAttributesParser);
        return trips as (SchedulePeriodTrip & { line_id: string; service_id: string })[];
    } catch (error) {
        throw new TrError(
            `Cannot get trips in time range ${rangeStart}-${rangeEnd} in database (knex error: ${error})`,
            'DBSCHED0004',
            'TransitScheduleCannotUpdateBecauseDatabaseError'
        );
    }
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
    saveAll,
    delete: deleteScheduleData,
    getScheduleIdsForLine,
    truncateSchedules: truncate.bind(null, knex, scheduleTable),
    truncateSchedulePeriods: truncate.bind(null, knex, periodTable),
    truncateScheduleTrips: truncate.bind(null, knex, tripTable),
    destroy: destroy.bind(null, knex),
    /** Get the complete collection of schedules, with all periods and trips */
    collection,
    /** Read the schedules for a list of lines */
    readForLines,
    duplicateSchedule,
    getTripsInTimeRange
};
