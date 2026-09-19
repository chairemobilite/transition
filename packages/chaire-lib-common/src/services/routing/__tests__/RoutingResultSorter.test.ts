/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { UnimodalRoutingResult } from '../RoutingResult';
import { TransitRoutingResult } from '../TransitRoutingResult';
import { getPathDuration, buildSortedIndices } from '../RoutingResultSorter';
import { pathNoTransferRouteResult } from '../../../test/services/transitRouting/TrRoutingConstantsStubs';
import TestUtils from '../../../test/TestUtils';

const origin = TestUtils.makePoint([0, 0]);
const destination = TestUtils.makePoint([1, 1]);

const unimodalResultWithDurations = (durations: number[]) =>
    new UnimodalRoutingResult({
        routingMode: 'walking',
        origin,
        destination,
        paths: durations.map((duration) => ({
            distance: 10,
            duration,
            legs: []
        }))
    });

const transitResultWithTravelTimes = (totalTravelTimes: number[]) =>
    new TransitRoutingResult({
        origin,
        destination,
        paths: totalTravelTimes.map((totalTravelTime) => ({
            ...pathNoTransferRouteResult,
            totalTravelTime
        }))
    });

describe('getPathDuration', () => {
    test('Returns the duration of a Route path', () => {
        const result = unimodalResultWithDurations([123]);
        expect(getPathDuration(result, 0)).toEqual(123);
    });

    test('Returns the totalTravelTime of a non-Route (transit) path', () => {
        const result = transitResultWithTravelTimes([456]);
        expect(getPathDuration(result, 0)).toEqual(456);
    });

    test('Returns Infinity when there is no path at the given index', () => {
        const result = unimodalResultWithDurations([123]);
        expect(getPathDuration(result, 1)).toEqual(Infinity);
    });
});

describe('buildSortedIndices', () => {
    test('Returns an empty array when there are no alternatives', () => {
        const result = unimodalResultWithDurations([]);
        expect(buildSortedIndices(result, 'none')).toEqual([]);
    });

    test('"none" preserves the original order regardless of duration', () => {
        const result = unimodalResultWithDurations([300, 100, 200]);
        expect(buildSortedIndices(result, 'none')).toEqual([0, 1, 2]);
    });

    test('"travelTime" orders indices by ascending duration for Route paths', () => {
        const result = unimodalResultWithDurations([300, 100, 200]);
        expect(buildSortedIndices(result, 'travelTime')).toEqual([1, 2, 0]);
    });

    test('"travelTime" orders indices by ascending totalTravelTime for transit paths', () => {
        const result = transitResultWithTravelTimes([300, 100, 200]);
        expect(buildSortedIndices(result, 'travelTime')).toEqual([1, 2, 0]);
    });
});
