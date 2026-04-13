/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Path from '../Path';
import { groupServicesByTravelTimes, expandGroupedDataToServices } from '../PathServiceGrouping';
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
        expect(groups[0].activeDays.sort()).toEqual(['friday', 'monday', 'saturday', 'sunday', 'thursday', 'tuesday', 'wednesday']);
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
        expect(weekdayGroup!.activeDays.sort()).toEqual(['friday', 'monday', 'thursday', 'tuesday', 'wednesday']);
        expect(weekendGroup!.activeDays.sort()).toEqual(['saturday', 'sunday']);
    });

    test('services with different day patterns and travel times stay in separate groups', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'mondayOnly', travelTimeSeconds: [150, 150] }
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
            mondayOnly: makeService('mondayOnly', { monday: true }, '2026-12-25', '2026-12-25')
        });

        const groups = groupServicesByTravelTimes(path, ['weekday', 'mondayOnly'], 200, services);

        expect(groups.length).toEqual(2);
        const weekdayGroup = groups.find((g) => g.serviceIds.includes('weekday'));
        const mondayGroup = groups.find((g) => g.serviceIds.includes('mondayOnly'));
        expect(weekdayGroup).toBeDefined();
        expect(weekdayGroup!.activeDays.sort()).toEqual(['friday', 'monday', 'thursday', 'tuesday', 'wednesday']);
        expect(mondayGroup).toBeDefined();
        expect(mondayGroup!.activeDays).toEqual(['monday']);
    });

    test('separates weekday, saturday, sunday and monday-only services with different travel times', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'saturday', travelTimeSeconds: [120, 120] },
                    { id: 'sunday', travelTimeSeconds: [140, 140] },
                    { id: 'mondayOnly', travelTimeSeconds: [160, 160] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            mondayOnly: makeService('mondayOnly', { monday: true }, '2026-12-25', '2026-12-25'),
            weekday: makeService(
                'weekday',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            saturday: makeService('saturday', { saturday: true }, '2026-01-01', '2026-12-31'),
            sunday: makeService('sunday', { sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(
            path,
            ['mondayOnly', 'weekday', 'saturday', 'sunday'],
            200,
            services
        );

        expect(groups.length).toEqual(4);
        const weekdayGroup = groups.find((g) => g.serviceIds.includes('weekday'));
        const saturdayGroup = groups.find((g) => g.serviceIds.includes('saturday'));
        const sundayGroup = groups.find((g) => g.serviceIds.includes('sunday'));
        const mondayGroup = groups.find((g) => g.serviceIds.includes('mondayOnly'));
        expect(weekdayGroup!.activeDays.sort()).toEqual(['friday', 'monday', 'thursday', 'tuesday', 'wednesday']);
        expect(saturdayGroup!.activeDays).toEqual(['saturday']);
        expect(sundayGroup!.activeDays).toEqual(['sunday']);
        expect(mondayGroup!.activeDays).toEqual(['monday']);
    });

    test('services with overlapping day patterns and matching travel times merge into one group', () => {
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'mondayOnly', travelTimeSeconds: [100, 100] }
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
            mondayOnly: makeService('mondayOnly', { monday: true }, '2026-12-25', '2026-12-25')
        });

        const groups = groupServicesByTravelTimes(path, ['weekday', 'mondayOnly'], 200, services);

        expect(groups.length).toEqual(1);
        expect(groups[0].serviceIds).toContain('weekday');
        expect(groups[0].serviceIds).toContain('mondayOnly');
        expect(groups[0].activeDays.sort()).toEqual(['friday', 'monday', 'thursday', 'tuesday', 'wednesday']);
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
        expect(groups[0].activeDays.sort()).toEqual(['friday', 'monday', 'saturday', 'sunday', 'thursday', 'tuesday', 'wednesday']);
    });

    test('representative (serviceIds[0]) is the service with the most periods even when passed last', () => {
        // subsetService has 3 periods, fullService has 4. They share the same times for
        // the 3 common periods, so subsetService is merged into fullService's bucket.
        // Passing subsetService first in serviceIds must not make it the representative.
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'subsetService', travelTimeSeconds: [100, 100] },
                    { id: 'fullService', travelTimeSeconds: [100, 100] }
                ]
            },
            {
                periodShortname: 'MD',
                services: [
                    { id: 'subsetService', travelTimeSeconds: [90, 90] },
                    { id: 'fullService', travelTimeSeconds: [90, 90] }
                ]
            },
            {
                periodShortname: 'PM',
                services: [
                    { id: 'subsetService', travelTimeSeconds: [110, 110] },
                    { id: 'fullService', travelTimeSeconds: [110, 110] }
                ]
            },
            // Only fullService has an EV period — this is what makes its key a superset.
            { periodShortname: 'EV', services: [{ id: 'fullService', travelTimeSeconds: [80, 80] }] }
        ]);

        const services = makeServicesCollection({
            subsetService: makeService(
                'subsetService',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            fullService: makeService('fullService', { saturday: true, sunday: true }, '2026-01-01', '2026-12-31')
        });

        const groups = groupServicesByTravelTimes(path, ['subsetService', 'fullService'], 800, services);

        expect(groups.length).toEqual(1);
        expect(groups[0].serviceIds).toHaveLength(2);
        expect(groups[0].serviceIds[0]).toEqual('fullService');
        expect(Object.keys(groups[0].averageTimesByPeriod).sort()).toEqual(['AM', 'EV', 'MD', 'PM']);
    });

    test('service with no trips for the path produces empty fingerprint', () => {
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
        expect(groups[0].activeDays.sort()).toEqual(['friday', 'monday', 'saturday', 'sunday', 'thursday', 'tuesday', 'wednesday']);
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
        expect(groups[0].activeDays).toEqual(['saturday']);
    });

    test('services with no segment data are not grouped together by empty fingerprint', () => {
        // Brand-new line: no GTFS import, no segmentsByServiceAndPeriod on the path.
        // Two services with no segment data must not be falsely merged into a single
        // group just because their fingerprints are both empty strings.
        const path = { attributes: { data: {} } } as Path;

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
        expect(weekdayGroup!.serviceIds).toEqual(['weekday']);
        expect(weekendGroup!.serviceIds).toEqual(['weekend']);
    });

    test('services on different periods groups are never merged even when travel time keys overlap', () => {
        // Both services share the same shortname "morning" for MD and PM travel times,
        // but they belong to different periods groups. Without the periods-group check,
        // service A's fingerprint would be a subset of B's and subset-merge would
        // collapse them into one group. The periods-group partitioning must prevent that.
        const path = makePath([
            {
                periodShortname: 'morning',
                services: [
                    { id: 'serviceOnDefault', travelTimeSeconds: [100, 100] },
                    { id: 'serviceOnExtended', travelTimeSeconds: [100, 100] }
                ]
            }
        ]);

        const services = makeServicesCollection({
            serviceOnDefault: makeService(
                'serviceOnDefault',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            ),
            serviceOnExtended: makeService(
                'serviceOnExtended',
                { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true },
                '2026-01-01',
                '2026-12-31'
            )
        });

        const periodsGroupByServiceId = {
            serviceOnDefault: 'default',
            serviceOnExtended: 'extended_morning_peak'
        };

        const groups = groupServicesByTravelTimes(
            path,
            ['serviceOnDefault', 'serviceOnExtended'],
            200,
            services,
            false,
            periodsGroupByServiceId
        );

        expect(groups.length).toEqual(2);
        const defaultGroup = groups.find((g) => g.serviceIds.includes('serviceOnDefault'));
        const extendedGroup = groups.find((g) => g.serviceIds.includes('serviceOnExtended'));
        expect(defaultGroup!.serviceIds).toEqual(['serviceOnDefault']);
        expect(extendedGroup!.serviceIds).toEqual(['serviceOnExtended']);
    });

    test('services with no day-of-week flags are not grouped and each stay as a singleton', () => {
        // calendar_dates-only services (no day-of-week flags set) must not be grouped with
        // anything, even if their travel times match other services or each other.
        const path = makePath([
            {
                periodShortname: 'AM',
                services: [
                    { id: 'weekday', travelTimeSeconds: [100, 100] },
                    { id: 'exception1', travelTimeSeconds: [100, 100] },
                    { id: 'exception2', travelTimeSeconds: [100, 100] }
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
            exception1: makeService('exception1', {}, '2026-12-25', '2026-12-25', 'Exception 1'),
            exception2: makeService('exception2', {}, '2027-01-01', '2027-01-01', 'Exception 2')
        });

        const groups = groupServicesByTravelTimes(path, ['weekday', 'exception1', 'exception2'], 200, services);

        expect(groups.length).toEqual(3);
        const weekdayGroup = groups.find((g) => g.serviceIds.includes('weekday'));
        const exception1Group = groups.find((g) => g.serviceIds.includes('exception1'));
        const exception2Group = groups.find((g) => g.serviceIds.includes('exception2'));
        expect(weekdayGroup!.activeDays.length).toBe(5);
        expect(exception1Group!.activeDays).toEqual([]);
        expect(exception1Group!.serviceIds).toEqual(['exception1']);
        expect(exception2Group!.activeDays).toEqual([]);
        expect(exception2Group!.serviceIds).toEqual(['exception2']);
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

describe('expandGroupedDataToServices', () => {
    test('copies edits from edited service to all services in the group', () => {
        const groups = [
            {
                serviceIds: ['s1', 's2', 's3'],
                activeDays: ['monday'],
                averageTimesByPeriod: {}
            }
        ];
        const localData = {
            s1: { AM: [100, 200] },
            s2: { AM: [50, 60] },
            s3: { AM: [70, 80] }
        };

        const expanded = expandGroupedDataToServices(localData, groups);

        expect(expanded.s1).toEqual({ AM: [100, 200] });
        expect(expanded.s2).toEqual({ AM: [100, 200] });
        expect(expanded.s3).toEqual({ AM: [100, 200] });
    });

    test('does not copy when no service in group has edits', () => {
        const groups = [
            { serviceIds: ['s1', 's2'], activeDays: ['monday'], averageTimesByPeriod: {} }
        ];
        const localData = {};

        const expanded = expandGroupedDataToServices(localData, groups);

        expect(expanded.s1).toBeUndefined();
        expect(expanded.s2).toBeUndefined();
    });

    test('expanded services have independent array copies (no shared references)', () => {
        const groups = [
            {
                serviceIds: ['s1', 's2', 's3'],
                activeDays: ['monday'],
                averageTimesByPeriod: {}
            }
        ];
        const localData = {
            s1: { AM: [100, 200], PM: [300, 400] },
            s2: { AM: [10, 20], PM: [30, 40] },
            s3: { AM: [50, 60], PM: [70, 80] }
        };

        const expanded = expandGroupedDataToServices(localData, groups);

        // Mutate s2's array
        expanded.s2.AM[0] = 999;

        // s1 and s3 should not be affected
        expect(expanded.s1.AM[0]).toBe(100);
        expect(expanded.s3.AM[0]).toBe(100);

        // s2's PM should also be independent
        expanded.s2.PM[1] = 888;
        expect(expanded.s1.PM[1]).toBe(400);
        expect(expanded.s3.PM[1]).toBe(400);
    });

    test('does not propagate periods to services that did not originally have them', () => {
        // fullService is the representative (4 periods), subsetService was merged in
        // via mergeServicesWithSubsetPeriods and only has 3 periods. Editing EV on the
        // representative must not create an EV entry on subsetService.
        const groups = [
            {
                serviceIds: ['fullService', 'subsetService'],
                activeDays: ['monday'],
                averageTimesByPeriod: {}
            }
        ];
        const localData = {
            fullService: {
                AM: [100, 200],
                MD: [90, 180],
                PM: [110, 220],
                EV: [80, 160]
            },
            subsetService: {
                AM: [100, 200],
                MD: [90, 180],
                PM: [110, 220]
            }
        };

        const expanded = expandGroupedDataToServices(localData, groups);

        expect(Object.keys(expanded.subsetService).sort()).toEqual(['AM', 'MD', 'PM']);
        expect(expanded.subsetService.EV).toBeUndefined();
        expect(expanded.fullService.EV).toEqual([80, 160]);
    });

    test('propagates edited shared periods to the subset service without adding new ones', () => {
        // User edits AM and EV on the representative. AM is shared, EV is representative-only.
        // subsetService should receive the AM edits but nothing for EV.
        const groups = [
            {
                serviceIds: ['fullService', 'subsetService'],
                activeDays: ['monday'],
                averageTimesByPeriod: {}
            }
        ];
        const localData = {
            fullService: {
                AM: [111, 222],
                PM: [110, 220],
                EV: [77, 155]
            },
            subsetService: {
                AM: [100, 200],
                PM: [110, 220]
            }
        };

        const expanded = expandGroupedDataToServices(localData, groups);

        expect(expanded.subsetService.AM).toEqual([111, 222]);
        expect(expanded.subsetService.PM).toEqual([110, 220]);
        expect(expanded.subsetService.EV).toBeUndefined();
    });
});
