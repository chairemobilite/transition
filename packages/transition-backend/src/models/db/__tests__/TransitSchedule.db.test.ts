/*
 * Copyright 2022-2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../transitSchedules.db.queries';
import linesDbQueries from '../transitLines.db.queries';
import agenciesDbQueries from '../transitAgencies.db.queries';
import servicesDbQueries from '../transitServices.db.queries';
import pathsDbQueries from '../transitPaths.db.queries';
import ScheduleDataValidator from 'transition-common/lib/services/schedules/ScheduleDataValidator';
import { ScheduleAttributes, SchedulePeriod, SchedulePeriodTrip } from 'transition-common/lib/services/schedules/Schedule';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const agencyId = uuidV4();
const lineId = uuidV4();
const lineId2 = uuidV4();
const serviceId = uuidV4();
const serviceId2 = uuidV4();
const pathId = uuidV4();
const pathId2 = uuidV4();

// TODO this requires a lot of stubs, when moving to typescript, add separate tests to test the calls without actually touching the database, but keep those tests as integration tests

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncateSchedules();
    await dbQueries.truncateSchedulePeriods();
    await dbQueries.truncateScheduleTrips();
    // Need to add agencies, service and line
    await agenciesDbQueries.create({
        id: agencyId
    } as any);
    await linesDbQueries.create({
        id: lineId,
        agency_id: agencyId
    } as any);
    await linesDbQueries.create({
        id: lineId2,
        agency_id: agencyId
    } as any);
    await pathsDbQueries.create({
        id: pathId,
        line_id: lineId
    } as any);
    await pathsDbQueries.create({
        id: pathId2,
        line_id: lineId
    } as any);
    await servicesDbQueries.create({
        id: serviceId
    } as any);
    await servicesDbQueries.create({
        id: serviceId2
    } as any);
});

afterAll(async () => {
    await dbQueries.truncateSchedules();
    await dbQueries.truncateSchedulePeriods();
    await dbQueries.truncateScheduleTrips();
    await servicesDbQueries.truncate();
    await pathsDbQueries.truncate();
    await linesDbQueries.truncate();
    await agenciesDbQueries.truncate();
    await knex.destroy();
});

const pathStub1 = {
    get: function(attribute, defaultValue) {
        if (attribute === 'nodes') {
            return [1,1,1,1]; // this is the number of nodes in the following schedules:
        } else {
            return defaultValue;
        }
    }
};

const pathStub2 = {
    get: function(attribute, defaultValue) {
        if (attribute === 'nodes') {
            return [1,1,1,1,1,1]; // this is NOT the number of nodes in the following schedules:
        } else {
            return defaultValue;
        }
    }
};

let scheduleIntegerId: number | undefined = undefined;
const scheduleForServiceId = {
    "allow_seconds_based_schedules": false,
    "id": "cab32276-3181-400e-a07c-719326be1f02",
    integer_id: undefined,
    "line_id": lineId,
    "service_id": serviceId,
    "is_frozen": false,
    "periods": [{
        // Period with start and end hours and multiple trips
        integer_id: undefined,
        id: uuidV4(),
        "end_at_hour": 12,
        "interval_seconds": 1800,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_period_shortname",
        "start_at_hour": 7,
        "trips": [{
            integer_id: undefined,
            "arrival_time_seconds": 27015,
            "block_id": "a2cadcb8-ee17-4bd7-9e77-bd400ad73064",
            "departure_time_seconds": 25200,
            "id": "42cadcb8-ee17-4bd7-9e77-bd400ad73064",
            "node_arrival_times_seconds": [null, 25251, 26250, 27015] as any,
            "node_departure_times_seconds": [25200, 25261, 26260, null] as any,
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }, {
            integer_id: undefined,
            "arrival_time_seconds": 32416,
            "departure_time_seconds": 30601,
            "id": "5389b983-511e-4184-8776-ebc108cebaa2",
            "node_arrival_times_seconds": [null, 30652, 31650, 32416] as any,
            "node_departure_times_seconds": [30601, 30662, 31660, null] as any,
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }, {
            integer_id: undefined,
            "arrival_time_seconds": 34216,
            "departure_time_seconds": 32401,
            "id": "448544ae-60d1-4d5b-8734-d031332cb6bc",
            "node_arrival_times_seconds": [null, 32452, 33450, 34216] as any,
            "node_departure_times_seconds": [32401, 32462, 33460, null] as any,
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }]
    }, {
        // Period with custom start and end, with a single trip
        integer_id: undefined,
        id: uuidV4(),
        "custom_start_at_str": "13:15",
        "custom_end_at_str": "17:24",
        "end_at_hour": 18,
        "interval_seconds": 1800,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_custom_period",
        "start_at_hour": 13,
        "trips": [{
            integer_id: undefined,
            "arrival_time_seconds": 50000,
            "departure_time_seconds": 48000,
            "id": "448544ae-cafe-4d5b-8734-d031332cb6bc",
            "node_arrival_times_seconds": [null, 48050, 49450, 50000] as any,
            "node_departure_times_seconds": [48000, 48060, 49460, null] as any,
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }]
    }, {
        // Period with custom start and end, without trips
        integer_id: undefined,
        id: uuidV4(), 
        "custom_start_at_str": "18:00",
        "custom_end_at_str": "23:00",
        "end_at_hour": 23,
        "interval_seconds": 1800,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_custom_period",
        "start_at_hour": 18
    }],
    "periods_group_shortname": "all_day",
};
const scheduleForServiceId2Period = [{
    // Period with start and end hours and multiple trips
    integer_id: undefined,
    id: uuidV4(),
    "end_at_hour": 12,
    "interval_seconds": 1800,
    "outbound_path_id": pathId,
    "period_shortname": "all_day_period_shortname",
    "start_at_hour": 7,
    "trips": [{
        integer_id: undefined,
        "arrival_time_seconds": 27015,
        "block_id": "a2cadcb8-ee17-4bd7-9e77-bd400ad73064",
        "departure_time_seconds": 25200,
        "id": uuidV4(),
        "node_arrival_times_seconds": [null, 25251, 26250, 27015] as any,
        "node_departure_times_seconds": [25200, 25261, 26260, null] as any,
        "nodes_can_board": [true, true, true, false],
        "nodes_can_unboard": [false, true, true, true],
        "path_id": pathId,
        "seated_capacity": 20,
        "total_capacity": 50
    }, {
        integer_id: undefined,
        "arrival_time_seconds": 32416,
        "departure_time_seconds": 30601,
        "id": uuidV4(),
        "node_arrival_times_seconds": [null, 30652, 31650, 32416] as any,
        "node_departure_times_seconds": [30601, 30662, 31660, null] as any,
        "nodes_can_board": [true, true, true, false],
        "nodes_can_unboard": [false, true, true, true],
        "path_id": pathId,
        "seated_capacity": 20,
        "total_capacity": 50
    }, {
        integer_id: undefined,
        "arrival_time_seconds": 34216,
        "departure_time_seconds": 32401,
        "id": uuidV4(),
        "node_arrival_times_seconds": [null, 32452, 33450, 34216] as any,
        "node_departure_times_seconds": [32401, 32462, 33460, null] as any,
        "nodes_can_board": [true, true, true, false],
        "nodes_can_unboard": [false, true, true, true],
        "path_id": pathId,
        "seated_capacity": 20,
        "total_capacity": 50
    }]
}, {
    // Period with custom start and end, with a single trip
    integer_id: undefined,
    id: uuidV4(),
    "custom_start_at_str": "13:15",
    "custom_end_at_str": "17:24",
    "end_at_hour": 18,
    "interval_seconds": 1800,
    "outbound_path_id": pathId,
    "period_shortname": "all_day_custom_period",
    "start_at_hour": 13,
    "trips": [{
        integer_id: undefined,
        "arrival_time_seconds": 50000,
        "departure_time_seconds": 48000,
        "id": uuidV4(),
        "node_arrival_times_seconds": [null, 48050, 49450, 50000] as any,
        "node_departure_times_seconds": [48000, 48060, 49460, null] as any,
        "nodes_can_board": [true, true, true, false],
        "nodes_can_unboard": [false, true, true, true],
        "path_id": pathId,
        "seated_capacity": 20,
        "total_capacity": 50
    }]
}, {
    // Period with custom start and end, without trips
    integer_id: undefined,
    id: uuidV4(), 
    "custom_start_at_str": "18:00",
    "custom_end_at_str": "23:00",
    "end_at_hour": 23,
    "interval_seconds": 1800,
    "outbound_path_id": pathId,
    "period_shortname": "all_day_custom_period",
    "start_at_hour": 18
}];

/** Function to verify 2 schedules are identical to the trip level. It's easier
 * to debug failed test than a matchObject on the scheduleAttributes */
