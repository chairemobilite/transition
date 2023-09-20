/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { pathNoTransferRouteResult, pathNoTransfer } from '../../../test/services/trRouting/TrRoutingConstantsStubs';
import { routeToUserObject } from '../TrRoutingResultConversion';

test('Test result conversion', () => {
    // Change the few differences with the old path no transfer
    const expected = _cloneDeep(pathNoTransfer) as any;
    delete expected.optimizeCases;
    delete expected.status;
    expected.steps.forEach(step => {
        step.action = step.action === 'board' ? 'boarding' : step.action === 'unboard' ? 'unboarding' : step.action;
        if (step.action === 'walking' && step.readyToBoardAt === undefined) {
            step.readyToBoardAt = undefined;
            step.readyToBoardAtSeconds = undefined;
        }
    });
    expect(routeToUserObject(pathNoTransferRouteResult)).toEqual(expected);
});

// TODO Cannot test the path with transfer because its data is all wrong. Make a real path first