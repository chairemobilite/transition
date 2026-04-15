/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { findPeriodShortname, Period } from '../Period';

const periods: Period[] = [
    { shortname: 'am_peak', name: { en: 'AM Peak' }, startAtHour: 6, endAtHour: 9 },
    { shortname: 'midday', name: { en: 'Midday' }, startAtHour: 9, endAtHour: 15 },
    { shortname: 'pm_peak', name: { en: 'PM Peak' }, startAtHour: 15, endAtHour: 18 },
    { shortname: 'evening', name: { en: 'Evening' }, startAtHour: 18, endAtHour: 24 }
];

describe('findPeriodShortname', () => {
    test('returns correct period for time within a period', () => {
        expect(findPeriodShortname(periods, 7 * 3600)).toBe('am_peak'); // 7:00
        expect(findPeriodShortname(periods, 12 * 3600)).toBe('midday'); // 12:00
        expect(findPeriodShortname(periods, 16 * 3600)).toBe('pm_peak'); // 16:00
        expect(findPeriodShortname(periods, 20 * 3600)).toBe('evening'); // 20:00
    });

    test('returns correct period at exact boundary', () => {
        expect(findPeriodShortname(periods, 6 * 3600)).toBe('am_peak'); // start of first period
        expect(findPeriodShortname(periods, 9 * 3600)).toBe('midday'); // end of am_peak = start of midday
    });

    test('returns last period for post-last-period overflow within 6 hours', () => {
        expect(findPeriodShortname(periods, 25 * 3600)).toBe('evening'); // 1AM next day
        expect(findPeriodShortname(periods, 29 * 3600)).toBe('evening'); // 5AM next day (within 6h)
    });

    test('returns null for post-last-period beyond 6 hour overflow', () => {
        expect(findPeriodShortname(periods, 31 * 3600)).toBeNull(); // 7AM next day (> 6h)
    });

    test('returns first period for pre-first-period within 6 hour overflow', () => {
        expect(findPeriodShortname(periods, 3 * 3600)).toBe('am_peak'); // 3AM (3h before 6AM)
        expect(findPeriodShortname(periods, 1 * 3600)).toBe('am_peak'); // 1AM (5h before 6AM)
        expect(findPeriodShortname(periods, 0)).toBe('am_peak'); // midnight (6h before 6AM)
    });

    test('returns null for empty periods array', () => {
        expect(findPeriodShortname([], 0)).toBeNull();
        expect(findPeriodShortname([], 12 * 3600)).toBeNull(); // midday
    });

    test('returns null for pre-first-period beyond 6 hour overflow', () => {
        // With first period at 6AM, 6h overflow means anything >= 0 is covered.
        // Use periods starting later to test the null case.
        const latePeriodsArr: Period[] = [
            { shortname: 'late_am', name: { en: 'Late AM' }, startAtHour: 10, endAtHour: 14 }
        ];
        // 10AM - 6h = 4AM = 14400s. Time at 3AM = 10800s < 14400s → null
        expect(findPeriodShortname(latePeriodsArr, 3 * 3600)).toBeNull();
        // Time at 5AM = 18000s >= 14400s → late_am
        expect(findPeriodShortname(latePeriodsArr, 5 * 3600)).toBe('late_am');
    });
});
