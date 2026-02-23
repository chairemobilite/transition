/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _isFinite from 'lodash/isFinite';
import _isString from 'lodash/isString';
import _padStart from 'lodash/padStart';
import { _isBlank } from './LodashExtensions';
import type { TFunction } from 'i18next';

/**
 * Formats the number of seconds since midnight to a time string (HH:MM[:ss]).
 * If seconds is larger than a 24 hour day perior, the timed string will be >
 * 24:00. This may happen for example for schedules for a day that end after
 * midnight.
 * @param secondsSinceMidnight Number of seconds since midnight
 * @param has24hours Whether the time should be formatted in 24hours format
 * (default true)
 * @param withSeconds Whether the time should include the number of seconds
 * (default false)
 * @returns A string formatted as (HH:MM[:ss]), or empty if seconds are invalid
 */
const secondsSinceMidnightToTimeStr = function (
    secondsSinceMidnight: number,
    has24hours = true,
    withSeconds = false
): string {
    if (!_isFinite(secondsSinceMidnight)) {
        return '';
    }
    const secondsSinceMidnightAbs =
        secondsSinceMidnight >= 0 ? secondsSinceMidnight : 24 * 3600 - Math.abs(secondsSinceMidnight % (24 * 3600));
    let hour = Math.floor(secondsSinceMidnightAbs / 3600);
    const minute = Math.floor(secondsSinceMidnightAbs / 60 - hour * 60);

    if (!has24hours && hour > 12) {
        hour = hour - 12;
    } else if (!has24hours && hour === 0) {
        hour = 12;
    }

    if (withSeconds) {
        const second = secondsSinceMidnightAbs - hour * 3600 - minute * 60;
        return `${hour}:${_padStart(String(minute), 2, '0')}:${_padStart(String(second), 2, '0')}`;
    } else {
        return `${hour}:${_padStart(String(minute), 2, '0')}`;
    }
};

const decimalHourToTimeStr = function (decimalHour, has24hours = true, withSeconds = false) {
    decimalHour = parseFloat(decimalHour);
    if (_isFinite(decimalHour) && decimalHour >= 0) {
        const seconds = Math.round(decimalHour * 3600);
        return secondsSinceMidnightToTimeStr(seconds, has24hours, withSeconds);
    }
    return null;
};

const timeStrToDecimalHour = function (timeStr) {
    if (_isString(timeStr)) {
        const splittedTime = timeStr.split(':');
        if (splittedTime.length === 2) {
            const hour = parseInt(splittedTime[0]);
            const minute = parseInt(splittedTime[1]);
            if (_isFinite(hour) && _isFinite(minute) && hour >= 0 && minute >= 0 && minute < 60) {
                return hour + minute / 60;
            }
        }
    }
    return null;
};

const secondsToMinutes = function (seconds, rounding = Math.ceil) {
    seconds = parseInt(seconds);
    return _isFinite(seconds) ? rounding(seconds / 60) : null;
};

const secondsToMinutesDecimal = function (seconds) {
    seconds = parseInt(seconds);
    return _isFinite(seconds) ? seconds / 60 : null;
};

const secondsToHours = function (seconds, rounding = Math.ceil) {
    seconds = parseInt(seconds);
    return _isFinite(seconds) ? rounding(seconds / 3600) : null;
};

const secondsToHoursDecimal = function (seconds) {
    seconds = parseInt(seconds);
    return _isFinite(seconds) ? seconds / 3600 : null;
};

const minutesToHours = function (minutes: string | number, rounding = Math.ceil) {
    minutes = typeof minutes === 'string' ? parseInt(minutes) : minutes;
    return _isFinite(minutes) ? rounding(minutes / 60) : null;
};

const minutesToHoursDecimal = function (minutes: string | number) {
    minutes = typeof minutes === 'string' ? parseInt(minutes) : minutes;
    return _isFinite(minutes) ? minutes / 60 : null;
};

const minutesToSeconds = function (minutes: string | number) {
    minutes = typeof minutes === 'string' ? parseInt(minutes) : minutes;
    return _isFinite(minutes) ? minutes * 60 : null;
};

const hoursToSeconds = function (hours) {
    hours = parseInt(hours);
    return _isFinite(hours) ? hours * 3600 : null;
};

/**
 * Convert a duration in seconds to a formatted time string.
 * The function takes a duration in seconds and returns a string
 * in the format "XX hr YY min ZZ sec", where each non-zero
 * component is included with its corresponding unit.
 *
 * @param {number} seconds - The duration in seconds to be converted.
 * @param {TFunction} t - The translation function to localize unit strings.
 * @param {Object} options - Formatting options.
 * @param {string} options.hourUnit - The unit for hours, in a localizable form. The value of the hour will be added as the 'count' option for translation.
 * @param {string} options.minuteUnit - The unit for minutes, in a localizable form. The value of the minute will be added as the 'count' option for translation.
 * @param {string} options.secondsUnit - The unit for seconds, in a localizable form. The value of the second will be added as the 'count' option for translation.
 * @param {boolean} [options.withSeconds=true] - Whether to include seconds in the output.
 * @param {string} [options.zeroText] - Text to return when the returned output would be zero.
 * @returns {string} - The formatted time string or empty string if the input is invalid.
 */
