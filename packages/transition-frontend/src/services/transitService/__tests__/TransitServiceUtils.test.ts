/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import each from 'jest-each';
import moment from 'moment';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import * as ServiceUtils from '../TransitServiceUtils';
import { TransitObjectStub, GenericCollectionStub } from '../../__tests__/TransitObjectStub';
import * as Schedules from '../../schedule/__tests__/TransitScheduleUtils.test';
import { TestUtils } from 'chaire-lib-common/lib/test';
import Service from 'transition-common/lib/services/service/Service';
import Line from 'transition-common/lib/services/line/Line';
import Schedule from 'transition-common/lib/services/schedules/Schedule';
import LineCollection from 'transition-common/lib/services/line/LineCollection';

Line.prototype.refreshSchedules = jest.fn().mockResolvedValue('ok');
const mockedRefreshLines = Line.prototype.refreshSchedules as jest.MockedFunction<typeof Line.prototype.refreshSchedules>;
Schedule.prototype.save = jest.fn().mockResolvedValue('ok');
const mockedScheduleSave = Schedule.prototype.save as jest.MockedFunction<typeof Schedule.prototype.save>;
Schedule.prototype.delete = jest.fn().mockResolvedValue('ok');
const mockedScheduleDelete = Schedule.prototype.delete as jest.MockedFunction<typeof Schedule.prototype.delete>;

const emptyService = new Service({}, true)
const weekday = "service weekday";
const serviceWeekday = new Service({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        name: weekday,
        toString: () => weekday,
        start_date: '2020-01-01',
        end_date: '2020-12-31'
    }, true);
const extendedWeekday = new Service({
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        name: "service weekday extended",
        toString: () => "service weekday extended",
        start_date: '2020-01-01',
        end_date: '2020-12-31'
    }, true);
const serviceWeekend = new Service({
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: true,
        sunday: true,
        name: "service weekend",
        toString: () => "service weekend",
        start_date: '2020-01-01',
        end_date: '2020-12-31'
    }, true);
const serviceOld = new Service({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        name: "service old",
        toString: () => "service old",
        start_date: '2019-01-01',
        end_date: '2019-12-31'
    }, true);
const serviceOverlap = new Service({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        name: "service short validity",
        toString: () => "service short validity",
        start_date: '2019-06-30',
        end_date: '2020-06-30'
    }, true);
const partialService = new Service({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        name: "partial service, missing some days",
        toString: () => "service short validity",
        start_date: '2019-06-30',
        end_date: '2020-06-30'
    }, true);
const undefinedDays = new Service({
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: null,
        friday: undefined,
        name: "partial service, undefined days",
        toString: () => "service short validity",
        start_date: '2019-06-30',
        end_date: '2020-06-30'
    }, true);
const saturdayWithOnlyExcept = new Service({
    saturday: true,
    sunday: false,
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    name: "Saturday service, with exceptions",
    toString: () => "service short validity",
    start_date: '2023-06-01',
    end_date: '2023-07-01',
    only_dates: ['2023-06-25'],
    except_dates: ['2023-06-10']
}, true);
const translationFct = (str) => {return str.substring(str.lastIndexOf(':') + 1)};

beforeEach(() => {
    mockedRefreshLines.mockClear();
    mockedScheduleDelete.mockClear();
    mockedScheduleSave.mockClear();
})

test('Get Label', () => {
    expect(ServiceUtils.getServiceLabel(emptyService, translationFct)).toBe(emptyService.getId());
    expect(ServiceUtils.getServiceLabel(serviceWeekday, translationFct)).toBe(weekday + " (monday, tuesday, wednesday, thursday, friday)");
    expect(ServiceUtils.getServiceLabel(serviceWeekend, translationFct)).toBe("service weekend (saturday, sunday)");
});

test('Can Merge', () => {
    // We can merge everything with an empty service
    expect(ServiceUtils.canMergeServices(emptyService, serviceWeekday)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(emptyService, extendedWeekday)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(emptyService, serviceWeekend)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(emptyService, serviceOld)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(emptyService, serviceOverlap)).toBeTruthy();

    // Can merge only when days are included or identical
    expect(ServiceUtils.canMergeServices(serviceWeekday, serviceWeekday)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(serviceWeekday, extendedWeekday)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(serviceWeekday, serviceWeekend)).toBeFalsy();
    expect(ServiceUtils.canMergeServices(extendedWeekday, serviceWeekday)).toBeFalsy();

    // Can merge only if validity period overlaps
    expect(ServiceUtils.canMergeServices(serviceWeekday, serviceOverlap)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(serviceOverlap, serviceWeekday)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(serviceWeekday, serviceOld)).toBeFalsy();

    // Missing or undefined days should be considered as false
    expect(ServiceUtils.canMergeServices(serviceWeekday, partialService)).toBeTruthy();
    expect(ServiceUtils.canMergeServices(serviceWeekend, partialService)).toBeFalsy();
    expect(ServiceUtils.canMergeServices(serviceWeekday, undefinedDays)).toBeTruthy();
});

