/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { RouteResults } from '../../../services/routing/RoutingService';

const mockGetRouteByMode: jest.MockedFunction<(
    origin: GeoJSON.Feature<GeoJSON.Point>,
    destination: GeoJSON.Feature<GeoJSON.Point>
) => Promise<RouteResults>> = jest.fn();
mockGetRouteByMode.mockImplementation(async (_origin, _destination) => {
    console.log('Mocking RoutingUtils.getRouteByMode');
    return {
        waypoints: [],
        routes: []
    };
});

const enableMocks = () => {
    jest.mock('../../../../lib/services/routing/RoutingUtils', () => ({
        getRouteByMode: mockGetRouteByMode
    }));
};

const mockClear = () => {
    mockGetRouteByMode.mockClear();
};

export default {
    enableMocks,
    mockClear,
    mockGetRouteByMode
};
