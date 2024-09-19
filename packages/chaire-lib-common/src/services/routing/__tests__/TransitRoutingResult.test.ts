/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from "../../../utils/TrError";
import { SegmentToGeoJSON, TransitRoutingResult } from "../TransitRoutingResult";
import { pathNoTransferRouteResult } from '../../../test/services/transitRouting/TrRoutingConstantsStubs';
import { getRouteByMode } from "../RoutingUtils";

jest.mock("../RoutingUtils", () => ({
    getRouteByMode: jest.fn().mockImplementation(async (origin: GeoJSON.Feature<GeoJSON.Point>, destination: GeoJSON.Feature<GeoJSON.Point>, _mode) => ({
        waypoints: [],
        routes: [{
            distance: 1000,
            duration: 600,
            geometry: {
                type: 'LineString',
                coordinates: [
                    origin.geometry.coordinates,
                    destination.geometry.coordinates,
                ],
            },
            legs: []
        }]
    }))
}));
const mockedGetRouteByMode = getRouteByMode as jest.MockedFunction<typeof getRouteByMode>;

describe('TransitRoutingResult, with valid single route, no walk only route', () => {

    beforeEach(() => {
        mockedGetRouteByMode.mockClear();
    });

    const validParams = {
        origin: pathNoTransferRouteResult.originDestination[0],
        destination: pathNoTransferRouteResult.originDestination[1],
        paths: [pathNoTransferRouteResult],
    }

    const routingResult = new TransitRoutingResult(validParams);

    test('Should return the right routing mode', () => {
        expect(routingResult.getRoutingMode()).toEqual('transit');
    });

    test('Should return the right alternatives count', () => {
        expect(routingResult.hasAlternatives()).toEqual(false);
        expect(routingResult.getAlternativesCount()).toEqual(1);
    });

    test('Should return the right path', () => {
        expect(routingResult.getPath(0)).toEqual(pathNoTransferRouteResult);
        expect(routingResult.getPath(1)).toBeUndefined();
    });

    test('Should return the right origin and destination', () => {
        expect(routingResult.originDestinationToGeojson()).toEqual({
            type: 'FeatureCollection',
            features: [...pathNoTransferRouteResult.originDestination]
        });
    });

    test('Should return the right path geojson', async () => {
        // Just mock a simple boarding to unboarding location feature
        const segmentToGeojson: SegmentToGeoJSON = jest.fn().mockImplementation(async (boardingStep, unboardingStep, completeData, index) => ({
            type: 'Feature',
            properties: {
                stepSequence: index,
                completeData
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    boardingStep.nodeCoordinates,
                    unboardingStep.nodeCoordinates
                ]
            }
        }));
        const geojson = await routingResult.getPathGeojson(0, { segmentToGeojson });
        expect(segmentToGeojson).toHaveBeenCalledTimes(1);
        expect(segmentToGeojson).toHaveBeenCalledWith(pathNoTransferRouteResult.steps[1], pathNoTransferRouteResult.steps[2], false, 1);
        expect(mockedGetRouteByMode).toHaveBeenCalledTimes(2);
        expect(geojson).toEqual({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: expect.anything(),
                geometry: {
                    type: 'LineString',
                    coordinates: [pathNoTransferRouteResult.originDestination[0].geometry.coordinates, (pathNoTransferRouteResult.steps[1] as any).nodeCoordinates]
                },
                properties: {
                    distanceMeters: 1000,
                    travelTimeSeconds: 600,
                    mode: 'walking',
                    action: 'walking',
                    stepSequence: 0,
                    color: expect.anything()
                }
            },{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        (pathNoTransferRouteResult.steps[1] as any).nodeCoordinates,
                        (pathNoTransferRouteResult.steps[2] as any).nodeCoordinates
                    ]
                },
                properties: {
                    completeData: false,
                    stepSequence: 1
                }
            }, {
                type: 'Feature',
                id: expect.anything(),
                geometry: {
                    type: 'LineString',
                    coordinates: [(pathNoTransferRouteResult.steps[2] as any).nodeCoordinates, pathNoTransferRouteResult.originDestination[1].geometry.coordinates]
                },
                properties: {
                    distanceMeters: 1000,
                    travelTimeSeconds: 600,
                    mode: 'walking',
                    action: 'walking',
                    stepSequence: 2,
                    color: expect.anything()
                }
            }]
        });
    });

    test('Should return no error', () => {
        expect(routingResult.hasError()).toEqual(false);
        expect(routingResult.getError()).toBeUndefined();
    });
});