test('Merge services with conflict', async () => {
    // TODO Stub those objects when they are in typescript
    // TODO Generic collection
    const testServiceWeekday = new Service(serviceWeekday.getAttributes(), false);
    const testServiceExtended = new Service(extendedWeekday.getAttributes(), false);
    const testServiceWeekend = new Service(serviceWeekend.getAttributes(), false);
    jest.spyOn(testServiceWeekday, 'delete').mockResolvedValue(Status.createOk({ id: serviceWeekday.id }));
    jest.spyOn(testServiceExtended, 'delete').mockResolvedValue(Status.createOk({ id: extendedWeekday.id }));
    jest.spyOn(testServiceWeekend, 'delete').mockResolvedValue(Status.createOk({ id: serviceWeekend.id }));
    const service1Id = testServiceWeekday.getId();
    const service2Id = testServiceExtended.getId();
    const service3Id = testServiceWeekend.getId();

    // Prepare the first line, contains one of the services to merge
    const attributes1 = {};
    const line1Schedule = new Schedule(Schedules.scheduleBase.attributes, false);
    line1Schedule.set('service_id', service1Id);
    attributes1[service1Id] = line1Schedule;
    const line1 = new Line({scheduleByServiceId: attributes1 }, false);

    // Prepare the second line, contains 2 services, one of which is to merge
    const attributes2 = {};
    const line2Schedule1 = new Schedule(Schedules.scheduleBase.attributes, false);
    line2Schedule1.set('service_id', service1Id);
    attributes2[service1Id] = line2Schedule1.attributes;

    const line2Schedule2 = new Schedule(Schedules.scheduleBase.attributes, false);
    line2Schedule2.set('service_id', service3Id);
    attributes2[service3Id] = line2Schedule2.attributes;

    const line2 = new Line({scheduleByServiceId: attributes2 }, false);

    // Prepare the third line, contains 2 services, that will be merged
    const attributes3 = {};
    const line3Schedule1 = new Schedule(Schedules.scheduleBase.attributes, false);
    line3Schedule1.set('service_id', service1Id);
    attributes3[service1Id] = line3Schedule1.attributes;

    const line3Schedule2 = new Schedule(Schedules.scheduleSamePeriod.attributes, false);
    line3Schedule2.set('service_id', service2Id);
    attributes3[service2Id] = line3Schedule2.attributes;

    const line3 = new Line({scheduleByServiceId: attributes3 }, false);

    // Prepare the 4th line, contains 2 services, with periods that cannot be merged
    const attributes4 = {};
    const line4Schedule1 = new Schedule(Schedules.scheduleBase.attributes, false);
    line4Schedule1.set('service_id', service1Id);
    attributes4[service1Id] = line4Schedule1.attributes;

    const line4Schedule2 = new Schedule(Schedules.differentTimes.attributes, false);
    line4Schedule2.set('service_id', service2Id);
    attributes4[service2Id] = line4Schedule2.attributes;

    const line4 = new Line({scheduleByServiceId: attributes4 }, false);

    // Prepare scenarios
    const scenario1 = new TransitObjectStub({services: [service1Id]});
    const scenario2 = new TransitObjectStub({services: [service1Id, service2Id]});
    const scenario3 = new TransitObjectStub({services: [service1Id, service3Id]});
    const scenario4 = new TransitObjectStub({services: [service3Id]});

    // Prepare test elements
    const lines = [ line1, line2, line3, line4 ];
    const scenarios = [ scenario1, scenario2, scenario3, scenario4 ];
    const serviceLocator = { collectionManager: {
        get: (_str) => _str === 'lines' ? new GenericCollectionStub(lines) : new GenericCollectionStub(scenarios),
        refresh: (str) => str
    } };
    const newServiceId = "newServiceId";
    const messages = await ServiceUtils.mergeServices(newServiceId, [ testServiceWeekday, testServiceExtended ], serviceLocator);

    await TestUtils.flushPromises();
    // Check the messages
    expect(messages.length).toBe(1);
    expect(messages[0].line).toBe(line4);

    // lines should be refreshed before merging services and after, so 2 times * 3 lines and 1 time for the 4th line
    expect(mockedRefreshLines).toHaveBeenCalledTimes(7);
    // 3 schedules were saved
    expect(mockedScheduleSave).toHaveBeenCalledTimes(3);
    // 1 was deleted
    expect(mockedScheduleDelete).toHaveBeenCalledTimes(1);

    // Validate services
    // Service 1 has new service id
    expect(scenario1.save).toHaveBeenCalledTimes(1);
    expect(scenario1.get('services')).toEqual([newServiceId]);

    // Service 2 has one service, the merged one
    expect(scenario2.save).toHaveBeenCalledTimes(1);
    expect(scenario2.get('services')).toEqual([newServiceId]);

    // Service 3 has service 1 replaced by new service
    expect(scenario3.save).toHaveBeenCalledTimes(1);
    expect(scenario3.get('services')).toEqual([service3Id, newServiceId]);

    // Service 4 is unchanged
    expect(scenario4.save).toHaveBeenCalledTimes(0);

    // Make sure the services have not been delete
    expect(testServiceWeekday.delete).toHaveBeenCalledTimes(0);
    expect(testServiceExtended.delete).toHaveBeenCalledTimes(0);
    expect(testServiceWeekend.delete).toHaveBeenCalledTimes(0);

});

