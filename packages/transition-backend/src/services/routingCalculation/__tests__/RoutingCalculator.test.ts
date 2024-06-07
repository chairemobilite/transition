/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { TransitAccessibilityMapCalculator } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import { calculateAccessibilityMap, calculateRoute } from '../RoutingCalculator';
import { Routing } from 'chaire-lib-backend/lib/services/routing/Routing';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { pathNoTransferRouteResult, pathOneTransferRouteResult } from 'chaire-lib-common/lib/test/services/trRouting/TrRoutingConstantsStubs';
import TestUtils from 'chaire-lib-common/src/test/TestUtils';
import { TransitRoutingResult } from 'chaire-lib-common/lib/services/routing/TransitRoutingResult';

jest.mock('transition-common/lib/services/nodes/NodeCollection');
jest.mock('transition-common/lib/services/path/PathCollection');
// Mock the route calculation function
jest.mock('chaire-lib-backend/lib/services/routing/Routing', () => ({
    Routing: {
        calculate: jest.fn()
    }
}));
const mockedCalculate = Routing.calculate as jest.MockedFunction<typeof Routing.calculate>;
// Mock the transit result getPathGeojson function to return just an empty feature collection
TransitRoutingResult.prototype.getPathGeojson = jest.fn();
const mockedGetTransitPathGeojson = TransitRoutingResult.prototype.getPathGeojson as jest.MockedFunction<typeof TransitRoutingResult.prototype.getPathGeojson>;
mockedGetTransitPathGeojson.mockResolvedValue({ type: 'FeatureCollection', features: [] });

beforeEach(() => {
    jest.clearAllMocks();
});

test('calculateAccessibilityMap, without geojson', async () => {
    const routingResult = 'routingResult';
    
    trRoutingProcessManager.status = jest.fn().mockResolvedValue({
        status: 'started'
    } as any);
    TransitAccessibilityMapCalculator.calculate = jest.fn().mockResolvedValue({
        routingResult: routingResult 
    } as any);

    const result = await calculateAccessibilityMap({} as any, false);

    expect(result).toStrictEqual({resultByNode: routingResult});
    expect(TransitAccessibilityMapCalculator.calculate).toBeCalled();
});

test('calculateAccessibilityMap, with geojson', async () => {
    const expectedResult = {
        polygons: 'polygons',
        strokes: 'strokes',
        resultByNode: 'resultByNode',
    };

    const mockLoadFromServer = jest.fn(() => Promise.resolve());
    
    trRoutingProcessManager.status = jest.fn().mockResolvedValue({
        status: 'started'
    } as any);
    (NodeCollection as any).mockImplementation(() => {
        return {
            loadFromServer: mockLoadFromServer
        }
    });
    TransitAccessibilityMapCalculator.calculateWithPolygons = jest.fn().mockResolvedValue(expectedResult as any);

    const result = await calculateAccessibilityMap({} as any, true);

    expect(result).toStrictEqual(expectedResult);
    expect(mockLoadFromServer).toBeCalled();
    expect(TransitAccessibilityMapCalculator.calculateWithPolygons).toBeCalled();
});

