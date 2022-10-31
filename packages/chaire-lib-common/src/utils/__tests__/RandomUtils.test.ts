/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import seedrandom from 'seedrandom';
import random     from 'random';

import * as RandomUtils    from '../RandomUtils';
import { roundToDecimals } from '../MathUtils';

test('should get random from distribution', function() {

    const seed            = seedrandom('test'); // seed so we can get the same results each time
    const randomGenerator = random.clone(seed);
    const distribution    = new Map([
        [300, 0.2],
        [400, 0.5],
        [500, 0.1],
        [600, 0.07],
        [800, 0.05],
        [1000, 0.03],
        [1500, 0.01],
        [2000, 0.01],
        [3000, 0.01],
        [4000, 0.01],
        [10000, 0.01] 
    ]);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(800);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(400);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(2000);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(400);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(400);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(400);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(400);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(300);
    expect(RandomUtils.randomFromDistribution(distribution, randomGenerator.float(0.0, 1.0))).toBe(500);

});

test('should get random around percent', function() {

    const seed            = seedrandom('test'); // seed so we can get the same results each time
    const randomGenerator = random.clone(seed);
    expect(RandomUtils.randomAroundPercent(23, 0, 0, randomGenerator)).toBe(23);
    expect(roundToDecimals(RandomUtils.randomAroundPercent(23, 0.1, 0.1, randomGenerator),5)).toBe(22.55101);
    expect(roundToDecimals(RandomUtils.randomAroundPercent(23, 0.2, 0,   randomGenerator),5)).toBe(22.83775);
    expect(roundToDecimals(RandomUtils.randomAroundPercent(-15.34, 1, 1, randomGenerator),5)).toBe(-9.35123);
    expect(roundToDecimals(RandomUtils.randomAroundPercent(-15.34, 1, undefined, randomGenerator),5)).toBe(-10.80264);
    expect(roundToDecimals(RandomUtils.randomAroundPercent(-15.34, undefined, undefined, randomGenerator),5)).toBe(-14.64496);
});

test('should get random around', function() {

    const seed            = seedrandom('test'); // seed so we can get the same results each time
    const randomGenerator = random.clone(seed);
    expect(RandomUtils.randomAround(23, 0, 0, randomGenerator)).toBe(23);
    expect(roundToDecimals(RandomUtils.randomAround(23, 0.1, 0.1, randomGenerator),5)).toBe(22.98048);
    expect(roundToDecimals(RandomUtils.randomAround(23, 0.2, 0,   randomGenerator),5)).toBe(22.99295);
    expect(roundToDecimals(RandomUtils.randomAround(-15.34, 1, 1, randomGenerator),5)).toBe(-15.7304);
    expect(roundToDecimals(RandomUtils.randomAround(-15.34, 1, undefined, randomGenerator),5)).toBe(-15.63579);
    expect(roundToDecimals(RandomUtils.randomAround(-15.34, undefined, undefined, randomGenerator),5)).toBe(-15.79309);
});

test('should get random bool array', function() {

    const seed            = seedrandom('test'); // seed so we can get the same results each time
    const randomGenerator = random.clone(seed);
    expect(RandomUtils.randomBoolArray(0, undefined, randomGenerator)).toEqual([]);
    expect(() => RandomUtils.randomBoolArray(-1, undefined, randomGenerator)).toThrowError('randomBoolArray: Array size must be a positive integer');
    expect(() => RandomUtils.randomBoolArray(-1.5, undefined, randomGenerator)).toThrowError('randomBoolArray: Array size must be a positive integer');
    expect(() => RandomUtils.randomBoolArray(2.5, undefined, randomGenerator)).toThrowError('randomBoolArray: Array size must be a positive integer');
    expect(RandomUtils.randomBoolArray(1, 1, randomGenerator)).toEqual([true]);
    expect(RandomUtils.randomBoolArray(2, 2, randomGenerator)).toEqual([true, true]);
    expect(RandomUtils.randomBoolArray(2, 0, randomGenerator)).toEqual([false, false]);
    expect(RandomUtils.randomBoolArray(8, 4, randomGenerator)).toEqual([true, false, true, true, true, false, false, false]);
    expect(RandomUtils.randomBoolArray(8, 2, randomGenerator)).toEqual([false, false, false, true, false, true, false, false]);
    expect(RandomUtils.randomBoolArray(8, 7, randomGenerator)).toEqual([true, true, true, true, true, false, true, true]);
    expect(RandomUtils.randomBoolArray(4, 3, randomGenerator)).toEqual([true, true, false, true]);
});

test('should get random in range', function() {

    const seed            = seedrandom('test'); // seed so we can get the same results each time
    const randomGenerator = random.clone(seed);
    expect(() => RandomUtils.randomInRange([3,2], randomGenerator)).toThrow('randomInRange: Invalid range, must be positive integer');
    expect(() => RandomUtils.randomInRange([3.4,4.6], randomGenerator)).toThrow('randomInRange: Invalid range, must be positive integer');
    expect(RandomUtils.randomInRange([0,0], randomGenerator)).toEqual(0);
    expect(RandomUtils.randomInRange([0,1], randomGenerator)).toEqual(0);
    expect(RandomUtils.randomInRange([-3,-3], randomGenerator)).toEqual(-3);
    expect(RandomUtils.randomInRange([0,10], randomGenerator)).toEqual(3);
    expect(RandomUtils.randomInRange([0,100], randomGenerator)).toEqual(35);
    expect(RandomUtils.randomInRange([0,1000], randomGenerator)).toEqual(273);
    expect(RandomUtils.randomInRange([0,10000], randomGenerator)).toEqual(4636);
});

test('should shuffle array', function() {

    const seed            = seedrandom('test'); // seed so we can get the same results each time
    const randomGenerator = random.clone(seed);
    expect(RandomUtils.shuffle([1,2,3,4,5,6,7,8,9,10,22,45,78], randomGenerator)).toEqual([45,6,78,7,8,5,10,2,1,22,9,3,4]);
    expect(RandomUtils.shuffle([2,45,'aa','bb',1234,[1,2,3]], randomGenerator)).toEqual([2,1234,[1,2,3], 45,'bb','aa']);
  
});
