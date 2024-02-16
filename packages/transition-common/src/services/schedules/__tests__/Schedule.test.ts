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
import Schedule from '../Schedule';
import { getScheduleAttributes } from './ScheduleData.test';
import { getPathObject } from '../../path/__tests__/PathData.test';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import LineCollection from '../../line/LineCollection';
import PathCollection from '../../path/PathCollection';
import Line from '../../line/Line';
import { timeStrToSecondsSinceMidnight } from 'chaire-lib-common/lib/utils/DateTimeUtils';

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

    test('Periods with individual trips, no outbound/inboud/frequencies/units', () => {
        // Reset paths, intervals and units
        const testAttributes = _cloneDeep(scheduleAttributesForUpdate);
        testAttributes.periods.forEach(period => {
            (period as any).outbound_path_id = null;
            period.inbound_path_id = null;
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
