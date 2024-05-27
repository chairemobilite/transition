/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { default as mockedRoutingUtils } from 'chaire-lib-common/lib/test/services/routing/RoutingUtilsMock';
import { default as mockedTrRouting } from 'chaire-lib-common/lib/test/services/trRouting/TrRoutingServiceMock';
import { TestUtils } from 'chaire-lib-common/lib/test';

import { simplePathResult, transferPathResult, alternativesResult } from './TrRoutingResultStub';
import { TransitRoutingCalculator } from '../TransitRoutingCalculator';
import { TransitRouting, TransitRoutingAttributes } from '../TransitRouting';
import { RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { TransitRoutingResult } from '../TransitRoutingResult';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { UnimodalRoutingResult } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { TrRoutingV2 } from 'chaire-lib-common/src/api/TrRouting';

let attributes: TransitRoutingAttributes;
let transitRouting: TransitRouting;

describe('TransitRoutingCalculator', () => {
    beforeEach(function () {
        // Arbitrary square polygon located in the Montreal
        const routing = new TransitRouting({});
        const batchRoutingQueries = routing.getAttributes().savedForBatch;
        attributes = {
            id: '000',
            is_frozen: false,
            originGeojson: TestUtils.makePoint([-73.745618, 45.368994]),
            destinationGeojson: TestUtils.makePoint([-73.742861, 45.361682]),
            data: {},
            savedForBatch: batchRoutingQueries,
            routingModes: ['transit']
        };

        transitRouting = new TransitRouting(attributes, true);
    });

    afterEach(function () {
        mockedTrRouting.mockClear();
        mockedRoutingUtils.mockClear();
    });

	test('simple path without transfer no way point', async () => {
		mockedTrRouting.mockRouteFunction.mockResolvedValue(simplePathResult);
        mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest)

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteFunction).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

		expect(transitResult.getPath(1)).toEqual(simplePathResult.routes[0]);
		expect(transitResult.getPath(2)).toEqual(undefined);

		const path1step = transitResult.getPath(1)?.steps as TrRoutingV2.TripStep[];
		expect(path1step).toEqual(simplePathResult.routes[0].steps);
		expect(path1step.length).toEqual(simplePathResult.routes[0].steps.length);
		expect(path1step[0].action).toEqual("walking");
		expect(path1step[1].action).toEqual("boarding");
		expect(path1step[2].action).toEqual("unboarding");
		expect(path1step[3].action).toEqual("walking");
	});

    test('simple path without transfer no way point', async () => {
		mockedTrRouting.mockRouteFunction.mockResolvedValue(simplePathResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteFunction).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

		expect(transitResult.getPath(1)).toEqual(simplePathResult.routes[0]);
		expect(transitResult.getPath(2)).toEqual(undefined);

		const path1step = transitResult.getPath(1)?.steps as TrRoutingV2.TripStep[];
		expect(path1step).toEqual(simplePathResult.routes[0].steps);
		expect(path1step.length).toEqual(simplePathResult.routes[0].steps.length);
		expect(path1step[0].action).toEqual("walking");
		expect(path1step[1].action).toEqual("boarding");
		expect(path1step[2].action).toEqual("unboarding");
		expect(path1step[3].action).toEqual("walking");
	});

	test('path with transfer no way point', async () => {

		mockedTrRouting.mockRouteFunction.mockResolvedValue(transferPathResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(mockedTrRouting.mockRouteFunction).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

        expect(transitResult.getPath(0)).toEqual(undefined);
		expect(transitResult.getPath(1)).toEqual(transferPathResult.routes[0]);
		expect(transitResult.getPath(2)).toEqual(undefined);

		const path1step = transitResult.getPath(1)?.steps as TrRoutingV2.TripStep[];
		expect(path1step.length).toEqual(transferPathResult.routes[0].steps.length);
		expect(path1step[0].action).toEqual("walking");
		expect(path1step[1].action).toEqual("boarding");
		expect(path1step[2].action).toEqual("unboarding");
		expect(path1step[3].action).toEqual("walking");
		expect(path1step[4].action).toEqual("boarding");
		expect(path1step[5].action).toEqual("unboarding");
		expect(path1step[6].action).toEqual("walking");
	});

	test('alternative path', async () => {
		mockedTrRouting.mockRouteFunction.mockResolvedValue(alternativesResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(mockedTrRouting.mockRouteFunction).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(3);

		const simplePathResultPath = alternativesResult.routes[0];
		const transferPathResultPath = alternativesResult.routes[1];

		expect(transitResult.getPath(0)).toEqual(undefined);
		expect(transitResult.getPath(1)).toEqual(simplePathResultPath);
		expect(transitResult.getPath(2)).toEqual(transferPathResultPath);
	});

    test('alternative path 60 minutes duration', async () => {
		mockedTrRouting.mockRouteFunction.mockResolvedValue(alternativesResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRoute60MinutesDurationTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteFunction).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

		const simplePathResultPath = alternativesResult.routes[0];
		const transferPathResultPath = alternativesResult.routes[1];

		expect(transitResult.getPath(0)).toEqual(simplePathResultPath);
		expect(transitResult.getPath(1)).toEqual(transferPathResultPath);
		expect(transitResult.getPath(2)).toEqual(undefined);
    });

    test('multiple modes, with correct results', async () => {
        const routingModes = ['transit', 'cycling', 'walking', 'rail'] as RoutingOrTransitMode[];
        transitRouting.attributes.routingModes = routingModes;
		mockedTrRouting.mockRouteFunction.mockResolvedValue(alternativesResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRoute60MinutesDurationTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteFunction).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(3);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'cycling');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'rail');

        expect(Object.keys(result)).toEqual(routingModes);
        for (let i = 0; i < routingModes.length; i++) {
            const resultForMode = result[routingModes[i]] as UnimodalRoutingResult;
            expect(resultForMode).toBeDefined();
            expect(resultForMode.hasError()).toBeFalsy();
            expect(resultForMode.getError()).toBeUndefined();
        }
    });

    test('multiple modes, with rejected results', async () => {
        const routingModes = ['transit', 'cycling', 'walking', 'rail'] as RoutingOrTransitMode[];
        transitRouting.attributes.routingModes = routingModes;
		mockedTrRouting.mockRouteFunction.mockRejectedValue(new TrError('test', 'ERRORCODE'));
        mockedRoutingUtils.mockGetRouteByMode.mockRejectedValueOnce('Just a string');
		mockedRoutingUtils.mockGetRouteByMode.mockRejectedValue(new TrError('test', 'ERRORCODE'));

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteFunction).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(3);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'cycling');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'rail');

        expect(Object.keys(result)).toEqual(routingModes);
        for (let i = 0; i < routingModes.length; i++) {
            const resultForMode = result[routingModes[i]] as UnimodalRoutingResult;
            expect(resultForMode).toBeDefined();
            expect(resultForMode.hasError()).toBeTruthy();
            expect(TrError.isTrError(resultForMode.getError())).toBe(true);
        }
    });
});

const walkingRouteNoWaypointTest: RouteResults = {
	waypoints: [null, null],
	routes: [
		{
			distance: 500,
			duration: 500,
			legs: []
		}
	]
};

const walkingRoute60MinutesDurationTest: RouteResults = {
	waypoints: [null, null],
	routes: [
		{
			distance: 500,
			duration: 3600,
			legs: []
		}
	]
};
