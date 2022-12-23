/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as TrRoutingService from '../../../services/trRouting/TrRoutingService';
import { pathNoTransfer, pathNoTransferRouteResult } from './TrRoutingConstantsStubs';

const mockRouteV1Function: jest.MockedFunction<typeof TrRoutingService.TrRoutingService.prototype.routeV1> = jest.fn();
mockRouteV1Function.mockImplementation(async (_params, _options) => {
    return {
        type: 'path',
        path: pathNoTransfer
    };
});

const mockRouteFunction: jest.MockedFunction<typeof TrRoutingService.TrRoutingService.prototype.route> = jest.fn();
mockRouteFunction.mockImplementation(async (_params) => {
    return {
        routes: [pathNoTransferRouteResult],
        totalRoutesCalculated: 1
    };
});

const mockAccessibleMapFunction: jest.MockedFunction<
    (
        params: TrRoutingService.RoutingQueryOptions,
        options: { [key: string]: unknown }
    ) => Promise<TrRoutingService.TrRoutingResultAccessibilityMap>
> = jest.fn();
mockAccessibleMapFunction.mockImplementation(async (_params, _options) => {
    return {
        type: 'nodes',
        nodes: []
    };
});

const enableMocks = () => {
    // The TrRoutingService module contains a lot of stuff, just mock the main
    // API function of the TrRoutingService class
    TrRoutingService.TrRoutingService.prototype.routeV1 = mockRouteV1Function;
    TrRoutingService.TrRoutingService.prototype.accessibleMap = mockAccessibleMapFunction;
    TrRoutingService.TrRoutingService.prototype.route = mockRouteFunction;
};

const mockClear = () => {
    mockRouteFunction.mockClear();
    mockAccessibleMapFunction.mockClear();
    mockRouteV1Function.mockClear();
};

export default {
    enableMocks,
    mockClear,
    mockRouteV1Function,
    mockRouteFunction,
    mockAccessibleMapFunction
};