const expectSchedulesSame = (actual: ScheduleAttributes, expected: ScheduleAttributes, { matchIds = true, lineIdMapping = {}, serviceIdMapping = {}, pathIdMapping = {} } = {}) => {
    const { id, integer_id, line_id, service_id, periods, ...scheduleAttributes } = actual;
    const { periods: expectedPeriods, id: originalUuid, integer_id: originalIntegerId, line_id: originalLineId, service_id: originalServiceId, ...expectedScheduleAttributes } = expected;
    expect(scheduleAttributes).toEqual(expect.objectContaining(expectedScheduleAttributes));
    expect(line_id).toEqual(lineIdMapping[originalLineId] || originalLineId);
    expect(service_id).toEqual(serviceIdMapping[originalServiceId] || originalServiceId);
    if (originalIntegerId !== undefined && matchIds) {
        expect(integer_id).toEqual(originalIntegerId);
        expect(id).toEqual(originalUuid);
    }
    // Make sure all expected periods are there
    for (let periodIdx = 0; periodIdx < expectedPeriods.length; periodIdx++) {
        // Find the matching period
        const { trips: expectedTrips, id: expectedUuid, integer_id: expectedPeriodId, schedule_id: originalScheduleId, inbound_path_id: originalInboundId, outbound_path_id: originalOutboundId, ...expectedPeriodAttributes } = expectedPeriods[periodIdx];
        const matchingPeriod = matchIds === true ? periods.find(period => period.id === expectedUuid) : periods[periodIdx];
        expect(matchingPeriod).toBeDefined();
        // Validate period attributes
        const { integer_id: actualPeriodId, id: actualUuid, schedule_id, inbound_path_id, outbound_path_id, trips, ...periodAttributes } = matchingPeriod as SchedulePeriod;
        if (expectedTrips === undefined) {
            expect(trips).toEqual([]);
            continue;
        }
        expect(periodAttributes).toEqual(expect.objectContaining(expectedPeriodAttributes));
        expect(inbound_path_id).toEqual(originalInboundId ? pathIdMapping[originalInboundId] || originalInboundId : null);
        expect(outbound_path_id).toEqual(originalOutboundId ? pathIdMapping[originalOutboundId] || originalOutboundId : null);
        if (expectedPeriodId !== undefined && matchIds) {
            expect(actualPeriodId).toEqual(expectedPeriodId);
            expect(actualUuid).toEqual(expectedUuid);
        }
        // Make sure all expected trips are there
        for (let tripIdx = 0; tripIdx < expectedTrips.length; tripIdx++) {
            const { id: expectedTripUuid, integer_id: expectedTripId, schedule_period_id, path_id: originalPathId, ...expectedTripAttributes } = expectedTrips[tripIdx];
            const matchingTrip = matchIds === true ? trips.find(trip => trip.id === expectedTrips[tripIdx].id) : trips[tripIdx];
            expect(matchingTrip).toBeDefined();
            expect(matchingTrip).toEqual(expect.objectContaining(expectedTripAttributes));
            expect(matchingTrip!.path_id).toEqual(pathIdMapping[originalPathId] || originalPathId);
            if (expectedTripId !== undefined && matchIds) {
                expect(matchingTrip!.integer_id).toEqual(expectedTripId);
                expect(matchingTrip!.id).toEqual(expectedTripUuid);
                expect(schedule_period_id).toEqual(expectedPeriodId);
            }
        }
        expect(trips.length).toEqual(expectedTrips.length);
    }
    expect(periods.length).toEqual(expectedPeriods.length);
}

