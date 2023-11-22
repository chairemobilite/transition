/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const kphToMps = function (kph: number): number {
    return kph / 3.6;
};

const mpsToKph = function (mps: number): number {
    return mps * 3.6;
};

// M/s to ft/s
const mpsToFtps = function (mps: number): number {
    return mps * 3.281;
};

const ftpsToMps = function (ftps: number): number {
    return ftps / 3.281;
};

const kphToMph = function (kph: number): number {
    return kph / 1.60934;
};

const mphToKph = function (mph: number): number {
    return mph * 1.60934;
};

const mpsToMph = function (mps: number): number {
    return mps * 2.23694;
};

const mphToMps = function (mph: number): number {
    return mph / 2.23694;
};

const metersToMiles = function (meters: number): number {
    return meters / 1609.34;
};

const milesToMeters = function (miles: number): number {
    return miles * 1609.34;
};

const metersToFeet = function (meters: number): number {
    return meters * 3.281;
};

const feetToMeters = function (feet: number): number {
    return feet / 3.281;
};

const kmToMiles = function (km: number): number {
    return km / 1.60934;
};

const milesToKm = function (miles: number): number {
    return miles * 1.60934;
};

const sqFeetToSqMeters = function (sqFeet: number): number {
    if (sqFeet < 0) {
        return NaN;
    }
    return sqFeet * 0.092903;
};

const distanceFromAccelerationAndSpeed = function (accelerationMps2: number, speedMps: number): number {
    return (speedMps * speedMps) / (2 * accelerationMps2);
};

const speedFromAccelerationAndDistance = function (accelerationMps2: number, distanceM: number): number {
    return Math.sqrt(2 * accelerationMps2 * distanceM);
};

const maxSpeedFromAccelerationDecelerationAndDistance = function (
    accelerationMps2: number,
    decelerationMps2: number,
    distanceM: number
): number {
    return Math.sqrt((2 * accelerationMps2 * decelerationMps2 * distanceM) / (accelerationMps2 + decelerationMps2));
};

// get total duration including acceleration and deceleration, with a running speed, which could be impossible to reach if too great:
// if running speed is too high, the maximum running speed will be used instead:
const durationFromAccelerationDecelerationDistanceAndRunningSpeed = function (
    accelerationMps2: number,
    decelerationMps2: number,
    distanceM: number,
    runningSpeedMps: number
): number {
    const maxSpeedMps = maxSpeedFromAccelerationDecelerationAndDistance(accelerationMps2, decelerationMps2, distanceM);
    runningSpeedMps = Math.min(runningSpeedMps, maxSpeedMps);
    const accelerationDistanceM = distanceFromAccelerationAndSpeed(accelerationMps2, runningSpeedMps);
    const decelerationDistanceM = distanceFromAccelerationAndSpeed(decelerationMps2, runningSpeedMps);
    return (
        runningSpeedMps / accelerationMps2 +
        runningSpeedMps / decelerationMps2 +
        (distanceM - accelerationDistanceM - decelerationDistanceM) / runningSpeedMps
    );
};

export {
    kphToMps,
    mpsToKph,
    mpsToFtps,
    ftpsToMps,
    kphToMph,
    mphToKph,
    mpsToMph,
    mphToMps,
    metersToMiles,
    milesToMeters,
    metersToFeet,
    feetToMeters,
    kmToMiles,
    milesToKm,
    sqFeetToSqMeters,
    distanceFromAccelerationAndSpeed,
    speedFromAccelerationAndDistance,
    maxSpeedFromAccelerationDecelerationAndDistance,
    durationFromAccelerationDecelerationDistanceAndRunningSpeed
};
