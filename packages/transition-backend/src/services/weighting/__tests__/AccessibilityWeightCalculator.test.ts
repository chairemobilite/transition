/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import GeoJSON from 'geojson';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { RoutingServiceManagerMock } from 'chaire-lib-common/lib/test';

// Mock database and related modules BEFORE importing anything that uses them
// Mock knex-postgis first to prevent initialization errors when transitNodes.db.queries loads
jest.mock('knex-postgis', () => {
    return jest.fn(() => ({
        geomFromGeoJSON: jest.fn()
    }));
});

jest.mock('../../../models/db/transitNodes.db.queries', () => {
    // Use a factory function that returns the mock
    return {
        __esModule: true,
        default: {
            collection: jest.fn()
        }
    };
});

jest.mock('../../../models/db/geometryUtils.db.queries', () => ({
    getPOIsWithinBirdDistanceFromPoint: jest.fn(),
    getPOIsWithinBirdDistanceFromPlaces: jest.fn(),
    getPOIsWithinBirdDistanceFromNodes: jest.fn()
}));

// Enable RoutingServiceManager mock (similar to other tests)
RoutingServiceManagerMock.enableMocks();

import { AccessibilityWeightCalculator, AccessibilityWeightCalculationParameters } from '../AccessibilityWeightCalculator';
import {
    PowerDecayParameters,
    WeightingRoutingMode,
    WeightDecayInputType
} from '../types';
import {
    getPOIsWithinBirdDistanceFromPoint,
    getPOIsWithinBirdDistanceFromNodes,
    getPOIsWithinBirdDistanceFromPlaces
} from '../../../models/db/geometryUtils.db.queries';
import transitNodesDbQueries from '../../../models/db/transitNodes.db.queries';

const mockedGetPOIsWithinBirdDistanceFromPoint = getPOIsWithinBirdDistanceFromPoint as jest.MockedFunction<typeof getPOIsWithinBirdDistanceFromPoint>;
const mockedGetPOIsWithinBirdDistanceFromNodes = getPOIsWithinBirdDistanceFromNodes as jest.MockedFunction<typeof getPOIsWithinBirdDistanceFromNodes>;
const mockedGetPOIsWithinBirdDistanceFromPlaces = getPOIsWithinBirdDistanceFromPlaces as jest.MockedFunction<typeof getPOIsWithinBirdDistanceFromPlaces>;
// Use RoutingServiceManagerMock like other tests do
const mockTableFrom = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableFrom;
// Get the mocked collection function from the imported module
const mockCollection = transitNodesDbQueries.collection as jest.MockedFunction<typeof transitNodesDbQueries.collection>;

