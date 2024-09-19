/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TestUtils } from 'chaire-lib-common/lib/test';

import { pathNoTransferRouteResult, pathOneTransferRouteResult } from 'chaire-lib-common/lib/test/services/transitRouting/TrRoutingConstantsStubs';
import { TrRoutingRouteResult } from 'chaire-lib-common/lib/services/transitRouting/types';
import { Routing } from '../Routing';
import { validateAndCreateTripRoutingAttributes } from 'chaire-lib-common/lib/services/routing/RoutingAttributes';
import { TripRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';
import { RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { TransitRoutingResultData } from 'chaire-lib-common/lib/services/routing/TransitRoutingResult';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { UnimodalRoutingResultData } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { TrRoutingV2 } from 'chaire-lib-common/src/api/TrRouting';
import transitRoutingService from '../../transitRouting/TransitRoutingService';
import { getRouteByMode } from 'chaire-lib-common/lib/services/routing/RoutingUtils';

jest.mock('chaire-lib-common/lib/services/routing/RoutingUtils', () => ({
    getRouteByMode: jest.fn()
}));
const mockGetRouteByMode = getRouteByMode as jest.MockedFunction<typeof getRouteByMode>;
jest.mock('../../transitRouting/TransitRoutingService', () => ({
    route: jest.fn()
}));
const mockedRouteFunction = transitRoutingService.route as jest.MockedFunction<typeof transitRoutingService.route>;

// A simple path without transfer
export const simplePathResult: TrRoutingRouteResult = {
	totalRoutesCalculated: 1,
	routes: [pathNoTransferRouteResult]
}

export const transferPathResult: TrRoutingRouteResult = {
	totalRoutesCalculated: 1,
	routes: [pathOneTransferRouteResult]
}

export const alternativesResult: TrRoutingRouteResult = {
	totalRoutesCalculated: 3,
	routes: [pathNoTransferRouteResult, pathOneTransferRouteResult]
}

let attributes: TripRoutingQueryAttributes;

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

describe('Routing Calculations', () => {
    beforeEach(function () {
        jest.clearAllMocks();
        // Arbitrary square points located in the Montreal area
        attributes = validateAndCreateTripRoutingAttributes({
            originGeojson: TestUtils.makePoint([-73.745618, 45.368994]),
            destinationGeojson: TestUtils.makePoint([-73.742861, 45.361682]),
            routingModes: ['transit', 'walking']
        });
    });

    test('simple path without transfer no way point', async () => {
        mockedRouteFunction.mockResolvedValue(simplePathResult);
        mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest)

        const result = await Routing.calculate(attributes);

        expect(mockedRouteFunction).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResultData;

        expect(transitResult.paths.length).toEqual(1);

        expect(transitResult.paths[0]).toEqual(simplePathResult.routes[0]);
        expect(transitResult.walkOnlyPath).toEqual(walkingRouteNoWaypointTest.routes[0]);

        const path1step = (transitResult.paths[0]).steps as TrRoutingV2.TripStep[];
        expect(path1step).toEqual(simplePathResult.routes[0].steps);
        expect(path1step.length).toEqual(simplePathResult.routes[0].steps.length);
        expect(path1step[0].action).toEqual("walking");
        expect(path1step[1].action).toEqual("boarding");
        expect(path1step[2].action).toEqual("unboarding");
        expect(path1step[3].action).toEqual("walking");
    });

    test('simple path without transfer no way point', async () => {
        mockedRouteFunction.mockResolvedValue(simplePathResult);
        mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

        const result = await Routing.calculate(attributes);

        expect(mockedRouteFunction).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResultData;

        expect(transitResult.paths.length).toEqual(1);

        expect(transitResult.paths[0]).toEqual(simplePathResult.routes[0]);
        expect(transitResult.walkOnlyPath).toEqual(walkingRouteNoWaypointTest.routes[0]);

        const path1step = (transitResult.paths[0]).steps as TrRoutingV2.TripStep[];
        expect(path1step).toEqual(simplePathResult.routes[0].steps);
        expect(path1step.length).toEqual(simplePathResult.routes[0].steps.length);
        expect(path1step[0].action).toEqual("walking");
        expect(path1step[1].action).toEqual("boarding");
        expect(path1step[2].action).toEqual("unboarding");
        expect(path1step[3].action).toEqual("walking");
    });

    test('path with transfer no way point', async () => {

        mockedRouteFunction.mockResolvedValue(transferPathResult);
        mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

        const result = await Routing.calculate(attributes);

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResultData;

        expect(mockedRouteFunction).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'walking');

        expect(transitResult.paths.length).toEqual(1);

        expect(transitResult.paths[0]).toEqual(transferPathResult.routes[0]);
        expect(transitResult.walkOnlyPath).toEqual(walkingRouteNoWaypointTest.routes[0]);

        const path1step = (transitResult.paths[0]).steps as TrRoutingV2.TripStep[];
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
        mockedRouteFunction.mockResolvedValue(alternativesResult);
        mockGetRouteByMode.mockResolvedValue(walkingRouteNoWaypointTest);

        const result = await Routing.calculate(attributes);

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResultData;

        expect(mockedRouteFunction).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'walking');

        expect(transitResult.paths.length).toEqual(2);

        expect(transitResult.paths[0]).toEqual(alternativesResult.routes[0]);
        expect(transitResult.paths[1]).toEqual(alternativesResult.routes[1]);
        expect(transitResult.walkOnlyPath).toEqual(walkingRouteNoWaypointTest.routes[0]);
    });

    test('alternative path 60 minutes duration', async () => {
        mockedRouteFunction.mockResolvedValue(alternativesResult);
        mockGetRouteByMode.mockResolvedValue(walkingRoute60MinutesDurationTest);

        const result = await Routing.calculate(attributes);

        expect(mockedRouteFunction).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'walking');

        expect(Object.keys(result)).toEqual(['transit', 'walking']);
        const transitResult = result['transit'] as TransitRoutingResultData;

        expect(transitResult.paths.length).toEqual(2);

        expect(transitResult.paths[0]).toEqual(alternativesResult.routes[0]);
        expect(transitResult.paths[1]).toEqual(alternativesResult.routes[1]);
        expect(transitResult.walkOnlyPath).toBeUndefined();
    });

    test('multiple modes, with correct results', async () => {
        const routingModes = ['transit', 'cycling', 'walking', 'rail'] as RoutingOrTransitMode[];
        attributes.routingModes = routingModes;
        mockedRouteFunction.mockResolvedValue(alternativesResult);
        mockGetRouteByMode.mockResolvedValue(walkingRoute60MinutesDurationTest);

        const result = await Routing.calculate(attributes);

        expect(mockedRouteFunction).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledTimes(3);
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'walking');
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'cycling');
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'rail');

        expect(Object.keys(result)).toEqual(routingModes);
        for (let i = 0; i < routingModes.length; i++) {
            const resultForMode = result[routingModes[i]] as UnimodalRoutingResultData;
            expect(resultForMode).toBeDefined();
            expect(resultForMode.error).toBeUndefined();
        }
    });

    test('multiple modes, with rejected results', async () => {
        const routingModes = ['transit', 'cycling', 'walking', 'rail'] as RoutingOrTransitMode[];
        attributes.routingModes = routingModes;
        mockedRouteFunction.mockRejectedValue(new TrError('test', 'ERRORCODE'));
        mockGetRouteByMode.mockRejectedValueOnce('Just a string');
        mockGetRouteByMode.mockRejectedValue(new TrError('test', 'ERRORCODE'));

        const result = await Routing.calculate(attributes);

        expect(mockedRouteFunction).toHaveBeenCalledTimes(1);
        expect(mockGetRouteByMode).toHaveBeenCalledTimes(3);
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'walking');
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'cycling');
        expect(mockGetRouteByMode).toHaveBeenCalledWith(attributes.originGeojson, attributes.destinationGeojson, 'rail');

        expect(Object.keys(result)).toEqual(routingModes);
        for (let i = 0; i < routingModes.length; i++) {
            const resultForMode = result[routingModes[i]] as UnimodalRoutingResultData;
            expect(resultForMode).toBeDefined();
            expect(resultForMode.error).toBeDefined();
            expect(resultForMode.paths).toEqual([]);
        }
    });
});
