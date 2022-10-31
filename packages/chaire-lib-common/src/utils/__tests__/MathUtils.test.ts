/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MathUtils from '../MathUtils';

test('should parse integer or null', function() {
    expect(MathUtils.parseIntOrNull('6')).toBe(6);
    expect(MathUtils.parseIntOrNull('-6')).toBe(-6);
    expect(MathUtils.parseIntOrNull(6)).toBe(6);
    expect(MathUtils.parseIntOrNull(-6)).toBe(-6);
    expect(MathUtils.parseIntOrNull(6.223)).toBe(null);
    expect(MathUtils.parseIntOrNull('6.223')).toBe(null);
    expect(MathUtils.parseIntOrNull('test')).toBe(null);
    expect(MathUtils.parseIntOrNull('a2344')).toBe(null);
    expect(MathUtils.parseIntOrNull('2344a')).toBe(null);
    expect(MathUtils.parseIntOrNull(NaN)).toBe(null);
    expect(MathUtils.parseIntOrNull(Infinity)).toBe(null);
});

test('should parse float or null', function() {
    expect(MathUtils.parseFloatOrNull('6.23')).toBe(6.23);
    expect(MathUtils.parseFloatOrNull('-6.23')).toBe(-6.23);
    expect(MathUtils.parseFloatOrNull(6.23)).toBe(6.23);
    expect(MathUtils.parseFloatOrNull(-6.23)).toBe(-6.23);
    expect(MathUtils.parseFloatOrNull(6)).toBe(6.0);
    expect(MathUtils.parseFloatOrNull('test')).toBe(null);
    expect(MathUtils.parseFloatOrNull('a2344')).toBe(null);
    expect(MathUtils.parseFloatOrNull(NaN)).toBe(null);
    expect(MathUtils.parseFloatOrNull(Infinity)).toBe(null);
});

test('should round to nearest decimal', function() {
    expect(MathUtils.roundToDecimals(6.23, 1)).toBe(6.2);
    expect(MathUtils.roundToDecimals(6.0, 0)).toBe(6);
    expect(MathUtils.roundToDecimals(6.0, 0.5)).toBe(null);
    expect(MathUtils.roundToDecimals(-56.5765876, 3)).toBe(-56.577);
    expect(MathUtils.roundToDecimals(5764.57, -4)).toBe(10000);
    expect(MathUtils.roundToDecimals(5764.57, -5)).toBe(0);
    expect(MathUtils.roundToDecimals(-234, -2)).toBe(-200);
    expect(MathUtils.roundToDecimals(Infinity, 2)).toBe(null);
    expect(MathUtils.roundToDecimals('6.0', 0)).toBe(6);
    expect(MathUtils.roundToDecimals('5764.57', -4)).toBe(10000);
});

test('should get median from array', function() {
    const array = [200, -234.45, 340, 560.34, 5000, 12000];
    expect(MathUtils.median(array)).toBe(450.17);
    expect(MathUtils.median([])).toBe(NaN);
    expect(MathUtils.median([1])).toBe(1);
    expect(MathUtils.median([1, 2])).toBe(1.5);
    expect(MathUtils.median([1, 2, 3])).toBe(2);
});


test('should generate permutations with repetitions', function() {
    const values1 = ['a', 'b', 'c'];
    const values2 = [];
    expect(MathUtils.permutationsWithRepetition(values1, 1)).toEqual([['a'],['b'],['c']]);
    expect(MathUtils.permutationsWithRepetition(values1, 2)).toEqual([
        [ 'a', 'a' ],
        [ 'a', 'b' ],
        [ 'a', 'c' ],
        [ 'b', 'a' ],
        [ 'b', 'b' ],
        [ 'b', 'c' ],
        [ 'c', 'a' ],
        [ 'c', 'b' ],
        [ 'c', 'c' ]
    ]);
    expect(MathUtils.permutationsWithRepetition(values1, 3)).toEqual([
        [ 'a', 'a', 'a' ], [ 'a', 'a', 'b' ],
        [ 'a', 'a', 'c' ], [ 'a', 'b', 'a' ],
        [ 'a', 'b', 'b' ], [ 'a', 'b', 'c' ],
        [ 'a', 'c', 'a' ], [ 'a', 'c', 'b' ],
        [ 'a', 'c', 'c' ], [ 'b', 'a', 'a' ],
        [ 'b', 'a', 'b' ], [ 'b', 'a', 'c' ],
        [ 'b', 'b', 'a' ], [ 'b', 'b', 'b' ],
        [ 'b', 'b', 'c' ], [ 'b', 'c', 'a' ],
        [ 'b', 'c', 'b' ], [ 'b', 'c', 'c' ],
        [ 'c', 'a', 'a' ], [ 'c', 'a', 'b' ],
        [ 'c', 'a', 'c' ], [ 'c', 'b', 'a' ],
        [ 'c', 'b', 'b' ], [ 'c', 'b', 'c' ],
        [ 'c', 'c', 'a' ], [ 'c', 'c', 'b' ],
        [ 'c', 'c', 'c' ]
    ]);
    expect(MathUtils.permutationsWithRepetition(values2, 4)).toEqual([]);
  
    expect(MathUtils.permutationsWithRepetition(values1, 2, ['c'])).toEqual([
        [ 'a', 'a' ],
        [ 'a', 'b' ],
        [ 'b', 'a' ],
        [ 'b', 'b' ]
    ]);

    expect(MathUtils.permutationsWithRepetition(values1, 2, ['c'], false)).toEqual([
        [ 'a', 'b' ],
        [ 'b', 'a' ]
    ]);
  
    expect(MathUtils.permutationsWithRepetition(values1, 1, ['c'])).toEqual([
        [ 'a'],
        [ 'b']
    ]);
  
    expect(MathUtils.permutationsWithRepetition([], 1, ['c'])).toEqual([]);
    expect(MathUtils.permutationsWithRepetition(['a'], 1, ['c'])).toEqual([['a']]);
    expect(MathUtils.permutationsWithRepetition(['a'], 1, ['a'])).toEqual([]);
});

test('should get sequential array', function() {
    expect(MathUtils.sequentialArray(0)).toEqual([]);
    expect(() => MathUtils.sequentialArray(-1)).toThrowError('sequentialArray: Size of the array must be a positive integer');
    expect(() => MathUtils.sequentialArray(-1.5)).toThrowError('sequentialArray: Size of the array must be a positive integer');
    expect(() => MathUtils.sequentialArray(1.5)).toThrowError('sequentialArray: Size of the array must be a positive integer');
    expect(() => MathUtils.sequentialArray(Infinity)).toThrowError('sequentialArray: Size of the array must be a positive integer');
    expect(MathUtils.sequentialArray(1)).toEqual([0]);
    expect(MathUtils.sequentialArray(1, 345)).toEqual([345]);
    expect(MathUtils.sequentialArray(4)).toEqual([0,1,2,3]);
    expect(MathUtils.sequentialArray(4, 1)).toEqual([1,2,3,4]);
    expect(MathUtils.sequentialArray(4, 1, 2)).toEqual([1,3,5,7]);
    expect(MathUtils.sequentialArray(4, 2, 2)).toEqual([2,4,6,8]);
    expect(MathUtils.sequentialArray(5, 1.5, 0.5)).toEqual([1.5,2,2.5,3,3.5]);
});