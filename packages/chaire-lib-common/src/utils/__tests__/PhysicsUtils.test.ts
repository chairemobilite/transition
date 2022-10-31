/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as PhysicsUtils from '../PhysicsUtils';

test('should convert speeds', function() {
    expect(PhysicsUtils.kphToMps(3.6)).toBe(1);
    expect(PhysicsUtils.kphToMps(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.kphToMps(-3.6)).toBe(-1);

    expect(PhysicsUtils.mpsToKph(1)).toBe(3.6);
    expect(PhysicsUtils.mpsToKph(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.mpsToKph(-1)).toBe(-3.6);

    expect(PhysicsUtils.kphToMph(1.60934)).toBe(1);
    expect(PhysicsUtils.kphToMph(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.kphToMph(-1.60934)).toBe(-1);

    expect(PhysicsUtils.mphToKph(1)).toBe(1.60934);
    expect(PhysicsUtils.mphToKph(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.mphToKph(-1)).toBe(-1.60934);

    expect(PhysicsUtils.mphToMps(2.23694)).toBe(1);
    expect(PhysicsUtils.mphToMps(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.mphToMps(-2.23694)).toBe(-1);

    expect(PhysicsUtils.mpsToMph(1)).toBe(2.23694);
    expect(PhysicsUtils.mpsToMph(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.mpsToMph(-1)).toBe(-2.23694);
});

test('should convert distances', function() {
    expect(PhysicsUtils.metersToMiles(1609.34)).toBe(1);
    expect(PhysicsUtils.metersToMiles(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.metersToMiles(-1609.34)).toBe(-1);

    expect(PhysicsUtils.milesToMeters(1)).toBe(1609.34);
    expect(PhysicsUtils.milesToMeters(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.milesToMeters(-1)).toBe(-1609.34);

    expect(PhysicsUtils.kmToMiles(1.60934)).toBe(1);
    expect(PhysicsUtils.kmToMiles(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.kmToMiles(-1.60934)).toBe(-1);

    expect(PhysicsUtils.milesToKm(1)).toBe(1.60934);
    expect(PhysicsUtils.milesToKm(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.milesToKm(-1)).toBe(-1.60934);
});

test('should convert areas', function() {
    expect(PhysicsUtils.sqFeetToSqMeters(1)).toBe(0.092903);
    expect(PhysicsUtils.sqFeetToSqMeters(Infinity)).toBe(Infinity);
    expect(PhysicsUtils.sqFeetToSqMeters(-1)).toBe(NaN);
});

test('should calculate distances, speeds and times', function() {
    expect(Math.round(100*PhysicsUtils.distanceFromAccelerationAndSpeed(1.3, 23.4))/100).toBe(210.6);
    expect(PhysicsUtils.distanceFromAccelerationAndSpeed(Infinity, 23.4)).toBe(0);
    expect(PhysicsUtils.distanceFromAccelerationAndSpeed(1.5, Infinity)).toBe(Infinity);

    expect(Math.round(100*PhysicsUtils.speedFromAccelerationAndDistance(1.3, 210.6))/100).toBe(23.4);
    expect(PhysicsUtils.speedFromAccelerationAndDistance(Infinity, 235.4)).toBe(Infinity);
    expect(PhysicsUtils.speedFromAccelerationAndDistance(1.5, Infinity)).toBe(Infinity);

    expect(Math.round(100*PhysicsUtils.maxSpeedFromAccelerationDecelerationAndDistance(1.3, 2.4, 234.5))/100).toBe(19.89);
    expect(PhysicsUtils.maxSpeedFromAccelerationDecelerationAndDistance(Infinity, 3.5, 235.4)).toBe(NaN);
    expect(PhysicsUtils.maxSpeedFromAccelerationDecelerationAndDistance(1.5, Infinity, 456)).toBe(NaN);

    expect(Math.round(100*PhysicsUtils.durationFromAccelerationDecelerationDistanceAndRunningSpeed(1.3, 2.4, 172, 20))/100).toBe(20.2); // too short to reach speed
    expect(Math.round(100*PhysicsUtils.durationFromAccelerationDecelerationDistanceAndRunningSpeed(1.3, 2.4, 700.5, 20))/100).toBe(46.88);
    expect(Math.round(100*PhysicsUtils.durationFromAccelerationDecelerationDistanceAndRunningSpeed(1.3, 2.4, 3500, 42))/100).toBe(108.24);
    expect(PhysicsUtils.durationFromAccelerationDecelerationDistanceAndRunningSpeed(Infinity, 3.5, 235.4, Infinity)).toBe(NaN);
    expect(PhysicsUtils.durationFromAccelerationDecelerationDistanceAndRunningSpeed(1.5, Infinity, 456, 4653.6)).toBe(NaN);
});
