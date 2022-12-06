/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import * as TrRoutingService from '../../../services/trRouting/TrRoutingService';
import { pathNoTransfer } from './TrRoutingConstantsStubs';

// Type the mock method. If the signature changes, this needs to be updated here
// too, otherwise tests may fail (or worse, succeed) without explanation.
const mockRouteFunction: jest.MockedFunction<
    (
        params: TrRoutingService.RoutingQueryOptions,
        options: { [key: string]: unknown }
    ) => Promise<TrRoutingService.TrRoutingResult>
> = jest.fn();
mockRouteFunction.mockImplementation(async (_params, _options) => {
    return {
        type: 'path',
        path: pathNoTransfer
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
    TrRoutingService.TrRoutingService.prototype.route = mockRouteFunction;
    TrRoutingService.TrRoutingService.prototype.accessibleMap = mockAccessibleMapFunction;
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
