/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { circle as turfCircle } from '@turf/turf';
import transitRoutingService from 'chaire-lib-backend/lib/services/transitRouting/TransitRoutingService';
import { TestUtils } from 'chaire-lib-common/lib/test';
import {
    categories,
    detailedCategories,
    PlaceCategory,
    PlaceDetailedCategory
} from 'chaire-lib-common/lib/config/osm/osmMappingDetailedCategoryToCategory';
import polygonClipping from 'polygon-clipping';

import { TransitAccessibilityMapCalculator } from '../TransitAccessibilityMapCalculator';
import nodesDbQueries from '../../../models/db/transitNodes.db.queries';
import placesDbQueries from '../../../models/db/places.db.queries';

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

describe('Test accessibility map with results', () => {

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
    mockedNodesDbCollection.mockResolvedValue({ type: 'FeatureCollection', features: [ node1, node2, node3 ] });
    mockedPlacesPOIsCount.mockResolvedValue({accessiblePlacesCountByCategory, accessiblePlacesCountByDetailedCategory})

    test('Test one polygon, 2 nodes, with additional properties', async() => {
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
        const maxWalkingDistanceKm = Math.floor(attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000;
        const expectedMultiPolygons = [ 
            turfCircle(node2Point.coordinates, ((attributes.maxTotalTravelTimeSeconds - 500) * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(node1Point.coordinates, (attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(attributes.locationGeojson, maxWalkingDistanceKm, { units: 'kilometers', steps: 64 }).geometry.coordinates
        ]
        const additionalProperties = { test: 'this is a test', other: 3 };
        const accessibilityPolygon = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes, { additionalProperties });
        // Test that there is one polygon, with 2 disjoint circles
        const polygons = accessibilityPolygon.polygons;
        expect(polygons.features.length).toEqual(1);
        const multiPolygonCoord = polygons.features[0].geometry.coordinates;
        expect(multiPolygonCoord.length).toEqual(3);
        for (let i = 0; i < 2; i++) {
            const actual = multiPolygonCoord[i][0];
            const expected = expectedMultiPolygons[i][0];
            const actualString = actual.toString();
            expect(actual.length).toEqual(expected.length);
            for (let j = 0; j < actual.length; j++) {
                expect(actualString).toContain(expected[j].toString());
            }
        }
        const polygonProperties = polygons.features[0].properties;
        expect(polygonProperties).toBeDefined();
        expect(polygonProperties?.scenarioId).toEqual(defaultAttributes.scenarioId);
        expect(polygonProperties?.arrivalTimeSecondsSinceMidnight).toEqual(defaultAttributes.arrivalTimeSecondsSinceMidnight);
        expect(polygonProperties).toEqual(expect.objectContaining(additionalProperties));

        expect(mockedPlacesPOIsCount).toHaveBeenCalledTimes(1);
        expect(mockedPlacesPOIsCount).toHaveBeenCalledWith(polygons.features[0].geometry);
        expect(polygonProperties?.accessiblePlacesCountByCategory).toEqual(accessiblePlacesCountByCategory);
        expect(polygonProperties?.accessiblePlacesCountByDetailedCategory).toEqual(accessiblePlacesCountByDetailedCategory);
        expect(polygonProperties?.cat_education).toEqual(10);
        expect(polygonProperties?.catDet_school_secondary).toEqual(6);
        expect(polygonProperties?.catDet_school_university).toEqual(4);
    });

    test('Test one polygon, 2 nodes, different walking speed', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 2
        }
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
        const maxWalkingDistanceKm = Math.floor(attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000;
        const expectedMultiPolygons = [ 
            turfCircle(node2Point.coordinates, ((attributes.maxTotalTravelTimeSeconds - 500) * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(node1Point.coordinates, (attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(attributes.locationGeojson, maxWalkingDistanceKm, { units: 'kilometers', steps: 64 }).geometry.coordinates
        ]
        const accessibilityPolygon = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        // Test that there is one polygon, with 2 disjoint circles
        const polygons = accessibilityPolygon.polygons;
        expect(polygons.features.length).toEqual(1);
        const multiPolygonCoord = polygons.features[0].geometry.coordinates;
        const expectedCount = 3;
        expect(multiPolygonCoord.length).toEqual(expectedCount);
        for (let i = 0; i < expectedCount; i++) {
            const actual = multiPolygonCoord[i][0];
            const expected = expectedMultiPolygons[i][0];
            const actualString = actual.toString();
            expect(actual.length).toEqual(expected.length);
            for (let j = 0; j < actual.length; j++) {
                expect(actualString).toContain(expected[j].toString());
            }
        }
    });

    test('Test 2 polygons, 2 nodes', async() => {
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1,
            numberOfPolygons: 2
        }
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
        const maxWalkingDistanceKm = Math.floor(attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000;
        const expectedMultiPolygonsTotal = [ 
            turfCircle(node2Point.coordinates, ((attributes.maxTotalTravelTimeSeconds - 500) * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(node1Point.coordinates, (attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(attributes.locationGeojson, maxWalkingDistanceKm, { units: 'kilometers', steps: 64 }).geometry.coordinates
        ];
        const expectedSmallerPolygon = [ 
            turfCircle(node1Point.coordinates, (50 * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(attributes.locationGeojson, maxWalkingDistanceKm, { units: 'kilometers', steps: 64 }).geometry.coordinates
        ];
        const accessibilityPolygon = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        // Test that there is one polygon, with 2 disjoint circles
        const polygons = accessibilityPolygon.polygons;
        expect(polygons.features.length).toEqual(2);

        // Validate the larger polygon
        const multiPolygonCoord = polygons.features[0].geometry.coordinates;
        const expectedCount = 3;
        expect(multiPolygonCoord.length).toEqual(expectedCount);
        for (let i = 0; i < expectedCount; i++) {
            const actual = multiPolygonCoord[i][0];
            const expected = expectedMultiPolygonsTotal[i][0];
            const actualString = actual.toString();
            expect(actual.length).toEqual(expected.length);
            for (let j = 0; j < actual.length; j++) {
                expect(actualString).toContain(expected[j].toString());
            }
        }

        // Validate the second smaller polygon
        const smallerPolygonCoord = polygons.features[1].geometry.coordinates;
        expect(smallerPolygonCoord.length).toEqual(2);
        for (let i = 0; i < 2; i++) {
            const actual = smallerPolygonCoord[i][0];
            const expected = expectedSmallerPolygon[i][0];
            const actualString = actual.toString();
            expect(actual.length).toEqual(expected.length);
            for (let j = 0; j < actual.length; j++) {
                expect(actualString).toContain(expected[j].toString());
            }
        }
        expect(mockedNodesDbCollection).toHaveBeenCalledWith({ nodeIds: [ node1.properties.id, node2.properties.id ] });
    });

    test('Test one polygon, with delta', async() => {
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
                totalTravelTimeSeconds: 250
            },
            {
                departureTime: '06:57',
                departureTimeSeconds: 25020,
                id: node2.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 500
            }]
        });
        const maxWalkingDistanceKm = Math.floor(attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000;
        const expectedMultiPolygonsTotal = [ 
            turfCircle(node3Point.coordinates, Math.floor(((attributes.maxTotalTravelTimeSeconds - 500) / 3) * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(node2Point.coordinates, Math.floor(((attributes.maxTotalTravelTimeSeconds - 500) * 2 / 3) * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(node1Point.coordinates, (attributes.maxAccessEgressTravelTimeSeconds * attributes.walkingSpeedMps) / 1000, { units: 'kilometers', steps: 64 }).geometry.coordinates,
            turfCircle(attributes.locationGeojson, maxWalkingDistanceKm, { units: 'kilometers', steps: 64 }).geometry.coordinates
        ];
        const accessibilityPolygon = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        // Test that there is one polygon, with 2 disjoint circles
        const polygons = accessibilityPolygon.polygons;
        expect(polygons.features.length).toEqual(1);

        // Validate the larger polygon
        const multiPolygonCoord = polygons.features[0].geometry.coordinates;
        const expecteCount = 4;
        expect(multiPolygonCoord.length).toEqual(expecteCount);
        for (let i = 0; i < expecteCount; i++) {
            const actual = multiPolygonCoord[i][0];
            const expected = expectedMultiPolygonsTotal[i][0];
            const actualString = actual.toString();
            expect(actual.length).toEqual(expected.length);
            for (let j = 0; j < actual.length; j++) {
                expect(actualString).toContain(expected[j].toString());
            }
        }

    });

    test('Test one polygon, split of polygon clipping', async() => {
        // The polygon clipping code, when the number of nodes is higher than
        // 20, is split in pieces. It should return properly
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1
        }
        const testNodes = Array(50).fill(1).map((_, index) => {
            const geometry = { type: 'Point' as const, coordinates: [ -73 + index / 100, 45 + index / 100] };
            const node = {
                id: 3,
                geometry: geometry,
                type: 'Feature' as const,
                properties: {
                    id: `tempuuid${index}`,
                    code: `tempcode${index}`,
                    routing_radius_meters: 10,
                    default_dwell_time_seconds: 20,
                    data: {},
                    geography: geometry
                }
            };
            return node;
        })
        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: testNodes.map((node) => ({
                departureTime: '06:55',
                departureTimeSeconds: 24900,
                id: node.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 250
            }))
        });
        mockedNodesDbCollection.mockResolvedValueOnce({ type: 'FeatureCollection', features: testNodes });
        const accessibilityPolygon = await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        // Test that there is one polygon, with 2 disjoint circles
        const polygons = accessibilityPolygon.polygons;
        expect(polygons.features.length).toEqual(1);
        expect(mockedNodesDbCollection).toHaveBeenCalledWith({ nodeIds: testNodes.map(node => node.properties.id) });
    });

    test('Test one polygon, error in polygon clipping', async() => {
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
        let error: any = undefined;
        const polygonClippingUnion = jest.spyOn(polygonClipping, 'union').mockImplementation(() => { throw 'error in polygon clipping'; });

        try {
            await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        } catch (err) {
            error = err;
        } finally {
            polygonClippingUnion.mockRestore();
        }
        expect(error).toBeDefined();
    });

    test('Test one polygon, error in polygon clipping split', async() => {
        // The polygon clipping code, when the number of nodes is higher than
        // 20, is split in pieces. Make sure an error in one piece returns as
        // expected
        const attributes = {
            ...defaultAttributes,
            maxTotalTravelTimeSeconds: 600,
            minWaitingTimeSeconds: 120,
            maxAccessEgressTravelTimeSeconds: 180,
            maxTransferTravelTimeSeconds: 120,
            walkingSpeedMps: 1
        }
        const testNodes = Array(50).fill(1).map((_, index) => {
            const geometry = { type: 'Point' as const, coordinates: [ -73 + index / 100, 45 + index / 100] };
            const node = {
                id: 3,
                geometry: geometry,
                type: 'Feature' as const,
                properties: {
                    id: `tempuuid${index}`,
                    code: `tempcode${index}`,
                    routing_radius_meters: 10,
                    default_dwell_time_seconds: 20,
                    data: {},
                    geography: geometry
                }
            };
            return node;
        });
        mockedNodesDbCollection.mockResolvedValueOnce({ type: 'FeatureCollection', features: testNodes});
        mockedAccessibilityMap.mockResolvedValueOnce({
            type: 'nodes',
            nodes: testNodes.map((node) => ({
                departureTime: '06:55',
                departureTimeSeconds: 24900,
                id: node.properties.id,
                numberOfTransfers: 0,
                totalTravelTimeSeconds: 250
            }))
        });
        let error: any = undefined;
        const polygonClippingUnion = jest.spyOn(polygonClipping, 'union');
        // First time, just return something
        polygonClippingUnion.mockImplementationOnce(() => [[[[-73, 45], [-73.1, 45.1]]]]);
        polygonClippingUnion.mockImplementationOnce(() => { throw 'error in polygon clipping'; })

        try {
            await TransitAccessibilityMapCalculator.calculateWithPolygons(attributes);
        } catch (err) {
            error = err;
        } finally {
            polygonClippingUnion.mockRestore();
        }
        console.log(error);
        expect(error).toBeDefined();
        expect(mockedNodesDbCollection).toHaveBeenCalledWith({ nodeIds: testNodes.map(node => node.properties.id) });
    });

    test('Test get map comparison with simple polygons', async () => {
        // Test that the map comparison function works correctly using two simple square geoJSONs that intersect halfway through each other.
        const polygon1: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon> = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "coordinates": [
                        [
                            [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
                        ]
                    ],
                    "type": "MultiPolygon"
                }
            }]
        };

        const polygon2: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon> = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "coordinates": [
                        [
                            [[0, 0.5], [1, 0.5], [1, 1.5], [0, 1.5], [0, 0.5]]
                        ]
                    ],
                    "type": "MultiPolygon"
                }
            }]
        };

        const colors = {
            intersectionColor: 'intersectionColor',
            scenario1Minus2Color: 'scenario1Minus2Color',
            scenario2Minus1Color: 'scenario2Minus1Color'
        }

        const comparison = await TransitAccessibilityMapCalculator.getMapComparison(polygon1, polygon2, 1, colors);

        const expectedIntersection = [[0, 0.5], [1, 0.5], [1, 1], [0, 1], [0, 0.5]];

        const expectedScenario1Minus2 = [[0, 0], [1, 0], [1, 0.5], [0, 0.5], [0, 0]];

        const expectedScenario2Minus1 = [[0, 1], [1, 1], [1, 1.5], [0, 1.5], [0, 1]];

        expect(comparison).toHaveLength(1);

        expect(comparison[0].polygons.intersection[0].geometry.coordinates[0]).toEqual(expectedIntersection);
        expect(comparison[0].strokes.intersection[0].geometry.coordinates[0]).toEqual(expectedIntersection);
        expect(comparison[0].polygons.intersection[0].properties!.color).toEqual(colors.intersectionColor);

        expect(comparison[0].polygons.scenario1Minus2[0].geometry.coordinates[0]).toEqual(expectedScenario1Minus2);
        expect(comparison[0].strokes.scenario1Minus2[0].geometry.coordinates[0]).toEqual(expectedScenario1Minus2);
        expect(comparison[0].polygons.scenario1Minus2[0].properties!.color).toEqual(colors.scenario1Minus2Color);

        expect(comparison[0].polygons.scenario2Minus1[0].geometry.coordinates[0]).toEqual(expectedScenario2Minus1);
        expect(comparison[0].strokes.scenario2Minus1[0].geometry.coordinates[0]).toEqual(expectedScenario2Minus1);
        expect(comparison[0].polygons.scenario2Minus1[0].properties!.color).toEqual(colors.scenario2Minus1Color);
    });

    test('Test get polygon strokes with simple polygons', async () => {
        // Test that the map comparison function works correctly using a simple polygon with a hole in the middle.
        const polygon: GeoJSON.Feature<GeoJSON.MultiPolygon> = {
                "type": "Feature",
                "properties": {},
                "geometry": {
                    "coordinates": [
                        [
                            [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
                            [[1, 1], [9, 1], [9, 9], [1, 9], [1, 1]]
                        ]
                    ],
                    "type": "MultiPolygon"
                }
        };

        const strokes = TransitAccessibilityMapCalculator['getPolygonStrokes'](polygon);

        const expectedStrokes = [
            [[1, 1], [9, 1], [9, 9], [1, 9], [1, 1]],
            [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
        ];

        expect(strokes.geometry.type).toEqual('MultiLineString');
        expect(strokes.geometry.coordinates).toHaveLength(2);
        expect(strokes.geometry.coordinates).toEqual(expectedStrokes);
    });
});