describe(`schedules`, function () {

    test('schedule exists should return false if object is not in database', async function () {

        // Check unexisting schedule
        const exists = await dbQueries.exists(1);
        expect(exists).toBe(false);

    });

    test('should create schedule object with periods and trips from schedule data', async function() {
        const scheduleAttributes = _cloneDeep(scheduleForServiceId);
        const scheduleDataValidation = ScheduleDataValidator.validate(scheduleAttributes);
        expect(scheduleDataValidation.isValid).toBe(true);
        expect(ScheduleDataValidator.validate(scheduleAttributes, pathStub1).isValid).toBe(true);
        expect(ScheduleDataValidator.validate(scheduleAttributes, pathStub2).isValid).toBe(false);
        const newId = await dbQueries.save(scheduleAttributes as any);
        expect(newId).not.toBe(scheduleForServiceId.integer_id);
        scheduleIntegerId = newId;
    });

    test('should not create schedule object with existing service/line pair', async function() {

        const existingServiceLineSchedule = _cloneDeep(scheduleForServiceId);
        existingServiceLineSchedule.id = uuidV4();
        existingServiceLineSchedule.integer_id = undefined;
        existingServiceLineSchedule.periods = [];
        let exception: any = undefined;
        try {
            await dbQueries.save(existingServiceLineSchedule as any);
        } catch(error) {
            exception = error;
        }
        expect(exception).toBeDefined();

    });

    test('schedule exists should return true if object is in database', async function () {

        // Check unexisting schedule
        const exists = await dbQueries.exists(scheduleIntegerId as number);
        expect(exists).toBe(true);

    });

    test('should read schedule object as schedule data with periods and trips', async function() {

        const scheduleDataRead = await dbQueries.read(scheduleIntegerId as number);
        expectSchedulesSame(scheduleDataRead, scheduleForServiceId as any);
        expect(scheduleDataRead.updated_at).toBeNull();
        expect(scheduleDataRead.created_at).not.toBeNull();

    });

    test('readForLine', async() => {
        // Read the schedule for the line ID requested
        const schedulesForLine = await dbQueries.readForLine(scheduleForServiceId.line_id);
        expect(schedulesForLine.length).toEqual(1);
        expectSchedulesSame(schedulesForLine[0], scheduleForServiceId as any);

        // Read for a line id without data
        const schedulesForNonexistentLine = await dbQueries.readForLine(uuidV4());
        expect(schedulesForNonexistentLine).toEqual([]);
    });

    test('test collection', async function() {
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        expectSchedulesSame(collection[0], scheduleForServiceId as any);
    })

    test('should update a schedule in database and read it correctly', async () => {

        // Read the object from DB to get all the IDs
        const scheduleDataRead = await dbQueries.read(scheduleIntegerId as number);

        // Change a few values in schedule and 2nd period and trip
        const updatedSchedule = _cloneDeep(scheduleDataRead);
        updatedSchedule.periods_group_shortname = 'New_period_name';
        updatedSchedule.periods[1].custom_start_at_str = "13:45";
        updatedSchedule.periods[1].trips[0].seated_capacity = 30;

        // Update the object
        const updatedId = await dbQueries.save(updatedSchedule);
        expect(updatedId).toBe(scheduleIntegerId);

        // Delete the updated_at fields
        updatedSchedule.updated_at = expect.anything();
        updatedSchedule.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });

        // Read the object again and make sure it matches
        const scheduleDataUpdatedRead = await dbQueries.read(scheduleIntegerId as number);
        expectSchedulesSame(scheduleDataUpdatedRead, updatedSchedule);
        expect(scheduleDataUpdatedRead.updated_at).not.toBeNull();
        expect(scheduleDataUpdatedRead.created_at).not.toBeNull();

    });

    test('Update a schedule after deleting trips and periods', async () => {

        // Read the object from DB to get all the IDs
        const scheduleDataRead = await dbQueries.read(scheduleIntegerId as number);

        // Remove 2nd period and a trip from first period
        const updatedSchedule = _cloneDeep(scheduleDataRead);
        updatedSchedule.periods.splice(1, 1);
        updatedSchedule.periods[0].trips.splice(2, 1);

        // Update the object
        const updatedId = await dbQueries.save(updatedSchedule);
        expect(updatedId).toBe(scheduleIntegerId);

        // Expect anything for the updated_at fields
        updatedSchedule.updated_at = expect.anything();
        updatedSchedule.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });

        // Read the object again and make sure it matches
        const scheduleDataUpdatedRead = await dbQueries.read(scheduleIntegerId as number);
        // Recursively remove the updated_at field
        scheduleDataUpdatedRead.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });
        expectSchedulesSame(scheduleDataUpdatedRead, updatedSchedule);
    });

    test('Update a schedule after adding trips and periods', async () => {

        // Read the object from DB to get all the IDs
        const scheduleDataRead = await dbQueries.read(scheduleIntegerId as number);

        // Remove 2nd period and a trip from first period
        const updatedSchedule = _cloneDeep(scheduleDataRead);
        updatedSchedule.periods.splice(1, 0, scheduleForServiceId.periods[1] as any);
        const newTrip = scheduleForServiceId.periods[0].trips ? scheduleForServiceId.periods[0].trips[2] : undefined;
        expect(newTrip).toBeDefined();
        updatedSchedule.periods[0].trips.push(newTrip as any);

        // Update the object
        const updatedId = await dbQueries.save(updatedSchedule);
        expect(updatedId).toBe(scheduleIntegerId);

        // Expect anything for the updated_at fields
        updatedSchedule.updated_at = expect.anything();
        updatedSchedule.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });

        // Read the object again and make sure it matches
        const scheduleDataUpdatedRead = await dbQueries.read(scheduleIntegerId as number);
        expectSchedulesSame(scheduleDataUpdatedRead, updatedSchedule);

    });

    test('should delete object from database', async () => {

        const id = await dbQueries.delete(scheduleIntegerId as number);
        expect(id).toBe(scheduleIntegerId);

        // Verify the object does not exist anymore
        const exists = await dbQueries.exists(scheduleIntegerId as number);
        expect(exists).toBe(false);

    });

    test('should delete object from database by uuid', async () => {
        // FIXME We should not support deletion by uuid, remove when it is not supported anymore
        // Insert the new object in the DB
        const scheduleAttributes = _cloneDeep(scheduleForServiceId);
        const newId = await dbQueries.save(scheduleAttributes as any);
        const existsBefore = await dbQueries.exists(newId as number);
        expect(existsBefore).toBe(true);

        // Delete by uuid
        await dbQueries.delete(scheduleForServiceId.id);

        // Verify the object does not exist anymore
        const exists = await dbQueries.exists(scheduleIntegerId as number);
        expect(exists).toBe(false);

    });

});

