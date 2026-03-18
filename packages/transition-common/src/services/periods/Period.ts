/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

export type Period = {
    shortname: string;
    name: { [key: string]: string };
    startAtHour: number;
    endAtHour: number;
};

export type PeriodsGroup = {
    name: { [key: string]: string };
    periods: Period[];
};

/**
 * Finds the period shortname for a given time in seconds since midnight.
 * Returns null if the time does not fall within any period.
 * If the time exceeds the last period's end, it is assigned to the last period.
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
    if (timeSecondsSinceMidnight >= periods[periods.length - 1].endAtHour * 3600) {
        // assign to last period if outside range
        return periods[periods.length - 1].shortname;
    }
    return null;
};
