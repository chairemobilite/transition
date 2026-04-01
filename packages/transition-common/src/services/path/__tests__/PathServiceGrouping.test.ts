/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Path from '../Path';
import { groupServicesByTravelTimes, buildGroupLabel, expandGroupedDataToServices } from '../PathServiceGrouping';
import { TimeAndDistance } from '../PathTypes';

const makeService = (
    id: string,
    days: Record<string, boolean>,
    startDate = '2026-01-01',
    endDate = '2026-12-31',
    name?: string
) => ({
    get: (key: string) => {
        if (key === 'name') return name || id;
        if (key === 'start_date') return startDate;
        if (key === 'end_date') return endDate;
        return days[key] ?? false;
    }
});

const makeSchedule = (
    periods: { shortname: string; trips: { pathId: string; arrivals: number[]; departures: number[] }[] }[]
) => ({
    attributes: {
        periods: periods.map((p) => ({
            period_shortname: p.shortname,
            trips: p.trips.map((t) => ({
                path_id: t.pathId,
                node_arrival_times_seconds: t.arrivals,
                node_departure_times_seconds: t.departures
            }))
        }))
    }
});

const makeLine = (schedulesByServiceId: Record<string, ReturnType<typeof makeSchedule>>) => ({
    getSchedule: (serviceId: string) => schedulesByServiceId[serviceId]
});

const makePath = (
    periods: {
        periodShortname: string;
        services: { id: string; travelTimeSeconds?: TimeAndDistance['travelTimeSeconds'][] }[];
    }[]
) => {
    const segmentsByServiceAndPeriod: Record<string, Record<string, { segments: { travelTimeSeconds: number }[] }>> =
        {};
    for (const p of periods) {
        for (const s of p.services) {
            if (!segmentsByServiceAndPeriod[s.id]) segmentsByServiceAndPeriod[s.id] = {};
            segmentsByServiceAndPeriod[s.id][p.periodShortname] = {
                segments: s.travelTimeSeconds?.map((t) => ({ travelTimeSeconds: t })) ?? []
            };
        }
    }
    return {
        attributes: {
            data: { segmentsByServiceAndPeriod }
        }
    } as Path;
};

const makeServicesCollection = (services: Record<string, ReturnType<typeof makeService>>) => ({
    getById: (id: string) => services[id]
});

const getLabel = (group: { activeDays: string[]; hasHolidayService: boolean }, language = 'en') =>
    buildGroupLabel(group.activeDays, group.hasHolidayService, language);

const getLabelWithCommonName = (
    group: { activeDays: string[]; hasHolidayService: boolean; commonName?: string },
    language = 'en'
) => buildGroupLabel(group.activeDays, group.hasHolidayService, language, group.commonName);

const PATH_ID = 'path1';
const SEGMENT_COUNT = 2;