describe('Schedules, single queries with transaction errors', () => {

    beforeEach(async () => {
        // Empty the tables
        await dbQueries.truncateSchedules();
        await dbQueries.truncateSchedulePeriods();
        await dbQueries.truncateScheduleTrips();
    });

    test('Create with periods and trips, with error', async() => {
        const newSchedule = _cloneDeep(scheduleForServiceId);

        // Save a schedule with invalid UUID for ids in one of the trips
        (newSchedule.periods[0] as any).trips[0].id = 'not a uuid';
        await expect(dbQueries.save(newSchedule as any)).rejects.toThrow(TrError);

        // Read the object from DB and make sure it has not changed
        const dataExists = await dbQueries.exists(scheduleIntegerId as number);
        expect(dataExists).toEqual(false);
    });

    test('update with periods and trips, with error', async() => {
        // Insert the schedule
        const newId = await dbQueries.save(scheduleForServiceId as any);
        // Read the object from DB and make sure it has not changed
        const originalData = await dbQueries.read(newId);

        // Force and invalid data for period field custom_start_at_str
        const updatedSchedule = _cloneDeep(scheduleForServiceId);
        updatedSchedule.periods_group_shortname = 'New_period_name';
        updatedSchedule.periods[1].custom_start_at_str = ["13:45"] as any;
        delete updatedSchedule.periods[0];
        await expect(dbQueries.save(updatedSchedule as any)).rejects.toThrowError(TrError);

        // Read the object from DB and make sure it has not changed
        const dataAfterFail = await dbQueries.read(newId);
        expectSchedulesSame(dataAfterFail, originalData);
    });

});

describe('Schedules, with transactions', () => {

    beforeEach(async () => {
        // Empty the tables
        await dbQueries.truncateSchedules();
        await dbQueries.truncateSchedulePeriods();
        await dbQueries.truncateScheduleTrips();
    });

    test('Create, update with success', async() => {
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;

        let originalUpdatedSchedule: any = undefined;
        let newId: any = undefined;
        await knex.transaction(async (trx) => {
            // Save the original schedule
            newId = await dbQueries.save(originalSchedule, { transaction: trx });

            // Read the schedule, then save the updated schedule with one less period and trip
            const updatedSchedule = await dbQueries.read(newId, { transaction: trx });
            delete updatedSchedule.updated_at;
            updatedSchedule.periods.forEach((period) => {
                delete period.updated_at;
                if (period.trips) {
                    period.trips.forEach((trip) => delete trip.updated_at);
                }
            })
            // Remove 2nd period and a trip from first period, then
            updatedSchedule.periods.splice(1, 1);
            updatedSchedule.periods[0].trips.splice(2, 1);
            originalUpdatedSchedule = updatedSchedule;
            await dbQueries.save(updatedSchedule, { transaction: trx });
        });

        // Make sure the object is there and updated
        const dataRead = await dbQueries.read(newId);
        expectSchedulesSame(dataRead, originalUpdatedSchedule);
    });

    test('Create, update with error', async() => {
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;

        let originalUpdatedSchedule: any = undefined;
        let newId: any = undefined;

        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                 // Save the original schedule
                newId = await dbQueries.save(originalSchedule, { transaction: trx });

                // Read the schedule, then save the updated schedule with one less period and trip
                const updatedSchedule = await dbQueries.read(newId, { transaction: trx });
                delete updatedSchedule.updated_at;
                updatedSchedule.periods.forEach((period) => {
                    delete period.updated_at;
                    if (period.trips) {
                        period.trips.forEach((trip) => delete trip.updated_at);
                    }
                })
                // Update some fields, but change uuid of one trip for not a uuid
                updatedSchedule.allow_seconds_based_schedules = true;
                updatedSchedule.periods.splice(1, 1);
                updatedSchedule.periods[0].trips[0].id = 'not a uuid';
                originalUpdatedSchedule = updatedSchedule;

                // Save the updated schedule with one less period and trip
                await dbQueries.save(updatedSchedule, { transaction: trx });
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Read the object from DB and make sure it has not changed
        const dataExists = await dbQueries.exists(newId);
        expect(dataExists).toEqual(false);
    });

    test('Update, delete with error', async() => {
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        // Add the original schedule out of the transaction
        const newId = await dbQueries.save(originalSchedule);

        const updatedSchedule = await dbQueries.read(newId);
        // Remove 2nd period and a trip from first period, then
        updatedSchedule.periods.splice(1, 1);
        updatedSchedule.periods[0].trips.splice(2, 1);

        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                // Update, then delete the schedule, then throw an error
                await dbQueries.save(updatedSchedule, { transaction: trx });

                await dbQueries.delete(newId, { transaction: trx });
                throw 'error';
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Make sure the original object is unchanged
        // Make sure the object is there and updated
        const dataRead = await dbQueries.read(newId);
        expectSchedulesSame(dataRead, originalSchedule);
    });

});

