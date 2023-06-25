/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import { EventEmitter } from 'events';
import _cloneDeep from 'lodash.clonedeep';
import _omit from 'lodash.omit';
import each from 'jest-each';
import moment from 'moment';

import Service, { ServiceAttributes } from '../Service';

const socketMock = new EventEmitter();

const weekdayServiceAttributes: ServiceAttributes = {
    id: uuidV4(),
    name: 'Service1',
    data: {
        variables: {},
        gtfs: {
            service_id: 'SE'
        }
    },
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    start_date: '2020-01-01',
    end_date: '2020-12-31',
    is_frozen: false,
    scheduled_lines: []
};

const serviceAttributes2: ServiceAttributes = {
    id: uuidV4(),
    name: 'Service2',
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: true,
    sunday: true,
    start_date: '2000-01-01',
    end_date: '2000-01-01',
    description: 'descS2',
    internal_id: 's222ccc',
    color: '#ff0000',
    data: {
        foo: 'bar',
        variables: {}
    },
    is_frozen: true,
    scheduled_lines: []
};

test('should construct new services', function() {

    const service1 = new Service(weekdayServiceAttributes, true);
    expect(service1.getAttributes()).toEqual(weekdayServiceAttributes);
    expect(service1.isNew()).toBe(true);

    const service2 = new Service(serviceAttributes2, false);
    expect(service2.isNew()).toBe(false);

});

test('should validate', function() {
    // Service class does not have access to ServiceCollection. When we have a better than the collection manager, change it, but for now, fake it
    const features = [new Service(serviceAttributes2, false)]
    const collectionManager = { get: (name: string) => ({ features })}
    const service = new Service(weekdayServiceAttributes, true, collectionManager);
    expect(service.validate()).toBe(true);
    service.set('start_date', undefined);
    expect(service.validate()).toBe(false);
    service.set('start_date', '2020-01-01');
    service.set('end_date', undefined);
    expect(service.validate()).toBe(false);
    service.set('end_date', '2021-01-01');
    service.set('name', undefined);
    expect(service.validate()).toBe(false);
    service.set('name', 'test');
    expect(service.validate()).toBe(true);
    // Existing names
    service.set('name', serviceAttributes2.name);
    expect(service.validate()).toBe(false);
    // Add service to collection and set own name
    features.push(service);
    service.set('name', weekdayServiceAttributes.name);
    expect(service.validate()).toBe(true);
});

test('should convert to string', function() {
    const service1a = new Service(weekdayServiceAttributes, true);
    expect(service1a.toString()).toBe(weekdayServiceAttributes.name);
    service1a.set('name', undefined);
    expect(service1a.toString()).toBe(weekdayServiceAttributes.id);
    const service1b = new Service(weekdayServiceAttributes, true);
    expect(service1b.toString(true)).toBe(`Service1 ${weekdayServiceAttributes.id}`);
    service1b.set('name', undefined);
    expect(service1b.toString(true)).toBe(weekdayServiceAttributes.id);
});

test('should save and delete in memory', function() {
    const service = new Service(weekdayServiceAttributes, true);
    expect(service.isNew()).toBe(true);
    expect(service.isDeleted()).toBe(false);
    service.saveInMemory();
    expect(service.isNew()).toBe(false);
    service.deleteInMemory();
    expect(service.isDeleted()).toBe(true);
});

test('static methods should work', function() {
    expect(Service.getPluralName()).toBe('services');
    expect(Service.getCapitalizedPluralName()).toBe('Services');
    expect(Service.getDisplayName()).toBe('Service');
    const service = new Service(weekdayServiceAttributes, true);
    expect(service.getPluralName()).toBe('services');
    expect(service.getCapitalizedPluralName()).toBe('Services');
    expect(service.getDisplayName()).toBe('Service');

});

test('Test getting lines from attributes', () => {
    // Add an array of null, as returned by the database
    const attributesWithoutLines = Object.assign({}, weekdayServiceAttributes, {scheduled_lines: []});
    const service1 = new Service(attributesWithoutLines, true);
    expect(service1.scheduledLineIds()).toEqual([]);
    expect(service1.hasScheduledLines()).toEqual(false);
    
    const scheduledLines = ['line1', 'line2'];
    const attributesWithLines = Object.assign({}, weekdayServiceAttributes, {scheduled_lines: scheduledLines});
    const service2 = new Service(attributesWithLines, false);
    expect(service2.scheduledLineIds()).toEqual(scheduledLines);
    expect(service2.hasScheduledLines()).toEqual(true);
});

test('Add/remove scheduled_lines', () => {
    // Add an array of null, as returned by the database
    const attributesWithoutLines = Object.assign({scheduled_lines: [null]}, weekdayServiceAttributes);
    const service = new Service(attributesWithoutLines, true);

    const lineId1 = 'line';
    const lineId2 = 'line2';
    // Add one line
    service.addScheduledLine(lineId1);
    expect(service.scheduledLineIds()).toEqual([lineId1]);

    // Add same line
    service.addScheduledLine(lineId1);
    expect(service.scheduledLineIds()).toEqual([lineId1]);

    // Add second line
    service.addScheduledLine(lineId2);
    expect(service.scheduledLineIds()).toEqual([lineId1, lineId2]);

    // Remove first line
    service.removeScheduledLine(lineId1);
    expect(service.scheduledLineIds()).toEqual([lineId2]);

    // Remove unexisting line
    service.removeScheduledLine(lineId1);
    expect(service.scheduledLineIds()).toEqual([lineId2]);

    // Remove second line
    service.removeScheduledLine(lineId2);
    expect(service.scheduledLineIds()).toEqual([]);

});

