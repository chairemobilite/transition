/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import each from 'jest-each';
import * as DateTimeUtils from '../DateTimeUtils';

test('should convert decimal hour to time string', function() {
  expect(DateTimeUtils.decimalHourToTimeStr(6.23)).toBe('6:13');
  expect(DateTimeUtils.decimalHourToTimeStr(6.999)).toBe('6:59');
  expect(DateTimeUtils.decimalHourToTimeStr(23.99)).toBe('23:59');
  expect(DateTimeUtils.decimalHourToTimeStr(23.999)).toBe('23:59');
  expect(DateTimeUtils.decimalHourToTimeStr(6.999, true, true)).toBe('6:59:56');
  expect(DateTimeUtils.decimalHourToTimeStr(6.9999, true, true)).toBe('7:00:00');
});

test('should return null if decimal hour is not valid', function() {
  expect(DateTimeUtils.decimalHourToTimeStr('blabla')).toBe(null);
  expect(DateTimeUtils.decimalHourToTimeStr(-23)).toBe(null);
  expect(DateTimeUtils.decimalHourToTimeStr('-12:60')).toBe(null);
});

test('timeStrToSecondsSinceMidnight', function() {
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('1:00')).toBe(3600);
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('1:01')).toBe(3660);
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('1:')).toBe(3600);
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('1:1')).toBe(3660);
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('001:01')).toBe(3660);
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('14:41')).toBe(52860);
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('14:41:05')).toBe(52865);
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('25:00')).toBe(90000);
    // Test corner cases
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('14')).toBeNull();
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('14:41:05:05')).toBeNull();
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('bla')).toBeNull();
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('bl:ah')).toBeNull();
    expect(DateTimeUtils.timeStrToSecondsSinceMidnight('01:10:do')).toBeNull();
});

test('secondsSinceMidnightToTimeStr', function() {
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(3600)).toBe('1:00');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(3667)).toBe('1:01');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(5)).toBe('0:00');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(65)).toBe('0:01');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(65.50)).toBe('0:01');
    // Test the various parameters of the function
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(52860)).toBe('14:41');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(52860, false)).toBe('2:41');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(52865, true, true)).toBe('14:41:05');
    // Test corner cases
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(87000)).toBe('24:10');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(-3667)).toBe('22:58');
    expect(DateTimeUtils.secondsSinceMidnightToTimeStr(-87000)).toBe('23:50');
});

test('roundSecondsToNearestMinute', function() {
    expect(DateTimeUtils.roundSecondsToNearestMinute(0)).toBe(0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(10)).toBe(60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(-1)).toBe(-0); // it seems Javascript differentiate -0 from 0
    expect(DateTimeUtils.roundSecondsToNearestMinute(-59)).toBe(-0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(-72)).toBe(-60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(60)).toBe(60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(0, Math.ceil)).toBe(0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(10, Math.ceil)).toBe(60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(-1, Math.ceil)).toBe(-0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(-59, Math.ceil)).toBe(-0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(-72, Math.ceil)).toBe(-60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(60, Math.ceil)).toBe(60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(256, Math.ceil)).toBe(300);
    expect(DateTimeUtils.roundSecondsToNearestMinute(280, Math.ceil)).toBe(300);
    expect(DateTimeUtils.roundSecondsToNearestMinute(30, Math.floor)).toBe(0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(1, Math.floor)).toBe(0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(0, Math.floor)).toBe(0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(30, Math.round)).toBe(60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(15, Math.round)).toBe(0);
    expect(DateTimeUtils.roundSecondsToNearestMinute(45, Math.round)).toBe(60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(60, Math.round)).toBe(60);
    expect(DateTimeUtils.roundSecondsToNearestMinute(256, Math.round)).toBe(240);
    expect(DateTimeUtils.roundSecondsToNearestMinute(280, Math.round)).toBe(300);
    expect(DateTimeUtils.roundSecondsToNearestMinute(Infinity)).toBe(Infinity);
    expect(DateTimeUtils.roundSecondsToNearestMinute(Infinity, Math.ceil)).toBe(Infinity);
    expect(DateTimeUtils.roundSecondsToNearestMinute(Infinity, Math.floor)).toBe(Infinity);
    expect(DateTimeUtils.roundSecondsToNearestMinute(Infinity, Math.round)).toBe(Infinity);
    expect(DateTimeUtils.roundSecondsToNearestMinute(Math.PI)).toBe(60);
});

each([
    ['seconds only', 34, '34 s'],
    ['minutes only', 120, '2 m'],
    ['hours only', 7200, '2 h'],
    ['hours/minutes', 7260, '2 h 1 m'],
    ['hours/minutes/seconds', 7263, '2 h 1 m 3 s'],
    ['hours/seconds', 7203, '2 h 3 s'],
    ['zero', 0, '0 s'],
    ['negative', -7263, '-2 h 1 m 3 s'],
    ['null', null, null],
    ['undefined', undefined, null]
]).test('toXXhrYYminZZsec: %s', (_title, value, expected) => {
    expect(DateTimeUtils.toXXhrYYminZZsec(value, 'h', 'm', 's')).toEqual(expected);
})