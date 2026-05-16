/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** A named time-of-day period (e.g. AM peak, off-peak) defined by start/end hours. */
export type Period = {
    shortname: string;
    name: { [key: string]: string };
    startAtHour: number;
    endAtHour: number;
};

/** A named collection of time periods (e.g. "default" group with AM/PM/off-peak/evening/night). */
export type PeriodsGroup = {
    name: { [key: string]: string };
    periods: Period[];
};

// GTFS trips can have departure times beyond 24:00:00 (e.g. 25:30:00 for a 1:30 AM bus
// that is part of the previous day's evening service). Similarly, early-morning trips may
// depart before the first defined period. This overflow window assigns those trips to the
// nearest period instead of dropping them. 6 hours covers typical late-night/early-morning
// transit service without misassigning trips that clearly belong to a different day.
const MAX_OVERFLOW_SECONDS = 6 * 3600;

/**
 * Finds the period shortname for a given time in seconds since midnight.
 * Returns null if the time does not fall within any period.
 * Times up to 6 hours before the first period are assigned to the first period,
 * and times up to 6 hours after the last period are assigned to the last period
 * (covers early-morning and late-night transit service). Beyond that, returns null.
 *
 * @param periods - Array of periods to search
 * @param timeSecondsSinceMidnight - Time in seconds since midnight
 * @returns The matching period's shortname, or null if no match
 */
export const findPeriodShortname = (periods: Period[], timeSecondsSinceMidnight: number): string | null => {
    if (periods.length === 0) {
        return null;
    }
    for (let i = 0, count = periods.length; i < count; i++) {
        const period = periods[i];
        if (
            timeSecondsSinceMidnight >= period.startAtHour * 3600 &&
            timeSecondsSinceMidnight < period.endAtHour * 3600
        ) {
            return period.shortname;
        }
    }
    // Assign pre-first-period trips (within overflow window) to the first period
    const firstPeriod = periods[0];
    const firstStartSeconds = firstPeriod.startAtHour * 3600;
    if (
        timeSecondsSinceMidnight < firstStartSeconds &&
        timeSecondsSinceMidnight >= firstStartSeconds - MAX_OVERFLOW_SECONDS
    ) {
        return firstPeriod.shortname;
    }

    // Assign post-last-period trips (within overflow window) to the last period
    const lastPeriod = periods[periods.length - 1];
    const lastEndSeconds = lastPeriod.endAtHour * 3600;
    if (
        timeSecondsSinceMidnight >= lastEndSeconds &&
        timeSecondsSinceMidnight < lastEndSeconds + MAX_OVERFLOW_SECONDS
    ) {
        return lastPeriod.shortname;
    }
    return null;
};
