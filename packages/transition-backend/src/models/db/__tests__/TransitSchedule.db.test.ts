/*
 * Copyright 2022, Polytechnique Montreal and contributors
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
import { ScheduleAttributes, SchedulePeriod } from 'transition-common/lib/services/schedules/Schedule';
import TrError from 'chaire-lib-common/lib/utils/TrError';

const agencyId = uuidV4();
const lineId = uuidV4();
const serviceId = uuidV4();
const pathId = uuidV4();

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
    await pathsDbQueries.create({
        id: pathId,
        line_id: lineId
    } as any);
    await servicesDbQueries.create({
        id: serviceId
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
    await dbQueries.destroy();
    await servicesDbQueries.destroy();
    await pathsDbQueries.destroy();
    await linesDbQueries.destroy();
    await agenciesDbQueries.destroy();
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

const scheduleForServiceId = {
    "allow_seconds_based_schedules": false,
    "id": "cab32276-3181-400e-a07c-719326be1f02",
    "line_id": lineId,
    "service_id": serviceId,
    "is_frozen": false,
    "periods": [{
        // Period with start and end hours and multiple trips
        "custom_start_at_str": null,
        "end_at_hour": 12,
        "inbound_path_id": null,
        "interval_seconds": 1800,
        "number_of_units": null,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_period_shortname",
        "start_at_hour": 7,
        "trips": [{
            "arrival_time_seconds": 27015,
            "block_id": "a2cadcb8-ee17-4bd7-9e77-bd400ad73064",
            "departure_time_seconds": 25200,
            "id": "42cadcb8-ee17-4bd7-9e77-bd400ad73064",
            "node_arrival_times_seconds": [null, 25251, 26250, 27015],
            "node_departure_times_seconds": [25200, 25261, 26260, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }, {
            "arrival_time_seconds": 32416,
            "block_id": null,
            "departure_time_seconds": 30601,
            "id": "5389b983-511e-4184-8776-ebc108cebaa2",
            "node_arrival_times_seconds": [null, 30652, 31650, 32416],
            "node_departure_times_seconds": [30601, 30662, 31660, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }, {
            "arrival_time_seconds": 34216,
            "block_id": null,
            "departure_time_seconds": 32401,
            "id": "448544ae-60d1-4d5b-8734-d031332cb6bc",
            "node_arrival_times_seconds": [null, 32452, 33450, 34216],
            "node_departure_times_seconds": [32401, 32462, 33460, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }]
    }, {
        // Period with custom start and end, with a single trip
        "custom_start_at_str": "13:15",
        "custom_end_at_str": "17:24",
        "end_at_hour": 18,
        "inbound_path_id": null,
        "interval_seconds": 1800,
        "number_of_units": null,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_custom_period",
        "start_at_hour": 13,
        "trips": [{
            "arrival_time_seconds": 50000,
            "block_id": null,
            "departure_time_seconds": 48000,
            "id": "448544ae-cafe-4d5b-8734-d031332cb6bc",
            "node_arrival_times_seconds": [null, 48050, 49450, 50000],
            "node_departure_times_seconds": [48000, 48060, 49460, null],
            "nodes_can_board": [true, true, true, false],
            "nodes_can_unboard": [false, true, true, true],
            "path_id": pathId,
            "seated_capacity": 20,
            "total_capacity": 50
        }]
    }, {
        // Period with custom start and end, without trips
        "custom_start_at_str": "18:00",
        "custom_end_at_str": "23:00",
        "end_at_hour": 23,
        "inbound_path_id": null,
        "interval_seconds": 1800,
        "number_of_units": null,
        "outbound_path_id": pathId,
        "period_shortname": "all_day_custom_period",
        "start_at_hour": 18
    }],
    "periods_group_shortname": "all_day",
};

/** Function to verify 2 schedules are identical to the trip level. It's easier
 * to debug failed test than a matchObject on the scheduleAttributes */
const expectSchedulesSame = (actual: ScheduleAttributes, expected: ScheduleAttributes) => {
    const { periods, ...scheduleAttributes } = actual;
    const { periods: expectedPeriods, ...expectedScheduleAttributes } = expected;
    expect(scheduleAttributes).toEqual(expect.objectContaining(expectedScheduleAttributes));
    // Make sure all expected periods are there
    for (let periodIdx = 0; periodIdx < expectedPeriods.length; periodIdx++) {
        // Find the matching period
        const { trips: expectedTrips, ...expectedPeriodAttributes } = expectedPeriods[periodIdx];
        const matchingPeriod = periods.find(period => period.id === expectedPeriodAttributes.id);
        expect(matchingPeriod).toBeDefined();
        // Validate period attributes
        const { trips, ...periodAttributes } = matchingPeriod as SchedulePeriod;
        if (expectedTrips === undefined) {
            expect(trips).toEqual([]);
            continue;
        }
        expect(periodAttributes).toEqual(expect.objectContaining(expectedPeriodAttributes));
        // Make sure all expected trips are there
        for (let tripIdx = 0; tripIdx < expectedTrips.length; tripIdx++) {
            const matchingTrip = trips.find(trip => trip.id === expectedTrips[tripIdx].id);
            expect(matchingTrip).toBeDefined();
            expect(matchingTrip).toEqual(expect.objectContaining(expectedTrips[tripIdx]));
        }
        expect(trips.length).toEqual(expectedTrips.length);
    }
    expect(periods.length).toEqual(expectedPeriods.length);
}

