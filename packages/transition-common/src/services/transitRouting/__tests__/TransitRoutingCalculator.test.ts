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
import { TrRoutingStep } from 'chaire-lib-common/lib/api/TrRouting';
import { TrRoutingResultPath, TrRoutingResultAlternatives } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { TransitRoutingResult } from '../TransitRoutingResult';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { RouteCalculatorResult } from '../RouteCalculatorResult';
import TrError from 'chaire-lib-common/lib/utils/TrError';

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
		mockedTrRouting.mockRouteV1Function.mockResolvedValue(simplePathResult);
        mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest)

		const result = await TransitRoutingCalculator.calculate(transitRouting);
		const simplePathResultPath = simplePathResult as TrRoutingResultPath;

		expect(mockedTrRouting.mockRouteV1Function).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

		expect(transitResult.getPath(1)).toEqual(simplePathResultPath.path);
		expect(transitResult.getPath(2)).toEqual(undefined);

		const path1step = transitResult.getPath(1)?.steps as TrRoutingStep[];
		expect(path1step).toEqual(simplePathResultPath.path.steps);
		expect(path1step.length).toEqual(simplePathResultPath.path.steps.length);
		expect(path1step[0].action).toEqual("walking");
		expect(path1step[1].action).toEqual("board");
		expect(path1step[2].action).toEqual("unboard");
		expect(path1step[3].action).toEqual("walking");
	});

    test('simple path without transfer no way point', async () => {
		mockedTrRouting.mockRouteV1Function.mockResolvedValue(simplePathResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);
		const simplePathResultPath = simplePathResult as TrRoutingResultPath;

		expect(mockedTrRouting.mockRouteV1Function).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

		expect(transitResult.getPath(1)).toEqual(simplePathResultPath.path);
		expect(transitResult.getPath(2)).toEqual(undefined);

		const path1step = transitResult.getPath(1)?.steps as TrRoutingStep[];
		expect(path1step).toEqual(simplePathResultPath.path.steps);
		expect(path1step.length).toEqual(simplePathResultPath.path.steps.length);
		expect(path1step[0].action).toEqual("walking");
		expect(path1step[1].action).toEqual("board");
		expect(path1step[2].action).toEqual("unboard");
		expect(path1step[3].action).toEqual("walking");
	});

	test('path with transfer no way point', async () => {

		mockedTrRouting.mockRouteV1Function.mockResolvedValue(transferPathResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);
		const transferPathResultPath = transferPathResult as TrRoutingResultPath;

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(mockedTrRouting.mockRouteV1Function).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

        expect(transitResult.getPath(0)).toEqual(undefined);
		expect(transitResult.getPath(1)).toEqual(transferPathResultPath.path);
		expect(transitResult.getPath(2)).toEqual(undefined);

		const path1step = transitResult.getPath(1)?.steps as TrRoutingStep[];
		expect(path1step.length).toEqual(transferPathResultPath.path.steps.length);
		expect(path1step[0].action).toEqual("walking");
		expect(path1step[1].action).toEqual("board");
		expect(path1step[2].action).toEqual("unboard");
		expect(path1step[3].action).toEqual("walking");
		expect(path1step[4].action).toEqual("board");
		expect(path1step[5].action).toEqual("unboard");
		expect(path1step[6].action).toEqual("walking");
	});

	test('alternative path', async () => {
		mockedTrRouting.mockRouteV1Function.mockResolvedValue(alternativesResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);
		const alternativesResultPath = alternativesResult as TrRoutingResultAlternatives;

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(mockedTrRouting.mockRouteV1Function).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(3);

		const simplePathResultPath = alternativesResult.alternatives[0];
		const transferPathResultPath = alternativesResult.alternatives[1];

		expect(transitResult.getPath(0)).toEqual(undefined);
		expect(transitResult.getPath(1)).toEqual(simplePathResultPath);
		expect(transitResult.getPath(2)).toEqual(transferPathResultPath);
	});

    test('alternative path 60 minutes duration', async () => {
		mockedTrRouting.mockRouteV1Function.mockResolvedValue(alternativesResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRoute60MinutesDurationTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteV1Function).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResult;

		expect(transitResult.hasAlternatives()).toEqual(true);
		expect(transitResult.getAlternativesCount()).toEqual(2);

		const simplePathResultPath = alternativesResult.alternatives[0];
		const transferPathResultPath = alternativesResult.alternatives[1];

		expect(transitResult.getPath(0)).toEqual(simplePathResultPath);
		expect(transitResult.getPath(1)).toEqual(transferPathResultPath);
		expect(transitResult.getPath(2)).toEqual(undefined);
    });

    test('multiple modes, with correct results', async () => {
        const routingModes = ['transit', 'cycling', 'walking', 'rail'] as RoutingOrTransitMode[];
        transitRouting.attributes.routingModes = routingModes;
		mockedTrRouting.mockRouteV1Function.mockResolvedValue(alternativesResult);
		mockedRoutingUtils.mockGetRouteByMode.mockResolvedValue(walkingRoute60MinutesDurationTest);

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteV1Function).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(3);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'cycling');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'rail');

        expect(Object.keys(result)).toEqual(routingModes);
        for (let i = 0; i < routingModes.length; i++) {
            const resultForMode = result[routingModes[i]] as RouteCalculatorResult;
            expect(resultForMode).toBeDefined();
            expect(resultForMode.hasError()).toBeFalsy();
            expect(resultForMode.getError()).toBeUndefined();
        }
    });

    test('multiple modes, with rejected results', async () => {
        const routingModes = ['transit', 'cycling', 'walking', 'rail'] as RoutingOrTransitMode[];
        transitRouting.attributes.routingModes = routingModes;
		mockedTrRouting.mockRouteV1Function.mockRejectedValue(new TrError('test', 'ERRORCODE'));
        mockedRoutingUtils.mockGetRouteByMode.mockRejectedValueOnce('Just a string');
		mockedRoutingUtils.mockGetRouteByMode.mockRejectedValue(new TrError('test', 'ERRORCODE'));

		const result = await TransitRoutingCalculator.calculate(transitRouting);

		expect(mockedTrRouting.mockRouteV1Function).toHaveBeenCalledTimes(1);
		expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledTimes(3);
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'walking');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'cycling');
        expect(mockedRoutingUtils.mockGetRouteByMode).toHaveBeenCalledWith(transitRouting.attributes.originGeojson, transitRouting.attributes.destinationGeojson, 'rail');

        expect(Object.keys(result)).toEqual(routingModes);
        for (let i = 0; i < routingModes.length; i++) {
            const resultForMode = result[routingModes[i]] as RouteCalculatorResult;
            expect(resultForMode).toBeDefined();
            expect(resultForMode.hasError()).toBeTruthy();
            expect(resultForMode.getError()).toBeDefined();
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