test('Merge services no conflict', async () => {
    // Same as previous test, but without the conflicting line 4
    // TODO Stub those objects when they are in typescript
    // TODO Generic collection
    const testServiceWeekday = new Service(serviceWeekday.getAttributes(), false);
    const testServiceExtended = new Service(extendedWeekday.getAttributes(), false);
    const testServiceWeekend = new Service(serviceWeekend.getAttributes(), false);
    jest.spyOn(testServiceWeekday, 'delete').mockResolvedValue(Status.createOk({ id: serviceWeekday.id }));
    jest.spyOn(testServiceExtended, 'delete').mockResolvedValue(Status.createOk({ id: extendedWeekday.id }));
    jest.spyOn(testServiceWeekend, 'delete').mockResolvedValue(Status.createOk({ id: serviceWeekend.id }));
    const service1Id = testServiceWeekday.getId();
    const service2Id = testServiceExtended.getId();
    const service3Id = testServiceWeekend.getId();

    // Prepare the first line, contains one of the services to merge
    const attributes1 = {};
    const line1Schedule = new Schedule(Schedules.scheduleBase.attributes, false);
    line1Schedule.set('service_id', service1Id);
    attributes1[service1Id] = line1Schedule.attributes;
    const line1 = new Line({scheduleByServiceId: attributes1 }, false);

    // Prepare the second line, contains 2 services, one of which is to merge
    const attributes2 = {};
    const line2Schedule1 = new Schedule(Schedules.scheduleBase.attributes, false);
    line2Schedule1.set('service_id', service1Id);
    attributes2[service1Id] = line2Schedule1.attributes;

    const line2Schedule2 = new Schedule(Schedules.scheduleBase.attributes, false);
    line2Schedule2.set('service_id', service3Id);
    attributes2[service3Id] = line2Schedule2.attributes;

    const line2 = new Line({scheduleByServiceId: attributes2 }, false);

    // Prepare the third line, contains 2 services, that will be merged
    const attributes3 = {};
    const line3Schedule1 = new Schedule(Schedules.scheduleBase.attributes, false);
    line3Schedule1.set('service_id', service1Id);
    attributes3[service1Id] = line3Schedule1.attributes;

    const line3Schedule2 = new Schedule(Schedules.scheduleSamePeriod.attributes, false);
    line3Schedule2.set('service_id', service2Id);
    attributes3[service2Id] = line3Schedule2.attributes;

    const line3 = new Line({scheduleByServiceId: attributes3 }, false);

    // Prepare test elements
    const lines = [ line1, line2, line3 ];
    const serviceLocator = { collectionManager: {
        get: (_str) => _str === 'lines' ? new LineCollection(lines, {}) : new GenericCollectionStub([]),
        refresh: (str) => str
    } };
    const newServiceId = "newServiceId";
    const messages = await ServiceUtils.mergeServices(newServiceId, [ testServiceWeekday, testServiceExtended ], serviceLocator);

    await TestUtils.flushPromises();
    // Check the messages
    expect(messages.length).toBe(0);

    // lines should be refreshed before merging services and after, so 2 times * 3 lines
    expect(mockedRefreshLines).toHaveBeenCalledTimes(6);
    // 3 services were saved, 1 deleted from line 3
    expect(mockedScheduleSave).toHaveBeenCalledTimes(3);
    expect(mockedScheduleDelete).toHaveBeenCalledTimes(1);

    // Make sure the services have not been delete
    expect(testServiceWeekday.delete).toHaveBeenCalledTimes(1);
    expect(testServiceExtended.delete).toHaveBeenCalledTimes(1);
    expect(testServiceWeekend.delete).toHaveBeenCalledTimes(0);

});

