/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import trRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import { TransitAccessibilityMapCalculator } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapCalculator';
import { calculateAccessibilityMap, calculateRoute } from '../RoutingCalculator';
import transitObjectDataHandlers from '../../transitObjects/TransitObjectsDataHandler';
import { TransitRoutingCalculator } from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';

jest.mock('transition-common/lib/services/nodes/NodeCollection');
jest.mock('transition-common/lib/services/path/PathCollection');

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
    
    trRoutingProcessManager.status = jest.fn().mockResolvedValue({
        status: 'started'
    } as any);
    transitObjectDataHandlers.nodes.geojsonCollection! = jest.fn().mockResolvedValue({
        geojson: {
            features: 'features'
        }
    });
    TransitAccessibilityMapCalculator.calculateWithPolygons = jest.fn().mockResolvedValue(expectedResult as any);

    const result = await calculateAccessibilityMap({} as any, true);

    expect(result).toStrictEqual(expectedResult);
    expect(transitObjectDataHandlers.nodes.geojsonCollection).toBeCalled();
    expect(TransitAccessibilityMapCalculator.calculateWithPolygons).toBeCalled();
});

test('calculateRoute, without geojson', async () => {
    const transitResult = 'transitResult';
    const walkingResult = 'walkingResult';
    const drivingResult = 'drivingResult';

    const resultsByMode = {
        transit: {
            getParams: () => transitResult
        },
        walking: {
            getParams: () => walkingResult
        },
        driving: {
            getParams: () => drivingResult
        },
    }
    
    trRoutingProcessManager.status = jest.fn().mockResolvedValue({
        status: 'started'
    } as any);
    TransitRoutingCalculator.calculate = jest.fn().mockResolvedValue(resultsByMode);

    const result = await calculateRoute({} as any, false);

    expect(result).toStrictEqual({
        transit: transitResult,
        walking: walkingResult,
        driving: drivingResult
    });
    expect(TransitRoutingCalculator.calculate).toBeCalled();
});

test('calculateRoute, with geojson', async () => {
    const transitResult = 'transitResult';
    const walkingResult = 'walkingResult';
    const drivingResult = 'drivingResult';
    const transitGeojson = 'transitGeojson';
    const walkingGeojson = 'walkingGeojson';
    const drivingGeojson = 'drivingGeojson';

    const resultsByMode = {
        transit: {
            getParams: () =>  {
                return { result: transitResult }
            },
            getAlternativesCount: () => 1,
            getPathGeojson: async () => transitGeojson
        },
        walking: {
            getParams: () => {
                return { result: walkingResult }
            },
            getAlternativesCount: () => 1,
            getPathGeojson: async () => walkingGeojson
        },
        driving: {
            getParams: () => {
                return { result: drivingResult }
            },
            getAlternativesCount: () => 1,
            getPathGeojson: async () => drivingGeojson
        },
    }
    
    trRoutingProcessManager.status = jest.fn().mockResolvedValue({
        status: 'started'
    } as any);
    TransitRoutingCalculator.calculate = jest.fn().mockResolvedValue(resultsByMode);
    transitObjectDataHandlers.paths.geojsonCollection! = jest.fn().mockResolvedValue({
        geojson: {
            features: 'features'
        }
    });

    const result = await calculateRoute({} as any, true);

    expect(result).toStrictEqual({
        transit: {
            result: transitResult,
            pathsGeojson: [transitGeojson]
        },
        walking: {
            result: walkingResult,
            pathsGeojson: [walkingGeojson]
        },
        driving: {
            result: drivingResult,
            pathsGeojson: [drivingGeojson]
        }
    });
    expect(TransitRoutingCalculator.calculate).toBeCalled();
});

test('calculateRoute, with geojson and alternatives', async () => {
    const transitResult = 'transitResult';
    const walkingResult = 'walkingResult';
    const drivingResult = 'drivingResult';
    const transitGeojson = 'transitGeojson';
    const walkingGeojson = 'walkingGeojson';
    const drivingGeojson = 'drivingGeojson';

    const resultsByMode = {
        transit: {
            getParams: () =>  {
                return { result: transitResult }
            },
            getAlternativesCount: () => 3,
            getPathGeojson: async () => transitGeojson
        },
        walking: {
            getParams: () => {
                return { result: walkingResult }
            },
            getAlternativesCount: () => 2,
            getPathGeojson: async () => walkingGeojson
        },
        driving: {
            getParams: () => {
                return { result: drivingResult }
            },
            getAlternativesCount: () => 4,
            getPathGeojson: async () => drivingGeojson
        },
    }
    
    trRoutingProcessManager.status = jest.fn().mockResolvedValue({
        status: 'started'
    } as any);
    TransitRoutingCalculator.calculate = jest.fn().mockResolvedValue(resultsByMode);
    transitObjectDataHandlers.paths.geojsonCollection! = jest.fn().mockResolvedValue({
        geojson: {
            features: 'features'
        }
    });

    const result = await calculateRoute({} as any, true);

    expect(result).toStrictEqual({
        transit: {
            result: transitResult,
            pathsGeojson: [transitGeojson, transitGeojson, transitGeojson]
        },
        walking: {
            result: walkingResult,
            pathsGeojson: [walkingGeojson, walkingGeojson]
        },
        driving: {
            result: drivingResult,
            pathsGeojson: [drivingGeojson, drivingGeojson, drivingGeojson, drivingGeojson]
        }
    });
    expect(TransitRoutingCalculator.calculate).toBeCalled();
});
