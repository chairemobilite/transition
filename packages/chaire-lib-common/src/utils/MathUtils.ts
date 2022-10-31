/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _isFinite from 'lodash.isfinite';

/**
 * Parses a number or string value to an integer. It returns an integer only if
 * the value is entirely an integer, so a float value or an integer for suffix
 * append will return null
 * @param value The string or number value to convert to integer.
 * @returns An integer, only if the whole value parses to an integer
 */
export const parseIntOrNull = function(value: string | number = ''): number | null {
    if (typeof value === 'number') {
        return Math.floor(value) === value && _isFinite(value) ? value : null;
    }
    const intValue = parseInt(value);
    return _isFinite(intValue) && intValue.toString() === value ? intValue : null;
};

/**
 * Parses a number or string value to a float. It returns a float only if the
 * value is finite, otherwise it returns null.
 * @param value The string or number value to convert to float.
 * @returns A float, only if the value is finite
 */
export const parseFloatOrNull = function(value: string | number = ''): number | null {
    if (typeof value === 'number') {
        return _isFinite(value) ? value : null;
    }
    value = parseFloat(value);
    return _isFinite(value) ? value : null;
};

export const roundToDecimals = function(number: string | number, numberOfDecimals = 1) {
    if (!Number.isInteger(numberOfDecimals)) {
        return null;
    }
    const nb = typeof number === 'string' ? parseFloat(number) : number;
    const factor = Math.pow(10, numberOfDecimals);
    return _isFinite(nb) ? Math.round(factor * nb) / factor : null;
};

export const median = function(array: number[]): number {
    if (array.length === 0) {
        return NaN;
    }

    array.sort((a, b) => {
        return a - b;
    });

    const half = Math.floor(array.length / 2);
    if (array.length % 2) {
        return array[half];
    }

    return (array[half - 1] + array[half]) / 2.0;
};

/**
 * Compute all possible permutations of the elements in parameter. A permutation
 * is a combination of elements where the order does matter, for example 1 2 3
 * !== 2 1 3.
 *
 * @param arr The array of elements to put in the permutations
 * @param len The length of the permuted objects
 * @param except The elements in array not to include in the permutations
 * @param repetition Whether to allow repetition of elements in the permutations
 * for example [1 1 1]
 * @returns The array of permutations
 */
export const permutationsWithRepetition = <T>(arr: T[], len: number, except: T[] = [], repetition = true): T[][] => {
    // source: https://stackoverflow.com/a/59028925 be careful: result size is n^len
    const base = arr.length;
    if (base === 1) {
        if (except.includes(arr[0])) {
            return [];
        }
        return [[arr[0]]];
    }
    // Keep a count of the values tried at each position in the permutation
    const counter = Array(len).fill(0);
    const permutations: T[][] = [];

    // Increment the counter array, starting from the end
    const increment = function(i: number) {
        if (counter[i] === base - 1) {
            // Counter already at the last element, increment previous one
            counter[i] = 0;
            increment(i - 1);
        } else {
            counter[i]++;
        }
    };

    // There is base ^ len permutations to try
    for (let permutationIndex = base ** len; permutationIndex > 0; permutationIndex--) {
        // Compute one permutation
        const currentPermutation: T[] = [];
        for (let pos = 0; pos < counter.length; pos++) {
            // Make sure the current value for position j is allowed
            if (!except.includes(arr[counter[pos]])) {
                if (repetition === false && currentPermutation.includes(arr[counter[pos]])) {
                    // This permutation is not allowed
                    break;
                }
                currentPermutation.push(arr[counter[pos]]);
            }
        }
        if (currentPermutation.length === len) {
            permutations.push(currentPermutation);
        }
        increment(counter.length - 1);
    }

    return permutations;
};

/**
 * Create a array of sequential number of a given size, starting at value and
 * with increment
 *
 * @param n The size of the array to get
 * @param startAt The value of the first element of the array
 * @param increment The increment for the next value
 * @returns An array of sequential numbers
 */
export const sequentialArray = function(n: number, startAt = 0, increment = 1): number[] {
    if (!Number.isInteger(n) || n < 0) {
        throw 'sequentialArray: Size of the array must be a positive integer';
    }
    const array: number[] = [];
    for (let i = 0; i < n; i++) {
        array.push(i * increment + startAt);
    }
    return array;
};

export default {
    parseIntOrNull,
    parseFloatOrNull,
    roundToDecimals,
    median,
    permutationsWithRepetition,
    sequentialArray
};