describe('Service matches', () => {

    each([
        ['Match service day: matching', serviceWeekday, { days: [2] }, true],
        ['Match service day: empty days', serviceWeekday, { days: [] }, true],
        ['Match service day: no match', serviceWeekday, { days: [6] }, false],
        ['Match service day: no days', serviceWeekday, { }, true],
        ['Match service day: multiple filter, all match (AND assumed for now)', serviceWeekday, { days: [0, 1, 2] }, true],
        ['Match service day: multiple filter, some match (AND assumed for now)', serviceWeekday, { days: [0, 6] }, false],
        ['Match dates: start date in range', serviceWeekday, { startDate: new Date(moment('2020-10-09').toString()) }, true],
        ['Match dates: start date in range, not a service day', serviceWeekday, { startDate: new Date(moment('2020-10-10').toString()) }, false],
        ['Match dates: start date not in range', serviceWeekday, { startDate: new Date(moment('2021-10-10').toString()) }, false],
        ['Match dates: start date and end date in range', serviceWeekday, { startDate: new Date(moment('2020-10-10').toString()), endDate: new Date(moment('2020-11-11').toString()) }, true],
        ['Match dates: start date and end date not in range', serviceWeekday, { startDate: new Date(moment('2021-10-10').toString()), endDate: new Date(moment('2021-11-11').toString()) }, false],
        ['Match dates with only except: date is except date', saturdayWithOnlyExcept, { startDate: new Date(moment('2023-06-10').toString()) }, false],
        ['Match dates with only except: date is only date', saturdayWithOnlyExcept, { startDate: new Date(moment('2023-06-25').toString()) }, true],
        ['Match dates with only except: date is in range and the right day', saturdayWithOnlyExcept, { startDate: new Date(moment('2023-06-17').toString()) }, true],
        ['Match dates with only except: date is in range but not the right day', saturdayWithOnlyExcept, { startDate: new Date(moment('2023-06-18').toString()) }, false],
        ['Match dates with only except: start date and end date in range, but not the only date', saturdayWithOnlyExcept, { startDate: new Date(moment('2023-06-17').toString()), endDate: new Date(moment('2023-06-23').toString()) }, true],
        ['Match dates and day: match', serviceWeekday, { days: [2, 3], startDate: new Date(moment('2020-10-10').toString()), endDate: new Date(moment('2020-11-11').toString()) }, true],
        ['Match dates and day: no match for days', serviceWeekday, { days: [6], startDate: new Date(moment('2020-10-10').toString()), endDate: new Date(moment('2020-11-11').toString()) }, false],
        ['Match dates and day: no match for dates', serviceWeekday, { days: [2, 3], startDate: new Date(moment('2021-10-10').toString()), endDate: new Date(moment('2021-11-11').toString()) }, false],
        ['Match name: complete match', serviceWeekday, { name: weekday }, true],
        ['Match name: string contains', serviceWeekday, { name: weekday.slice(3, 6) }, true],
        ['Match name: no match', serviceWeekday, { name: 'test' }, false],
        ['Match name: regex', serviceWeekday, { name: weekday.slice(3, 6) + '*' }, true],
        ['Match name: regex starts with, match', serviceWeekday, { name: '^' + weekday.slice(0, 3) }, true],
        ['Match name: regex complete word', serviceWeekday, { name: '^' + weekday + '$' }, true],
        ['Match name: regex complete word', serviceWeekday, { name: '^' + weekday.slice(0, 3) + '$' }, false],
        ['Match name: regex starts with, no match', serviceWeekday, { name: '^' + weekday.slice(3, 6) }, false],
        ['Match name: empty string', serviceWeekday, { name: '' }, true],
    ]).test('%s', (_title: string, service: Service, filter: { [key: string]: any}, expected: boolean) => {
        expect(ServiceUtils.serviceMatches(service, filter)).toEqual(expected);
    });

});