describe('groupServicesByTravelTimes', () => {
    test('groups weekday and weekend services with same travel times', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'weekend', travelTimeSeconds: [100, 100] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            weekday: makeService(
                'weekday',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            weekend: makeService('weekend', { saturday: true, sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['weekday', 'weekend'], 200, services);

        expect(groups.length).toEqual(1);
        expect(groups[0].serviceIds).toContain('weekday');
        expect(groups[0].serviceIds).toContain('weekend');
        expect(getLabel(groups[0])).toBe('Every day');
    });

    test('separates weekday and weekend services with different travel times', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'weekend', travelTimeSeconds: [150, 150] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            weekday: makeService(
                'weekday',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            weekend: makeService('weekend', { saturday: true, sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['weekday', 'weekend'], 200, services);

        expect(groups.length).toEqual(2);
        const weekdayGroup = groups.find((g) => g.serviceIds.includes('weekday'));
        const weekendGroup = groups.find((g) => g.serviceIds.includes('weekend'));
        expect(weekdayGroup).toBeDefined();
        expect(weekendGroup).toBeDefined();
        expect(getLabel(weekdayGroup!)).toContain('Weekday');
        expect(getLabel(weekendGroup!)).toContain('Weekend');
    });

    test('holiday services are grouped separately when unmatched', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'regular', travelTimeSeconds: [100, 100] },
                    { id: 'holiday', travelTimeSeconds: [150, 150] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            regular: makeService(
                'regular',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            holiday: makeService('holiday', { monday: true }, '2026-12-25', '2026-12-25')
        });

        const groups = groupServicesByTravelTimes(path, ['regular', 'holiday'], 200, services);

        expect(groups.length).toEqual(2);
        const regularGroup = groups.find((g) => g.serviceIds.includes('regular'));
        const holidayGroup = groups.find((g) => g.serviceIds.includes('holiday'));
        expect(regularGroup).toBeDefined();
        expect(getLabel(regularGroup!)).toContain('Weekday');
        expect(holidayGroup).toBeDefined();
        expect(holidayGroup!.hasHolidayService).toBe(true);
    });

    test('separates weekday, saturday, sunday and holiday services with different travel times', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'saturday', travelTimeSeconds: [120, 120] },
                    { id: 'sunday', travelTimeSeconds: [140, 140] },
                    { id: 'holiday', travelTimeSeconds: [160, 160] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            holiday: makeService('holiday', { monday: true }, '2026-12-25', '2026-12-25'),
            weekday: makeService(
                'weekday',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            saturday: makeService('saturday', { saturday: true }, '2026-01-01', '2026-12-31'),
            sunday: makeService('sunday', { sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['holiday', 'weekday', 'saturday', 'sunday'], 200, services);

        expect(groups.length).toEqual(4);
        const weekdayGroup = groups.find((g) => g.serviceIds.includes('weekday'));
        const saturdayGroup = groups.find((g) => g.serviceIds.includes('saturday'));
        const sundayGroup = groups.find((g) => g.serviceIds.includes('sunday'));
        const holidayGroup = groups.find((g) => g.serviceIds.includes('holiday'));
        expect(getLabel(weekdayGroup!)).toBe('Weekday');
        expect(getLabel(saturdayGroup!)).toBe('Sat');
        expect(getLabel(sundayGroup!)).toBe('Sun');
        expect(holidayGroup!.hasHolidayService).toBe(true);
    });

    test('holiday services merge into matching group when travel times match', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'regular', travelTimeSeconds: [100, 100] },
                    { id: 'holiday', travelTimeSeconds: [100, 100] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            regular: makeService(
                'regular',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            holiday: makeService('holiday', { monday: true }, '2026-12-25', '2026-12-25')
        });

        const groups = groupServicesByTravelTimes(path, ['regular', 'holiday'], 200, services);

        expect(groups.length).toEqual(1);
        expect(groups[0].serviceIds).toContain('regular');
        expect(groups[0].serviceIds).toContain('holiday');
    });

    test('service with subset of periods merges into group with more periods', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'fullService', travelTimeSeconds: [100, 100] },
                    { id: 'amOnly', travelTimeSeconds: [100, 100] }
                ]
            },
            { periodShortname: 'PM', services: [{ id: 'fullService', travelTimeSeconds: [110, 110] }] }
        ]);

        const services = makeServicesCollection({
            fullService: makeService(
                'fullService',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            amOnly: makeService('amOnly', { saturday: true, sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['fullService', 'amOnly'], 200, services);

        expect(groups.length).toEqual(1);
        expect(groups[0].serviceIds).toContain('fullService');
        expect(groups[0].serviceIds).toContain('amOnly');
        expect(getLabel(groups[0])).toBe('Every day');
    });

    test('service with no trips for the path produces empty fingerprint', () => {
        // TODO: Check if we keep this test
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'withTrips', travelTimeSeconds: [100, 100] },
                    { id: 'noTrips', travelTimeSeconds: undefined }
                ]
            }
        ]);

        const services = makeServicesCollection({
            withTrips: makeService(
                'withTrips',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            noTrips: makeService('noTrips', { saturday: true, sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['withTrips', 'noTrips'], 200, services);

        expect(groups.length).toEqual(2);
    });

    test('labels in French', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'weekend', travelTimeSeconds: [100, 100] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            weekday: makeService(
                'weekday',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            weekend: makeService('weekend', { saturday: true, sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['weekday', 'weekend'], 200, services);

        expect(getLabel(groups[0], 'fr')).toBe('Tous les jours');
    });

    test('service covering all 7 days gets every day label', () => {
        const path = makePath([
            { periodShortname: 'AM', services: [{ id: 'allDays', travelTimeSeconds: [100, 100] }] }
        ]);

        const services = makeServicesCollection({
            allDays: makeService(
                'allDays',
                {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: true,
                    sunday: true
                },
                '2026-01-01',
                '2026-12-31'
            )
        });

        const groups = groupServicesByTravelTimes(path, ['allDays'], 200, services);

        expect(groups.length).toEqual(1);
        expect(getLabel(groups[0])).toBe('Every day');
    });

    test('saturday-only service gets individual day label', () => {
        const path = makePath([
            { periodShortname: 'AM', services: [{ id: 'satOnly', travelTimeSeconds: [100, 100] }] }
        ]);

        const services = makeServicesCollection({
            satOnly: makeService('satOnly', { saturday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['satOnly'], 200, services);

        expect(groups.length).toEqual(1);
        expect(getLabel(groups[0])).toBe('Sat');
    });

    test('only holiday services stay separate', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'christmas', travelTimeSeconds: [100, 100] },
                    { id: 'newYear', travelTimeSeconds: [150, 150] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            christmas: makeService('christmas', { wednesday: true }, '2026-12-25', '2026-12-25', 'Christmas'),
            newYear: makeService('newYear', { thursday: true }, '2027-01-01', '2027-01-01', 'New Year')
        });

        const groups = groupServicesByTravelTimes(path, ['christmas', 'newYear'], 200, services);

        expect(groups.length).toEqual(2);
        expect(groups.every((g) => g.hasHolidayService)).toBe(true);
    });

    test('assigns commonName only to duplicate-labelled groups', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'slow1', travelTimeSeconds: [100, 100] },
                    { id: 'slow2', travelTimeSeconds: [100, 100] },
                    { id: 'fast1', travelTimeSeconds: [60, 60] },
                    { id: 'fast2', travelTimeSeconds: [60, 60] },
                    { id: 'sat', travelTimeSeconds: [80, 80] }
                ]
            }
        ]);

        const weekdayDays = {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true
        };
        const services = makeServicesCollection({
            slow1: makeService('slow1', weekdayDays, '2026-01-01', '2026-06-30', '25S-H55S000S-82-S'),
            slow2: makeService('slow2', weekdayDays, '2026-07-01', '2026-12-31', '25N-H55N000S-80-S'),
            fast1: makeService('fast1', weekdayDays, '2026-01-01', '2026-06-30', '25S-H59S000S-81-S'),
            fast2: makeService('fast2', weekdayDays, '2026-07-01', '2026-12-31', '25N-H59N000S-80-S'),
            sat: makeService('sat', { saturday: true }, '2026-01-01', '2026-12-31', 'Saturday service')
        });

        const groups = groupServicesByTravelTimes(
            path,
            ['slow1', 'slow2', 'fast1', 'fast2', 'sat'],
            200,
            services
        );

        const weekdayGroups = groups.filter((g) => g.activeDays.length === 5);
        const saturdayGroup = groups.find((g) => g.activeDays.includes('saturday'));
        expect(weekdayGroups).toHaveLength(2);
        expect(weekdayGroups.every((g) => g.commonName !== undefined)).toBe(true);
        expect(weekdayGroups.map((g) => g.commonName).sort()).toEqual(['H55', 'H59']);
        // Saturday group has a unique base label, so no commonName is assigned
        expect(saturdayGroup?.commonName).toBeUndefined();
    });
});