describe('TransitRoutingResult, with valid single route, with walk only route', () => {

    beforeEach(() => {
        mockedGetRouteByMode.mockClear();
    });

    // Walk only route, faster than the first transit route
    const walkOnlyRoute = {
        distance: 2000,
        duration: 1200,
        geometry: {
            type: 'LineString' as const,
            coordinates: [
                pathNoTransferRouteResult.originDestination[0].geometry.coordinates,
                pathNoTransferRouteResult.originDestination[1].geometry.coordinates,
            ],
        },
        legs: []
    }
    const validParams = {
        origin: pathNoTransferRouteResult.originDestination[0],
        destination: pathNoTransferRouteResult.originDestination[1],
        paths: [pathNoTransferRouteResult],
        walkOnlyPath: walkOnlyRoute
    }

    const routingResult = new TransitRoutingResult(validParams);

    test('Should return the right routing mode', () => {
        expect(routingResult.getRoutingMode()).toEqual('transit');
    });

    test('Should return the right alternatives count', () => {
        expect(routingResult.hasAlternatives()).toEqual(true);
        expect(routingResult.getAlternativesCount()).toEqual(2);
    });

    test('Should return the right path', () => {
        // FIXME The walk only path should be returned as the first path
        expect(routingResult.getPath(0)).toEqual(walkOnlyRoute);
        expect(routingResult.getPath(1)).toEqual(pathNoTransferRouteResult);
        expect(routingResult.getPath(2)).toBeUndefined();
    });

    test('Should return the right origin and destination', () => {
        expect(routingResult.originDestinationToGeojson()).toEqual({
            type: 'FeatureCollection',
            features: [...pathNoTransferRouteResult.originDestination]
        });
    });

    test('Should return the right path geojson for the transit path', async () => {
        // Just mock a simple boarding to unboarding location feature
        const segmentToGeojson: SegmentToGeoJSON = jest.fn().mockImplementation(async (boardingStep, unboardingStep, completeData, index) => ({
            type: 'Feature',
            properties: {
                stepSequence: index,
                completeData
            },
            geometry: {
                type: 'LineString',
                coordinates: [
                    boardingStep.nodeCoordinates,
                    unboardingStep.nodeCoordinates
                ]
            }
        }));
        const geojson = await routingResult.getPathGeojson(1, { segmentToGeojson });
        expect(segmentToGeojson).toHaveBeenCalledTimes(1);
        expect(segmentToGeojson).toHaveBeenCalledWith(pathNoTransferRouteResult.steps[1], pathNoTransferRouteResult.steps[2], false, 1);
        expect(mockedGetRouteByMode).toHaveBeenCalledTimes(2);
        expect(geojson).toEqual({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                id: expect.anything(),
                geometry: {
                    type: 'LineString',
                    coordinates: [pathNoTransferRouteResult.originDestination[0].geometry.coordinates, (pathNoTransferRouteResult.steps[1] as any).nodeCoordinates]
                },
                properties: {
                    distanceMeters: 1000,
                    travelTimeSeconds: 600,
                    mode: 'walking',
                    action: 'walking',
                    stepSequence: 0,
                    color: expect.anything()
                }
            },{
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        (pathNoTransferRouteResult.steps[1] as any).nodeCoordinates,
                        (pathNoTransferRouteResult.steps[2] as any).nodeCoordinates
                    ]
                },
                properties: {
                    completeData: false,
                    stepSequence: 1
                }
            }, {
                type: 'Feature',
                id: expect.anything(),
                geometry: {
                    type: 'LineString',
                    coordinates: [(pathNoTransferRouteResult.steps[2] as any).nodeCoordinates, pathNoTransferRouteResult.originDestination[1].geometry.coordinates]
                },
                properties: {
                    distanceMeters: 1000,
                    travelTimeSeconds: 600,
                    mode: 'walking',
                    action: 'walking',
                    stepSequence: 2,
                    color: expect.anything()
                }
            }]
        });
    });

    test('Should return the right path geojson for the walk only path', async () => {
        // Just mock a simple boarding to unboarding location feature
        const segmentToGeojson: SegmentToGeoJSON = jest.fn();
        const geojson = await routingResult.getPathGeojson(0, { segmentToGeojson });
        expect(segmentToGeojson).not.toHaveBeenCalled();
        expect(mockedGetRouteByMode).not.toHaveBeenCalled();
        expect(geojson).toEqual({
            type: 'FeatureCollection',
            features: [{
                type: 'Feature',
                geometry: walkOnlyRoute.geometry,
                properties: {
                    distanceMeters: walkOnlyRoute.distance,
                    travelTimeSeconds: walkOnlyRoute.duration,
                    mode: 'walking',
                    color: expect.anything()
                }
            }]
        });
    });

    test('Should return no error', () => {
        expect(routingResult.hasError()).toEqual(false);
        expect(routingResult.getError()).toBeUndefined();
    });
});

describe('TransitRoutingResult, with error parameters', () => {

    beforeEach(() => {
        mockedGetRouteByMode.mockClear();
    });

    const error = {
        localizedMessage: 'Error occurred',
        error: 'Some error',
        errorCode: '123',
    };
    const validParams = {
        origin: pathNoTransferRouteResult.originDestination[0],
        destination: pathNoTransferRouteResult.originDestination[1],
        paths: [],
        error
    }

    const routingResult = new TransitRoutingResult(validParams);

    test('Should return the right routing mode', () => {
        expect(routingResult.getRoutingMode()).toEqual('transit');
    });

    test('Should return the right alternatives count', () => {
        expect(routingResult.hasAlternatives()).toEqual(false);
        expect(routingResult.getAlternativesCount()).toEqual(0);
    });

    test('Should return the right path', () => {
        expect(routingResult.getPath(0)).toBeUndefined();
        expect(routingResult.getPath(1)).toBeUndefined();
    });

    test('Should return the right origin and destination', () => {
        expect(routingResult.originDestinationToGeojson()).toEqual({
            type: 'FeatureCollection',
            features: [...pathNoTransferRouteResult.originDestination]
        });
    });

    test('Should return the right path geojson', async () => {
        // Just mock a simple boarding to unboarding location feature
        const segmentToGeojson: SegmentToGeoJSON = jest.fn();
        const geojson = await routingResult.getPathGeojson(0, { segmentToGeojson });
        expect(segmentToGeojson).not.toHaveBeenCalled();
        expect(mockedGetRouteByMode).not.toHaveBeenCalled();
        expect(geojson).toEqual({
            type: 'FeatureCollection',
            features: []
        });
    });

    test('Should return no error', () => {
        expect(routingResult.hasError()).toEqual(true);
        expect(routingResult.getError()).toEqual(new TrError(error.error, error.errorCode, error.localizedMessage));
    });
});