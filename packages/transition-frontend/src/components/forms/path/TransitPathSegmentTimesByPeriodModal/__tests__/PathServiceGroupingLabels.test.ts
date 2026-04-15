/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type { ServiceGroup } from 'transition-common/lib/services/path/PathServiceGrouping';
import { assignCommonNamesForDuplicates } from '../PathServiceGroupingLabels';

const makeService = (id: string, name?: string) => ({
    get: (key: string) => {
        if (key === 'name') return name || id;
        return false;
    }
});

const makeServicesCollection = (services: Record<string, ReturnType<typeof makeService>>) => ({
    getById: (id: string) => services[id]
});

describe('assignCommonNamesForDuplicates', () => {
    test('assigns commonName only to duplicate-labelled groups', () => {
        const weekdayDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const groups: ServiceGroup[] = [
            { serviceIds: ['slow1', 'slow2'], activeDays: weekdayDays, averageTimesByPeriod: { AM: [100, 100] } },
            { serviceIds: ['fast1', 'fast2'], activeDays: weekdayDays, averageTimesByPeriod: { AM: [60, 60] } },
            { serviceIds: ['sat'], activeDays: ['saturday'], averageTimesByPeriod: { AM: [80, 80] } }
        ];

        const services = makeServicesCollection({
            slow1: makeService('slow1', '25S-H55S000S-82-S'),
            slow2: makeService('slow2', '25N-H55N000S-80-S'),
            fast1: makeService('fast1', '25S-H59S000S-81-S'),
            fast2: makeService('fast2', '25N-H59N000S-80-S'),
            sat: makeService('sat', 'Saturday service')
        });

        assignCommonNamesForDuplicates(groups, services);

        const weekdayGroups = groups.filter((g) => g.activeDays.length === 5);
        const saturdayGroup = groups.find((g) => g.activeDays.includes('saturday'));
        expect(weekdayGroups).toHaveLength(2);
        expect(weekdayGroups.every((g) => g.commonName !== undefined)).toBe(true);
        expect(weekdayGroups.map((g) => g.commonName).sort()).toEqual(['H55', 'H59']);
        // Saturday group has a unique base label, so no commonName is assigned
        expect(saturdayGroup?.commonName).toBeUndefined();
    });

    test('does not assign commonName when groups have unique day signatures', () => {
        const groups: ServiceGroup[] = [
            { serviceIds: ['s1'], activeDays: ['monday'], averageTimesByPeriod: {} },
            { serviceIds: ['s2'], activeDays: ['saturday'], averageTimesByPeriod: {} }
        ];

        const services = makeServicesCollection({
            s1: makeService('s1', 'Weekday service'),
            s2: makeService('s2', 'Weekend service')
        });

        assignCommonNamesForDuplicates(groups, services);

        expect(groups[0].commonName).toBeUndefined();
        expect(groups[1].commonName).toBeUndefined();
    });
});
