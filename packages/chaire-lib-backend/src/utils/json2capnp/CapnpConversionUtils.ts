/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * Convert null values to -1, returning the original value for any other value
 *
 * @param {(number | null | undefined)} value The value to  convert
 * @return {*}  {number} The original value or -1 if it was null
 */
const nullToMinusOne = function(value: number | null | undefined): number {
    if (value === null || value === undefined) {
        return -1;
    }
    return value;
};

/**
 * Convert -1 values to undefined, returning any other value as is
 *
 * @param {number} value The value to convert
 * @return {*}  {number | undefined)} The original value or undefined if the
 * value was -1
 */
const minusOneToUndefined = function(value: number): number | undefined {
    if (value === -1) {
        return undefined;
    }
    return value;
};

/**
 * Convert boolean values to a number
 *
 * @param {( boolean | null | undefined)} value The value to convert
 * @return {*}  {number} 1 for true, 0 for false or -1 for any other value
 */
const boolToInt8 = function(value: boolean | null | undefined): number {
    if (value === true) {
        return 1;
    } else if (value === false) {
        return 0;
    }
    return -1;
};

/**
 * Convert a number to boolean value
 *
 * @param {number} value The value to convert
 * @return {*}  {(boolean | undefined)} true if 1, false if 0 or undefined for
 * any other value
 */
const int8ToBool = function(value: number): boolean | undefined {
    if (value === 1) {
        return true;
    } else if (value === 0) {
        return false;
    }
    return undefined;
};

/**
 * Convert the 'none' string to undefined, returning the original value for any
 * other value
 *
 * @param {string} str The value to convert
 * @return {*}  {(string | undefined)} undefined if str is the 'none' string,
 * the original value otherwise
 */
const noneStringToUndefined = function(str: string): string | undefined {
    if (str === 'none') {
        return undefined;
    }
    return str;
};

const LAT_LON_PRECISION_FACTOR = 1000000;

/**
 * Round coordinates to limit the number of decimal after the point. It gives
 * results precise to approximately 10 cm
 *
 * @param {[number, number]} coordinates The coordinates to round
 * @return {*}  {[number, number]} Rounded coordinates
 */
const roundLonLatCoordinates = function(coordinates: [number, number]): [number, number] {
    // precise to approximately 10 cm
    return [roundLonLatCoordinate(coordinates[0]), roundLonLatCoordinate(coordinates[1])];
};

/**
 * Round a single coordinate to limit the number of decimal after the point. It
 * gives results precise to approximately 10 cm
 *
 * @param {number} coordinate The coordinate to round
 * @return {*}  {number}
 */
const roundLonLatCoordinate = function(coordinate: number): number {
    return intCoordinateToLatLon(latLonCoordinateToInt(coordinate));
};

/**
 * Convert a lat/lon coordinate to an integer number that keeps the precision to
 * approximately 10 cm, removing the decimals. To reverse the process and obtain
 * the original coordinate, use `intCoordinateToLatLon`
 *
 * @param {number} coordinate The coordinate to transform to integer
 * @return {*}  {number}
 */
const latLonCoordinateToInt = function(coordinate: number): number {
    return Math.round(coordinate * LAT_LON_PRECISION_FACTOR);
};

/**
 * Convert an integer number to a lat/lon coordinate number, with a precision of
 * approximately 10 cm. It is the reverse function of `latLonCoordinateToInt`
 *
 * @param {number} intCoordinate The integer to convert back to lat/lon
 * @return {*}  {number}
 */
const intCoordinateToLatLon = function(intCoordinate: number): number {
    return intCoordinate / LAT_LON_PRECISION_FACTOR;
};

export {
    nullToMinusOne,
    minusOneToUndefined,
    boolToInt8,
    int8ToBool,
    noneStringToUndefined,
    roundLonLatCoordinates,
    roundLonLatCoordinate,
    latLonCoordinateToInt,
    intCoordinateToLatLon
};
