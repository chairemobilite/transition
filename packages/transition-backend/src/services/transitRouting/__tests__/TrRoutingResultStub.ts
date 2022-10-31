/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { TrRoutingResultPath, TrRoutingResultAlternatives } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { RouteResults } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { pathNoTransfer, pathOneTransfer } from 'chaire-lib-common/lib/test/services/trRouting/TrRoutingConstantsStubs';

// TODO tahini: this is considered a test file, so we need a test, should be a mock
test('Dummy', () => {
	// Dummy test so this file passes, we should have a place to put stub classes
});

// A simple path without transfer
export const simplePathResult: TrRoutingResultPath = {
	type: 'path',
	path: pathNoTransfer
}

export const transferPathResult: TrRoutingResultPath = {
	type: 'path',
	path: pathOneTransfer
}

export const alternativesResult: TrRoutingResultAlternatives = {
	type: 'withAlternatives',
	alternatives: [
		{
			alternativeSequence: 1,
			alternativeTotalSequence: 2,
			...pathNoTransfer
		},
		{
			alternativeSequence: 2,
			alternativeTotalSequence: 2,
			...pathOneTransfer
		}
	]
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
