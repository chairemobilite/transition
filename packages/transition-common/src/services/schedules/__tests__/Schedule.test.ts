/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';
import _omit from 'lodash.omit';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import EventManagerMock from 'chaire-lib-common/lib/test/services/events/EventManagerMock';
import Schedule from '../Schedule';
import { getScheduleAttributes } from './ScheduleData.test';

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
