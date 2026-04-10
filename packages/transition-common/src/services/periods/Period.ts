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

const MAX_OVERFLOW_SECONDS = 6 * 3600; // 6 hours

/**
 * Finds the period shortname for a given time in seconds since midnight.
 * Returns null if the time does not fall within any period.
 * If the time exceeds the last period's end by up to 6 hours, it is assigned
 * to the last period (covers late-night transit service). Beyond that, returns null.
 *
 * @param periods - Array of periods to search
 * @param timeSecondsSinceMidnight - Time in seconds since midnight
 * @returns The matching period's shortname, or null if no match
 */
export const findPeriodShortname = (periods: Period[], timeSecondsSinceMidnight: number): string | null => {
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