describe('Schedules save', () => {
    beforeAll(async () => {
        jest.setTimeout(10000);
        await dbQueries.truncateSchedules();
        await dbQueries.truncateSchedulePeriods();
        await dbQueries.truncateScheduleTrips();

    });

    test('Create and update multiple schedules with success using saveAll', async() => {
        const originalSchedule1 = _cloneDeep(scheduleForServiceId) as any;
        let originalSchedule2 = _cloneDeep(scheduleForServiceId) as any;
        
        originalSchedule2.id = uuidV4();
        originalSchedule2.periods = scheduleForServiceId2Period;
        
        originalSchedule2.line_id = lineId2;
    
        let originalUpdatedSchedules: any[] = [];
        let newIds: any[] = [];
        
        await knex.transaction(async (trx) => {
            // Save the original schedules 
            newIds = await dbQueries.saveAll([originalSchedule1, originalSchedule2], { transaction: trx });
    
            // Read the schedules we just saved from the DB
            const updatedSchedules = await Promise.all(
                newIds.map(id => dbQueries.read(id, { transaction: trx }))
            );
    
            // edit those schedules
            updatedSchedules.forEach((schedule) => {
                delete schedule.updated_at;
                schedule.periods.forEach((period) => {
                    delete period.updated_at;
                    if (period.trips) {
                        period.trips.forEach((trip) => delete trip.updated_at);
                    }
                });
                
                if (schedule.line_id === scheduleForServiceId.line_id) {
                    schedule.periods.splice(1, 1);
                    schedule.periods[0].trips.splice(2, 1);
                } else {
                    schedule.periods.splice(0, 1);
                }
            });
    
            originalUpdatedSchedules = updatedSchedules;
            await dbQueries.saveAll(updatedSchedules, { transaction: trx });
        });
    
        // Verify if the objects were correctly saved
        const readSchedules = await Promise.all(newIds.map(id => dbQueries.read(id)));
        
        for (let i = 0; i < readSchedules.length; i++) {
            expectSchedulesSame(readSchedules[i], originalUpdatedSchedules[i]);
        }
    });
});

