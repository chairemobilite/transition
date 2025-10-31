/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import transitRoutingService from 'chaire-lib-backend/lib/services/transitRouting/TransitRoutingService';
import { TestUtils } from 'chaire-lib-common/lib/test';
import {
    categories,
    detailedCategories,
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';

import { TransitAccessibilityMapCalculator } from '../TransitAccessibilityMapCalculator';
import nodesDbQueries from '../../../models/db/transitNodes.db.queries';
import placesDbQueries from '../../../models/db/places.db.queries';
import { TransitAccessibilityMapWithPolygonResult } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';

// Mock knex for PostGIS operations
jest.mock('chaire-lib-backend/lib/config/shared/db.config', () => {
    const mockTransaction = jest.fn();
    const mockRaw = jest.fn();

    return {
        __esModule: true,
        default: {
            transaction: mockTransaction,
            raw: mockRaw
        }
    };
});

// Import knex after mocking
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

const defaultAttributes = {
    locationGeojson: TestUtils.makePoint([-73, 45]),
    scenarioId: 'abc',
    id: 'abcdef',
    data: {},
    arrivalTimeSecondsSinceMidnight: 25200
}

const accessiblePlacesCountByCategory = categories.reduce(
    (categoriesAsKeys, category) => ((categoriesAsKeys[category] = 0), categoriesAsKeys),
    {}
) as { [key in PlaceCategory]: number };
accessiblePlacesCountByCategory.education = 10;

const accessiblePlacesCountByDetailedCategory = detailedCategories.reduce(
    (categoriesAsKeys, category) => ((categoriesAsKeys[category] = 0), categoriesAsKeys),
    {}
) as { [key in PlaceDetailedCategory]: number };
accessiblePlacesCountByDetailedCategory.school_secondary = 6;
accessiblePlacesCountByDetailedCategory.school_university = 4;

jest.mock('../../../models/db/transitNodes.db.queries', () => ({
    geojsonCollection: jest.fn()
}));
const mockedNodesDbCollection = nodesDbQueries.geojsonCollection as jest.MockedFunction<typeof nodesDbQueries.geojsonCollection>;

jest.mock('../../../models/db/places.db.queries', () => ({
    getPOIsCategoriesCountInPolygon: jest.fn()
}));
const mockedPlacesPOIsCount = placesDbQueries.getPOIsCategoriesCountInPolygon as jest.MockedFunction<typeof placesDbQueries.getPOIsCategoriesCountInPolygon>;

jest.mock('chaire-lib-backend/lib/services/transitRouting/TransitRoutingService', () => ({
    accessibleMap: jest.fn()
}));
const mockedAccessibilityMap = transitRoutingService.accessibleMap as jest.MockedFunction<typeof transitRoutingService.accessibleMap>;

const mockedKnexTransaction = knex.transaction as jest.MockedFunction<typeof knex.transaction>;
const mockedKnexRaw = knex.raw as jest.MockedFunction<any>;

beforeEach(() => {
    jest.clearAllMocks();

    // Default mock setup for PostGIS operations
    const mockTrx = {
        raw: jest.fn().mockResolvedValue({ rows: [] })
    };

    // Mock the transaction to call the callback with the mock transaction
    mockedKnexTransaction.mockImplementation(async (callback) => {
        return await callback(mockTrx as any);
    });
})

describe('Test trRouting calls with various parameters', () => {

    beforeAll(() => {
        mockedAccessibilityMap.mockRejectedValue('Result does not matter');
    });

    test('Test the accessibility map default values', async () => {
        try {
            await TransitAccessibilityMapCalculator.calculate(defaultAttributes);
        } catch(e) {
            /* it's normal to fail */
        }
        expect(mockedAccessibilityMap).toHaveBeenCalledTimes(1);
        expect(mockedAccessibilityMap).toHaveBeenCalledWith(expect.objectContaining({
            minWaitingTime: 180,
            maxAccessTravelTime: 900,
            maxEgressTravelTime: 900,
            maxTransferTravelTime: 900,
            scenarioId: defaultAttributes.scenarioId,
            maxTravelTime: 900,
            location: defaultAttributes.locationGeojson,
            timeOfTrip: defaultAttributes.arrivalTimeSecondsSinceMidnight,
            timeOfTripType: 'arrival'
        }), expect.anything());
    });

    test('Test the accessibility map various values, but one trRouting call', async () => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 1800,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120
        }
        try {
            await TransitAccessibilityMapCalculator.calculate(attributes);
        } catch(e) {
            /* it's normal to fail */
        }
        expect(mockedAccessibilityMap).toHaveBeenCalledTimes(1);
        expect(mockedAccessibilityMap).toHaveBeenCalledWith(expect.objectContaining({
            minWaitingTime: attributes.minWaitingTimeSeconds,
            maxAccessTravelTime: attributes.maxAccessEgressTravelTimeSeconds,
            maxEgressTravelTime: attributes.maxAccessEgressTravelTimeSeconds,
            maxTransferTravelTime: attributes.maxTransferTravelTimeSeconds,
            scenarioId: defaultAttributes.scenarioId,
            maxTravelTime: attributes.maxTotalTravelTimeSeconds,
            location: defaultAttributes.locationGeojson,
            timeOfTrip: defaultAttributes.arrivalTimeSecondsSinceMidnight,
            timeOfTripType: 'arrival'
        }), expect.anything());
    });

    test('Test with delta', async () => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 1800,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            deltaSeconds: 180,
            deltaIntervalSeconds: 60
        }
        try {
            await TransitAccessibilityMapCalculator.calculate(attributes);
        } catch(e) {
            /* it's normal to fail */
        }
        expect(mockedAccessibilityMap).toHaveBeenCalledTimes(7);
        expect(mockedAccessibilityMap).toHaveBeenCalledWith(expect.objectContaining({
            timeOfTrip: defaultAttributes.arrivalTimeSecondsSinceMidnight,
        }), expect.anything());
        let countChecks = 0;
        for (let time = defaultAttributes.arrivalTimeSecondsSinceMidnight - attributes.deltaSeconds; 
            time <= defaultAttributes.arrivalTimeSecondsSinceMidnight + attributes.deltaSeconds; 
            time += attributes.deltaIntervalSeconds) {
            expect(mockedAccessibilityMap).toHaveBeenCalledWith(expect.objectContaining({
                timeOfTrip: time
            }), expect.anything());
            countChecks++;
        }
        expect(countChecks).toEqual(7);
    });

});

