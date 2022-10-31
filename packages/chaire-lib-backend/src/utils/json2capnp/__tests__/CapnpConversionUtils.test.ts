/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as capnp from '../CapnpConversionUtils';

test('should convert null or undefined to -1', function() {
    expect(capnp.nullToMinusOne(null)).toBe(-1);
    expect(capnp.nullToMinusOne(23.345)).toBe(23.345);
    expect(capnp.nullToMinusOne(-23.2)).toBe(-23.2);
    expect(capnp.nullToMinusOne(46)).toBe(46);
    expect(capnp.nullToMinusOne(-46)).toBe(-46);
    expect(capnp.nullToMinusOne(undefined)).toBe(-1);
});

test('should convert -1 to undefined', function() {
    expect(capnp.minusOneToUndefined(-1)).toBe(undefined);
    expect(capnp.minusOneToUndefined(23)).toBe(23);
});

test('should convert boolean to int8', function() {
    expect(capnp.boolToInt8(null)).toBe(-1);
    expect(capnp.boolToInt8(true)).toBe(1);
    expect(capnp.boolToInt8(false)).toBe(0);
    expect(capnp.boolToInt8(undefined)).toBe(-1);
});

test('should convert boolean to int8', function() {
    expect(capnp.int8ToBool(23.345)).toBe(undefined);
    expect(capnp.int8ToBool(-23.2)).toBe(undefined);
    expect(capnp.int8ToBool(1)).toBe(true);
    expect(capnp.int8ToBool(0)).toBe(false);
});

test('should convert string: "none" to undefined', function() {
    expect(capnp.noneStringToUndefined('')).toBe('');
    expect(capnp.noneStringToUndefined('test')).toBe('test');
    expect(capnp.noneStringToUndefined('none')).toBe(undefined);
});

test('roundLonLatCoordinates', function() {
    expect(capnp.roundLonLatCoordinates([0, 0])).toEqual([0, 0]);
    expect(capnp.roundLonLatCoordinates([0.00000000000002, 0.00000000000002])).toEqual([0, 0]);
    expect(capnp.roundLonLatCoordinates([-73.123456789, 45.123456789])).toEqual([-73.123457, 45.123457]);
    expect(capnp.roundLonLatCoordinates([45, -73])).toEqual([45, -73]);
});

test('roundLonLatCoordinate', function() {
    expect(capnp.roundLonLatCoordinate(0)).toEqual(0);
    expect(capnp.roundLonLatCoordinate(-50000)).toEqual(-50000);
    expect(capnp.roundLonLatCoordinate(45.000001)).toEqual(45.000001);
    expect(capnp.roundLonLatCoordinate(45.123456789)).toEqual(45.123457);
    expect(capnp.roundLonLatCoordinate(45.000000001)).toEqual(45);
});

test('latLonCoordinateToInt', function() {
    expect(capnp.latLonCoordinateToInt(0)).toEqual(0);
    expect(capnp.latLonCoordinateToInt(0.000001)).toEqual(1);
    expect(capnp.latLonCoordinateToInt(-50000)).toEqual(-50000000000);
    expect(capnp.latLonCoordinateToInt(45.000001)).toEqual(45000001);
    expect(capnp.latLonCoordinateToInt(45.123456789)).toEqual(45123457);
    expect(capnp.latLonCoordinateToInt(45.000000001)).toEqual(45000000);
});

test('intCoordinateToLatLon', function() {
    expect(capnp.intCoordinateToLatLon(0)).toEqual(0);
    expect(capnp.intCoordinateToLatLon(1)).toEqual(0.000001);
    expect(capnp.intCoordinateToLatLon(-50000000000)).toEqual(-50000);
    expect(capnp.intCoordinateToLatLon(45000001)).toEqual(45.000001);
    expect(capnp.intCoordinateToLatLon(45123457)).toEqual(45.123457);
    expect(capnp.intCoordinateToLatLon(45000000)).toEqual(45);
});
