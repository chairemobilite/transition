/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import TrError from "../../../utils/TrError";
import { UnimodalRoutingResult } from "../RoutingResult";

const origin = {
    type: 'Feature' as const,
    geometry: {
        type: 'Point' as const,
        coordinates: [0, 0],
    },
    properties: {},
};
const destination = {
    type: 'Feature' as const,
    geometry: {
        type: 'Point' as const,
        coordinates: [1, 1],
    },
    properties: {},
};

describe('UnimodalRoutingResult, with valid parameters', () => {
    const routingMode = 'driving' as const;
    const paths = [
        {
            distance: 1000,
            duration: 600,
            geometry: {
                type: 'LineString' as const,
                coordinates: [
                    [0, 0],
                    [1, 1],
                ],
            },
            legs: []
        },
    ];

    const validParams = {
        routingMode,
        origin,
        destination,
        paths
    };

    const routingResult = new UnimodalRoutingResult(validParams);

    test('Should return the right routing mode', () => {
        expect(routingResult.getRoutingMode()).toEqual(routingMode);
    });

    test('Should return the right alternatives count', () => {
        expect(routingResult.hasAlternatives()).toEqual(false);
        expect(routingResult.getAlternativesCount()).toEqual(1);
    });

    test('Should return the right path', () => {
        expect(routingResult.getPath(0)).toEqual(paths[0]);
        expect(routingResult.getPath(1)).toBeUndefined();
    });

    test('Should return the right origin and destination', () => {
        expect(routingResult.originDestinationToGeojson()).toEqual({
            type: 'FeatureCollection',
            features: [origin, destination]
        });
    });

    test('Should return the right path geojson', async () => {
        const geojson = await routingResult.getPathGeojson(0);
        expect(geojson).toEqual({
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    geometry: paths[0].geometry,
                    properties: {
                        distanceMeters: paths[0].distance,
                        travelTimeSeconds: paths[0].duration,
                        mode: routingMode,
                        color: expect.anything()
                    }
                }
            ]
        });
    });

    test('Should return no error', () => {
        expect(routingResult.hasError()).toEqual(false);
        expect(routingResult.getError()).toBeUndefined();
    });

});

describe('UnimodalRoutingResult, with error parameters', () => {
    const routingMode = 'cycling' as const;
    // No paths
    const paths = [];
    const error = {
        localizedMessage: 'Error occurred',
        error: 'Some error',
        errorCode: '123',
    };

    const paramsWithError = {
        routingMode,
        origin,
        destination,
        paths,
        error,
    };

    const routingResult = new UnimodalRoutingResult(paramsWithError);

    test('Should return the right routing mode', () => {
        expect(routingResult.getRoutingMode()).toEqual(routingMode);
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
            features: [origin, destination]
        });
    });

    test('Should throw error if request and undefined path geojson', async () => {
        let error: any = undefined;
        try {
            await routingResult.getPathGeojson(0);
        } catch(err) {
            error = err;
        }
        expect(error).toEqual('Geometry should be in the route, it is not');
    });

    test('Should return no error', () => {
        expect(routingResult.hasError()).toEqual(true);
        expect(routingResult.getError()).toEqual(new TrError(error.error, error.errorCode, error.localizedMessage));
    });
});