const toXXhrYYminZZsec = (
    seconds: number,
    t: TFunction,
    {
        hourUnit,
        minuteUnit,
        secondsUnit,
        withSeconds = true,
        zeroText
    }: { hourUnit: string; minuteUnit: string; secondsUnit: string; withSeconds?: boolean; zeroText?: string }
): string => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        return '';
    }
    const getZeroTextValue = () =>
        zeroText ? t(zeroText) : `0 ${withSeconds ? t(secondsUnit, { count: 0 }) : t(minuteUnit, { count: 0 })}`;
    if (seconds === 0) {
        return getZeroTextValue();
    }
    const negative = seconds < 0;
    const hours = Math.floor(Math.abs(seconds / 3600));
    const minutes = Math.floor(Math.abs((seconds % 3600) / 60));
    const secs = Math.floor(Math.abs(seconds % 60));

    // Add time components to the array, then remove leading and trailing zero components (ex: 0 hr, 0 min) before formatting the string.
    const timeComponents = [
        { value: hours, unit: hourUnit },
        { value: minutes, unit: minuteUnit }
    ];
    if (withSeconds) {
        timeComponents.push({ value: secs, unit: secondsUnit });
    }

    // Remove leading zero components, but only if they are not the only component
    const firstComponentIndex = timeComponents.findIndex((component) => component.value > 0);
    if (firstComponentIndex > 0) {
        timeComponents.splice(0, firstComponentIndex);
    } else if (firstComponentIndex === -1) {
        // all components are zero, return the zero text
        return getZeroTextValue();
    }

    // Remove trailing zero components, but only if they are not the only component (ex: 0 hr 0 min 3 s should not be reduced to 3 s).
    const lastComponentIndex = timeComponents.findLastIndex((component) => component.value > 0);
    if (lastComponentIndex !== -1 && lastComponentIndex < timeComponents.length - 1) {
        timeComponents.splice(lastComponentIndex + 1);
    }

    return `${negative ? '-' : ''}${timeComponents
        .map((component) => component.value + ' ' + t(component.unit, { count: component.value }))
        .join(' ')}`;
};

/**
 * Convert a time string (HH:MM[:ss]) to the number of seconds since midnight.
 * Time strings can be > 24:00, for example for schedules for a day that end
 * after midnight. The number since midnight will thus be greater than the
 * number of seconds in a day.
 * @param timeStr Number of seconds since midnight (HH:MM[:ss])
 * @returns The number of seconds since midnight, or null if invalid
 */
const timeStrToSecondsSinceMidnight = function (timeStr: string) {
    if (_isBlank(timeStr)) {
        return null;
    }
    const splittedTime = timeStr.split(':');
    if (splittedTime.length < 2 || splittedTime.length > 3) {
        return null;
    }

    const minuteStr = splittedTime[1].length < 2 ? '0' + splittedTime[1] : splittedTime[1];
    const secondStr = splittedTime[2] ? (splittedTime[2].length < 2 ? '0' + splittedTime[2] : splittedTime[2]) : '00'; // optional seconds
    const result = Number(splittedTime[0]) * 3600 + Number(minuteStr) * 60 + Number(secondStr);
    return !Number.isNaN(result) ? result : null;
};

const intTimeToSecondsSinceMidnight = function (intTime) {
    // 0 = midnight, 100 = 1:00 (AM), 2358 = 23:58, 2743 = 27:43
    if (_isBlank(intTime)) {
        return null;
    }
    intTime = parseInt(intTime);
    if (_isFinite(intTime)) {
        const paddedStrTime = _padStart(intTime.toString(), 4, '0');
        const hour = parseInt(paddedStrTime.slice(0, 2));
        const minute = parseInt(paddedStrTime.slice(2, 4));
        if (_isFinite(hour) && _isFinite(minute)) {
            return hour * 3600 + minute * 60;
        }
    }
    return null;
};

// returns value as seconds, rounded, ceiled or floored to the nearest 60 seconds:
const roundSecondsToNearestMinute = function (seconds: number, rounding = Math.ceil): number {
    return rounding(seconds / 60) * 60;
};

// returns value as seconds, rounded, ceiled or floored to the nearest N seconds:
const roundSecondsToNearestQuarter = function (seconds: number, interval: number, rounding = Math.ceil): number {
    return rounding(seconds / interval) * interval;
};

export {
    secondsSinceMidnightToTimeStr,
    decimalHourToTimeStr,
    timeStrToDecimalHour,
    secondsToMinutes,
    secondsToMinutesDecimal,
    secondsToHours,
    secondsToHoursDecimal,
    minutesToHours,
    minutesToHoursDecimal,
    minutesToSeconds,
    hoursToSeconds,
    toXXhrYYminZZsec,
    timeStrToSecondsSinceMidnight,
    intTimeToSecondsSinceMidnight,
    roundSecondsToNearestMinute,
    roundSecondsToNearestQuarter
};
