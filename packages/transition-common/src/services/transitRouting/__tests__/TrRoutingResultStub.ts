/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { pathNoTransferRouteResult, pathOneTransferRouteResult } from 'chaire-lib-common/lib/test/services/transitRouting/TrRoutingConstantsStubs';
import { TrRoutingRouteResult } from 'chaire-lib-common/lib/services/transitRouting/types';

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