describe('calculateRoute', () => {
    // Constants for route responses
    const origin = TestUtils.makePoint([1, 1]);
    const destination = TestUtils.makePoint([2, 2]);
    const attributes = {
        originGeojson: origin,
        destinationGeojson: destination,
        routingModes: ['transit' as const, 'walking' as const, 'driving' as const],
        engines: [],
        timeSecondsSinceMidnight: 0,
        timeType: 'departure' as const,
        withAlternatives: false
    };

    const walkingRouteNoWaypointTest = {
        distance: 500,
        duration: 500,
        legs: [],
        geometry: { type: 'LineString' as const, coordinates: [[1, 1], [2, 2]]}
    };

    const drivingRouteTest = {
        distance: 20000,
        duration: 3600,
        legs: [],
        geometry: { type: 'LineString' as const, coordinates: [[1, 1], [1, 2], [2, 2]]}
    };


    test('calculateRoute, without geojson', async () => {
        const resultsByMode = {
            transit: {
                origin,
                destination,
                paths: [pathNoTransferRouteResult],
                walkOnlyPath: undefined,
                error: undefined
            },
            walking: {
                origin,
                destination,
                paths: [walkingRouteNoWaypointTest],
                routingMode: 'walking' as const,
                error: undefined
            },
            driving: {
                origin,
                destination,
                paths: [drivingRouteTest],
                routingMode: 'driving' as const,
                error: undefined
            },
        }
        
        trRoutingProcessManager.status = jest.fn().mockResolvedValue({
            status: 'started'
        } as any);
        mockedCalculate.mockResolvedValue(resultsByMode);

        const result = await calculateRoute(attributes, false);

        expect(result).toStrictEqual(resultsByMode);
        expect(mockedCalculate).toHaveBeenCalledWith(attributes);
    });

    test('calculateRoute, with geojson', async () => {
        const resultsByMode = {
            transit: {
                origin,
                destination,
                paths: [pathNoTransferRouteResult],
                walkOnlyPath: undefined,
                error: undefined
            },
            walking: {
                origin,
                destination,
                paths: [walkingRouteNoWaypointTest],
                routingMode: 'walking' as const,
                error: undefined
            },
            driving: {
                origin,
                destination,
                paths: [drivingRouteTest],
                routingMode: 'driving' as const,
                error: undefined
            },
        }
        
        const mockLoadFromServer = jest.fn(() => Promise.resolve());

        trRoutingProcessManager.status = jest.fn().mockResolvedValue({
            status: 'started'
        } as any);
        mockedCalculate.mockResolvedValue(resultsByMode);
        (PathCollection as any).mockImplementation(() => {
            return {
                loadFromServer: mockLoadFromServer
            }
        });

        const result = await calculateRoute(attributes, true);

        // Routing result unit test have tested the geometry generation, we just make sure it exists in this case
        expect(result).toStrictEqual({
            transit: {
                ...resultsByMode.transit,
                pathsGeojson: expect.anything()
            },
            walking: {
                ...resultsByMode.walking,
                pathsGeojson: expect.anything()
            },
            driving: {
                ...resultsByMode.driving,
                pathsGeojson: expect.anything()
            }
        });
        expect(mockedCalculate).toHaveBeenCalledWith(attributes);
        // Get path geojson should have been called once
        expect(mockedGetTransitPathGeojson).toHaveBeenCalledTimes(1);
        expect(mockLoadFromServer).toBeCalled();
    });

    test('calculateRoute, with geojson and alternatives', async () => {
        const resultsByMode = {
            transit: {
                origin,
                destination,
                paths: [pathNoTransferRouteResult, pathOneTransferRouteResult],
                walkOnlyPath: walkingRouteNoWaypointTest,
                error: undefined
            },
            walking: {
                origin,
                destination,
                paths: [walkingRouteNoWaypointTest],
                routingMode: 'walking' as const,
                error: undefined
            },
            driving: {
                origin,
                destination,
                paths: [drivingRouteTest],
                routingMode: 'driving' as const,
                error: undefined
            },
        }

        const mockLoadFromServer = jest.fn(() => Promise.resolve());
        
        trRoutingProcessManager.status = jest.fn().mockResolvedValue({
            status: 'started'
        } as any);
        mockedCalculate.mockResolvedValue(resultsByMode);
        (PathCollection as any).mockImplementation(() => {
            return {
                loadFromServer: mockLoadFromServer
            }
        });

        const result = await calculateRoute(attributes, true);

        // Routing result unit test have tested the geometry generation, we just make sure it exists in this case
        expect(result).toStrictEqual({
            transit: {
                ...resultsByMode.transit,
                pathsGeojson: expect.anything()
            },
            walking: {
                ...resultsByMode.walking,
                pathsGeojson: expect.anything()
            },
            driving: {
                ...resultsByMode.driving,
                pathsGeojson: expect.anything()
            }
        });
        expect(mockedCalculate).toHaveBeenCalledWith(attributes);
        // Get path geojson should have been called for each alternative, including walk only
        expect(mockedGetTransitPathGeojson).toHaveBeenCalledTimes(3);
        expect(mockLoadFromServer).toBeCalled();
    });
});