describe('Test accessibility map with results using PostGIS', () => {

    // Create node objects
    const node1Point = { type: 'Point' as const, coordinates: [-73.1, 45] };
    const node2Point = { type: 'Point' as const, coordinates: [-73.2, 45] };
    const node3Point = { type: 'Point' as const, coordinates: [-73.3, 45] };
    const node1 = {
        id: 1,
        geometry: node1Point,
        type: 'Feature' as const,
        properties: {
            id: 'node1uuid',
            code: 'code1',
            routing_radius_meters: 10,
            default_dwell_time_seconds: 20,
            data: {},
            geography: node1Point
        }
    };
    const node2 = {
        id: 2,
        geometry: node2Point,
        type: 'Feature' as const,
        properties: {
            id: 'node2uuid',
            code: 'code2',
            routing_radius_meters: 10,
            default_dwell_time_seconds: 20,
            data: {},
            geography: node2Point
        }
    };
    const node3 = {
        id: 3,
        geometry: node3Point,
        type: 'Feature' as const,
        properties: {
            id: 'node3uuid',
            code: 'code3',
            routing_radius_meters: 10,
            default_dwell_time_seconds: 20,
            data: {},
            geography: node3Point
        }
    };

    beforeEach(() => {
        mockedNodesDbCollection.mockResolvedValue({
            type: 'FeatureCollection' as const,
            features: [node1, node2, node3]
        });

        mockedPlacesPOIsCount.mockResolvedValue({
            accessiblePlacesCountByCategory,
            accessiblePlacesCountByDetailedCategory
        });
    });

    test('Test one polygon with PostGIS single query', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1
        }

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: [{
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node1.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 480
            },
            {
                departureTime: '06:55',
                departureTimeSeconds: 24900,
                id: node2.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 420
            }]
        });

        // Mock the PostGIS response with a simple polygon
        const mockPolygonCoordinates = [
            [
                [-73.05, 45.05],
                [-73.05, 44.95],
                [-72.95, 44.95],
                [-72.95, 45.05],
                [-73.05, 45.05]
            ]
        ];

        const mockTrx = {
            raw: jest.fn()
                .mockResolvedValueOnce({ rows: [] }) // SET work_mem
                .mockResolvedValueOnce({ rows: [] }) // CREATE TEMPORARY TABLE
                .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX
                .mockResolvedValueOnce({ rows: [] }) // ANALYZE
                .mockResolvedValueOnce({
                    rows: [{
                        geometry_json: JSON.stringify({
                            type: 'MultiPolygon',
                            coordinates: mockPolygonCoordinates
                        })
                    }]
                }) // ST_Union query
        };

        mockedKnexTransaction.mockImplementation(async (callback) => {
            return await callback(mockTrx as any);
        });

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        // Verify that PostGIS transaction was called
        expect(mockedKnexTransaction).toHaveBeenCalled();
        // Verify the transaction operations were called
        expect(mockTrx.raw).toHaveBeenCalledTimes(5);
        // Verify the first call is setting work_mem
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining('SET LOCAL work_mem')
        );
        // Verify temporary table creation
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining('CREATE TEMPORARY TABLE ??'),
            expect.arrayContaining([expect.stringMatching(/^temp_circles_/)])

        );
        // Verify spatial index creation
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining('CREATE INDEX ??'),
            expect.any(Array)
        );
        // Verify the ST_Union query
        expect(mockTrx.raw).toHaveBeenCalledWith(
            expect.stringContaining('ST_Union'),
            expect.any(Array)
        );
        // Verify nodes were queried
        expect(mockedNodesDbCollection).toHaveBeenCalledWith({
            nodeIds: [node1.properties.id, node2.properties.id]
        });
        // Verify the result structure
        expect(result.polygons.features).toHaveLength(1);
        expect(result.polygons.features[0].geometry.coordinates).toEqual(mockPolygonCoordinates);
    });

    test('Test multiple polygons with different durations using PostGIS', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 1200,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1,
            numberOfPolygons: 2  // Generate 2 polygons
        }

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: [{
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node1.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 480
            },
            {
                departureTime: '06:55',
                departureTimeSeconds: 24900,
                id: node2.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 720
            }]
        });

        // Mock PostGIS responses for multiple polygons (900s and 600s)
        const largerPolygonCoordinates = [
            [
                [-73.1, 45.1],
                [-73.1, 44.9],
                [-72.9, 44.9],
                [-72.9, 45.1],
                [-73.1, 45.1]
            ]
        ];

        const smallerPolygonCoordinates = [
            [
                [-73.05, 45.05],
                [-73.05, 44.95],
                [-72.95, 44.95],
                [-72.95, 45.05],
                [-73.05, 45.05]
            ]
        ];

        let callCount = 0;
        const mockTrx = {
            raw: jest.fn().mockImplementation(() => {
                callCount++;
                // Every 5th call returns polygon data (after setup queries)
                if (callCount % 5 === 0) {
                    const coords = callCount === 5 ? largerPolygonCoordinates : smallerPolygonCoordinates;
                    return Promise.resolve({
                        rows: [{
                            geometry_json: JSON.stringify({
                                type: 'MultiPolygon',
                                coordinates: coords
                            })
                        }]
                    });
                }
                return Promise.resolve({ rows: [] });
            })
        };

        mockedKnexTransaction.mockImplementation(async (callback) => {
            return await callback(mockTrx as any);
        });

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Should have 2 polygons (900s and 600s)
        expect(result.polygons.features).toHaveLength(2);
        // Verify that PostGIS was called twice (once for each duration)
        expect(mockedKnexTransaction).toHaveBeenCalledTimes(2);
        // Verify the larger polygon (1200s)
        expect(result.polygons.features[0].properties!.durationSeconds).toEqual(1200);
        expect(result.polygons.features[0].geometry.coordinates).toEqual(largerPolygonCoordinates);
        // Verify the smaller polygon (600s)
        expect(result.polygons.features[1].properties!.durationSeconds).toEqual(600);
        expect(result.polygons.features[1].geometry.coordinates).toEqual(smallerPolygonCoordinates);
    });

    test('Test polygon generation with delta using PostGIS', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1,
            deltaSeconds: 300,
            deltaIntervalSeconds: 300
        }

        // Mock responses for 3 time periods
        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: [{
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node3.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 500
            }]
        });

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: [{
                departureTime: '06:55',
                departureTimeSeconds: 24900,
                id: node1.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 250
            },
            {
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node2.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 500
            }]
        });

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: [{
                departureTime: '07:00',
                departureTimeSeconds: 25200,
                id: node1.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 100
            }]
        });

        const mockPolygonCoordinates = [
            [
                [-73.05, 45.05],
                [-73.05, 44.95],
                [-72.95, 44.95],
                [-72.95, 45.05],
                [-73.05, 45.05]
            ]
        ];

        const mockTrx = {
            raw: jest.fn()
                .mockResolvedValueOnce({ rows: [] }) // SET work_mem
                .mockResolvedValueOnce({ rows: [] }) // CREATE TEMPORARY TABLE
                .mockResolvedValueOnce({ rows: [] }) // CREATE INDEX
                .mockResolvedValueOnce({ rows: [] }) // ANALYZE
                .mockResolvedValueOnce({
                    rows: [{
                        geometry_json: JSON.stringify({
                                type: 'MultiPolygon',
                                coordinates: mockPolygonCoordinates
                            })
                    }]
                })
        };

        mockedKnexTransaction.mockImplementation(async (callback) => {
            return await callback(mockTrx as any);
        });

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Verify accessibility map was called 3 times (delta creates 3 time points)
        expect(mockedAccessibilityMap).toHaveBeenCalledTimes(3);
        // Verify nodes were queried with the combined node IDs from all delta calculations
        expect(mockedNodesDbCollection).toHaveBeenCalledWith({
            nodeIds: expect.arrayContaining([node1.properties.id, node2.properties.id, node3.properties.id])
        });
        // Verify PostGIS transaction was called
        expect(mockedKnexTransaction).toHaveBeenCalled();
        // Result should contain the polygon
        expect(result.polygons.features).toHaveLength(1);
    });

    test('Test empty nodes result with PostGIS', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1
        }

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: []
        });

        // Mock PostGIS response for origin circle only
        const originCircleCoordinates = [
            [
                [-73.02, 45.02],
                [-73.02, 44.98],
                [-72.98, 44.98],
                [-72.98, 45.02],
                [-73.02, 45.02]
            ]
        ];

        const mockTrx = {
            raw: jest.fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [{
                        geometry_json: JSON.stringify({
                                type: 'MultiPolygon',
                                coordinates: originCircleCoordinates
                            })
                    }]
                })
        };

        mockedKnexTransaction.mockImplementation(async (callback) => {
            return await callback(mockTrx as any);
        });

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Should still have a polygon (just the origin circle)
        expect(result.polygons.features).toHaveLength(1);
        // Verify PostGIS was called even with no nodes
        expect(mockedKnexTransaction).toHaveBeenCalled();
        // Nodes collection should be called with empty array
        expect(mockedNodesDbCollection).toHaveBeenCalledWith({ nodeIds: [] });
    });

    test('Test PostGIS error handling', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1
        }

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: [{
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node1.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 480
            }]
        });

        // Mock a PostGIS error
        const mockError = new Error('PostGIS query failed');
        mockedKnexTransaction.mockRejectedValue(mockError);

        await expect(TransitAccessibilityMapCalculator.calculateWithPolygons(attributes))
            .rejects.toThrow('PostGIS query failed');
    });

    test('Test circles array construction with varying node distances', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 900,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1.5
        }

        // Mock nodes with different travel times
        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: [{
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node1.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 300 // 600s remaining
            },
            {
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node2.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 600 // 300s remaining
            },
            {
                departureTime: '06:52',
                departureTimeSeconds: 24720,
                id: node3.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 900 // 0s remaining - should not generate circle
            }]
        });

        const mockPolygonCoordinates = [];

        const mockTrx = {
            raw: jest.fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [{
                        geometry_json: JSON.stringify({
                            type: 'MultiPolygon',
                            coordinates: mockPolygonCoordinates
                        })
                    }]
                })
        };

        mockedKnexTransaction.mockImplementation(async (callback) => {
            return await callback(mockTrx as any);
        });

        await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Verify the CREATE TEMPORARY TABLE call includes correct number of circles
        // Should have 3 circles: origin + node1 + node2 (node3 has 0 remaining distance)
        const createTableCall = mockTrx.raw.mock.calls.find(call =>
            call[0].includes('CREATE TEMPORARY TABLE')
        );
        expect(createTableCall).toBeDefined();

        // The SQL should contain 3 value tuples (origin, node1, node2)
        const sql = createTableCall![0];
        const valueMatches = sql.match(/ST_SetSRID\(ST_MakePoint/g);
        expect(valueMatches).toHaveLength(3);
    });
});

