/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as TrRoutingService from '../../../services/transitRouting/TransitRoutingService';
import { pathNoTransferRouteResult } from './TrRoutingConstantsStubs';

const mockRouteFunction: jest.MockedFunction<typeof TrRoutingService.TrRoutingService.prototype.route> = jest.fn();
mockRouteFunction.mockImplementation(async (_params) => {
    return {
        routes: [pathNoTransferRouteResult],
        totalRoutesCalculated: 1
    };
});

const mockAccessibleMapFunction: jest.MockedFunction<typeof TrRoutingService.TrRoutingService.prototype.accessibleMap> =
    jest.fn();
mockAccessibleMapFunction.mockImplementation(async (_params, _options) => {
    return {
        type: 'nodes',
        nodes: []
    };
});

const enableMocks = () => {
    // The TrRoutingService module contains a lot of stuff, just mock the main
    // API function of the TrRoutingService class
    TrRoutingService.TrRoutingService.prototype.accessibleMap = mockAccessibleMapFunction;
    TrRoutingService.TrRoutingService.prototype.route = mockRouteFunction;
};

const mockClear = () => {
    mockRouteFunction.mockClear();
    mockAccessibleMapFunction.mockClear();
};

export default {
    enableMocks,
    mockClear,
    mockRouteFunction,
    mockAccessibleMapFunction
};