describe('buildGroupLabel with commonName', () => {
    test('appends commonName when provided', () => {
        const label = getLabelWithCommonName({
            activeDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            hasHolidayService: false,
            commonName: 'H55'
        });
        expect(label).toBe('Weekday H55');
    });

    test('omits commonName when not provided', () => {
        const label = getLabelWithCommonName({
            activeDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            hasHolidayService: false
        });
        expect(label).toBe('Weekday');
    });

    test('works with holiday label in French', () => {
        const label = getLabelWithCommonName(
            {
                activeDays: [],
                hasHolidayService: true,
                commonName: 'H60'
            },
            'fr'
        );
        expect(label).toBe('Jour férié H60');
    });
});

describe('expandGroupedDataToServices', () => {
    test('copies edits from edited service to all services in the group', () => {
        const groups = [
            {
                serviceIds: ['s1', 's2', 's3'],
                activeDays: ['monday'],
                hasHolidayService: false,
                averageTimesByPeriod: {}
            }
        ];
        const localData = {
            s1: { AM: [100, 200] }
        };

        const expanded = expandGroupedDataToServices(localData, groups);

        expect(expanded.s1).toEqual({ AM: [100, 200] });
        expect(expanded.s2).toEqual({ AM: [100, 200] });
        expect(expanded.s3).toEqual({ AM: [100, 200] });
    });

    test('does not copy when no service in group has edits', () => {
        const groups = [
            { serviceIds: ['s1', 's2'], activeDays: ['monday'], hasHolidayService: false, averageTimesByPeriod: {} }
        ];
        const localData = {};

        const expanded = expandGroupedDataToServices(localData, groups);

        expect(expanded.s1).toBeUndefined();
        expect(expanded.s2).toBeUndefined();
    });
});