describe('Schedules duplication', () => {

    beforeEach(async () => {
        // Empty the tables
        await dbQueries.truncateSchedules();
        await dbQueries.truncateSchedulePeriods();
        await dbQueries.truncateScheduleTrips();
    });

    test('Duplicate for new line ID', async() => {
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;

        // Save the original schedule
        const originalScheduleId = await dbQueries.save(originalSchedule);
        // Add new line for which to duplicate
        const newLineId = uuidV4();
        await linesDbQueries.create({
            id: newLineId,
            agency_id: agencyId
        } as any);

        // Duplicate the schedule with a line id mapping
        const scheduleIdMapping = await dbQueries.duplicateSchedule({lineIdMapping: { [lineId]: newLineId } });

        // Make sure there are now 2 schedules
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(2);

        // Find the duplicated schedule and make sure it is as expected
        originalSchedule.updated_at = null;
        originalSchedule.created_at = expect.anything();
        originalSchedule.data = null;
        const duplicatedSchedule = schedulesInDb.find(sched => sched.integer_id !== originalScheduleId);
        expect(duplicatedSchedule).toBeDefined();
        expect(scheduleIdMapping[originalScheduleId]).toEqual((duplicatedSchedule as ScheduleAttributes).integer_id);
        expectSchedulesSame(duplicatedSchedule as ScheduleAttributes, originalSchedule, { matchIds: false, lineIdMapping: { [lineId]: newLineId } });
    });

    test('Duplicate for new service ID', async() => {
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;

        // Save the original schedule
        const originalScheduleId = await dbQueries.save(originalSchedule);
        // Add new line for which to duplicate
        const newServiceId = uuidV4();
        await servicesDbQueries.create({
            id: newServiceId
        } as any);

        // Duplicate the schedule with a service id mapping
        const scheduleIdMapping = await dbQueries.duplicateSchedule({serviceIdMapping: { [serviceId]: newServiceId } });

        // Make sure there are now 2 schedules
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(2);

        // Find the duplicated schedule and make sure it is as expected
        originalSchedule.updated_at = null;
        originalSchedule.created_at = expect.anything();
        originalSchedule.data = null;
        const duplicatedSchedule = schedulesInDb.find(sched => sched.integer_id !== originalScheduleId);
        expect(duplicatedSchedule).toBeDefined();
        expect(scheduleIdMapping[originalScheduleId]).toEqual((duplicatedSchedule as ScheduleAttributes).integer_id);
        expectSchedulesSame(duplicatedSchedule as ScheduleAttributes, originalSchedule, { matchIds: false, serviceIdMapping: { [serviceId]: newServiceId } });
    });

    test('Duplicate for new line and path ID', async() => {
        // Create uuids for the new line and paths and add an inbound path for one of the periods
        const [inboundPathId, newLineId, newOutboundPathId, newInboundPathId] = [uuidV4(), uuidV4(), uuidV4(), uuidV4()];
        // Add new lines and path for which to duplicate
        await linesDbQueries.create({
            id: newLineId,
            agency_id: agencyId
        } as any);
        await pathsDbQueries.createMultiple([
            { id: inboundPathId, line_id: lineId } as any,
            { id: newOutboundPathId, line_id: newLineId } as any,
            { id: newInboundPathId, line_id: newLineId } as any
        ]);

        // Save the original schedule, after adding inbound path to one of the periods
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        originalSchedule.periods[0].inbound_path_id = inboundPathId;
        originalSchedule.periods[0].trips[0].path_id = inboundPathId;
        
        const originalScheduleId = await dbQueries.save(originalSchedule);

        // Duplicate the schedule with a line and path id mapping
        const scheduleIdMapping = await dbQueries.duplicateSchedule({lineIdMapping: { [lineId]: newLineId }, pathIdMapping: { [pathId]: newOutboundPathId, [inboundPathId]: newInboundPathId } });

        // Make sure there are now 2 schedules
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(2);

        // Find the duplicated schedule and make sure it is as expected
        originalSchedule.updated_at = null;
        originalSchedule.created_at = expect.anything();
        originalSchedule.data = null;
        const duplicatedSchedule = schedulesInDb.find(sched => sched.integer_id !== originalScheduleId);
        expect(duplicatedSchedule).toBeDefined();
        expect(scheduleIdMapping[originalScheduleId]).toEqual((duplicatedSchedule as ScheduleAttributes).integer_id);
        expectSchedulesSame(duplicatedSchedule as ScheduleAttributes, originalSchedule, { matchIds: false, lineIdMapping: { [lineId]: newLineId }, pathIdMapping: { [pathId]: newOutboundPathId, [inboundPathId]: newInboundPathId } });
    });

    test('Duplicate for both line and service ID at the same time', async() => {
        // Add 2 lines and 3 services (one service won't be duplicated)
        const [originalLineId1, originalLineId2, originalServiceId1, originalServiceId2, otherServiceId] = [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()];
        await linesDbQueries.createMultiple([
            { id: originalLineId1, agency_id: agencyId },
            { id: originalLineId2, agency_id: agencyId }] as any);
        await servicesDbQueries.createMultiple([
            { id: originalServiceId1 },
            { id: originalServiceId2 },
            { id: otherServiceId }] as any);

        // Create 2 schedules for 2 of the lines and 2 of the services, and one extra for the other service, so 5 schedules total
        const getScheduleData = (lineId: string, serviceId: string) => {
            const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
            // Reset all uuids
            originalSchedule.id = undefined;
            originalSchedule.periods.forEach((period) => {
                period.id = undefined;
                period.integer_id = undefined;
                period.trips?.forEach((trip) => {
                    trip.id = undefined;
                    trip.integer_id = undefined;
                });
            });
            originalSchedule.line_id = lineId;
            originalSchedule.service_id = serviceId;
            return originalSchedule;
        };     
        const scheduleIdLine1Service1 = await dbQueries.save(getScheduleData(originalLineId1, originalServiceId1));
        const scheduleIdLine1Service2 = await dbQueries.save(getScheduleData(originalLineId1, originalServiceId2));
        const scheduleIdLine2Service1 = await dbQueries.save(getScheduleData(originalLineId2, originalServiceId1));
        const scheduleIdLine2Service2 = await dbQueries.save(getScheduleData(originalLineId2, originalServiceId2));
        const notDuplicatedSchedule = await dbQueries.save(getScheduleData(originalLineId2, otherServiceId));

        // Add another 2 lines and 2 services and duplicate all 4 schedules to the new lines and services
        const [newLineId1, newLineId2, newServiceId1, newServiceId2] = [uuidV4(), uuidV4(), uuidV4(), uuidV4()];
        await linesDbQueries.createMultiple([
            { id: newLineId1, agency_id: agencyId },
            { id: newLineId2, agency_id: agencyId }] as any);
        await servicesDbQueries.createMultiple([
            { id: newServiceId1 },
            { id: newServiceId2 }] as any);
        const lineIdMapping = { [originalLineId1]: newLineId1, [originalLineId2]: newLineId2 };
        const serviceIdMapping = { [originalServiceId1]: newServiceId1, [originalServiceId2]: newServiceId2 };

        // Duplicate shedules with line and service id mappings
        const scheduleIdMapping = await dbQueries.duplicateSchedule({
            lineIdMapping,
            serviceIdMapping
        });

        // There should now be 8 schedules
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(9);

        // Verify all 4 schedules have been correctly duplicated
        const removeAutoFields = (schedule) => {
            delete schedule.created_at;
            delete schedule.updated_at;
            delete schedule.data;
            // Reset all uuids
            schedule.periods.forEach((period) => {
                delete period.created_at;
                delete period.updated_at;
                delete period.data;
                period.trips?.forEach((trip) => {
                    delete trip.created_at;
                    delete trip.updated_at;
                    delete trip.data;
                });
            });
            return schedule;
        }  
        const [originalL1S1, newL1S1] = [schedulesInDb.find(sched => sched.integer_id === scheduleIdLine1Service1), schedulesInDb.find(sched => sched.integer_id === scheduleIdMapping[scheduleIdLine1Service1])]
        expect(originalL1S1).toBeDefined();
        expect(newL1S1).toBeDefined();
        expectSchedulesSame(newL1S1 as ScheduleAttributes, removeAutoFields(originalL1S1) as ScheduleAttributes, { matchIds: false, serviceIdMapping, lineIdMapping });

        const [originalL1S2, newL1S2] = [schedulesInDb.find(sched => sched.integer_id === scheduleIdLine1Service2), schedulesInDb.find(sched => sched.integer_id === scheduleIdMapping[scheduleIdLine1Service2])]
        expect(originalL1S2).toBeDefined();
        expect(newL1S2).toBeDefined();
        expectSchedulesSame(newL1S2 as ScheduleAttributes, removeAutoFields(originalL1S2) as ScheduleAttributes, { matchIds: false, serviceIdMapping, lineIdMapping });

        const [originalL2S1, newL2S1] = [schedulesInDb.find(sched => sched.integer_id === scheduleIdLine2Service1), schedulesInDb.find(sched => sched.integer_id === scheduleIdMapping[scheduleIdLine2Service1])]
        expect(originalL2S1).toBeDefined();
        expect(newL2S1).toBeDefined();
        expectSchedulesSame(newL2S1 as ScheduleAttributes, removeAutoFields(originalL2S1) as ScheduleAttributes, { matchIds: false, serviceIdMapping, lineIdMapping });

        const [originalL2S2, newL2S2] = [schedulesInDb.find(sched => sched.integer_id === scheduleIdLine2Service2), schedulesInDb.find(sched => sched.integer_id === scheduleIdMapping[scheduleIdLine2Service2])]
        expect(originalL2S2).toBeDefined();
        expect(newL2S2).toBeDefined();
        expectSchedulesSame(newL2S2 as ScheduleAttributes, removeAutoFields(originalL2S2) as ScheduleAttributes, { matchIds: false, serviceIdMapping, lineIdMapping });

        // Make sure the schedule for the other service was not duplicated
        expect(scheduleIdMapping[notDuplicatedSchedule]).toBeUndefined();
    });

    test('Duplicate when there are no schedules for the line', async() => {
        // Add new line for which to duplicate
        const newLineId = uuidV4();
        await linesDbQueries.create({
            id: newLineId,
            agency_id: agencyId
        } as any);

        // Duplicate the schedule with a line id mapping, it should return an empty object
        const scheduleIdMapping = await dbQueries.duplicateSchedule({lineIdMapping: { [lineId]: newLineId } });
        expect(scheduleIdMapping).toEqual({});

        // Make sure there are now 2 schedules
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(0);
    });

    test('Duplicate when there are no schedules for the line, but no periods', async() => {
        // Save the original schedule, without periods
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        originalSchedule.periods = [];
        const originalScheduleId = await dbQueries.save(originalSchedule);

        // Add new line for which to duplicate
        const newLineId = uuidV4();
        await linesDbQueries.create({
            id: newLineId,
            agency_id: agencyId
        } as any);

        // Duplicate the schedule with a line id mapping, duplication should succeed
        const scheduleIdMapping = await dbQueries.duplicateSchedule({lineIdMapping: { [lineId]: newLineId } });
        expect(scheduleIdMapping).toEqual({ [originalScheduleId]: expect.anything() });

        // Make sure there are now 2 schedules
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(2);
    });

    test('Duplicate when there are no schedules and periods for the line, but no trips', async() => {
        // Save the original schedule, without trips
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        originalSchedule.periods.forEach(period => {
            period.trips = [];
        });
        const originalScheduleId = await dbQueries.save(originalSchedule);

        // Add new line for which to duplicate
        const newLineId = uuidV4();
        await linesDbQueries.create({
            id: newLineId,
            agency_id: agencyId
        } as any);

        // Duplicate the schedule with a line id mapping, duplication should succeed
        const scheduleIdMapping = await dbQueries.duplicateSchedule({lineIdMapping: { [lineId]: newLineId } });
        expect(scheduleIdMapping).toEqual({ [originalScheduleId]: expect.anything() });

        // Make sure there are now 2 schedules
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(2);
    });

    test('Test transaction: duplicate for new line and, but unexisting path IDs', async() => {
        // Create uuids for the new line and paths and add an inbound path for one of the periods
        const [inboundPathId, newLineId, newOutboundPathId, newInboundPathId] = [uuidV4(), uuidV4(), uuidV4(), uuidV4()];
        // Add new lines and path for which to duplicate
        await linesDbQueries.create({
            id: newLineId,
            agency_id: agencyId
        } as any);
        // Do not add paths for new inbound and outbound IDs, schedule should duplicate fine, but not periods and trips
        await pathsDbQueries.createMultiple([
            { id: inboundPathId, line_id: lineId } as any,
        ]);

        // Save the original schedule, after adding inbound path to one of the periods
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        originalSchedule.periods[0].inbound_path_id = inboundPathId;
        originalSchedule.periods[0].trips[0].path_id = inboundPathId;
        await dbQueries.save(originalSchedule);

        // Duplicate the schedule with a line and path id mapping
        await expect(dbQueries.duplicateSchedule({lineIdMapping: { [lineId]: newLineId }, pathIdMapping: { [pathId]: newOutboundPathId, [inboundPathId]: newInboundPathId } })).rejects.toThrow(TrError);

        // Make sure there is still only 1 schedule
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(1);
    });

    test('Test transaction: duplication fine, but transaction fails later', async() => {
        // Test preparation same as for the service ID mapping test
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;

        // Save the original schedule
        await dbQueries.save(originalSchedule);
        // Add new service for which to duplicate
        const newServiceId = uuidV4();
        await servicesDbQueries.create({
            id: newServiceId
        } as any);

        let error: any = undefined;
        try {
            // Wrap in a transaction
            await knex.transaction(async (trx) => {
                // Update, then delete the schedule, then throw an error
                await dbQueries.duplicateSchedule({serviceIdMapping: { [serviceId]: newServiceId }, transaction: trx });
                // Throw an error to make transaction fail
                throw 'manualTransactionFailure';
            });
        } catch(err) {
            error = err;
        }
        expect(error).toEqual('manualTransactionFailure');

        // Make sure there is still only 1 schedule
        const schedulesInDb = await dbQueries.collection();
        expect(schedulesInDb.length).toEqual(1);
    });

    test('No mapping provided, should throw error', async () => {
        // Add at least one schedule
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        await dbQueries.save(originalSchedule);

        // Duplicate the schedule without mapping, should throw an error
        await expect(dbQueries.duplicateSchedule({ })).rejects.toThrow(TrError);
    });

    test('Mapping to non uuid line ids, should throw error', async () => {
        // Add at least one schedule
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        await dbQueries.save(originalSchedule);

        // Duplicate the schedule without mapping, should throw an error
        await expect(dbQueries.duplicateSchedule({ lineIdMapping: { notAUuid: 'other' } })).rejects.toThrow(TrError);
    });

    test('Mapping to non uuid service ids, should throw error', async () => {
        // Add at least one schedule
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        await dbQueries.save(originalSchedule);

        // Duplicate the schedule without mapping, should throw an error
        await expect(dbQueries.duplicateSchedule({ serviceIdMapping: { notAUuid: 'other' } })).rejects.toThrow(TrError);
    });

});

