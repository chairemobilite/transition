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
import  { clipPolygon } from '../../../models/db/geometryUtils.db.queries';

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

jest.mock('../../../models/db/geometryUtils.db.queries', () => ({
    clipPolygon: jest.fn()
}));
const mockedGeometryUtilsDbClipPolygon = clipPolygon as jest.MockedFunction<typeof clipPolygon>;


beforeEach(() => {
    jest.clearAllMocks();
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

    test('Test one polygon, 2 nodes, with additional properties and POIs', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1,
            calculatePois: true
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

        mockedGeometryUtilsDbClipPolygon.mockResolvedValue(mockPolygonCoordinates);

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        // Verify that PostGIS transaction was called
        expect(mockedGeometryUtilsDbClipPolygon).toHaveBeenCalled();

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
            numberOfPolygons: 2,  // Generate 2 polygons,
            calculatePois: false
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

        mockedGeometryUtilsDbClipPolygon.mockResolvedValueOnce(largerPolygonCoordinates);
        mockedGeometryUtilsDbClipPolygon.mockResolvedValueOnce(smallerPolygonCoordinates);

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Should have 2 polygons (900s and 600s)
        expect(result.polygons.features).toHaveLength(2);
        // Verify that PostGIS was called twice (once for each duration)
        expect(mockedGeometryUtilsDbClipPolygon).toHaveBeenCalledTimes(2);
        // Verify the larger polygon (1200s)
        expect(result.polygons.features[0].properties!.durationSeconds).toEqual(1200);
        expect(result.polygons.features[0].geometry.coordinates).toEqual(largerPolygonCoordinates);
        // Verify the smaller polygon (600s)
        expect(result.polygons.features[1].properties!.durationSeconds).toEqual(600);
        expect(result.polygons.features[1].geometry.coordinates).toEqual(smallerPolygonCoordinates);

        //Test that we get no POIs when calculatePois is explicitly set to false in the attributes
        expect(mockedPlacesPOIsCount).toHaveBeenCalledTimes(0);
        const polygonProperties = result.polygons.features[0].properties!;
        expect(polygonProperties.accessiblePlacesCountByCategory).toBeUndefined();
        expect(polygonProperties.accessiblePlacesCountByDetailedCategory).toBeUndefined();
        expect(polygonProperties.cat_education).toBeUndefined();
        expect(polygonProperties.catDet_school_secondary).toBeUndefined();
        expect(polygonProperties.catDet_school_university).toBeUndefined();
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

        mockedGeometryUtilsDbClipPolygon.mockResolvedValue(mockPolygonCoordinates);

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Verify accessibility map was called 3 times (delta creates 3 time points)
        expect(mockedAccessibilityMap).toHaveBeenCalledTimes(3);
        // Verify nodes were queried with the combined node IDs from all delta calculations
        expect(mockedNodesDbCollection).toHaveBeenCalledWith({
            nodeIds: expect.arrayContaining([node1.properties.id, node2.properties.id, node3.properties.id])
        });
        // Verify PostGIS transaction was called
        expect(mockedGeometryUtilsDbClipPolygon).toHaveBeenCalled();
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

        mockedGeometryUtilsDbClipPolygon.mockResolvedValue(originCircleCoordinates);

        const result: TransitAccessibilityMapWithPolygonResult = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);

        // Should still have a polygon (just the origin circle)
        expect(result.polygons.features).toHaveLength(1);
        // Verify PostGIS was called even with no nodes
        expect(mockedGeometryUtilsDbClipPolygon).toHaveBeenCalled();
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
        mockedGeometryUtilsDbClipPolygon.mockRejectedValue(mockError);

        await expect(TransitAccessibilityMapCalculator.calculateWithPolygons(attributes))
            .rejects.toThrow('PostGIS query failed');
    });

    test('Test circles array construction with varying node distances', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 900,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 1000, // Ensure is higher than the highest value
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

        mockedGeometryUtilsDbClipPolygon.mockResolvedValue(mockPolygonCoordinates);

        await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        
        // Verify clipPolygon was called with circles for nodes with remaining time
        expect(mockedGeometryUtilsDbClipPolygon).toHaveBeenCalledWith(
            expect.arrayContaining([
                // Origin circle (900s * 1.5 m/s = 1350m = 1.35 km, but capped to 1000s * 1.5 = 1.5 km)
                expect.objectContaining({
                    center: [defaultAttributes.locationGeojson.geometry.coordinates[0], defaultAttributes.locationGeojson.geometry.coordinates[1]],
                    radiusKm: 1.35 // min(900 * 1.5, 1000 * 1.5) / 1000
                }),
                // Node 1: 600s remaining * 1.5 m/s = 900m
                expect.objectContaining({
                    center: [node1Point.coordinates[0], node1Point.coordinates[1]],
                    radiusKm: 0.9
                }),
                // Node 2: 300s remaining * 1.5 m/s = 450m
                expect.objectContaining({
                    center: [node2Point.coordinates[0], node2Point.coordinates[1]],
                    radiusKm: 0.45
                })
                // Node 3: 0s remaining - excluded
            ])
        );
    });
});
