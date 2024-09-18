/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TrRoutingRouteResult } from 'chaire-lib-common/lib/services/trRouting/types';
import { RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { pathNoTransferRouteResult, pathOneTransferRouteResult } from 'chaire-lib-common/lib/test/services/trRouting/TrRoutingConstantsStubs';

// TODO tahini: this is considered a test file, so we need a test, should be a mock
test('Dummy', () => {
	// Dummy test so this file passes, we should have a place to put stub classes
});

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

export const walkingRouteResult: RouteResults = {
	waypoints: [null, null],
	routes: [
		{
			distance: 500,
			duration: 500,
			legs: [],
            geometry: {
                type: 'LineString',
                coordinates: [[-73,45],[-73.02,45.02],[-73.02,45.52]]
            }
		}
	]
};

export const cyclingRouteResult: RouteResults = {
	waypoints: [null, null],
	routes: [
		{
			distance: 550,
			duration: 300,
			legs: [],
            geometry: {
                type: 'LineString',
                coordinates: [[-73,45],[-73.02,45.07],[-73.05,45.7]]
            }
		}
	]
};
