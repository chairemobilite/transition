/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { RoutingResult, UnimodalRoutingResult } from '../RoutingResult';
import { TransitRoutingResult } from '../TransitRoutingResult';
import { SortedRoutingResult } from '../RoutingResultSorter';
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

const expectOrder = (sortedResult: SortedRoutingResult, result: RoutingResult, expectedIndices: number[]) => {
    expect(sortedResult.getAlternativesCount()).toEqual(expectedIndices.length);
    expectedIndices.forEach((originalIndex, position) => {
        expect(sortedResult.getPath(position)).toBe(result.getPath(originalIndex));
    });
};

describe.each([
    ['unimodal', unimodalResultWithDurations],
    ['transit', transitResultWithTravelTimes]
])('SortedRoutingResult with a %s result', (_type: string, makeResult: (travelTimes: number[]) => RoutingResult) => {
    test('"none" preserves the original order', () => {
        const result = makeResult([300, 100, 200]);
        expectOrder(new SortedRoutingResult(result, 'none'), result, [0, 1, 2]);
    });

    test('"travelTime" orders alternatives by ascending travel time', () => {
        const result = makeResult([300, 100, 200]);
        expectOrder(new SortedRoutingResult(result, 'travelTime'), result, [1, 2, 0]);
    });

    test('getPath returns undefined for a position out of range', () => {
        const result = makeResult([300]);
        expect(new SortedRoutingResult(result, 'none').getPath(1)).toBeUndefined();
    });

    test('getPathGeojson gets the geojson of the original alternative at the sorted position', async () => {
        const result = makeResult([300, 100, 200]);
        // One distinct geojson per original alternative, so we can tell which one is returned
        const geojsonByIndex: GeoJSON.FeatureCollection[] = [0, 1, 2].map(() => ({
            type: 'FeatureCollection',
            features: []
        }));
        const getPathGeojsonSpy = jest
            .spyOn(result, 'getPathGeojson')
            .mockImplementation(async (index) => geojsonByIndex[index]);
        const options = { completeData: false };
        const sortedResult = new SortedRoutingResult(result, 'travelTime');

        const expectedIndices = [1, 2, 0];
        for (const [position, originalIndex] of expectedIndices.entries()) {
            expect(await sortedResult.getPathGeojson(position, options)).toBe(geojsonByIndex[originalIndex]);
            expect(getPathGeojsonSpy).toHaveBeenLastCalledWith(originalIndex, options);
        }
    });

    test('getPathGeojson returns undefined for a position out of range', () => {
        const result = makeResult([300]);
        const getPathGeojsonSpy = jest
            .spyOn(result, 'getPathGeojson')
            .mockResolvedValue({ type: 'FeatureCollection', features: [] });

        expect(new SortedRoutingResult(result, 'none').getPathGeojson(1, {})).toBeUndefined();
        expect(getPathGeojsonSpy).not.toHaveBeenCalled();
    });
});
