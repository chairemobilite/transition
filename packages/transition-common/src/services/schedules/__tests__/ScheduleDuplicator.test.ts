/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import _omit from 'lodash/omit';
import { v4 as uuidV4 } from 'uuid';

import { getScheduleAttributes } from './ScheduleData.test';
import Schedule from '../Schedule';
import { duplicateSchedule } from '../ScheduleDuplicator';

const pathId = uuidV4();
const scheduleAttributes = getScheduleAttributes({ pathId });
const schedule = new Schedule(scheduleAttributes, true);

test('Duplicate schedule, same line path and services', async () => {
    // Copy the line and make sure the path was correctly copied
    const newSchedule = await duplicateSchedule(schedule, { });
    expect(newSchedule.getId()).not.toEqual(schedule.getId());

    // Validate the schedule's data
    const expectedSched = getScheduleAttributes({ pathId, scheduleId: newSchedule.getId() });
    const actualSched = newSchedule.attributes;
    const expectedBaseSchedules = _omit(expectedSched, 'periods', 'integer_id');
    const actualSchedule = _omit(actualSched, 'periods');
    const expectedPeriods = expectedSched.periods;
    const actualPeriods = actualSched.periods;
    expect(actualSchedule).toEqual(expectedBaseSchedules);

    // Validate the period's data and id propagation
    for (let i = 0; i < expectedPeriods.length; i++) {
        const expectedPeriod = _omit(expectedPeriods[i], ['id', 'trips', 'integer_id', 'schedule_id']);
        const actualPeriod = _omit(actualPeriods[i], ['id', 'trips']);
        const expectedTrips = expectedPeriods[i].trips;
        const actualTrips = actualPeriods[i].trips;
        const periodId = actualPeriods[i].integer_id;
        expect(actualPeriod).toEqual(expectedPeriod);

        // Validate the trip's data and id propagation
        for (let j = 0; j < expectedTrips.length; j++) {
            const expectedTrip = _omit(expectedTrips[j], 'id', 'integer_id', 'schedule_period_id');
            const actualTrip = _omit(actualTrips[j], 'id');
            expect(actualTrip).toEqual(expectedTrip);
        }
    }
});

test('Duplicate schedule, different line, path and services', async () => {
    const newServiceId = uuidV4();
    const newLineId = uuidV4();
    const newPathId = uuidV4();
    const pathMapping = {};
    pathMapping[pathId] = newPathId;
    
    // Copy the line and make sure the path was correctly copied
    const newSchedule = await duplicateSchedule(schedule, { lineId: newLineId, serviceId: newServiceId, pathIdsMapping: pathMapping });
    expect(newSchedule.getId()).not.toEqual(schedule.getId());
    expect(newSchedule.attributes.line_id).not.toEqual(schedule.attributes.line_id);
    expect(newSchedule.attributes.service_id).not.toEqual(schedule.attributes.service_id);

    // Validate the schedule's data
    const expectedSched = getScheduleAttributes({ pathId: newPathId, lineId: newLineId, serviceId: newServiceId, scheduleId: newSchedule.getId() });
    const actualSched = newSchedule.attributes;
    const expectedBaseSchedules = _omit(expectedSched, 'periods', 'integer_id');
    const actualSchedule = _omit(actualSched, 'periods');
    const expectedPeriods = expectedSched.periods;
    const actualPeriods = actualSched.periods;
    expect(actualSchedule).toEqual(expectedBaseSchedules);

    // Validate the period's data and id propagation
    for (let i = 0; i < expectedPeriods.length; i++) {
        const expectedPeriod = _omit(expectedPeriods[i], ['id', 'trips', 'integer_id', 'schedule_id']);
        const actualPeriod = _omit(actualPeriods[i], ['id', 'trips']);
        expect(actualPeriod.outbound_path_id).not.toEqual(schedule.attributes.periods[i].outbound_path_id);
        const expectedTrips = expectedPeriods[i].trips;
        const actualTrips = actualPeriods[i].trips;
        expect(actualPeriod).toEqual(expectedPeriod);

        // Validate the trip's data and id propagation
        for (let j = 0; j < expectedTrips.length; j++) {
            const expectedTrip = _omit(expectedTrips[j], 'id', 'integer_id', 'schedule_period_id');
            const actualTrip = _omit(actualTrips[j], 'id');
            expect(actualTrip).toEqual(expectedTrip);
        }
    }
});