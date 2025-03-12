/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as LE from '../LodashExtensions';
import each from 'jest-each';

test('should check if isBlank', function() {
  expect(LE._isBlank(1.3)).toBe(false);
  expect(LE._isBlank('')).toBe(true);
  expect(LE._isBlank(' ')).toBe(true);
  expect(LE._isBlank('test')).toBe(false);
  expect(LE._isBlank('\t')).toBe(true);
  expect(LE._isBlank(['test'])).toBe(false);
  expect(LE._isBlank(Infinity)).toBe(false);
  expect(LE._isBlank(null)).toBe(true);
  expect(LE._isBlank(undefined)).toBe(true);
  expect(LE._isBlank(NaN)).toBe(false);
  expect(LE._isBlank([])).toBe(true);
  expect(LE._isBlank({})).toBe(true);
  expect(LE._isBlank([1,2,3])).toBe(false);
  expect(LE._isBlank({a: 2})).toBe(false);
  expect(LE._isBlank(true)).toBe(false);
  expect(LE._isBlank(false)).toBe(false);
  expect(LE._isBlank(new Date)).toBe(false);
  expect(LE._isBlank(new Date('2022-05-02'))).toBe(false);
});

test('should convert empty string to null', function() {
  expect(LE._emptyStringToNull(null)).toBe(null);
  expect(LE._emptyStringToNull(-1)).toBe(-1);
  expect(LE._emptyStringToNull(23)).toBe(23);
  expect(LE._emptyStringToNull('')).toBe(null);
  expect(LE._emptyStringToNull('test')).toBe('test');
});

test('should chunkify', function() {
    const array = [1,2,3,4,5,6,7,8];
    expect(LE._chunkify(array, 2, true)).toEqual([[1,2,3,4], [5,6,7,8]]);
    expect(LE._chunkify(array, 3, true)).toEqual([[1,2,3], [4,5,6], [7,8]]);
    expect(LE._chunkify(array, 9, true)).toEqual([[1],[2],[3],[4],[5],[6],[7],[8],[]]);
    expect(LE._chunkify(array, 7, true)).toEqual([[1,2],[3],[4],[5],[6],[7],[8]]);
    expect(LE._chunkify(array, 2, false)).toEqual([[1,2,3,4], [5,6,7,8]]);
    expect(LE._chunkify(array, 5, false)).toEqual([[1],[2],[3],[4],[5,6,7,8]]);
    expect(LE._chunkify(array, 0, false)).toEqual([array]);
    expect(LE._chunkify(array, 1, false)).toEqual([array]);
    expect(LE._chunkify(array, -1, false)).toEqual([array]);
});

test('should convert to integer or default value', function() {
    expect(LE._toInteger(null)).toEqual(null);
    expect(LE._toInteger(null, 12)).toEqual(12);
    expect(LE._toInteger(null, 12.4)).toEqual(12);
    expect(LE._toInteger('')).toEqual(null);
    expect(LE._toInteger('23.23')).toEqual(23);
    expect(LE._toInteger('23.23', 12)).toEqual(23);
    expect(LE._toInteger('a23.23')).toEqual(null);
    expect(LE._toInteger('a23.23', 12)).toEqual(12);
    expect(LE._toInteger(23.345)).toEqual(23);
    expect(LE._toInteger(23, 12)).toEqual(23);
    expect(LE._toInteger(-23.2)).toEqual(-23);
    expect(LE._toInteger(NaN)).toEqual(null);
    expect(LE._toInteger(NaN, 12)).toEqual(12);
    expect(LE._toInteger(Infinity)).toEqual(null);
    expect(LE._toInteger(undefined)).toEqual(null);
    expect(LE._toInteger(undefined, undefined)).toEqual(null);
    expect(LE._toInteger(undefined, 12)).toEqual(12);
});

test('should convert to float or default value', function() {
    expect(LE._toFloat(null)).toEqual(null);
    expect(LE._toFloat(null, 12.4)).toEqual(12.4);
    expect(LE._toFloat('')).toEqual(null);
    expect(LE._toFloat('23')).toEqual(23);
    expect(LE._toFloat('23.23')).toEqual(23.23);
    expect(LE._toFloat('23.23', 12.4)).toEqual(23.23);
    expect(LE._toFloat('a23.23')).toEqual(null);
    expect(LE._toFloat('a23.23', 12.4)).toEqual(12.4);
    expect(LE._toFloat(23.345)).toEqual(23.345);
    expect(LE._toFloat(23, 12.4)).toEqual(23);
    expect(LE._toFloat(-23.2)).toEqual(-23.2);
    expect(LE._toFloat(NaN)).toEqual(null);
    expect(LE._toFloat(NaN, 12)).toEqual(12);
    expect(LE._toFloat(Infinity)).toEqual(null);
    expect(LE._toFloat(undefined)).toEqual(null);
    expect(LE._toFloat(undefined, undefined)).toEqual(null);
    expect(LE._toFloat(undefined, 12)).toEqual(12);
});