test('Test deleting service with or without scheduled lines', async () => {
    const deleteSocketMock = jest.fn().mockImplementation((deletedId, cachePath, callback) => callback(true));
    const cacheLineSocketMock = jest.fn().mockImplementation((lineIds, callback) => callback(true));

    socketMock.on('transitService.delete', deleteSocketMock);
    socketMock.on('cache.saveLines', cacheLineSocketMock);

    // Test deleting a line without schedules
    const attributesWithoutLines = Object.assign({}, weekdayServiceAttributes, {scheduled_lines: []});
    const service1 = new Service(attributesWithoutLines, true);
    await service1.delete(socketMock);
    expect(deleteSocketMock).toHaveBeenCalledTimes(1);
    expect(deleteSocketMock).toHaveBeenCalledWith(service1.getId(), undefined, expect.anything());
    expect(cacheLineSocketMock).not.toHaveBeenCalled();
    
    // Test deleting a line with schedules
    const scheduledLines = ['line1', 'line2'];
    const attributesWithLines = Object.assign({}, weekdayServiceAttributes, {scheduled_lines: scheduledLines});
    const service2 = new Service(attributesWithLines, false);
    await service2.delete(socketMock);
    expect(deleteSocketMock).toHaveBeenCalledTimes(2);
    expect(deleteSocketMock).toHaveBeenLastCalledWith(service2.getId(), undefined, expect.anything());
    expect(cacheLineSocketMock).toHaveBeenCalledTimes(1);
    expect(cacheLineSocketMock).toHaveBeenCalledWith(scheduledLines, expect.anything());
});

describe('Service validity period', () => {
    const startRange = new Date(moment('2021-09-10').toString());
    const endRange = new Date(moment('2021-10-09').toString());
    each([
        ['Valid range for date', startRange, undefined, true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-01-01', end_date: '2022-01-01' })],
        ['Invalid range for date, before', startRange, undefined, false, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-01-01', end_date: '2021-02-01' })],
        ['Invalid range for date, after', startRange, undefined, false, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-11-10', end_date: '2022-01-01' })],
        ['Valid range for range', startRange, endRange, true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-01-01', end_date: '2022-01-01' })],
        ['Invalid range for range, before', startRange, endRange, false, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-01-01', end_date: '2021-02-01' })],
        ['Invalid range for range, after', startRange, endRange, false, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-11-10', end_date: '2022-01-01' })],
        ['Valid range for range, all included', startRange, endRange, true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-20', end_date: '2022-09-22' })],
        ['Valid range for range, overlaps', startRange, endRange, true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-01', end_date: '2022-09-22' })],
        ['Valid range for date, but has only dates', startRange, undefined, true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-10', end_date: '2021-10-30', only_dates: ['2021-09-10', '2021-09-23', '2021-10-30'] })],
        ['Valid range for date, only dates, but not test date', startRange, undefined, false, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-08', end_date: '2021-10-30', only_dates: ['2021-09-08', '2021-09-23', '2021-10-30'] })],
        ['Valid range for range, but has only dates', startRange, endRange, true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-01', end_date: '2021-12-31', only_dates: ['2021-09-08', '2021-09-23', '2021-10-30'] })],
        ['Valid range for range, only dates, but not in test range', startRange, endRange, false, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-01', end_date: '2021-10-30', only_dates: ['2021-09-08', '2021-10-30'] })],
        ['Valid range for date, but exclude', startRange, undefined, false, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-01', end_date: '2021-09-11', except_dates: ['2021-09-10'] })],
        ['Valid range for date, with exclude, not excluded', startRange, undefined, true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-01', end_date: '2021-09-11', except_dates: ['2021-09-13'] })],
        // TODO We don't look at the exclusion for ranges. Should we?
        ['Valid range for range, but exclude', startRange, new Date(moment('2021-09-12').toString()), true, Object.assign({}, weekdayServiceAttributes, { start_date: '2021-09-01', end_date: '2021-09-15', except_dates: ['2021-09-10', '2021-09-11', '2021-09-12'] })],
    ]).test('%s', (_title, start, end, expected, serviceAttributes: ServiceAttributes) => {
        const service = new Service(serviceAttributes, false);
        if (end) {
            expect(service.isValidForDate(start, end)).toEqual(expected);
        } else {
            expect(service.isValidForDate(start)).toEqual(expected);
        }
    });
});

test('getClonedAttributes', () => {
    const service = new Service(weekdayServiceAttributes, true);

    // Delete specifics
    const clonedAttributes = service.getClonedAttributes();
    const { id, data, ...expected } = _cloneDeep(weekdayServiceAttributes);
    (expected as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes).toEqual(expected);

    // Complete copy
    const clonedAttributes2 = service.getClonedAttributes(false);
    const { data: data2, ...expectedWithSpecifics } = _cloneDeep(weekdayServiceAttributes);
    (expectedWithSpecifics as any).data = _omit(data, 'gtfs');
    expect(clonedAttributes2).toEqual(expectedWithSpecifics);

    // With second object
    const service2 = new Service(serviceAttributes2, true);

    // Delete specifics
    const clonedAttributes3 = service2.getClonedAttributes();
    const expected2 = _omit(service2.attributes, 'id');
    expect(clonedAttributes3).toEqual(expected2);

    // Complete copy
    const clonedAttributes4 = service2.getClonedAttributes(false);
    expect(clonedAttributes4).toEqual(service2.attributes);
});