describe('AccessibilityWeightCalculator', () => {
    const place1Id = uuidV4();
    const place2Id = uuidV4();
    const poi1Id = 1;
    const poi2Id = 2;

    const defaultPlaces: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature' as const,
                id: place1Id,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                },
                properties: {
                    foo: 'bar'
                }
            },
            {
                type: 'Feature' as const,
                id: place2Id,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [-73.5, 45.6]
                },
                properties: {
                    bar: 'foo'
                }
            }
        ]
    };



    const decayParameters: PowerDecayParameters = {
        type: 'power',
        beta: 2
    };

    const defaultPOIs: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }> = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature' as const,
                id: poi1Id,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                },
                properties: {
                    weight: 1.0
                }
            },
            {
                type: 'Feature' as const,
                id: poi2Id,
                geometry: {
                    type: 'Point' as const,
                    coordinates: [-73.5, 45.6]
                },
                properties: {
                    weight: 2.0
                }
            }
        ]
    };

    const defaultParameters: AccessibilityWeightCalculationParameters = {
        decayFunctionParameters: decayParameters,
        decayInputType: 'networkDistance' as WeightDecayInputType,
        poisFeatureCollection: defaultPOIs,
        placesFeatureCollection: defaultPlaces,
        maxBirdDistanceMeters: 10000,
        routingMode: 'walking' as WeightingRoutingMode
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockTableFrom.mockClear();
        mockCollection.mockClear();
        mockedGetPOIsWithinBirdDistanceFromPoint.mockClear();
        mockedGetPOIsWithinBirdDistanceFromPlaces.mockClear();
        // Reset mockTableFrom to return empty arrays by default
        mockTableFrom.mockResolvedValue({
            query: '',
            durations: [],
            distances: []
        });
        // Default mock for getPOIsWithinBirdDistanceFromPlaces returns empty object
        mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValue({});
    });

    describe('calculateWeights', () => {
        test('should return error status when POIs array is empty', async () => {
            const parametersWithoutPOIs = {
                ...defaultParameters,
                poisFeatureCollection: {
                    type: 'FeatureCollection' as const,
                    features: []
                }
            };

            const result = await AccessibilityWeightCalculator.calculateWeights(parametersWithoutPOIs);
            expect(Status.isStatusError(result)).toBe(true);
            if (Status.isStatusError(result)) {
                expect(result.error).toBeInstanceOf(TrError);
                expect((result.error as TrError).message).toContain(
                    'poisFeatureCollection is required and must contain at least one feature'
                );
            }
        });

        test('should return error status when no places provided', async () => {
            const parametersWithoutPlaces = {
                ...defaultParameters,
                placesFeatureCollection: {
                    type: 'FeatureCollection' as const,
                    features: []
                }
            };

            const result = await AccessibilityWeightCalculator.calculateWeights(parametersWithoutPlaces);
            expect(Status.isStatusError(result)).toBe(true);
            if (Status.isStatusError(result)) {
                expect(result.error).toBeInstanceOf(TrError);
                expect((result.error as TrError).message).toContain(
                    'placesFeatureCollection is required and must contain at least one feature'
                );
            }
        });

        test('should return empty results when placesFeatureCollection has no valid features', async () => {
            const parametersWithInvalidPlaces = {
                ...defaultParameters,
                placesFeatureCollection: {
                    type: 'FeatureCollection' as const,
                    features: [
                        {
                            type: 'Feature' as const,
                            geometry: null,
                            properties: {}
                        } as unknown as GeoJSON.Feature<GeoJSON.Point>
                    ]
                }
            };

            const result = await AccessibilityWeightCalculator.calculateWeights(parametersWithInvalidPlaces);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toEqual({});
            }
        });

        test('should return error status when maxBirdDistanceMeters is not positive', async () => {
            const parameters = {
                ...defaultParameters,
                maxBirdDistanceMeters: -100
            };

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusError(result)).toBe(true);
            if (Status.isStatusError(result)) {
                expect(result.error).toBeInstanceOf(TrError);
                expect((result.error as TrError).message).toContain(
                    'maxBirdDistanceMeters must be a positive number'
                );
            }
        });

        test('should return error status when maxNetworkDistanceMeters is not positive', async () => {
            const parameters = {
                ...defaultParameters,
                maxNetworkDistanceMeters: 0
            };

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusError(result)).toBe(true);
            if (Status.isStatusError(result)) {
                expect(result.error).toBeInstanceOf(TrError);
                expect((result.error as TrError).message).toContain(
                    'maxNetworkDistanceMeters must be a positive number'
                );
            }
        });

        test('should return error status when maxTravelTimeSeconds is not positive', async () => {
            const parameters = {
                ...defaultParameters,
                maxTravelTimeSeconds: -50
            };

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusError(result)).toBe(true);
            if (Status.isStatusError(result)) {
                expect(result.error).toBeInstanceOf(TrError);
                expect((result.error as TrError).message).toContain(
                    'maxTravelTimeSeconds must be a positive number'
                );
            }
        });

        test('should skip places without geography', async () => {
            const placesWithoutGeography = {
                type: 'FeatureCollection' as const,
                features: [
                    {
                        type: 'Feature' as const,
                        id: place1Id,
                        geometry: null,
                        properties: {}
                    } as unknown as GeoJSON.Feature<GeoJSON.Point>
                ]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: placesWithoutGeography
            };

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(0);
            }
        });

        test('should return zero weight when no POIs found', async () => {
            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace
            };

            // Mock getPOIsWithinBirdDistanceFromPlaces to return empty array for this place
            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: []
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
                expect(result.result[place1Id]).toBe(0);
            }
        });

        test('should calculate weight correctly with single POI', async () => {
            const poi1 = {
                id: poi1Id as number,
                weight: 10.0,
                distance: 500,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace
            };

            // Mock getPOIsWithinBirdDistanceFromPlaces to return POI for this place
            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1]
            });

            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [300], // 5 minutes
                distances: [500] // 500 meters
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
                expect(result.result[place1Id]).toBeDefined();
                // Weight = poiWeight * decayValue = 10.0 * (500^-2) = 10.0 * 0.000004 = 0.00004
                expect(result.result[place1Id]).toBeCloseTo(10.0 * Math.pow(500, -2), 10);
            }
        });

        test('should calculate weight correctly with multiple POIs', async () => {
            const poi1 = {
                id: poi1Id,
                weight: 10.0,
                distance: 500,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const poi2 = {
                id: poi2Id as number,
                weight: 5.0,
                distance: 1000,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1, poi2]
            });

            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [300, 600],
                distances: [500, 1000]
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
                const expectedWeight =
                    10.0 * Math.pow(500, -2) + // POI 1 contribution
                    5.0 * Math.pow(1000, -2); // POI 2 contribution
                expect(result.result[place1Id]).toBeCloseTo(expectedWeight, 10);
            }
        });

        test('should include POIs even if network distance exceeds bird distance + 100 tolerance', async () => {
            const poi1 = {
                id: poi1Id as number,
                weight: 10.0,
                distance: 500, // Bird distance
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1]
            });

            // Network distance (700) exceeds bird distance (500) + 100 threshold = 600
            // The current implementation does NOT filter out POIs based on network/bird distance discrepancy.
            // It simply uses the network distance for the decay calculation if network distance mode is selected.
            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [420],
                distances: [700] // Network distance exceeds bird distance + 100 (600)
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
                // POI is included despite the large discrepancy between bird and network distance
                expect(result.result[place1Id]).toBeGreaterThan(0);
            }
        });

        test('should skip POIs with null routing results', async () => {
            const poi1 = {
                id: poi1Id as number,
                weight: 10.0,
                distance: 500,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1]
            });

            // Return arrays with undefined/null values to simulate failed routing
            // which _isBlank will catch
            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [],
                distances: []
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
                expect(result.result[place1Id]).toBe(0);
            }
        });

        test('should calculate weights for multiple places', async () => {
            const poi1 = {
                id: poi1Id,
                weight: 10.0,
                distance: 500,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1], // POI for place1
                [place2Id]: [] // No POIs for place2
            });

            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [300],
                distances: [500]
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(defaultParameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(2);
                expect(result.result[place1Id]).toBeDefined();
                expect(result.result[place1Id]).toBeGreaterThan(0);
                expect(result.result[place2Id]).toBeDefined();
                expect(result.result[place2Id]).toBe(0);
            }
        });

        test('should calculate weights for a single place', async () => {
            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: []
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
                expect(result.result[place1Id]).toBe(0);
            }
        });

        test('should use travelTime decayInputType when specified', async () => {
            const poi1 = {
                id: poi1Id,
                weight: 10.0,
                distance: 500,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace,
                decayInputType: 'travelTime' as WeightDecayInputType
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1]
            });

            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [300], // 5 minutes
                distances: [500]
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
                // Weight = poiWeight * decayValue = 10.0 * (300^-2) = 10.0 * 0.000011111... = 0.000111...
                expect(result.result[place1Id]).toBeCloseTo(10.0 * Math.pow(300, -2), 10);
            }
        });

        test('should call progress callback during calculation', async () => {
            const progressCallback = jest.fn();

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [],
                [place2Id]: []
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(defaultParameters, progressCallback);

            expect(Status.isStatusOk(result)).toBe(true);
            expect(progressCallback).toHaveBeenCalled();
            expect(progressCallback).toHaveBeenCalledWith(1.0); // Final progress
        });

        test('should handle decay calculation errors gracefully', async () => {
            const poi1 = {
                id: poi1Id,
                weight: 10.0,
                distance: 500,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const invalidParameters = {
                ...defaultParameters,
                placesFeatureCollection: singlePlace,
                decayFunctionParameters: {
                    type: 'power',
                    beta: -1 // Invalid: negative beta
                } as PowerDecayParameters
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1]
            });

            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [300],
                distances: [500]
            });

            // Mock console.warn to avoid noise in test output
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
                // Suppress warnings in tests
            });

            // Should not return error status, but handle gracefully
            const result = await AccessibilityWeightCalculator.calculateWeights(invalidParameters);
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(Object.keys(result.result)).toHaveLength(1);
            }
            consoleWarnSpy.mockRestore();
        });

        test('should use default routing mode when not specified', async () => {
            const poi1 = {
                id: poi1Id as number,
                weight: 10.0,
                distance: 500,
                geography: {
                    type: 'Point' as const,
                    coordinates: [-73.6, 45.5]
                } as GeoJSON.Point
            };

            const singlePlace = {
                type: 'FeatureCollection' as const,
                features: [defaultPlaces.features[0]]
            };

            const parameters = {
                decayFunctionParameters: decayParameters,
                decayInputType: 'networkDistance' as WeightDecayInputType,
                poisFeatureCollection: defaultPOIs,
                placesFeatureCollection: singlePlace,
                maxBirdDistanceMeters: 10000
                // routingMode not specified, should default to 'walking'
            };

            mockedGetPOIsWithinBirdDistanceFromPlaces.mockResolvedValueOnce({
                [place1Id]: [poi1]
            });

            mockTableFrom.mockResolvedValueOnce({
                query: '',
                durations: [300],
                distances: [500]
            });

            const result = await AccessibilityWeightCalculator.calculateWeights(parameters);

            expect(Status.isStatusOk(result)).toBe(true);
            expect(mockTableFrom).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'walking'
                })
            );
        });
    });

    describe('calculateNodeAccessibilityWeights', () => {
        const node1Id = uuidV4();
        const node2Id = uuidV4();
        const poi1Id = 1;
        const poi2Id = 2;

        const defaultPOIs: GeoJSON.FeatureCollection<GeoJSON.Point, { weight?: number }> = {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature' as const,
                    id: poi1Id,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [-73.6, 45.5]
                    },
                    properties: {
                        weight: 1.0
                    }
                },
                {
                    type: 'Feature' as const,
                    id: poi2Id,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [-73.5, 45.6]
                    },
                    properties: {
                        weight: 2.0
                    }
                }
            ]
        };

        const decayParameters: PowerDecayParameters = {
            type: 'power',
            beta: 2
        };

        const mockNode1 = {
            id: node1Id,
            geography: {
                type: 'Point' as const,
                coordinates: [-73.6, 45.5]
            },
            is_enabled: true
        };

        const mockNode2 = {
            id: node2Id,
            geography: {
                type: 'Point' as const,
                coordinates: [-73.5, 45.6]
            },
            is_enabled: true
        };

        beforeEach(() => {
            jest.clearAllMocks();
            mockedGetPOIsWithinBirdDistanceFromNodes.mockResolvedValue({});
            mockCollection.mockResolvedValue([]);
            mockTableFrom.mockResolvedValue({
                query: '',
                durations: [],
                distances: []
            });
        });

        test('should handle undefined nodeIds and query all enabled nodes', async () => {
            mockCollection.mockResolvedValue([mockNode1, mockNode2]);
            mockedGetPOIsWithinBirdDistanceFromNodes.mockResolvedValue({
                [node1Id]: [
                    {
                        id: poi1Id,
                        weight: 1.0,
                        distance: 100,
                        geography: {
                            type: 'Point',
                            coordinates: [-73.6, 45.5]
                        }
                    }
                ],
                [node2Id]: [
                    {
                        id: poi2Id,
                        weight: 2.0,
                        distance: 200,
                        geography: {
                            type: 'Point',
                            coordinates: [-73.5, 45.6]
                        }
                    }
                ]
            });

            const parameters = {
                decayFunctionParameters: decayParameters,
                decayInputType: 'birdDistance' as WeightDecayInputType,
                poisFeatureCollection: defaultPOIs,
                maxBirdDistanceMeters: 10000,
                routingMode: 'walking' as WeightingRoutingMode
            };

            const result = await AccessibilityWeightCalculator.calculateNodeAccessibilityWeights(parameters);

            expect(mockCollection).toHaveBeenCalledWith({ nodeIds: undefined });
            expect(mockedGetPOIsWithinBirdDistanceFromNodes).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Object),
                undefined
            );
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(typeof result.result).toBe('object');
            }
        });

        test('should handle empty nodeIds array and return empty result', async () => {
            // Empty array means "no nodes" - returns {} immediately without database calls
            const parameters = {
                decayFunctionParameters: decayParameters,
                decayInputType: 'birdDistance' as WeightDecayInputType,
                poisFeatureCollection: defaultPOIs,
                nodeIds: [],
                maxBirdDistanceMeters: 10000,
                routingMode: 'walking' as WeightingRoutingMode
            };

            const result = await AccessibilityWeightCalculator.calculateNodeAccessibilityWeights(parameters);

            // Empty nodeIds array should return early without calling database functions
            expect(mockCollection).not.toHaveBeenCalled();
            expect(mockedGetPOIsWithinBirdDistanceFromNodes).not.toHaveBeenCalled();
            // Empty nodeIds array should result in empty weights object
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toEqual({});
            }
        });

        test('should handle non-empty nodeIds array', async () => {
            const specificNodeIds = [node1Id];
            mockCollection.mockResolvedValue([mockNode1]);
            mockedGetPOIsWithinBirdDistanceFromNodes.mockResolvedValue({
                [node1Id]: [
                    {
                        id: poi1Id,
                        weight: 1.0,
                        distance: 100,
                        geography: {
                            type: 'Point',
                            coordinates: [-73.6, 45.5]
                        }
                    }
                ]
            });

            const parameters = {
                decayFunctionParameters: decayParameters,
                decayInputType: 'birdDistance' as WeightDecayInputType,
                poisFeatureCollection: defaultPOIs,
                nodeIds: specificNodeIds,
                maxBirdDistanceMeters: 10000,
                routingMode: 'walking' as WeightingRoutingMode
            };

            const result = await AccessibilityWeightCalculator.calculateNodeAccessibilityWeights(parameters);

            expect(mockCollection).toHaveBeenCalledWith({ nodeIds: specificNodeIds });
            expect(mockedGetPOIsWithinBirdDistanceFromNodes).toHaveBeenCalledWith(
                expect.any(Number),
                expect.any(Object),
                specificNodeIds
            );
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toHaveProperty(node1Id);
                expect(result.result[node1Id]).toBeGreaterThanOrEqual(0);
            }
        });

        test('should return zero weight when nodeIds provided but nodes not found in database', async () => {
            mockCollection.mockResolvedValue([]);
            mockedGetPOIsWithinBirdDistanceFromNodes.mockResolvedValue({});

            const parameters = {
                decayFunctionParameters: decayParameters,
                decayInputType: 'birdDistance' as WeightDecayInputType,
                poisFeatureCollection: defaultPOIs,
                nodeIds: [node1Id],
                maxBirdDistanceMeters: 10000,
                routingMode: 'walking' as WeightingRoutingMode
            };

            const result = await AccessibilityWeightCalculator.calculateNodeAccessibilityWeights(parameters);

            // When nodeIds are provided but nodes not found, they get weight 0
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result).toEqual({ [node1Id]: 0 });
            }
        });

        test('should handle node without geography gracefully', async () => {
            const nodeWithoutGeography = {
                id: node1Id,
                geography: null,
                is_enabled: true
            };
            mockCollection.mockResolvedValue([nodeWithoutGeography]);
            mockedGetPOIsWithinBirdDistanceFromNodes.mockResolvedValue({
                [node1Id]: []
            });

            const parameters = {
                decayFunctionParameters: decayParameters,
                decayInputType: 'birdDistance' as WeightDecayInputType,
                poisFeatureCollection: defaultPOIs,
                nodeIds: [node1Id],
                maxBirdDistanceMeters: 10000,
                routingMode: 'walking' as WeightingRoutingMode
            };

            const result = await AccessibilityWeightCalculator.calculateNodeAccessibilityWeights(parameters);

            // Node without geography should have weight 0
            expect(Status.isStatusOk(result)).toBe(true);
            if (Status.isStatusOk(result)) {
                expect(result.result[node1Id]).toBe(0);
            }
        });
    });
});

