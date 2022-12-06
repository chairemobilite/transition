/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import random, { Random } from 'random';
import _cloneDeep from 'lodash.clonedeep';

import { sequentialArray } from './MathUtils';

// TODO: Document those methods and try to type them better. They were just copy-pasted from original file

/**
 * Get a random value from a certain distribution
 * @param distribution array or Map with key = Number and value = probability ([0.0,1.0])
 * @param randomNumber
 * @param distributionSum
 * @param except
 * @returns
 */
const randomFromDistribution = function (
    distribution: Map<number, number> | number[] | { [key: number]: unknown },
    randomNumber: number = random.float(0.0, 1.0),
    distributionSum = 1.0,
    except: number[] = []
): number {
    if (distributionSum === 0) {
        throw 'Distribution sum is invalid';
    }

    let cummulativeProbability = 0.0;
    const randomFromSum = randomNumber * distributionSum;
    if (Array.isArray(distribution)) {
        let prevKey = 0;
        // Array
        for (let i = 0, count = distribution.length; i < count; i++) {
            cummulativeProbability += distribution[i];
            if (randomFromSum < cummulativeProbability) {
                if (!except.includes(i)) {
                    return i;
                }
            }
            prevKey = i;
        }
        return prevKey;
    }
    if (typeof (distribution as any).entries === 'function') {
        let prevKey = 0;
        // Map
        for (const [key, probability] of (distribution as Map<number, number>).entries()) {
            cummulativeProbability += probability;
            if (randomFromSum < cummulativeProbability) {
                if (!except.includes(key)) {
                    return key;
                }
            }
            prevKey = key;
        }
        return prevKey;
    }
    // Object
    let prevKey = 0;
    for (const key in distribution) {
        cummulativeProbability += distribution[key];
        if (randomFromSum < cummulativeProbability) {
            if (!except.includes(key as unknown as number)) {
                return key as unknown as number;
            }
        }
        prevKey = key as unknown as number;
    }
    return prevKey;
};

/**
 *
 * @param value The value around which to get the random value
 * @param rangeMinusPercent
 * @param rangePlusPercent
 * @param randomGenerator
 * @returns
 */
const randomAroundPercent = function (
    value: number,
    rangeMinusPercent = 0.1,
    rangePlusPercent?: number,
    randomGenerator: Random = random
) {
    const rangePlus = rangePlusPercent === undefined ? rangeMinusPercent : rangePlusPercent;
    return randomGenerator.float(value * (1 - rangeMinusPercent), value * (1 + rangePlus));
};

const randomAround = function (value: number, rangeMinus = 1, rangePlus?: number, randomGenerator = random) {
    const plusRange = rangePlus === undefined ? rangeMinus : rangePlus;
    return randomGenerator.float(value - rangeMinus, value + plusRange);
};

const sampleSizeWithOptionalSeed = function <T>(
    array: T[],
    n: number /* sample size */,
    randomGenerator: Random = random,
    seed?: number
): T[] {
    // from lodash.sampleSize
    if (seed) {
        randomGenerator = random.clone(seed);
    }
    n = n === null ? 1 : n;
    const length = array === null ? 0 : array.length;
    if (!length || n < 1) {
        return [];
    }
    n = n > length ? length : n;
    let index = -1;
    const lastIndex = length - 1;
    const result = _cloneDeep(array);
    while (++index < n) {
        const rand = index + Math.floor(randomGenerator.float() * (lastIndex - index + 1));
        const value = result[rand];
        result[rand] = result[index];
        result[index] = value;
    }
    return result.slice(0, n);
};

const shuffle = function <T>(array: T[], randomGenerator = random, seed?: number): T[] {
    return sampleSizeWithOptionalSeed(array, array.length, randomGenerator, seed);
};

const randomInArray = function <T>(array: T[], randomGenerator = random, seed?: number): T {
    const sample = sampleSizeWithOptionalSeed(array, 1, randomGenerator, seed);
    if (sample && sample.length === 1) {
        return sample[0];
    } else {
        throw 'randomInArray: undefined sample, or invalid length';
    }
};

// returns only integer
const randomInRange = function (range: [number, number], randomGenerator: Random = random, seed?: number): number {
    if (
        !range ||
        !Array.isArray(range) ||
        range.length !== 2 ||
        !Number.isInteger(range[0]) ||
        !Number.isInteger(range[1]) ||
        range[1] < range[0]
    ) {
        throw 'randomInRange: Invalid range, must be positive integer';
    }
    const rangeDiff = range[1] - range[0];
    const values = sequentialArray(rangeDiff + 1, range[0], 1);
    return randomInArray(values, randomGenerator, seed);
};

const randomValueIndex = function (array, value, randomGenerator: Random = random, seed?: number) {
    if (!array || !Array.isArray(array) || array.length === 0) {
        return null;
    }
    const valueIndexes: number[] = [];
    for (let i = 0, count = array.length; i < count; i++) {
        if (array[i] === value) {
            valueIndexes.push(i);
        }
    }
    if (valueIndexes.length > 0) {
        return randomInArray(valueIndexes, randomGenerator, seed);
    }
    return null;
};

const randomBoolArray = function (
    n: number /* array size */,
    numberOfTrue?: number,
    randomGenerator: Random = random,
    seed?: number
): boolean[] {
    if (!Number.isInteger(n) || n < 0) {
        throw 'randomBoolArray: Array size must be a positive integer';
    }
    const indexes = sequentialArray(n);
    const nbTrue = numberOfTrue === undefined ? randomGenerator.int(0, n) : numberOfTrue;
    const trueIndexes = sampleSizeWithOptionalSeed(indexes, nbTrue, randomGenerator, seed);
    const boolArray = new Array(n);
    boolArray.fill(false);
    for (let i = 0, count = trueIndexes.length; i < count; i++) {
        boolArray[trueIndexes[i]] = true;
    }
    return boolArray;
};

const sample = sampleSizeWithOptionalSeed; // alias

export {
    randomFromDistribution,
    randomAroundPercent,
    randomAround,
    randomInRange,
    randomValueIndex,
    randomInArray,
    randomBoolArray,
    sampleSizeWithOptionalSeed,
    sample, // alias of sampleSizeWithOptionalSeed
    shuffle // alias of sampleSizeWithOptionalSeed with length = array length
};
