/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { pathNoTransfer, pathOneTransfer } from 'chaire-lib-common/lib/test/services/trRouting/TrRoutingConstantsStubs';
import {  TrRoutingResultPath, TrRoutingResultAlternatives } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';

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
			alternativeTotalSequence: 1,
			...pathNoTransfer
		},
		{
			alternativeSequence: 1,
			alternativeTotalSequence: 1,
			...pathOneTransfer
		}
	]
}