describe(`schedules`, function () {

    test('schedule exists should return false if object is not in database', async function () {

        // Check unexisting schedule
        const exists = await dbQueries.exists(uuidV4());
        expect(exists).toBe(false);

    });

    test('should create schedule object with periods and trips from schedule data', async function() {

        const scheduleDataValidation = ScheduleDataValidator.validate(scheduleForServiceId);
        expect(scheduleDataValidation.isValid).toBe(true);
        expect(ScheduleDataValidator.validate(scheduleForServiceId, pathStub1).isValid).toBe(true);
        expect(ScheduleDataValidator.validate(scheduleForServiceId, pathStub2).isValid).toBe(false);
        const newId = await dbQueries.save(scheduleForServiceId as any);
        expect(newId).toBe(scheduleForServiceId.id);

    });

    test('should not create schedule object with existing service/line pair', async function() {

        const existingServiceLineSchedule = _cloneDeep(scheduleForServiceId);
        existingServiceLineSchedule.id = uuidV4();
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
        const exists = await dbQueries.exists(scheduleForServiceId.id);
        expect(exists).toBe(true);

    });

    test('should read schedule object as schedule data with periods and trips', async function() {

        const scheduleDataRead = await dbQueries.read(scheduleForServiceId.id);
        expect(scheduleDataRead).toMatchObject(scheduleForServiceId);
        expect(scheduleDataRead.updated_at).toBeNull();
        expect(scheduleDataRead.created_at).not.toBeNull();

    });

    test('test collection', async function() {
        const collection = await dbQueries.collection();
        expect(collection.length).toEqual(1);
        expect(collection[0]).toMatchObject(scheduleForServiceId);
    })

    test('should update a schedule in database and read it correctly', async () => {

        // Read the object from DB to get all the IDs
        const scheduleDataRead = await dbQueries.read(scheduleForServiceId.id);

        // Change a few values in schedule and 2nd period and trip
        const updatedSchedule = _cloneDeep(scheduleDataRead);
        updatedSchedule.periods_group_shortname = 'New_period_name';
        updatedSchedule.periods[1].custom_start_at_str = "13:45";
        updatedSchedule.periods[1].trips[0].seated_capacity = 30;

        // Update the object
        const newId = await dbQueries.save(updatedSchedule);
        expect(newId).toBe(scheduleForServiceId.id);

        // Delete the updated_at fields
        updatedSchedule.updated_at = expect.anything();
        updatedSchedule.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });

        // Read the object again and make sure it matches
        const scheduleDataUpdatedRead = await dbQueries.read(scheduleForServiceId.id);
        expectSchedulesSame(scheduleDataUpdatedRead, updatedSchedule);
        expect(scheduleDataUpdatedRead.updated_at).not.toBeNull();
        expect(scheduleDataUpdatedRead.created_at).not.toBeNull();

    });

    test('Update a schedule after deleting trips and periods', async () => {

        // Read the object from DB to get all the IDs
        const scheduleDataRead = await dbQueries.read(scheduleForServiceId.id);

        // Remove 2nd period and a trip from first period
        const updatedSchedule = _cloneDeep(scheduleDataRead);
        updatedSchedule.periods.splice(1, 1);
        updatedSchedule.periods[0].trips.splice(2, 1);

        // Update the object
        const newId = await dbQueries.save(updatedSchedule);
        expect(newId).toBe(scheduleForServiceId.id);

        // Expect anything for the updated_at fields
        updatedSchedule.updated_at = expect.anything();
        updatedSchedule.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });

        // Read the object again and make sure it matches
        const scheduleDataUpdatedRead = await dbQueries.read(scheduleForServiceId.id);
        // Recursively remove the updated_at field
        scheduleDataUpdatedRead.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });
        expectSchedulesSame(scheduleDataUpdatedRead, updatedSchedule);
    });

    test('Update a schedule after adding trips and periods', async () => {

        // Read the object from DB to get all the IDs
        const scheduleDataRead = await dbQueries.read(scheduleForServiceId.id);

        // Remove 2nd period and a trip from first period
        const updatedSchedule = _cloneDeep(scheduleDataRead);
        updatedSchedule.periods.splice(1, 0, scheduleForServiceId.periods[1] as any);
        const newTrip = scheduleForServiceId.periods[0].trips ? scheduleForServiceId.periods[0].trips[2] : undefined;
        expect(newTrip).toBeDefined();
        updatedSchedule.periods[0].trips.push(newTrip as any);

        // Update the object
        const newId = await dbQueries.save(updatedSchedule);
        expect(newId).toBe(scheduleForServiceId.id);

        // Expect anything for the updated_at fields
        updatedSchedule.updated_at = expect.anything();
        updatedSchedule.periods.forEach((period) => {
            delete period.updated_at;
            period.trips.forEach((trip) => delete trip.updated_at);
        });

        // Read the object again and make sure it matches
        const scheduleDataUpdatedRead = await dbQueries.read(scheduleForServiceId.id);
        expectSchedulesSame(scheduleDataUpdatedRead, updatedSchedule);

    });

    test('should delete object from database', async () => {

        const id = await dbQueries.delete(scheduleForServiceId.id);
        expect(id).toBe(scheduleForServiceId.id);

        // Verify the object does not exist anymore
        const exists = await dbQueries.exists(scheduleForServiceId.id);
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
        await expect(dbQueries.save(newSchedule as any)).rejects.toThrowError(TrError);

        // Read the object from DB and make sure it has not changed
        const dataExists = await dbQueries.exists(scheduleForServiceId.id);
        expect(dataExists).toEqual(false);
    });

    test('update with periods and trips, with error', async() => {
        // Insert the schedule
        await dbQueries.save(scheduleForServiceId as any);
        // Read the object from DB and make sure it has not changed
        const originalData = await dbQueries.read(scheduleForServiceId.id);

        // Force and invalid data for period field custom_start_at_str
        const updatedSchedule = _cloneDeep(scheduleForServiceId);
        updatedSchedule.periods_group_shortname = 'New_period_name';
        updatedSchedule.periods[1].custom_start_at_str = ["13:45"] as any;
        delete updatedSchedule.periods[0];
        await expect(dbQueries.save(updatedSchedule as any)).rejects.toThrowError(TrError);

        // Read the object from DB and make sure it has not changed
        const dataAfterFail = await dbQueries.read(scheduleForServiceId.id);
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

        const updatedSchedule = _cloneDeep(originalSchedule);
        // Remove 2nd period and a trip from first period, then
        updatedSchedule.periods.splice(1, 1);
        updatedSchedule.periods[0].trips.splice(2, 1);
        await knex.transaction(async (trx) => {
            // Save the original schedule
            await dbQueries.save(originalSchedule, { transaction: trx });

            // Save the updated schedule with one less period and trip
            await dbQueries.save(updatedSchedule, { transaction: trx });
        });

        // Make sure the object is there and updated
        const dataRead = await dbQueries.read(scheduleForServiceId.id);
        expectSchedulesSame(dataRead, updatedSchedule);
    });

    test('Create, update with error', async() => {
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;

        const updatedSchedule = _cloneDeep(originalSchedule);
        // Update some fields, but change uuid of one trip for not a uuid
        updatedSchedule.allow_seconds_based_schedules = true;
        updatedSchedule.periods.splice(1, 1);
        updatedSchedule.periods[0].trips[0].id = 'not a uuid';

        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                 // Save the original schedule
                await dbQueries.save(originalSchedule, { transaction: trx });

                // Save the updated schedule with one less period and trip
                await dbQueries.save(updatedSchedule, { transaction: trx });
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Read the object from DB and make sure it has not changed
        const dataExists = await dbQueries.exists(scheduleForServiceId.id);
        expect(dataExists).toEqual(false);
    });

    test('Update, delete with error', async() => {
        const originalSchedule = _cloneDeep(scheduleForServiceId) as any;
        // Add the original schedule out of the transaction
        await dbQueries.save(originalSchedule);

        const updatedSchedule = _cloneDeep(originalSchedule);
        // Remove 2nd period and a trip from first period, then
        updatedSchedule.periods.splice(1, 1);
        updatedSchedule.periods[0].trips.splice(2, 1);

        let error: any = undefined;
        try {
            await knex.transaction(async (trx) => {
                // Update, then delete the schedule, then throw an error
                await dbQueries.save(updatedSchedule, { transaction: trx });
                await dbQueries.delete(scheduleForServiceId.id, { transaction: trx });
                throw 'error';
            });
        } catch(err) {
            error = err;
        }
        expect(error).toBeDefined();

        // Make sure the original object is unchanged
        // Make sure the object is there and updated
        const dataRead = await dbQueries.read(scheduleForServiceId.id);
        expectSchedulesSame(dataRead, originalSchedule);
    });

});