test('conversion with _toBool', function() {
    expect(LE._toBool(null)).toEqual(null);
    expect(LE._toBool(null, true)).toEqual(true);
    expect(LE._toBool('true')).toEqual(true);
    expect(LE._toBool('true', false)).toEqual(true);
    expect(LE._toBool(true)).toEqual(true);
    expect(LE._toBool(true, false)).toEqual(true);
    expect(LE._toBool('false')).toEqual(false);
    expect(LE._toBool('false', true)).toEqual(false);
    expect(LE._toBool(false)).toEqual(false);
    expect(LE._toBool(false, true)).toEqual(false);
    expect(LE._toBool('potato', true)).toEqual(true);
    expect(LE._toBool('potato')).toEqual(null);
    expect(LE._toBool(undefined)).toEqual(null);
})

test('booleish', function() {
    const trueishes = ['y', 'yes', 'true', true, '1', 1, 1.0, 'on', 'TRUE', 'Y', 'Yes', 'YES', 'On', 'ON', 'True', 'tRuE', 'TrUe', 't', 'T'];
    const falseishes = ['n', 'no', 'false', false, '0', 0, 'off', 'N', 'NO', 'No', 'FALSE', 'False', 'Off', 'OFF', 'FaLsE', 'fAlSe', 'f', 'F'];
    const nullishes = ['null', null, 'undefined', '', 'nil', 'blabla', Infinity, -2, 44, 55.3, -23.456, { val: true }, [true], [false], ['bla']];
    for (let i = 0; i < trueishes.length; i++) {
        expect(LE._booleish(trueishes[i])).toBe(true);
    }
    for (let i = 0; i < falseishes.length; i++) {
        expect(LE._booleish(falseishes[i])).toBe(false);
    }
    for (let i = 0; i < nullishes.length; i++) {
        expect(LE._booleish(nullishes[i])).toBe(null);
    }
});

test('Remove blank fields', function() {
    // Test with an object
    const obj = { a: null, b: '', c: undefined, d: 1 };
    expect(LE._removeBlankFields(obj)).toEqual({ b: '', d: 1 });
    expect(obj).toEqual({ b: '', d: 1 });

    // Object without blank fields
    const allNonBlank = { a: 'test', b: { innerB: null, desc: 'Does not go deep' }, c: 2 };
    const allNonBlankBis = Object.assign({}, allNonBlank);
    expect(LE._removeBlankFields(allNonBlank)).toEqual(allNonBlankBis);

    // Other corner case objects
    expect(LE._removeBlankFields({})).toEqual({});
    expect(LE._removeBlankFields({ a: null, b: undefined })).toEqual({});

    // Test with arbitrary non object types
    expect(LE._removeBlankFields(3)).toEqual(3);
    expect(LE._removeBlankFields('abc')).toEqual('abc');
    expect(LE._removeBlankFields(null)).toEqual(null);
    expect(LE._removeBlankFields(undefined)).toEqual(undefined);
});

each([
    ['No identical string, empty array', 'str', [], 'str'],
    ['No identical string, data in array', 'str', ['strOther', 'otherStr', 'foo', 'bar'], 'str'],
    ['Identical string, get first suffix', 'str', ['str', 'otherStr', 'foo', 'bar'], 'str-1'],
    ['Identical string, many times', 'str', ['str', 'str-1', 'str-2', 'str-3', 'str-4', 'otherStr'], 'str-5']
]).test('Make string unique: %s', (_name, str, otherStr, expected) => {
    expect(LE._makeStringUnique(str, otherStr)).toEqual(expected);
});

each([
    ['Valid Email', 'foo@bar.net', true],
    ['Valid Email', 'foo+something@bar.net', true],
    ['Incomplete domain', 'foo@bar', false],
    ['No prefix', '@bar.net', false],
    ['No suffix', 'foo@', false],
    ['Not an email', 'simple string', false],
]).test('Is email: %s', (_name, str, expected) => {
    expect(LE._isEmail(str)).toEqual(expected);
});