describe('Test PostGIS integration edge cases', () => {

    test('Test unique table name generation', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            walkingSpeedMps: 1
        }

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: []
        });

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: []
        });

        const capturedTableNames: string[] = [];
        const mockTrx = {
            raw: jest.fn().mockImplementation((sql: string, bindings?: any[]) => {
                // Capture table names from CREATE TEMPORARY TABLE statements
                if (sql.includes('CREATE TEMPORARY TABLE ??') && bindings && bindings[0]) {
                    capturedTableNames.push(bindings[0]);
                }

                if (sql.includes('ST_AsGeoJSON')) {
                    return Promise.resolve({
                        rows: [{
                            geometry_json: JSON.stringify({
                                type: 'MultiPolygon',
                                coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]]
                            })
                        }]
                    });
                }
                return Promise.resolve({ rows: [] });

            })
        };

        mockedKnexTransaction.mockImplementation(async (callback) => {
            return await callback(mockTrx as any);
        });

        // Call twice to verify unique table names
        await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Verify we captured table names and they are different
        expect(capturedTableNames).toHaveLength(2);
        expect(capturedTableNames[0]).not.toEqual(capturedTableNames[1]);
        expect(capturedTableNames[0]).toMatch(/^temp_circles_[a-f0-9_]{16}$/);
        expect(capturedTableNames[1]).toMatch(/^temp_circles_[a-f0-9_]{16}$/);
    });

    test('Test work_mem configuration', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            walkingSpeedMps: 1
        }

        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: []
        });

        const mockTrx = {
            raw: jest.fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ geometry: { coordinates: [] } }] })
        };

        mockedKnexTransaction.mockImplementation(async (callback) => {
            return await callback(mockTrx as any);
        });

        await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Verify work_mem was set
        const workMemCall = mockTrx.raw.mock.calls[0][0];
        expect(workMemCall).toContain('SET LOCAL work_mem');
        expect(workMemCall).toContain('20MB');
        expect(workMemCall).toContain('maintenance_work_mem');
        expect(workMemCall).toContain('20MB');
    });
});