describe('getTripsInTimeRange', () => {

    beforeEach(async () => {
        // Empty the tables
        await dbQueries.truncateSchedules();
        await dbQueries.truncateSchedulePeriods();
        await dbQueries.truncateScheduleTrips();

        // Add a few schedules
        const service1Line1 = _cloneDeep(scheduleForServiceId) as any;
        service1Line1.line_id = lineId;
        service1Line1.service_id = serviceId;
        await dbQueries.save(service1Line1);

        // duplicate schedule for the same line, different service
        await dbQueries.duplicateSchedule({serviceIdMapping: { [serviceId]: serviceId2 } });
        // duplicate the service1 service for another line
        await dbQueries.duplicateSchedule({serviceIdMapping: { [serviceId]: serviceId }, lineIdMapping: { [lineId]: lineId2 } });
    });

    test('No trips in range', async() => {
        const trips = await dbQueries.getTripsInTimeRange({
            rangeStart: 0,
            rangeEnd: 10000,
            lineIds: [lineId, lineId2],
            serviceIds: [serviceId, serviceId2]
        });
        expect(trips.length).toEqual(0);
    });

    test('Get trips in range for multiple service and line', async() => {
        const trips = await dbQueries.getTripsInTimeRange({
            rangeStart: 25000,
            rangeEnd: 35000,
            lineIds: [lineId, lineId2],
            serviceIds: [serviceId, serviceId2]
        });
        // There should be 3 trips by line/service pairs
        expect(trips.length).toEqual(3 * 3);
        expect(trips.filter(trip => trip.line_id === lineId && trip.service_id === serviceId).length).toEqual(3);
        expect(trips.filter(trip => trip.line_id === lineId2 && trip.service_id === serviceId).length).toEqual(3);
        expect(trips.filter(trip => trip.line_id === lineId && trip.service_id === serviceId2).length).toEqual(3);
    });

    test('Get trips in range only for line', async() => {
        const trips = await dbQueries.getTripsInTimeRange({
            rangeStart: 25000,
            rangeEnd: 35000,
            lineIds: [lineId],
            serviceIds: [serviceId, serviceId2]
        });
        // There should be 3 trips by line/service pairs
        expect(trips.length).toEqual(2 * 3);
        expect(trips.some(trip => trip.line_id === lineId2)).toBe(false);
    });

    test('Get trips in range only for service', async() => {
        const trips = await dbQueries.getTripsInTimeRange({
            rangeStart: 25000,
            rangeEnd: 35000,
            lineIds: [lineId, lineId2],
            serviceIds: [serviceId]
        });
        // There should be 3 trips by line/service pairs
        expect(trips.length).toEqual(2 * 3);
        expect(trips.some(trip => trip.service_id === serviceId2)).toBe(false);
    });

    test('Trips ending at range start', async() => {
        const trips = await dbQueries.getTripsInTimeRange({
            rangeStart: 27015,
            rangeEnd: 29000,
            lineIds: [lineId],
            serviceIds: [serviceId]
        });
        // There should be 1 trip, the one ending at 27015
        expect(trips.length).toEqual(1);
        expect(trips[0].arrival_time_seconds).toEqual(27015);
    });

    test('Trips starting at range end', async() => {
        const trips = await dbQueries.getTripsInTimeRange({
            rangeStart: 10000,
            rangeEnd: 25200,
            lineIds: [lineId],
            serviceIds: [serviceId]
        });
        // There should be 1 trip, the one starting at 25200
        expect(trips.length).toEqual(1);
        console.log("trips", trips[0]);
        expect(trips[0].departure_time_seconds).toEqual(25200);
    });

    test('Unexisting line for service', async() => {
        const trips = await dbQueries.getTripsInTimeRange({
            rangeStart: 25000,
            rangeEnd: 35000,
            lineIds: [lineId2],
            serviceIds: [serviceId2]
        });
        // There should be no trip
        expect(trips.length).toEqual(0);
    });

});